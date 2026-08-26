# HMS Enhancement & Issue Runbook

**Branches:** `bugfix/25-08-be` (backend) · `bugfix/25-08-fe` (frontend)  
**Constraint:** Prefer display / analytics / small UI fixes. Avoid new modules and write-path changes that can break billing, stock, or files.  
**Rule:** Mark items `Done` only after verified. Defer anything high-risk unless explicitly approved.  
**Timezone:** Clinic operates in India (IST, UTC+5:30). New/changed analytics date filters use `getISTDateRangeBounds` / `$dateToString` with `Asia/Kolkata`.

---

## Status legend

| Status | Meaning |
|--------|---------|
| `Todo` | Not started |
| `In progress` | Actively being fixed |
| `Done` | Fixed (code landed; verify in env) |
| `Deferred` | Out of this pass |
| `Needs decision` | Blocked on product/clinic confirmation |

---

## 1. Pharmacy Module Enhancements

| ID | Item | Status | Risk | Notes |
|----|------|--------|------|-------|
| P1 | Return to Vendor | Deferred | High | New module. |
| P2 | Sales: sale / cost / profit | Needs decision | Low–Med | Needs testing / cost-field confirmation before work. |
| P3 | Vendor bill details visible | Done | Low | Analytics PO view now shows responses: invoice #, attachments, batch/expiry/buy price. |
| P4 | Patient name consumption report | Done | Low–Med | Analytics page + CSV; groups PatientPharmacy by patient. |
| P5 | Export pharmacy reports | Done | Low | DownloadMenu + CustomDateRangePicker on pharmacy reports; new downloads for pharmacy/PO reports. |
| P6 | Remove excess stock | Deferred | High | Write-path. |
| P7 | Modify expiry dates | Deferred | High | Write-path. |
| P8 | Stock transfer printable | Deferred* | Med–High | Transfer exists; PDF = pipeline. |
| P9 | Item-wise stock value | Done | Low | Analytics item stock values (cost + MRP) + CSV. |
| P10 | CSV download issues | Done | Low | Dead client-side `exportToCSV` left unused; server DownloadMenu was already wired on most reports. Added missing downloads for Pharmacy Report + Purchase Order. |
| P11 | Purchase report download | Done | Low | `purchase-order-report/download` + FE DownloadMenu. |

---

## 2. Cryopreservation Module

| ID | Item | Status | Notes |
|----|------|--------|-------|
| C1 | Cryo reports | Done | Analytics list + CSV polished; IST date filter; files view fixed. |
| C2 | Preservation + expiry | Done | Preservation = record `date`; expiry = `details.details.dateOfExpiry` only. |
| C3 | Printable format | Deferred* | Template pipeline. |

---

## 3. Clinical Reports

| ID | Item | Status | Notes |
|----|------|--------|-------|
| CR1 | OPU/FET format + attachments | Done | OPU files + field mapping fixed; PDF only on report complete; correct report name/file key. |
| CR2 | Hysteroscopy / Laparoscopy formats | Deferred* | — |
| CR3 | Monthly procedure-wise | Done | Covered by A5-3. |
| CR4 | Anaesthetist report | Todo | — |
| CR5 | Daily/Monthly/Yearly/Custom | Done | `CustomDateRangePicker` on analytics reports; BE uses `getISTDateRangeBounds`. No preset buttons. |

---

## 4. Appointment Module

| ID | Item | Status | Notes |
|----|------|--------|-------|
| A4-1 | Patient Name on list | Done | Renamed column to **Patient Name**. |
| A4-2 | MRN / Patient ID on list | Done | FE `AppointmentsList.tsx` — column `patientId` (— if walk-in). |
| A4-3 | Source not auto-filled | Done | Create form: empty option + `displayEmpty`; no marketing-source map. |

---

## 5. Analytics Module

| ID | Item | Status | Notes |
|----|------|--------|-------|
| A5-1 | Monthly OPU report | Done | BE `getOpuFetReports` (`OPUReport`) + FE page/sidebar. Filter on cycle `date` (IST). |
| A5-2 | Monthly FET report | Done | Same API with `EmbryoTransferReport`. |
| A5-3 | Procedure-wise monthly stats | Done | BE `getProcedureMonthlyStats` + FE page. |
| A5-4 | Edit amount/date | Deferred | Billing write-path. |
| A5-5 | Wrong amounts (master vs billed) | Needs decision | **Not changed** this pass. Amount column still list price. |
| A5-6 | Discount on T / P / I reports | Done | Billing join adds `discount` + `netBilled`; amount stays master list price. Unbilled → `—`. |

---

## 6. Patient IVF Tracking Dashboard

| ID | Item | Status | Notes |
|----|------|--------|-------|
| IVF1–4 | Waiting / undergoing / completed / discontinued | Needs decision | No implement this pass. Label-mapping parked. |

---

## 7. General System Issues

| ID | Item | Status | Notes |
|----|------|--------|-------|
| G1 | Profile pictures disappear | Done | FE preserve image/IDs on Patients + PatientDashboard edit submit; seed upload state from existing patient. |
| G2 | Document printing fails | Deferred | Do not touch print/Chromium this pass. |
| G3 | Attachments / KeepPermanently | Done (partial) | See Extra gaps. Tagged: editPatient identifications, history files add/edit, refund files, partner IDs. `parseS3Url` strips query + decodeURIComponent. `keepUrlsPermanently` helper added. **Sweeper not disabled.** |

---

## Extra gaps / issues

| ID | Gap | Severity | Status |
|----|-----|----------|--------|
| X1 | `parseS3Url` still virtual-hosted regional only | Med | Improved (query strip); path-style/CloudFront still unsupported. |
| X2 | History FE may omit `reportId` on upload | Med | Open — FE upload path not fully audited this pass. |
| X3 | `generateSignedUrl` getObject ignores client `key` | Med | Open — viewing-only fix later. |
| X4 | Identifications on editPatient | — | **Fixed** (KeepPermanently). |
| X5 | Refund files untagged | — | **Fixed**. |
| X6 | Analytics date TZ | — | **Fixed** for new/changed T&T reports via IST helper. |
| X7 | Donor edit identifications (if any) | Low | Not checked deeply — note for later. |
| X8 | Existing S3 objects already deleted (pre-tag) | High | Cannot restore via code; ops/backfill only. |

---

## Working order — this pass (completed)

1. ~~A4 Appointments~~ Done  
2. ~~G1 Profile image~~ Done  
3. ~~G3 KeepPermanently gaps~~ Done (partial; sweeper untouched)  
4. ~~A5-3 Procedure monthly~~ Done  
5. ~~A5-1 / A5-2 OPU + FET~~ Done  
6. ~~A5-6 Discount join~~ Done  
7. IVF — Needs decision  
8. A5-5 / A5-4 / G2 — Deferred / Needs decision  

---

## Decision log

| Date | Decision |
|------|----------|
| 2026-08-25 | Display/analytics/small fixes only. |
| 2026-08-25 | Amount/date edit deferred. |
| 2026-08-25 | Wrong amounts (A5-5) Needs decision — do not rewrite amount source. |
| 2026-08-25 | Discount: keep master amount; add Discount + Net Billed via billing join. |
| 2026-08-25 | FET = EmbryoTransferReport. |
| 2026-08-25 | OPU/FET/procedure filters use `date` + IST. |
| 2026-08-25 | IVF dashboard → Needs decision (no implement). |
| 2026-08-25 | Do not disable 15-min S3 sweeper; defer print/Chromium. |

---

## How to update

When an item is fixed: set Status, one-line note (FE/BE). Add new findings under **Extra gaps**.
