import { PatientData } from "../../models/Patients";

export enum EBuckets {
  UserProfiles = "evara-hms-user-profiles",
  UserReports = "evara-hms-user-reports",
  PharmacyInvoices = "evara-hms-pharmacy-invoices",
  UserIdentifications = "evara-hms-user-identifications",
}

export enum EDocumentTypes {
  Investigation = "Investigation",
  Procedure = "Procedure",
  CryoPreservation = "Cryo Preservation",
  TreatmentCycle = "Treatment-Cycle",
  MedicalHistory = "Medical-History",
  Invoice = "Invoice",
  Billing = "Billing",
  BillingDiscount = "BillingDiscount",
  Refund = "Refund",
  PurchaseOrder = "PurchaseOrder",
}

export enum EReportTemplateTypes {
  Reports = "reports",
  Invoices = "invoice",
  Refund = "refund",
  BillPharmacy = "billPharmacy",
  BillOtherServices = "billOtherServices",
}

export interface ISection {
  showTitle: boolean;
  title: string;
  content: Record<string, string>;
}

export interface IReportData {
  doctor: string;
  patient: string;
  clinic: string;
  sections: ISection[];
  reportName: string;
  reportId: string;
  fileName: string;
  templateType: EReportTemplateTypes;
  bucket: EBuckets.UserReports;
  documentType: EDocumentTypes;
}

export interface IInvoiceData {
  patient: string;
  clinic: string;
  sections: ISection[];
  reportName: string;
  reportId: string;
  fileName: string;
  templateType: EReportTemplateTypes;
  bucket: EBuckets.UserReports;
  documentType: EDocumentTypes;
}

export interface IPDFGeneratorMessage {
  headerHtml: string;
  footerHtml: string;
  htmlContent: string;
  bucket: EBuckets.UserReports;
  key: string;
  doctor: string;
  category: EDocumentTypes;
  reportName: string;
  source_report_id: string;
  patient?: PatientData;
  clinic?: string;
}
