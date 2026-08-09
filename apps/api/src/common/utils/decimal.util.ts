import { Prisma } from '@prisma/client';

export function toDecimal(val: number | string | Prisma.Decimal): Prisma.Decimal {
  if (val instanceof Prisma.Decimal) return val;
  return new Prisma.Decimal(val);
}

export function addDecimal(
  a: number | string | Prisma.Decimal,
  b: number | string | Prisma.Decimal,
): Prisma.Decimal {
  return toDecimal(a).add(toDecimal(b));
}

export function subDecimal(
  a: number | string | Prisma.Decimal,
  b: number | string | Prisma.Decimal,
): Prisma.Decimal {
  return toDecimal(a).sub(toDecimal(b));
}

export function mulDecimal(
  a: number | string | Prisma.Decimal,
  b: number | string | Prisma.Decimal,
): Prisma.Decimal {
  return toDecimal(a).mul(toDecimal(b));
}

export function percentDecimal(
  amount: number | string | Prisma.Decimal,
  percentage: number | string | Prisma.Decimal,
): Prisma.Decimal {
  return toDecimal(amount).mul(toDecimal(percentage)).div(100);
}

export function roundDecimal(
  val: number | string | Prisma.Decimal,
  decimals = 2,
): Prisma.Decimal {
  return toDecimal(val).toDecimalPlaces(decimals, Prisma.Decimal.ROUND_HALF_UP);
}

export function serializeDecimal(
  val: number | string | Prisma.Decimal | null | undefined,
  decimals = 2,
): string {
  if (val === null || val === undefined) return '0.00';
  return roundDecimal(val, decimals).toFixed(decimals);
}

/**
 * Recursively converts Prisma.Decimal and Date instances to strings / ISO strings
 * for safe JSON serialization (e.g. Idempotency responseJson or API responses).
 */
export function sanitizeForJson<T>(obj: T): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Prisma.Decimal) return obj.toFixed(2);
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map((item) => sanitizeForJson(item));
  if (typeof obj === 'object') {
    const res: any = {};
    for (const key of Object.keys(obj)) {
      res[key] = sanitizeForJson((obj as any)[key]);
    }
    return res;
  }
  return obj;
}
