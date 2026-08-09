import * as crypto from 'crypto';

export function generateOrderNumber(countryCode = 'GW'): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `NSL-${countryCode.toUpperCase()}-${dateStr}-${randomSuffix}`;
}
