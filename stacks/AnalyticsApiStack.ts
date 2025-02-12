import { StackContext, use } from 'sst/constructs';
import { MainStack } from './MainStack';

export const AnalyticsApiStack = ({ stack }: StackContext) => {
  const { api2 } = use(MainStack);

  api2.addRoutes(stack, {
    //Analytics Dashboard
    //Billings
    'GET /analytics/billings/patient-billings':
      'packages/functions/src/analyticsDashboard/billings/patientBillings/get.main',
    'GET /analytics/billings/patient-billings/download':
      'packages/functions/src/analyticsDashboard/billings/patientBillings/download.main',
    'GET /analytics/refundReports':
      'packages/functions/src/analyticsDashboard/billings/getRefundReports.main',
    'GET /analytics/billings/refund-reports/download':
      'packages/functions/src/analyticsDashboard/billings/refundReport/download.main',
    'GET /analytics/billings/revenue-breakup':
      'packages/functions/src/analyticsDashboard/billings/getRevenueBreakup.main',
    'GET /analytics/billings/revenue-breakup/download':
      'packages/functions/src/analyticsDashboard/billings/revenueBreakup/download.main',

    // Treatments-Testing
    'GET /analytics/treatments-testing/investigation-reports':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/getInvestigationReports.main',
    'GET /analytics/treatments-testing/investigation-reports/download':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/investigation/download.main',
    'GET /analytics/treatments-testing/procedure-reports':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/getProcedureReports.main',
    'GET /analytics/treatments-testing/procedure-reports/download':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/procedure/download.main',
    'GET /analytics/treatments-testing/cryo-preservation-reports':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/getCryoPreservationReports.main',
    'GET /analytics/treatments-testing/cryo-preservation-reports/download':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/cryoPreservation/download.main',
    'GET /analytics/treatments-testing/treatment-cycle-reports':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/getTreatmentCycleReports.main',
    'GET /analytics/treatments-testing/treatment-cycle-reports/download':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/treatmentCycle/download.main',
    'GET /analytics/treatments-testing/service-reports':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/getServiceReports.main',
    'GET /analytics/treatments-testing/service-reports/download':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/service/download.main',
    'GET /analytics/treatments-testing/patient-package-reports':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/getPatientPackageReports.main',
    'GET /analytics/treatments-testing/patient-package-reports/download':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/patientPackage/download.main',
    'GET /analytics/treatments-testing/master-package-reports':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/getMasterPackageReports.main',
    'GET /analytics/treatments-testing/master-package-reports/download':
      'packages/functions/src/analyticsDashboard/treatmentsTesting/masterPackage/download.main',

    //Pharmacy
    'GET /analytics/pharmacy/sales-by-schedule':
      'packages/functions/src/analyticsDashboard/pharmacy/getSalesBySchedule.main',
    'GET /analytics/pharmacy/sales-by-schedule/download':
      'packages/functions/src/analyticsDashboard/pharmacy/salesBySchedule/download.main',
    'GET /analytics/pharmacy/drugs-and-vendor':
      'packages/functions/src/analyticsDashboard/pharmacy/getDrugsAndVendor.main',
    'GET /analytics/pharmacy/drugs-and-vendor/download':
      'packages/functions/src/analyticsDashboard/pharmacy/drugsAndVendors/download.main',
    'GET /analytics/pharmacy/expiry-details':
      'packages/functions/src/analyticsDashboard/pharmacy/getExpiryDetails.main',
    'GET /analytics/pharmacy/expiry-details/download':
      'packages/functions/src/analyticsDashboard/pharmacy/expiryDetails/download.main',
    'GET /analytics/pharmacy/internal-consumption':
      'packages/functions/src/analyticsDashboard/pharmacy/getInternalConsumption.main',
    'GET /analytics/pharmacy/internal-consumption/download':
      'packages/functions/src/analyticsDashboard/pharmacy/internalConsumption/download.main',
    'GET /analytics/pharmacy/stock-summary':
      'packages/functions/src/analyticsDashboard/pharmacy/stockSummary/getStockSummary.main',
    'GET /analytics/pharmacy/stock-summary/download':
      'packages/functions/src/analyticsDashboard/pharmacy/stockSummary/downloadStockSummary.main',
    'GET /analytics/pharmacy/patient-return':
      'packages/functions/src/analyticsDashboard/pharmacy/getPatientReturn.main',
    'GET /analytics/pharmacy/patient-return/download':
      'packages/functions/src/analyticsDashboard/pharmacy/patientReturn/download.main',
    'GET /analytics/pharmacy/critical-stocks':
      'packages/functions/src/analyticsDashboard/pharmacy/getCriticalStocks.main',
    'GET /analytics/pharmacy/critical-stocks/download':
      'packages/functions/src/analyticsDashboard/pharmacy/criticalStocks/download.main',
    'GET /analytics/pharmacy/pharmacy-report':
      'packages/functions/src/analyticsDashboard/pharmacy/getPharmacyReport.main',
    'GET /analytics/pharmacy/purchase-order-report':
      'packages/functions/src/analyticsDashboard/pharmacy/getPurchaseOrderReport.main',
  });
};
