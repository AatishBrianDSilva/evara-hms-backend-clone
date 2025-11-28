# Bug Fix: Missing PatientPharmacy Documents Causing N/A Batch/Expiry in Billing

## Issue Summary

When processing patient billing for pharmacy items, some items show batch number and expiry date as "N/A" even though the stock has valid batch and expiry data.

## Root Cause

The issue occurs when:
1. **PatientPharmacy document is never created** (or is rolled back)
2. **Estimation is created with a `serviceId`** that points to a non-existent PatientPharmacy
3. **Billing is created** from that estimation, copying the invalid `serviceId`
4. **When processing billing**, the code tries to fetch PatientPharmacy using `serviceId`, but it doesn't exist
5. **Result**: Batch number and expiry date default to "N/A"

## Technical Details

### The Problematic Flow

In `addPharmacy.ts`, the code flow is:

```typescript
// Line 111: Save PatientPharmacy (in transaction, NOT committed yet)
const newPharmacy = await newPatientPharmacy.save({ session });

// Line 163: Publish SNS with serviceId (INSIDE transaction, BEFORE commit) ⚠️
await publishBillingServiceToSNS(
  newPharmacy.patient,
  newPharmacy.doctor,
  pharmacyStock._id,
  newPharmacy._id as any,  // <-- serviceId sent here
  ...
);

// Line 181: Commit transaction
await session.commitTransaction();
```

### What Goes Wrong

1. **PatientPharmacy is saved** in a transaction (not yet committed)
2. **SNS message is published** with `serviceId = newPharmacy._id` (inside transaction, before commit)
3. **SNS triggers estimation creation** asynchronously with that `serviceId`
4. **If transaction fails/rolls back** after SNS publish:
   - PatientPharmacy is rolled back (doesn't exist in database)
   - SNS message is already sent (can't be rolled back)
   - Estimation is created with `serviceId` pointing to non-existent PatientPharmacy
5. **When billing is created** from estimation, it copies the invalid `serviceId`
6. **When processing billing**, `processBilling.ts` tries to find PatientPharmacy:
   ```typescript
   const patientPharmacy = await PatientPharmacy.findOne({
     _id: serviceId,  // <-- This doesn't exist!
     patient: patientData.patientData.patientId,
   })
   ```
7. **Result**: `patientPharmacy` is `null`, so batch/expiry defaults to "N/A"

### Why Transaction Can Fail

Transaction can fail after SNS publish due to:
- **Network issues (client-side or server-side)**:
  - Slow internet connection causing request timeouts
  - Connection drops between client and server
  - Network latency causing Lambda function timeouts
  - Client disconnecting before transaction completes
- **Database connection issues**:
  - MongoDB connection pool exhaustion
  - Database server timeouts
  - Connection drops during transaction
- **Validation errors**:
  - Data validation failures after SNS publish
  - Schema validation errors
- **Concurrent transaction conflicts**:
  - Write conflicts in MongoDB
  - Deadlocks
- **Lambda/Server issues**:
  - Lambda function timeout
  - Memory issues
  - Server crashes
- **Any error in the transaction after SNS publish**

### Client-Side Network Issues

**Yes, slow internet or network issues on the client side CAN contribute to this bug:**

1. **Request Timeout**: If client has slow internet, the request might timeout
   - Client might retry the request
   - Server might have already sent SNS but transaction not committed
   - Result: Multiple SNS messages or transaction rollback after SNS sent

2. **Connection Drop**: If client disconnects during request:
   - Server might abort the transaction
   - But SNS was already published
   - Result: PatientPharmacy rolled back, but estimation created

3. **Network Latency**: Slow network can cause:
   - Lambda function to timeout (if configured)
   - Client to cancel request
   - Server to abort transaction after SNS publish

**However, the root cause is still architectural**: Publishing SNS before transaction commit makes the system vulnerable to ANY failure, including network issues.

## Evidence

### Database State
- **Billing items** have `serviceId` values
- **PatientPharmacy documents** with those IDs don't exist
- **Estimations** exist with `serviceId` pointing to non-existent PatientPharmacy

### Example from Production
- Billing ID: `6922b843656c206ef05c53c9`
- Item: SPORLAC EVA
- `serviceId` in billing: `6922b759e7bc15a533fd74a0`
- PatientPharmacy with that ID: **Does not exist**
- Stock has valid batch/expiry data

## Solution

### Fix: Move SNS Publish After Transaction Commit

Move the SNS publish operation **after** the transaction is committed to ensure:
1. PatientPharmacy exists in database before SNS is sent
2. If transaction fails, no SNS is sent (no orphaned estimations)
3. Data consistency is maintained

### Implementation

**File**: `packages/functions/src/patientDashboard/pharmacy/addPharmacy.ts`

**Change**: Move SNS publish from inside transaction (before commit) to after transaction commit.

```typescript
// BEFORE (BROKEN):
for (const item of data.items) {
  // ... create PatientPharmacy ...
  const newPharmacy = await newPatientPharmacy.save({ session });
  
  // Publish SNS INSIDE transaction (BEFORE commit) ⚠️
  await publishBillingServiceToSNS(...);
}

await session.commitTransaction();  // If this fails, SNS already sent!

// AFTER (FIXED):
const createdPharmacies = [];

for (const item of data.items) {
  // ... create PatientPharmacy ...
  const newPharmacy = await newPatientPharmacy.save({ session });
  
  // Store for SNS publish AFTER commit
  createdPharmacies.push({
    newPharmacy,
    pharmacyStock,
    serviceName,
    sellPrice,
    itemId,
  });
}

// Commit transaction FIRST
await session.commitTransaction();
session.endSession();

// NOW publish SNS AFTER transaction is committed ✅
for (const { newPharmacy, pharmacyStock, serviceName, sellPrice, itemId } of createdPharmacies) {
  await publishBillingServiceToSNS(
    newPharmacy.patient,
    newPharmacy.doctor,
    pharmacyStock._id,
    newPharmacy._id as any,
    EPatientBillingServiceType.Pharmacy,
    serviceName,
    sellPrice,
    newPharmacy.totalQuantity,
    auth.clinicId,
    auth.branchId,
    itemId,
  );
}
```

### Additional Safety: Fallback to Stock Data

As a secondary fix, update `processBilling.ts` to fallback to stock data if PatientPharmacy is missing:

```typescript
// In processBilling.ts, after PatientPharmacy lookup fails:
if (!patientPharmacy) {
  console.warn(`PatientPharmacy not found for serviceId: ${serviceId}, falling back to stock data`);
  
  // Fallback: Fetch from PharmacyStock
  const stock = await PharmacyStock.findById(masterServiceId).lean();
  if (stock?.batches?.length > 0) {
    batchNumber = stock.batches[0].batchNo || 'N/A';
    expiryDate = stock.batches[0].expiryDate
      ? new Date(stock.batches[0].expiryDate).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          timeZone: 'Asia/Kolkata',
        })
      : 'N/A';
  }
}
```

## Testing

### How to Reproduce the Bug

1. Add temporary error after SNS publish in `addPharmacy.ts`:
   ```typescript
   await publishBillingServiceToSNS(...);
   
   // TEMPORARY: Force transaction failure
   throw new ErrorMessage(500, 'TEST: Simulating transaction failure');
   ```

2. Add a pharmacy item through frontend
3. Check database:
   - PatientPharmacy: Should NOT exist (rolled back)
   - Estimation: Should exist with `serviceId` (SNS was sent)
4. Create billing from estimation
5. Process billing: Batch/expiry will show "N/A"

### How to Verify the Fix

1. Apply the fix (move SNS after commit)
2. Add a pharmacy item
3. Check database:
   - PatientPharmacy: Should exist (committed)
   - Estimation: Should exist with valid `serviceId`
4. Create billing and process: Batch/expiry should show correctly

## Prevention

### Best Practices

1. **Never publish external messages (SNS, emails, etc.) inside transactions**
   - External services can't be rolled back
   - Always publish after transaction commit

2. **Use transaction-safe patterns**:
   - Complete all database operations first
   - Commit transaction
   - Then perform external operations (SNS, emails, etc.)

3. **Add error handling for external operations**:
   - If SNS publish fails after commit, log it
   - Consider retry mechanisms
   - Don't rollback transaction for external failures

4. **Add data validation**:
   - Validate PatientPharmacy exists before creating estimation
   - Add fallback mechanisms for missing data

## Impact

### Affected Systems
- Patient billing processing
- Invoice generation
- Batch/expiry tracking in bills

### Data Integrity
- Existing broken data: Estimations with invalid `serviceId`
- Future data: Will be correct after fix

### Migration Needed
- Consider data cleanup script to:
  - Find estimations with invalid `serviceId`
  - Either delete them or link to correct PatientPharmacy
  - Or update billing items to use stock data directly

## Related Files

- `packages/functions/src/patientDashboard/pharmacy/addPharmacy.ts` - Main fix location
- `packages/functions/src/patientDashboard/billings/processBilling.ts` - Fallback fix location
- `packages/core/src/lib/utils/publishBillingServiceToSNS.ts` - SNS publish utility
- `packages/functions/src/patientDashboard/billings/estimation/automateEstimation.ts` - Estimation creation

## Date

- **Issue Discovered**: 2025-01-XX
- **Root Cause Identified**: 2025-01-XX
- **Fix Implemented**: Pending

## Notes

- This issue affects pharmacy items only
- Other service types (Investigation, Procedure, etc.) may have similar patterns - review them
- Consider adding integration tests to prevent regression

