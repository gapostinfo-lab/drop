/**
 * Privacy utilities for masking sensitive information
 */

/**
 * Mask a phone number for display
 * Example: +1234567890 -> ***-***-7890
 */
export function maskPhoneNumber(phone: string): string {
  if (!phone) return '';
  // Get last 4 digits
  const cleaned = phone.replace(/\D/g, '');
  const last4 = cleaned.slice(-4);
  return `***-***-${last4}`;
}

/**
 * Get first name only from full name
 */
export function getFirstName(fullName: string): string {
  if (!fullName) return '';
  return fullName.split(' ')[0];
}
