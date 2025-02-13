import { APIGatewayProxyHandler } from 'aws-lambda';
import mongoose from 'mongoose';
type ObjectId = mongoose.Types.ObjectId;
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import { InternalConsumption } from '@evara-backend/core/models/pharmacyDashboard/InternalConsumption';
import { PharmacyStock } from '@evara-backend/core/models/pharmacyDashboard/PharmacyStock';
import { DrugItem } from '@evara-backend/core/models/pharmacyDashboard/DrugItem';
import { User } from '@evara-backend/core/models/User';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import { extractAuthorizerDetails } from '@evara-backend/core/src/lib/utils/extractAuthorizerDetails';
import { processInternalConsumptionReportData } from './processInternalConsumptionForReport';
import SNSService from '@evara-backend/core/lib/aws/sns';
import Branch from '@evara-backend/core/models/mastersDashboard/global/ClinicBranches';
import { TaxRate } from '@evara-backend/core/models/pharmacyDashboard/TaxRate';

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const conn = await connectMongoDb();
  const session = await conn.startSession();
  session.startTransaction();

  try {
    console.log('🔹 Starting Internal Consumption Process');

    const auth = extractAuthorizerDetails(event);
    if (!auth) throw new ErrorMessage(401, 'Unauthorized');

    if (!event.body) throw new ErrorMessage(400, 'Data is required');
    const { items, date } = JSON.parse(event.body);
    if (!items?.length) throw new ErrorMessage(400, 'Items are required');

    console.log('📌 Received Items:', JSON.stringify(items, null, 2));

    const branchId = auth.branchId;
    const clinicId = auth.clinicId;

    // 🔹 Fetch all PharmacyStock items
    console.log('🔹 Fetching Stock Data');
    const stockIds = items.map(i => i.item);
    const stocks = await PharmacyStock.find({
      _id: { $in: stockIds },
      clinicId,
    })
      .populate('item', 'name hsnCode mrp taxRate') // Get item details including taxRate ID
      .lean();

    if (!stocks.length) throw new ErrorMessage(404, 'Stock items not found');

    // 🔹 Extract tax rate IDs from stocks
    const taxRateIds = stocks.map(s => s.item.taxRate).filter(Boolean); // Remove null values

    console.log('🔹 Tax Rate IDs:', taxRateIds);

    // 🔹 Fetch actual tax rate values from TaxRate model
    const taxRates = await TaxRate.find({
      _id: { $in: taxRateIds },
    })
      .select('taxRate')
      .lean();

    console.log('📌 Fetched Tax Rates:', JSON.stringify(taxRates, null, 2));

    // 🔹 Create a Map for quick lookup of tax rates
    const taxRateMap = new Map(
      taxRates.map(tr => [tr._id.toString(), tr.taxRate]),
    );

    // 🔹 Fetch DrugItem details from stock items
    const drugIds = stocks.map(s => s.item._id);
    const drugs = await DrugItem.find({ _id: { $in: drugIds } }).lean();

    if (!drugs.length) throw new ErrorMessage(404, 'Drug items not found');
    console.log('📌 Fetched Drugs:', JSON.stringify(drugs, null, 2));

    // 🔹 Attach correct tax rates to stocks
    stocks.forEach(stock => {
      const taxRateId = stock.item.taxRate?.toString();
      stock.item.taxRate = taxRateMap.get(taxRateId) || 0; // Default to 0 if not found
    });

    console.log(
      '📌 Updated Stocks with Tax Rates:',
      JSON.stringify(stocks, null, 2),
    );

    // 🔹 Create lookup maps
    const stockMap = new Map(stocks.map(s => [s._id.toString(), s]));
    const drugMap = new Map(drugs.map(d => [d._id.toString(), d]));

    console.log('🔹 Processing Items & Updating Stock');

    // 🔹 Process each item and update stock
    for (const item of items) {
      const { item: stockItem, quantity, transferFrom } = item;
      const stock = stockMap.get(stockItem);
      if (!stock)
        throw new ErrorMessage(404, `Stock item ${stockItem} not found`);

      console.log(
        `📌 Processing Stock Item: ${stockItem}, Quantity: ${quantity}`,
      );

      let remainingQuantity = quantity;
      const usedBatches = [];

      for (let batch of stock.batches) {
        for (let location of batch.locations) {
          if (
            (location.location as unknown as ObjectId).equals(
              transferFrom.location,
            )
          ) {
            if (location.quantity >= remainingQuantity) {
              location.quantity -= remainingQuantity;
              usedBatches.push({
                batchId: batch.batchNo,
                deductedQuantity: remainingQuantity,
              });
              remainingQuantity = 0;
              break;
            } else {
              remainingQuantity -= location.quantity;
              usedBatches.push({
                batchId: batch.batchNo,
                deductedQuantity: location.quantity,
              });
              location.quantity = 0;
            }
          }
        }
        if (remainingQuantity === 0) break;
      }

      if (remainingQuantity > 0)
        throw new ErrorMessage(400, `Insufficient stock for ${stockItem}`);

      await PharmacyStock.updateOne(
        { _id: stockItem },
        { $set: { batches: stock.batches } },
        { session },
      );

      console.log(
        `✅ Updated Stock for ${stockItem}, Used Batches:`,
        usedBatches,
      );
      item.batches = usedBatches;
    }

    // 🔹 Fetch User
    console.log('🔹 Fetching User Data');
    const user = await User.findById(auth.userId).exec();
    if (!user) throw new ErrorMessage(404, 'User not found');

    console.log(`📌 User Found: ${user.username}`);

    // 🔹 Fetch Branch
    console.log('🔹 Fetching Branch Data');
    const branch = await Branch.findOne({
      code: new RegExp(`^${branchId.trim()}\\s*$`, 'i'),
      clinicId,
    }).lean();
    if (!branch) throw new ErrorMessage(404, 'Branch not found');

    console.log(`📌 Branch Found: ${branch.branchName}`);

    // 🔹 Create Internal Consumption
    console.log('🔹 Creating Internal Consumption');
    const internalConsumption = new InternalConsumption({
      items,
      clinicId,
      branchId,
      createdBy: user.username,
      date,
    });
    await internalConsumption.save({ session });

    console.log(
      `✅ Internal Consumption Created: ${internalConsumption.icNumber}`,
    );

    await session.commitTransaction();
    session.endSession();

    // 🔹 Generate Report Data
    // console.log('🔹 Generating Report Data');
    // const reportData = processInternalConsumptionReportData(
    //   internalConsumption,
    //   branch,
    //   stocks,
    //   drugs,
    // );

    // console.log('📌 Report Data:', JSON.stringify(reportData, null, 2));

    // 🔹 Send to SNS for report generation
    // console.log('🔹 Publishing Report Data to SNS');
    // await SNSService.publishMessage({
    //   Message: JSON.stringify(reportData),
    //   TopicArn: process.env.REPORT_HTML_GENERATION_TOPIC_ARN,
    // });

    // console.log('✅ Report Published Successfully');

    return successResponse(
      'Internal Consumption added and Stock updated successfully',
    );
  } catch (error) {
    console.error('❌ Error Handling Internal Consumption:', error);
    await session.abortTransaction();
    session.endSession();
    return errorResponse(error);
  }
};
