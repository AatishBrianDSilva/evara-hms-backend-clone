import { APIGatewayProxyHandler } from 'aws-lambda';
import { connectMongoDb } from '@evara-backend/core/src/lib/db/mongodb';
import ErrorMessage from '@evara-backend/core/src/lib/utils/ErrorMessage';
import errorResponse from '@evara-backend/core/src/lib/utils/errorResponse';
import successResponse from '@evara-backend/core/src/lib/utils/successResponse';
import {
  PatientBilling,
  EPatientBillingStatus,
  EPaymentMethod,
  EPaitentBillingPaymentType,
} from '@evara-backend/core/src/models/patientDashboard/Billings/PatientBilling';
import SNSService from '@evara-backend/core/lib/aws/sns';
import {
  EBuckets,
  EDocumentTypes,
  EReportTemplateTypes,
  IInvoiceData,
  IReportData,
} from '@evara-backend/core/lib/types/global';
import _ from 'lodash';
import { sanitizeInvoiceData } from '@evara-backend/core/lib/utils/sanitizeInvoiceData';
import { format } from 'date-fns';
import { formatToIndianCurrencyFormat } from '@evara-backend/core/lib/utils/formatToIndianCurrencyFormat';
import { extractAuthorizerDetails } from '@evara-backend/core/lib/utils/extractAuthorizerDetails';
import Branch from '@evara-backend/core/models/mastersDashboard/global/ClinicBranches';
import { PatientPharmacy } from '@evara-backend/core/models/patientDashboard/PatientPharmacy';
import mongoose from 'mongoose';
import { PharmacyStock } from '@evara-backend/core/models/pharmacyDashboard/PharmacyStock';
import { DrugItem } from '@evara-backend/core/models/pharmacyDashboard/DrugItem';

interface BillingsData {
  billings: {
    billingId: string;
    payments: {
      amount: number;
      method: EPaymentMethod;
      paymentDate?: string;
      details?: string;
    }[];
  }[];
}

export const main: APIGatewayProxyHandler = async (event, _context) => {
  _context.callbackWaitsForEmptyEventLoop = false;

  const auth = extractAuthorizerDetails(event);
  if (!auth) {
    throw new ErrorMessage(401, 'Unauthorized');
  }

  const conn = await connectMongoDb();

  const session = await conn.startSession();
  session.startTransaction();
  try {
    if (!event.body) {
      throw new ErrorMessage(400, 'Data is required');
    }

    const data: BillingsData = JSON.parse(event.body);

    const results = [];

    for (const { billingId, payments } of data.billings) {
      if (!billingId || !payments) {
        throw new ErrorMessage(
          400,
          'Billing ID and payments are required for each entry',
        );
      }

      const billing = await PatientBilling.findById(billingId).session(session);
      if (!billing) {
        throw new ErrorMessage(404, `Billing not found for ID: ${billingId}`);
      }

      let totalPaid = billing.payments.reduce(
        (acc, payment) => acc + payment.amount,
        0,
      );
      let totalPaymentAttempt = payments.reduce(
        (acc, payment) => acc + payment.amount,
        0,
      );
      let newTotalPaid = totalPaid + totalPaymentAttempt;

      // if (newTotalPaid < billing.grandTotal) {
      //   throw new ErrorMessage(
      //     400,
      //     `Payment insufficient to clear dues for billing ID: ${billingId}`
      //   );
      // }

      if (newTotalPaid > billing.grandTotal) {
        throw new ErrorMessage(
          400,
          `Payment is more than the billing amount for billing ID: ${billingId}`,
        );
      }

      payments.forEach(payment => {
        billing.payments.push({
          amount: payment.amount,
          method: payment.method,
          paymentDate: payment.paymentDate
            ? new Date(payment.paymentDate)
            : new Date(),
          details: payment.details,
          type: EPaitentBillingPaymentType.Payment,
        });
        // console.log("Current Payment", payment);
      });

      console.log('Payments', payments);

      const roundToTwo = (num: number) => Math.round(num * 100) / 100;
      const roundedTotalPaid = roundToTwo(newTotalPaid);
      const roundedGrandTotal = roundToTwo(billing.grandTotal);

      billing.status =
        roundedTotalPaid >= roundedGrandTotal
          ? EPatientBillingStatus.Paid
          : EPatientBillingStatus.Pending;

      // billing.status =
      //   newTotalPaid >= billing.grandTotal
      //     ? EPatientBillingStatus.Paid
      //     : EPatientBillingStatus.Pending;

      // Log the branchId and clinicId extracted from the auth
      const branchId = auth.branchId;
      const clinicId = auth.clinicId;
      console.log('Extracted Branch ID:', branchId);
      console.log('Extracted Clinic ID:', clinicId);

      // Fetch the branch using the branchId and clinicId from the auth details
      const branch = await Branch.findOne({
        code: new RegExp(`^${branchId.trim()}\\s*$`, 'i'),
        clinicId: clinicId,
        isActive: true,
      }).lean();

      if (!branch) {
        console.log('Branch not found');
        throw new ErrorMessage(404, 'Branch not found');
      }

      console.log('Branch found:', branch);

      // console.log('Billing data for report:', billing);
      // console.log('Patient data for report:', data);

      // Generate Report for payment
      if (payments) {
        const report = await processDataForReport(
          payments,
          billingId,
          data,
          billing,
          branch,
        );
        console.log('Report Data: ', JSON.stringify(report, null, 2));

        // Send to SNS
        await SNSService.publishMessage({
          Message: JSON.stringify(report),
          TopicArn: process.env.REPORT_HTML_GENERATION_TOPIC_ARN,
        });
      }

      await billing.save({ session });
      results.push({ billingId: billingId, status: 'Processed' });
    }

    await session.commitTransaction();

    session.endSession();

    return successResponse('All billings processed successfully', results);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    return errorResponse(error);
  }
};

const processDataForReport = async (
  data: any,
  id: string,
  patientData: any,
  billing: any,
  branch: any,
) => {
  const templateType =
    billing.billType === 'Pharmacy'
      ? EReportTemplateTypes.BillPharmacy
      : EReportTemplateTypes.BillOtherServices;

  const reportData: IInvoiceData = {
    bucket: EBuckets.UserReports,
    documentType: EDocumentTypes.Invoice,
    templateType: templateType,
    patient: patientData.patientData,
    clinic: patientData.patientData.clinicId,
    sections: [],
    reportName: '',
    fileName: 'invoice',
    reportId: id,
  };

  let billItems: any;

  if (billing.billType === 'Pharmacy') {
    // Fetch batch number and expiry date for each pharmacy item
    const pharmacyItems = await Promise.all(
      billing.items.map(async (item: any) => {
        try {
          // Ensure serviceId is converted to ObjectId
          const serviceId = new mongoose.Types.ObjectId(item.serviceId);
          const masterServiceId = new mongoose.Types.ObjectId(
            item.masterServiceId,
          );

          // Fetch matching PatientPharmacy document
          const patientPharmacy = await PatientPharmacy.findOne({
            _id: serviceId, // Matching with `_id` in PatientPharmacy
            patient: patientData.patientData.patientId, // Matching with correct patient
          })
            .select('item.details')
            .lean();

          console.log(
            'Fetched PatientPharmacy:',
            JSON.stringify(patientPharmacy, null, 2),
          );

          let batchNumber = 'N/A';
          let expiryDate = 'N/A';

          if (patientPharmacy?.item?.details?.length > 0) {
            const matchedDetail = patientPharmacy.item.details[0]; // Get first batch detail

            batchNumber = matchedDetail.batchNumber || 'N/A';
            expiryDate = matchedDetail.expiryDate
              ? new Date(matchedDetail.expiryDate).toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })
              : 'N/A';
          }

          // 🆕 Fetch HSN Code from PharmacyStock → DrugItem
          let hsnCode = 'N/A';
          const pharmacyStock =
            await PharmacyStock.findById(masterServiceId).lean();
          if (pharmacyStock?.item) {
            const drugItem = await DrugItem.findById(pharmacyStock.item).lean();
            if (drugItem?.hsnCode) {
              hsnCode = drugItem.hsnCode;
            }
          }

          console.log(
            `Resolved batchNumber: ${batchNumber}, expiryDate: ${expiryDate}`,
          );

          return {
            serviceName: item.serviceName,
            serviceType: item.serviceType,
            quantity: item.quantity,
            mrp: parseFloat(
              (
                item.mrpPerUnit +
                (item.mrpPerUnit * item.taxRate) / 100
              ).toFixed(2),
            ),
            value: parseFloat((item.price - item.tax).toFixed(2)),
            discountApplied: item.discount.toFixed(2),
            gst: item.taxRate,
            sgst: (item.tax / 2).toFixed(2),
            cgst: (item.tax / 2).toFixed(2),
            amount: item.total,
            batchNumber,
            expiryDate,
            hsnCode, // ✅ Include HSN Code in final report
          };
        } catch (error) {
          console.error('Error fetching PatientPharmacy:', error);
          return {
            serviceName: item.serviceName,
            serviceType: item.serviceType,
            quantity: item.quantity,
            mrp: parseFloat(
              (
                item.mrpPerUnit +
                (item.mrpPerUnit * item.taxRate) / 100
              ).toFixed(2),
            ),
            value: parseFloat((item.price - item.tax).toFixed(2)),
            gst: item.taxRate,
            sgst: (item.tax / 2).toFixed(2),
            cgst: (item.tax / 2).toFixed(2),
            amount: item.total,
            batchNumber: 'N/A',
            expiryDate: 'N/A',
            hsnCode: 'N/A',
          };
        }
      }),
    );

    billItems = pharmacyItems;
  } else {
    billItems = billing.items.map((item: any) => ({
      serviceName: item.serviceName,
      serviceType: item.serviceType,
      quantity: item.quantity,
      price: item.price,
      amount: item.amount,
      total: item.total,
      CGST: 'N/A',
      SGST: 'N/A',
      MRP: 'N/A',
      tax: 'N/A',
    }));
  }
  const totalAmount = billItems.reduce((sum: number, item: any) => {
    const itemAmount =
      item.amount ||
      (item.price && item.quantity ? item.price * item.quantity : 0);
    return sum + (itemAmount ? parseFloat(itemAmount) : 0);
  }, 0);

  const billDescription = billItems.every(
    (item: any) => item.serviceType === billItems[0].serviceType,
  )
    ? billItems[0].serviceType
    : 'Multiple Services';

  const billDate = new Date(billing.createdAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const billTime = new Date(billing.createdAt).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });

  const calculateAge = (dob: string): number => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  };

  const age = patientData.patientData.dob
    ? calculateAge(patientData.patientData.dob)
    : 'N/A';

  const patientDetails = {
    patientName: `${patientData.patientData.firstName} ${patientData.patientData.lastName}`,
    patientNumber: patientData.patientData.patientId,
    gender: patientData.patientData.gender,
    age: age,
    billDescription: billDescription,
    billNo: billing.billingId,
    billDate: billDate,
    billTime: billTime,
  };

  let branchAddress = 'Address not available';
  if (branch && branch.address) {
    const { street, city, state, zip } = branch.address;
    branchAddress =
      `${street || ''}, ${city || ''}, ${state || ''}, ${zip || ''}`.trim();
  }

  const branchDetails = {
    branchName: branch.branchName || 'N/A',
    Address: branchAddress || 'Address not available',
    Phone: branch.phone || 'N/A',
    Email: branch.email || 'N/A',
  };

  const subTotal = billing.amount || 0;
  const discount = billing.discount || 0;
  const tax = billing.tax || 0;
  const cgst = Math.round((tax / 2) * 100) / 100;
  const sgst = Math.round((tax / 2) * 100) / 100;

  const grandTotal = subTotal - discount + cgst + sgst;

  let summaryContent = {
    subTotal: formatToIndianCurrencyFormat(subTotal),
    discount: formatToIndianCurrencyFormat(discount),
    CGST: formatToIndianCurrencyFormat(cgst),
    SGST: formatToIndianCurrencyFormat(sgst),
    grandTotal: formatToIndianCurrencyFormat(grandTotal),
    paidAmount: formatToIndianCurrencyFormat(billing.totalPaid),
    due: formatToIndianCurrencyFormat(billing.totalDues),
  };

  const sections = [
    {
      title: 'Patient Details',
      showTitle: true,
      isBillDetails: false,
      content: patientDetails,
    },
    {
      title: 'Branch Details',
      showTitle: true,
      isBillDetails: false,
      content: branchDetails,
    },
    {
      title: 'Items',
      showTitle: true,
      isBillDetails: true,
      content: billItems,
    },
    {
      title: 'Summary',
      showTitle: true,
      isBillDetails: false,
      content: summaryContent,
    },
    {
      title: 'License',
      showTitle: false,
      isBillDetails: false,
      content: {
        GSTIN: branch.gstNumber,
        'Drug Licence No': branch.drugLicenceNumber,
      },
    },
  ];

  reportData.reportName = `Invoice ${billing.billingId}`;
  reportData.sections = sanitizeInvoiceData(sections);

  return reportData;
};
