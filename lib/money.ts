import type { WireMoney } from "./types";

/**
 * Money in the client domain. Amount is `bigint` minor units (e.g. cents
 * for USD) so addition and multiplication are exact. The wire boundary
 * carries amount as a decimal string (`WireMoney`); call `parseMoney` to
 * cross from wire to domain.
 */
export interface Money {
  amount: bigint;
  currency: string;
}

export function parseMoney(m: WireMoney): Money {
  return { amount: BigInt(m.amount), currency: m.currency };
}

const ZERO = BigInt(0);
const TEN = BigInt(10);

export function zeroMoney(currency: string): Money {
  return { amount: ZERO, currency };
}

export function addMoney(a: Money, b: Money): Money {
  if (a.currency !== b.currency) {
    throw new Error(
      `currency mismatch: cannot add ${a.currency} and ${b.currency}`,
    );
  }
  return { amount: a.amount + b.amount, currency: a.currency };
}

export function multiplyMoney(m: Money, qty: number): Money {
  if (!Number.isInteger(qty)) {
    throw new Error(`multiplyMoney requires an integer quantity, got ${qty}`);
  }
  if (qty < 0) {
    throw new Error(
      `multiplyMoney requires a non-negative quantity, got ${qty}`,
    );
  }
  return { amount: m.amount * BigInt(qty), currency: m.currency };
}

/**
 * Format a Money for display. Uses `Intl.NumberFormat` to choose the
 * correct number of minor units per currency (USD → 2, JPY → 0, etc.) so
 * the display layer never has to special-case currencies.
 */
export function formatMoney(m: Money, locale = "en-US"): string {
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: m.currency,
  });
  const fractionDigits = formatter.resolvedOptions().minimumFractionDigits ?? 2;
  const divisor = TEN ** BigInt(fractionDigits);
  // Build the decimal string from bigint (sign + abs major . padded minor)
  // so we never lose precision to Number, then hand to Intl which only
  // needs a Number for the digit-grouping/symbol formatting itself.
  const negative = m.amount < ZERO;
  const abs = negative ? -m.amount : m.amount;
  const major = abs / divisor;
  const minor = abs % divisor;
  const decimal =
    fractionDigits === 0
      ? `${negative ? "-" : ""}${major.toString()}`
      : `${negative ? "-" : ""}${major.toString()}.${minor
          .toString()
          .padStart(fractionDigits, "0")}`;
  return formatter.format(Number(decimal));
}
