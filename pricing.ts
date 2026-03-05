/**
 * Centralized pricing configuration for Droppit
 * All prices are in CENTS to avoid floating point issues
 * This must match convex/lib/pricing.ts
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
 * Package size display info
 */
export const packageSizes = [
  { 
    id: 'small' as const, 
    label: 'Small', 
    desc: 'Envelope or small box (shoebox size)',
    priceCents: pricingConfig.smallCents,
  },
  { 
    id: 'medium' as const, 
    label: 'Medium', 
    desc: 'Standard shipping box (carry-on size)',
    priceCents: pricingConfig.mediumCents,
  },
  { 
    id: 'large' as const, 
    label: 'Large', 
    desc: 'Large box (requires two hands)',
    priceCents: pricingConfig.largeCents,
  },
  { 
    id: 'oversized' as const, 
    label: 'Oversized', 
    desc: 'Very large or heavy item',
    priceCents: pricingConfig.oversizedCents,
  },
] as const;

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

/**
 * Format cents as USD string (e.g., 1200 -> "$12.00")
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Get package summary string (e.g., "2x Small, 1x Large")
 */
export function getPackageSummary(quantities: {
  smallQty: number;
  mediumQty: number;
  largeQty: number;
  oversizedQty: number;
}): string {
  const parts = [
    quantities.smallQty > 0 && `${quantities.smallQty}x Small`,
    quantities.mediumQty > 0 && `${quantities.mediumQty}x Medium`,
    quantities.largeQty > 0 && `${quantities.largeQty}x Large`,
    quantities.oversizedQty > 0 && `${quantities.oversizedQty}x Oversized`,
  ].filter(Boolean);
  
  return (parts as string[]).join(', ') || 'No packages';
}
