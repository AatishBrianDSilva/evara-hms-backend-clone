### **Verify manually (Run 1)**

1. Appointments list + create Source
2. Edit patient without re-uploading photo
3. Analytics sidebar: Procedure Monthly Stats, OPU, FET
4. T/P/I reports show Discount / Net Billed
5. Analytics → Cryo — Preservation Date + Expiry Date columns; View Reports action works
6. CSV download includes both date columns; empty expiry shows `—`
7. Date range filter respects IST (pick a single day at month boundary)
8. Open an OPU report, upload an attachment, save — attachment should remain on reopen.
9. Edit immature oocytes / specific abnormalities — values should round-trip correctly.
10. Save a checklist/protocol — no PDF generation triggered.
11. Complete an OPU or FET report — PDF should generate with the correct report title.

### **Verify manually (Run 2 — Pharmacy)**

12. Analytics → Purchase Order Reports → View a Processed PO — Vendor Bill Details shows invoice #, attachments, batch/expiry/buy price
13. Pharmacy Reports + Purchase Order Reports — DownloadMenu CSV works with date filter
14. Analytics → Patient Consumption — list + summary + CSV
15. Analytics → Item Stock Values — list (cost + MRP) + CSV
16. Existing pharmacy report downloads still work (Sale by Schedule, Internal Consumption, etc.)
