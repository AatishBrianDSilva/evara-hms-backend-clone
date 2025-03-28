import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import {
  PatientBilling,
  IPatientBilling,
} from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';
import { S3KeepPermanently, parseS3Url } from 'src/files/_KeepPermanently';

const round = (num: number) => Math.round(num * 100) / 100;

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  try {
    await connectMongoDb();
    console.log('🔗 Connected to MongoDB');

    if (!event.pathParameters) {
      throw new ErrorMessage(400, 'Path parameters are null');
    }

    const id = event.pathParameters['id'];
    if (!id) {
      throw new ErrorMessage(400, 'Id is not provided');
    }

    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const {
      updates,
    }: {
      updates: Partial<
        Pick<
          IPatientBilling,
          'discount' | 'discountReason' | 'discountFile' | 'discountType'
        >
      >;
    } = JSON.parse(event.body);

    console.log('📥 Received Updates:', updates);

    const updateKeys = Object.keys(updates);
    const allowedUpdates = [
      'discount',
      'discountReason',
      'discountFile',
      'discountType',
    ];
    const isValidUpdate = updateKeys.every(key => allowedUpdates.includes(key));

    if (!isValidUpdate) {
      throw new ErrorMessage(
        400,
        "Invalid update fields. Only 'discount', 'discountReason', 'discountFile', 'discountType' can be updated.",
      );
    }

    const billing = await PatientBilling.findById(id);
    if (!billing) {
      throw new ErrorMessage(404, 'Billing document not found');
    }

    console.log('🧾 Billing document found:', billing.billingId);

    // ------------------------------------------------------------------
    // STEP 1: Identify discount approach (percentage vs amount)
    //         and gather the total MRP (mrpPerUnit * quantity) for ratio.
    // ------------------------------------------------------------------
    const discountType = updates.discountType;
    const discountValue = updates.discount || 0; // in ₹ or %
    let discountInAmount = 0;
    let discountInPercentage = 0;

    // Sum of item MRP = Σ (mrpPerUnit * quantity)
    const totalMRPSum = billing.items.reduce((acc, item) => {
      const itemMRP = (item.mrpPerUnit ?? 0) * (item.quantity ?? 0);
      return acc + itemMRP;
    }, 0);

    if (!billing.items.length || totalMRPSum <= 0) {
      throw new ErrorMessage(400, 'No items found with valid MRP to update.');
    }

    if (discountType === 'percentage') {
      discountInPercentage = Number(discountValue);
      console.log(
        `🧮 Discount Type: Percentage | Value: ${discountInPercentage}%`,
      );
    } else if (discountType === 'amount') {
      discountInAmount = Number(discountValue);
      console.log(`🧮 Discount Type: Amount | Value: ₹${discountInAmount}`);
    }

    // ------------------------------------------------------------------
    // STEP 2: Recalculate each item’s price, discount, and total (with tax)
    // ------------------------------------------------------------------
    let totalDiscount = 0;
    let totalPriceAfterDiscount = 0; // sum of net item prices (pre-tax)
    let totalTax = 0;

    billing.items.forEach((item, index) => {
      // 2a) Base MRP for this item
      const itemMRP = (item.mrpPerUnit ?? 0) * (item.quantity ?? 0);

      // 2b) Calculate item discount
      let itemDiscount = 0;
      if (discountType === 'percentage') {
        itemDiscount = round((itemMRP * discountInPercentage) / 100);
      } else if (discountType === 'amount') {
        const ratio = itemMRP / totalMRPSum;
        itemDiscount = round(discountInAmount * ratio);
      }

      // 2c) Discounted price (before tax)
      const discountedPrice = round(itemMRP - itemDiscount);

      // 2d) Recompute item tax
      let itemTax = 0;
      if (item.taxRate && item.taxRate > 0) {
        itemTax = round((discountedPrice * item.taxRate) / 100);
      }

      // 2e) Final item total
      const itemTotal = round(discountedPrice + itemTax);

      // 2f) Update the item fields
      item.discount = itemDiscount;
      item.price = discountedPrice; // net price (pre-tax)
      item.tax = itemTax;
      item.total = itemTotal;

      console.log(
        `🔧 Item #${index + 1} (${item.serviceName}):
         MRP: ₹${itemMRP},
         Discount: ₹${itemDiscount},
         PriceAfterDiscount: ₹${discountedPrice},
         Tax: ₹${itemTax},
         Total: ₹${itemTotal}`,
      );

      // Accumulate totals
      totalDiscount += itemDiscount;
      totalPriceAfterDiscount += discountedPrice;
      totalTax += itemTax;
    });

    // ------------------------------------------------------------------
    // STEP 3: Update billing-level fields
    // ------------------------------------------------------------------
    billing.discount = round(totalDiscount);
    billing.amount = round(totalPriceAfterDiscount);
    billing.tax = round(totalTax);

    // Recompute discountInPercentage if user used a flat discount approach
    if (discountType === 'percentage') {
      billing.discountInPercentage = discountInPercentage;
    } else {
      // Convert the total discount to a percentage of the total original MRP
      billing.discountInPercentage = round((totalDiscount / totalMRPSum) * 100);
    }

    billing.discountReason = updates.discountReason || '';
    billing.discountFile = updates.discountFile || '';

    // Mark items as modified so Mongoose picks up the nested changes
    billing.markModified('items');
    console.log('✅ Marked billing.items as modified');

    // Save updated billing
    await billing.save();
    console.log('💾 Billing document updated and saved');

    // ------------------------------------------------------------------
    // STEP 4: If discountFile is an S3 link, mark it as permanent
    // ------------------------------------------------------------------
    if (updates.discountFile && updates.discountFile.startsWith('https://')) {
      const s3UrlParts = parseS3Url(updates.discountFile);
      if (s3UrlParts) {
        await S3KeepPermanently(s3UrlParts.bucketName, s3UrlParts.key);
        console.log('📦 Discount file marked for permanent S3 storage');
      }
    }

    // ------------------------------------------------------------------
    // STEP 5: Return success response
    // ------------------------------------------------------------------
    return successResponse('Billing updated successfully', {
      updatedBilling: billing,
    });
  } catch (error) {
    console.error('❌ Error updating billing:', error);
    return errorResponse(error);
  }
};
