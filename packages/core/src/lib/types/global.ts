import { PatientData } from "../../models/Patients";

export enum EBuckets {
  UserProfiles = "gv-evara-hms-user-profiles",
  UserReports = "gv-evara-hms-user-reports",
}

export enum EDocumentTypes {
  Investigation = "Investigation",
  Procedure = "Procedure",
  CryoPreservation = "Cryo Preservation",
  TreatmentCycle = "Treatment-Cycle",
  MedicalHistory = "Medical-History",
  Invoice = "Invoice",
}

export enum EReportTemplateTypes {
  Reports = "reports",
  Invoices = "invoice",
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

export interface IPDFGeneratorMessage {
  headerHtml: string;
  footerHtml: string;
  htmlContent: string;
  bucket: EBuckets.UserReports;
  key: string;
  patient: PatientData;
  doctor: string;
  category: EDocumentTypes;
  reportName: string;
  source_report_id: string;
}
