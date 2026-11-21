import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrencyINR(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function getBillSecurity(relatedRentals: any[]): number {
  if (!relatedRentals || relatedRentals.length === 0) return 0;
  const withBillSec = relatedRentals.find((r) => (Number(r.billSecurityAmount) || 0) > 0);
  if (withBillSec) return Number(withBillSec.billSecurityAmount) || 0;
  return relatedRentals.reduce((sum, r) => sum + (Number(r.securityAmount) || 0), 0);
}

export interface BillFinancials {
  totalRent: number;
  discount: number;
  penalty: number;
  securityDeposit: number;
  totalBillAmount: number;
  amountPaid: number;
  balanceDue: number;
  securityRefund: number;
  securityRefundDue: number;
  remainingSecurity: number;
  isSecurityRefunded: boolean;
  allReturned: boolean;
  refundStatus: RefundSecurityStatus;
}

export function calculateBillFinancials(relatedRentals: any[]): BillFinancials {
  if (!relatedRentals || relatedRentals.length === 0) {
    return {
      totalRent: 0,
      discount: 0,
      penalty: 0,
      securityDeposit: 0,
      totalBillAmount: 0,
      amountPaid: 0,
      balanceDue: 0,
      securityRefund: 0,
      securityRefundDue: 0,
      remainingSecurity: 0,
      isSecurityRefunded: false,
      allReturned: false,
      refundStatus: "None",
    };
  }

  let totalRent = 0;
  let discount = 0;
  let penalty = 0;
  let amountPaid = 0;

  for (const r of relatedRentals) {
    totalRent += Number(r.total) || 0;
    discount += Number(r.discount) || 0;
    penalty += Number(r.penalty) || 0;
    amountPaid += Number(r.advance) || 0;
  }

  const securityDeposit = getBillSecurity(relatedRentals);
  const totalBillAmount = Math.max(0, totalRent + securityDeposit + penalty - discount);
  const balanceDue = Math.max(0, totalBillAmount - amountPaid);

  const allReturned = relatedRentals.every((r) => r.status === "returned");
  const isSecurityRefunded = relatedRentals.some((r) => Boolean((r as any).securityReturned));

  let securityRefund = 0;
  for (const r of relatedRentals) {
    if ((r as any).securityRefundAmount != null && Number((r as any).securityRefundAmount) > 0) {
      securityRefund = Math.max(securityRefund, Number((r as any).securityRefundAmount));
    }
  }
  if (securityRefund <= 0 && isSecurityRefunded) {
    const explicitItemSec = relatedRentals.reduce((max, r) => {
      return (r as any).securityReturned ? Math.max(max, Number(r.securityAmount) || 0) : max;
    }, 0);
    securityRefund = explicitItemSec > 0 ? explicitItemSec : securityDeposit;
  }
  securityRefund = Math.min(securityDeposit, Math.max(0, securityRefund));
  const remainingSecurity = Math.max(0, securityDeposit - securityRefund);
  const refundStatus = getBillRefundSecurityStatus(relatedRentals);

  return {
    totalRent,
    discount,
    penalty,
    securityDeposit,
    totalBillAmount,
    amountPaid,
    balanceDue,
    securityRefund,
    securityRefundDue: securityRefund,
    remainingSecurity,
    isSecurityRefunded,
    allReturned,
    refundStatus,
  };
}

export function getDueAmount(rental: any, allRentals: any[] = []): number {
  if (!rental) return 0;
  if (rental.billNo && allRentals && allRentals.length > 0) {
    const relatedRentals = allRentals.filter((r) => r.billNo === rental.billNo);
    if (relatedRentals.length > 0) {
      return calculateBillFinancials(relatedRentals).balanceDue;
    }
  }
  return calculateBillFinancials([rental]).balanceDue;
}

export function sortBillItemsChronological<T extends any>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const timeA = new Date((a as any).createdAt || 0).getTime();
    const timeB = new Date((b as any).createdAt || 0).getTime();
    if (timeA !== timeB) return timeA - timeB;
    const idA = String((a as any).customId || (a as any).id || (a as any)._id || "");
    const idB = String((b as any).customId || (b as any).id || (b as any)._id || "");
    return idA.localeCompare(idB, undefined, { numeric: true });
  });
}

export type RefundSecurityStatus = "Pending" | "Eligible" | "Refunded" | "None";

export interface RefundAggregation {
  total: number;
  pending: number;
  completed: number;
  eligible: number;
  waitingReturn: number;
  billCount: number;
}

export function calculateRefundSummary(rentalsList: any[]): RefundAggregation {
  if (!rentalsList || rentalsList.length === 0) {
    return { total: 0, pending: 0, completed: 0, eligible: 0, waitingReturn: 0, billCount: 0 };
  }

  const billsMap = new Map<string, any[]>();
  for (const r of rentalsList) {
    const key = r.billNo || r.id || (r as any)._id;
    if (!key) continue;
    const existing = billsMap.get(key) || [];
    existing.push(r);
    billsMap.set(key, existing);
  }

  let total = 0;
  let pending = 0;
  let completed = 0;
  let eligible = 0;
  let waitingReturn = 0;

  for (const [, billRentals] of billsMap.entries()) {
    const sec = getBillSecurity(billRentals);
    if (sec <= 0) continue;

    total += sec;

    const allReturned = billRentals.every((r) => r.status === "returned");
    const isSecurityRefunded = billRentals.some((r) => Boolean((r as any).securityReturned));

    if (isSecurityRefunded) {
      completed += sec;
    } else {
      pending += sec;
      if (allReturned) {
        eligible += sec;
      } else {
        waitingReturn += sec;
      }
    }
  }

  return { total, pending, completed, eligible, waitingReturn, billCount: billsMap.size };
}

export function getBillRefundSecurityStatus(relatedRentals: any[]): RefundSecurityStatus {
  if (!relatedRentals || relatedRentals.length === 0) return "None";
  const sec = getBillSecurity(relatedRentals);
  if (sec <= 0) return "None";

  const allReturned = relatedRentals.every((r) => r.status === "returned");
  const isSecurityRefunded = relatedRentals.some((r) => Boolean((r as any).securityReturned));

  if (allReturned && isSecurityRefunded) {
    return "Refunded";
  }
  if (allReturned && !isSecurityRefunded) {
    return "Eligible";
  }
  return "Pending";
}

export function getItemRefundSecurityDisplay(rental: any, allRentals: any[] = []): number {
  if (!rental) return 0;
  const relatedRentals = rental.billNo && allRentals.length > 0
    ? allRentals.filter((r) => r.billNo === rental.billNo)
    : [rental];

  const totalBillSecurity = getBillSecurity(relatedRentals);
  if (totalBillSecurity <= 0) return 0;

  // Single-item bill:
  if (relatedRentals.length <= 1) {
    return totalBillSecurity;
  }

  // Multi-item bill:
  const allReturned = relatedRentals.every((r) => r.status === "returned");

  // While items are pending return (upcoming, active, overdue):
  // Show the complete bill security amount on the primary pending item under the bill,
  // without splitting into partial amounts and without duplicating across multiple items.
  if (!allReturned) {
    const pendingRentals = relatedRentals.filter((r) => r.status !== "returned");
    const sortedPending = [...pendingRentals].sort((a, b) => {
      const idA = String(a.customId || a.id || (a as any)._id || "");
      const idB = String(b.customId || b.id || (b as any)._id || "");
      return idA.localeCompare(idB);
    });
    const primaryPending = sortedPending[0];

    const isCurrentPrimaryPending =
      primaryPending &&
      (primaryPending.id === rental.id ||
        (primaryPending as any)._id === rental.id ||
        (primaryPending as any)._id === (rental as any)._id ||
        primaryPending.id === (rental as any)._id);

    if (isCurrentPrimaryPending) {
      return totalBillSecurity;
    }

    return 0;
  }

  // Multi-item bill when all items ARE returned:
  // When processed, display the complete refund amount against the last returned item only!
  // Earlier returned items (returned while other items were pending) do not show refund.
  let lastReturned = relatedRentals.find(
    (r) => Boolean((r as any).securityReturned) && (Number(r.securityAmount) || 0) > 0
  );
  if (!lastReturned) {
    lastReturned = relatedRentals.find((r) => Boolean((r as any).securityReturned));
  }
  if (!lastReturned) {
    const sorted = [...relatedRentals].sort((a, b) => {
      const timeA = new Date((a as any).securityReturnedAt || (a as any).returnedAt || (a as any).updatedAt || 0).getTime();
      const timeB = new Date((b as any).securityReturnedAt || (b as any).returnedAt || (b as any).updatedAt || 0).getTime();
      return timeB - timeA;
    });
    lastReturned = sorted[0];
  }

  const isCurrentTheLastReturned =
    lastReturned && (
      lastReturned.id === rental.id ||
      (lastReturned as any)._id === rental.id ||
      (lastReturned as any)._id === (rental as any)._id ||
      lastReturned.id === (rental as any)._id
    );

  if (isCurrentTheLastReturned) {
    return totalBillSecurity;
  }

  return 0;
}

/**
 * Safely extracts the numerical value from an order/bill identifier.
 * Examples: "#212" -> 212, "212" -> 212, "#INV-0003" -> 3, "BILL-0001" -> 1, "R-852" -> 852.
 */
export function extractOrderNumber(val?: string | null): number {
  if (!val) return -Infinity;
  const str = String(val).trim();
  const cleaned = str.replace(/^#+/, "").trim();
  const matches = cleaned.match(/\d+/g);
  if (matches && matches.length > 0) {
    const num = parseInt(matches[matches.length - 1], 10);
    if (!Number.isNaN(num)) return num;
  }
  return -Infinity;
}

/**
 * Compares two order identifiers in descending numerical order (largest to smallest).
 * Handles prefixed order numbers such as #INV-0003, BILL-0001, #212 safely.
 */
export function compareOrdersDescending(a?: string | null, b?: string | null): number {
  const numA = extractOrderNumber(a);
  const numB = extractOrderNumber(b);

  if (numA !== numB) {
    return numB - numA; // Descending: largest to smallest (e.g. 212 > 211 > 210)
  }

  // Tie-breaker: natural string comparison descending
  const strA = String(a || "").trim();
  const strB = String(b || "").trim();
  return strB.localeCompare(strA, undefined, { numeric: true, sensitivity: "base" });
}

