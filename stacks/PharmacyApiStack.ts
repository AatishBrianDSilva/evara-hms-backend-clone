import { StackContext, use } from 'sst/constructs';
import { MainStack } from './MainStack';

export function PharmacyApiStack({ stack }: StackContext) {
  const { api } = use(MainStack);

  api.addRoutes(stack, {
    // Pharmacy Dashboard

    // MASTER Start
    // Drug Items
    'POST /pharmacy-dashboard/master/drug-items/add':
      'packages/functions/src/pharmacyDashboard/master/drugItem/addDrugItem.main',
    'GET /pharmacy-dashboard/master/drug-items':
      'packages/functions/src/pharmacyDashboard/master/drugItem/getDrugItems.main',
    'GET /pharmacy-dashboard/master/drug-items/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugItem/getDrugItemById.main',
    'PUT /pharmacy-dashboard/master/drug-items/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugItem/updateDrugItem.main',
    'PATCH /pharmacy-dashboard/master/drug-items/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugItem/deleteDrugItem.main',

    // Drug Categories
    'POST /pharmacy-dashboard/master/drug-categories/add':
      'packages/functions/src/pharmacyDashboard/master/drugCategory/addDrugCategory.main',
    'GET /pharmacy-dashboard/master/drug-categories':
      'packages/functions/src/pharmacyDashboard/master/drugCategory/getDrugCategories.main',
    'GET /pharmacy-dashboard/master/drug-categories/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugCategory/getDrugCategoryById.main',
    'PUT /pharmacy-dashboard/master/drug-categories/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugCategory/updateDrugCategory.main',
    'PATCH /pharmacy-dashboard/master/drug-categories/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugCategory/deleteDrugCategory.main',

    // Drug Types
    'POST /pharmacy-dashboard/master/drug-types/add':
      'packages/functions/src/pharmacyDashboard/master/drugType/addDrugType.main',
    'GET /pharmacy-dashboard/master/drug-types':
      'packages/functions/src/pharmacyDashboard/master/drugType/getDrugTypes.main',
    'GET /pharmacy-dashboard/master/drug-types/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugType/getDrugTypeById.main',
    'PUT /pharmacy-dashboard/master/drug-types/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugType/updateDrugType.main',
    'PATCH /pharmacy-dashboard/master/drug-types/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugType/deleteDrugType.main',

    // Drug Locations
    'POST /pharmacy-dashboard/master/drug-locations/add':
      'packages/functions/src/pharmacyDashboard/master/drugLocation/addDrugLocation.main',
    'GET /pharmacy-dashboard/master/drug-locations':
      'packages/functions/src/pharmacyDashboard/master/drugLocation/getDrugLocations.main',
    'GET /pharmacy-dashboard/master/drug-locations/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugLocation/getDrugLocationById.main',
    'PUT /pharmacy-dashboard/master/drug-locations/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugLocation/updateDrugLocation.main',
    'PATCH /pharmacy-dashboard/master/drug-locations/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugLocation/deleteDrugLocation.main',

    // Drug Manufacturers
    'POST /pharmacy-dashboard/master/drug-manufacturers/add':
      'packages/functions/src/pharmacyDashboard/master/drugManufacturer/addDrugManufacturer.main',
    'GET /pharmacy-dashboard/master/drug-manufacturers':
      'packages/functions/src/pharmacyDashboard/master/drugManufacturer/getDrugManufacturers.main',
    'GET /pharmacy-dashboard/master/drug-manufacturers/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugManufacturer/getDrugManufacturerById.main',
    'PUT /pharmacy-dashboard/master/drug-manufacturers/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugManufacturer/updateDrugManufacturer.main',
    'PATCH /pharmacy-dashboard/master/drug-manufacturers/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugManufacturer/deleteDrugManufacturer.main',

    // Drug vendors
    'POST /pharmacy-dashboard/master/drug-vendors/add':
      'packages/functions/src/pharmacyDashboard/master/drugVendor/addDrugVendor.main',
    'GET /pharmacy-dashboard/master/drug-vendors':
      'packages/functions/src/pharmacyDashboard/master/drugVendor/getDrugVendors.main',
    'GET /pharmacy-dashboard/master/drug-vendors/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugVendor/getDrugVendorById.main',
    'PUT /pharmacy-dashboard/master/drug-vendors/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugVendor/updateDrugVendor.main',
    'PATCH /pharmacy-dashboard/master/drug-vendors/{id}':
      'packages/functions/src/pharmacyDashboard/master/drugVendor/deleteDrugVendor.main',

    // Tax Rates
    'POST /pharmacy-dashboard/master/tax-rates/add':
      'packages/functions/src/pharmacyDashboard/master/taxRate/addTaxRate.main',
    'GET /pharmacy-dashboard/master/tax-rates':
      'packages/functions/src/pharmacyDashboard/master/taxRate/getTaxRates.main',
    'GET /pharmacy-dashboard/master/tax-rates/{id}':
      'packages/functions/src/pharmacyDashboard/master/taxRate/getTaxRateById.main',
    'PUT /pharmacy-dashboard/master/tax-rates/{id}':
      'packages/functions/src/pharmacyDashboard/master/taxRate/updateTaxRate.main',
    'PATCH /pharmacy-dashboard/master/tax-rates/{id}':
      'packages/functions/src/pharmacyDashboard/master/taxRate/deleteTaxRate.main',

    // Master Pharmacy Stock
    // "POST /pharmacy-dashboard/master/stock/add":
    //   "packages/functions/src/pharmacyDashboard/master/pharmacyStock/addPharmacyStock.main",
    // "GET /pharmacy-dashboard/master/stock":
    //   "packages/functions/src/pharmacyDashboard/master/pharmacyStock/getPharmacyStocks.main",
    // "GET /pharmacy-dashboard/master/stock/{id}":
    //   "packages/functions/src/pharmacyDashboard/master/pharmacyStock/getPharmacyStockById.main",
    // "PUT /pharmacy-dashboard/master/stock/{id}":
    //   "packages/functions/src/pharmacyDashboard/master/pharmacyStock/updatePharmacyStock.main",
    // "DELETE /pharmacy-dashboard/master/stock/{id}":
    //   "packages/functions/src/pharmacyDashboard/master/pharmacyStock/deletePharmacyStock.main",
    // Pharmacy Masters End

    // Stocks
    'GET /pharmacy-dashboard/stocks':
      'packages/functions/src/pharmacyDashboard/stocks/getStocks.main',
    'GET /pharmacy-dashboard/stocks/paginate':
      'packages/functions/src/pharmacyDashboard/stocks/getPaginatedStocks.main',
    'GET /pharmacy-dashboard/stocks-by-batch/paginate':
      'packages/functions/src/pharmacyDashboard/stocks/getBatchWisePaginatedStocks.main',
    'GET /pharmacy-dashboard/stocks/{id}':
      'packages/functions/src/pharmacyDashboard/stocks/getStockById.main',
    'GET /pharmacy-dashboard/stocks/location/{id}':
      'packages/functions/src/pharmacyDashboard/stocks/getStocksByLocation.main',
    'GET /pharmacy-dashboard/batchesForStocks':
      'packages/functions/src/pharmacyDashboard/stocks/getBatchesForStocks.main',
    'GET /pharmacy-dashboard/stock-values':
      'packages/functions/src/pharmacyDashboard/stockValues/getStockValues.main',

    // Purchase Orders
    'POST /pharmacy-dashboard/purchase-order/add':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/addPurchaseOrder.main',
    'GET /pharmacy-dashboard/purchase-order':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/getPurchaseOrders.main',
    'GET /pharmacy-dashboard/processed-purchase-order':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/getProcessedPurchaseOrders.main',
    'GET /pharmacy-dashboard/purchase-order/{id}':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/getPurchaseOrderById.main',
    'PUT /pharmacy-dashboard/purchase-order/{id}':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/updatePurchaseOrder.main',
    'PUT /pharmacy-dashboard/purchase-order/draft/{id}':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/editDraftPurchaseOrder.main',
    'DELETE /pharmacy-dashboard/purchase-order/{id}':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/deletePurchaseOrder.main',
    'PUT /pharmacy-dashboard/purchase-order/{id}/status/{status}':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/updateStatusPurchaseOrderSimple.main',
    'PATCH /pharmacy-dashboard/purchase-order/{purchaseOrderId}/update-stock':
      'packages/functions/src/pharmacyDashboard/stocks/updateStockFromPurchaseOrder.main',
    'PATCH /pharmacy-dashboard/purchase-order/{id}/update-partial':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/updatePartiallyProcessedPurchaseOrder.main',
    'PUT /pharmacy-dashboard/purchase-order/{id}/move-to-admin-approval':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/movePurchaseOrderToAdminApproval.main',
    'PUT /pharmacy-dashboard/purchase-order/{id}/rejected-by-admin':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/purchaseOrderAdminRejection.main',
    'PUT /pharmacy-dashboard/purchase-order/{id}/move-partial-po-to-admin-approval':
      'packages/functions/src/pharmacyDashboard/purchaseOrder/movePartialPurchaseOrderToAdminApproval.main',

    //Internal Orders
    'POST /pharmacy-dashboard/internal-order/create-draft':
      'packages/functions/src/pharmacyDashboard/internalOrder/createInternalOrderDraft.main',
    'PATCH /pharmacy-dashboard/internal-order/{id}/approve':
      'packages/functions/src/pharmacyDashboard/internalOrder/approveInternalOrderDraft.main',
    'PATCH /pharmacy-dashboard/internal-order/{id}/reject':
      'packages/functions/src/pharmacyDashboard/internalOrder/rejectInternalOrderDraft.main',
    'PATCH /pharmacy-dashboard/internal-order/{id}/process':
      'packages/functions/src/pharmacyDashboard/internalOrder/processInternalOrderDraft.main',
    'GET /pharmacy-dashboard/internal-order':
      'packages/functions/src/pharmacyDashboard/internalOrder/getInternalOrders.main',
    'GET /pharmacy-dashboard/internal-order/{id}':
      'packages/functions/src/pharmacyDashboard/internalOrder/getInternalOrderById.main',
    'DELETE /pharmacy-dashboard/internal-order/{id}':
      'packages/functions/src/pharmacyDashboard/internalOrder/deleteInternalOrder.main',

    //Internal Consumption
    'POST /pharmacy-dashboard/internal-consumption/create':
      'packages/functions/src/pharmacyDashboard/internalConsumption/createInternalConsumption.main',
    'GET /pharmacy-dashboard/internal-consumption':
      'packages/functions/src/pharmacyDashboard/internalConsumption/getInternalConsumptions.main',
    'GET /pharmacy-dashboard/internal-consumption/download/{id}':
      'packages/functions/src/pharmacyDashboard/internalConsumption/downloadInternalConsumptionReport.main',

    // Pharmacy Invoice
    'GET /pharmacy-dashboard/invoice':
      'packages/functions/src/pharmacyDashboard/invoice/getInvoice.main',
    'GET /pharmacy-dashboard/invoice/download/{id}':
      'packages/functions/src/pharmacyDashboard/invoice/downloadInvoice.main',
    'GET /pharmacy-dashboard/purchase-order/download/{id}':
      'packages/functions/src/pharmacyDashboard/invoice/downloadPOInvoice.main',
    'GET /pharmacy-dashboard/purchase-order/processed/download/{id}':
      'packages/functions/src/pharmacyDashboard/invoice/downloadPOInvoiceProcessed.main',
  });

  stack.addOutputs({
    StackName: stack.stackName,
  });
}
