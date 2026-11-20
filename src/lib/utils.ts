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
