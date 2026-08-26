/**
 * Shared aggregation stages: join PatientBilling item discount / net billed
 * for a clinical service document (_id ↔ items.serviceId).
 *
 * Does NOT replace master list-price `amount` — only adds discount + netBilled.
 */
export const billingDiscountLookupStages = (clinicId: string) => [
  {
    $lookup: {
      from: 'patientbillings',
      let: {
        serviceOid: '$_id',
        patientCode: '$patientCode',
      },
      pipeline: [
        {
          $match: {
            clinicId,
            $expr: { $eq: ['$patientCode', '$$patientCode'] },
          },
        },
        { $unwind: '$items' },
        {
          $match: {
            $expr: { $eq: ['$items.serviceId', '$$serviceOid'] },
          },
        },
        {
          $project: {
            itemDiscount: { $ifNull: ['$items.discount', 0] },
            itemTotal: { $ifNull: ['$items.total', 0] },
          },
        },
      ],
      as: 'billingMatches',
    },
  },
  {
    $addFields: {
      discount: {
        $cond: [
          { $gt: [{ $size: '$billingMatches' }, 0] },
          { $sum: '$billingMatches.itemDiscount' },
          null,
        ],
      },
      netBilled: {
        $cond: [
          { $gt: [{ $size: '$billingMatches' }, 0] },
          { $sum: '$billingMatches.itemTotal' },
          null,
        ],
      },
    },
  },
];
