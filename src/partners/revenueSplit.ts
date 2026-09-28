/**
 * Partner revenue split (carried over from the previous prototype, now a pure, tested function).
 *
 * successFee      = revenue * feeRate
 * partnerEarnings = successFee * partnerShare
 * arvenEarnings   = successFee - partnerEarnings
 *
 * All amounts are computed in integer cents, so the two shares always add up to the fee.
 */

export interface RevenueSplitInput {
  /** Revenue attributable to the partner for the period, in the invoice currency. */
  revenue: number;
  /** Default 0.15 (15% success fee). */
  feeRate?: number;
  /** Default 0.5 (50/50 split). */
  partnerShare?: number;
}

export interface RevenueSplit {
  revenue: number;
  successFee: number;
  partnerEarnings: number;
  arvenEarnings: number;
}

export function calculateRevenueSplit({ revenue, feeRate = 0.15, partnerShare = 0.5 }: RevenueSplitInput): RevenueSplit {
  if (!Number.isFinite(revenue) || revenue < 0) throw new RangeError('revenue must be a non-negative number');
  if (!(feeRate >= 0 && feeRate <= 1)) throw new RangeError('feeRate must be between 0 and 1');
  if (!(partnerShare >= 0 && partnerShare <= 1)) throw new RangeError('partnerShare must be between 0 and 1');

  const revenueCents = Math.round(revenue * 100);
  const feeCents = Math.round(revenueCents * feeRate);
  const partnerCents = Math.round(feeCents * partnerShare);
  return {
    revenue: revenueCents / 100,
    successFee: feeCents / 100,
    partnerEarnings: partnerCents / 100,
    arvenEarnings: (feeCents - partnerCents) / 100,
  };
}
