/**
 * Centralized pricing configuration for Droppit
 * All prices are in CENTS to avoid floating point issues
 */
export const pricingConfig = {
  // Base pickup fee (mandatory per booking)
  pickupFeeCents: 1200, // $12.00
  
  // Per-package pricing by size
  smallCents: 400,      // $4.00
  mediumCents: 600,     // $6.00
  largeCents: 900,      // $9.00
  oversizedCents: 1500, // $15.00
  
  // Platform commission percentage
  commissionPercent: 25,
} as const;

/**
 * Calculate total price in cents
 */
export function calculateTotalCents(quantities: {
  smallQty: number;
  mediumQty: number;
  largeQty: number;
  oversizedQty: number;
}): number {
  const { smallQty, mediumQty, largeQty, oversizedQty } = quantities;
  
  const totalPackages = smallQty + mediumQty + largeQty + oversizedQty;
  
  const packagesCents = 
    (smallQty * pricingConfig.smallCents) +
    (mediumQty * pricingConfig.mediumCents) +
    (largeQty * pricingConfig.largeCents) +
    (oversizedQty * pricingConfig.oversizedCents);
  
  const pickupFeeApplied = totalPackages > 0 ? pricingConfig.pickupFeeCents : 0;
  
  return pickupFeeApplied + packagesCents;
}

/**
 * Calculate platform commission and courier payout
 */
export function calculatePayoutSplit(totalCents: number): {
  platformFeeCents: number;
  courierPayoutCents: number;
} {
  const platformFeeCents = Math.round(totalCents * pricingConfig.commissionPercent / 100);
  const courierPayoutCents = totalCents - platformFeeCents;
  
  return { platformFeeCents, courierPayoutCents };
}

/**
 * Format cents as USD string (e.g., 1200 -> "$12.00")
 */
export function formatCentsAsUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get price breakdown for display
 */
export function getPriceBreakdown(quantities: {
  smallQty: number;
  mediumQty: number;
  largeQty: number;
  oversizedQty: number;
}): {
  pickupFeeCents: number;
  packagesCents: number;
  totalCents: number;
  totalPackages: number;
} {
  const { smallQty, mediumQty, largeQty, oversizedQty } = quantities;
  
  const totalPackages = smallQty + mediumQty + largeQty + oversizedQty;
  
  const packagesCents = 
    (smallQty * pricingConfig.smallCents) +
    (mediumQty * pricingConfig.mediumCents) +
    (largeQty * pricingConfig.largeCents) +
    (oversizedQty * pricingConfig.oversizedCents);
  
  const pickupFeeApplied = totalPackages > 0 ? pricingConfig.pickupFeeCents : 0;
  
  return {
    pickupFeeCents: pickupFeeApplied,
    packagesCents,
    totalCents: pickupFeeApplied + packagesCents,
    totalPackages,
  };
}
