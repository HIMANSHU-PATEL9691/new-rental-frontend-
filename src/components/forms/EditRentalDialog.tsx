import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Plus, Calendar, Trash2 } from "lucide-react";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";

import type { Rental, RentalStatus } from "@/data/mock";
import { AddCustomerDialog } from "./AddCustomerDialog";
import { AddPieceDialog } from "./AddPieceDialog";

const pieceSchema = z.object({
  id: z.string(),
  rentalId: z.string().optional(),
  itemId: z.string().min(1, "Select a piece"),
  itemNo: z.string().trim().min(1, "Item number required").max(40),
  deliveryDate: z.string().min(1, "Delivery date required"),
  deliveryTime: z.string().min(1, "Delivery time required"),
  deliveryTimePeriod: z.enum(["Morning", "Afternoon", "Evening", "Night", ""]).optional().or(z.literal("")),
  startDate: z.string().min(1, "Start date required"),
  endDate: z.string().min(1, "End date required"),
  endTime: z.string().min(1, "Return time required"),
  endTimePeriod: z.enum(["Morning", "Afternoon", "Evening", "Night", ""]).optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1, "Quantity must be at least 1"),
  lostQuantity: z.coerce.number().int().min(0),
  rate: z.number().min(0, "Rate cannot be negative"),
  remark: z.string().trim().max(300).optional(),
  remarkCompleted: z.boolean().optional(),
  remarkConfirmedBy: z.string().optional(),
  fittingCompleted: z.boolean().optional(),
  fittingCompletedBy: z.string().optional(),
  drycleanCompleted: z.boolean().optional(),
  drycleanCompletedBy: z.string().optional(),
  drycleanAdminConfirmed: z.boolean().optional(),
  drycleanAdminConfirmedBy: z.string().optional(),
});

const schema = z.object({
  billNo: z.string().trim().max(40).optional().or(z.literal("")),
  address: z.string().trim().max(200).optional().or(z.literal("")),
  customerId: z.string().optional().or(z.literal("")),
  advance: z.coerce.number().min(0),
  securityAmount: z.coerce.number().min(0),
  securityReturned: z.boolean().optional(),
  remark: z.string().trim().max(300).optional(),
  signature: z.string().optional(),
  status: z.enum(["active", "upcoming", "returned", "overdue"]),
  ownerNumber: z.string().optional(),
  instaId: z.string().optional(),
  billMakingDate: z.string().optional(),
  confirmationChecked: z.boolean().optional(),
  pieces: z.array(pieceSchema).min(1, "Add at least one piece"),
});

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function daysBetween(start: string, end: string) {
  if (!start || !end) return 0;
  const s = new Date(start).getTime();
  const e = new Date(end).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.max(1, Math.round((e - s) / 86400000));
}

function getRentalAmount(rental: Rental, itemPriceFallback = 0) {
  const savedRate = Number((rental as any).rate);
  if (Number.isFinite(savedRate) && savedRate > 0) return savedRate;

  const savedTotal = Number(rental.total);
  const savedDiscount = Number(rental.discount);
  if (Number.isFinite(savedTotal) && savedTotal > 0) {
    return savedTotal + (Number.isFinite(savedDiscount) ? savedDiscount : 0);
  }

  return itemPriceFallback;
}

function isSafaItem(item: any) {
  const text = [item?.name, item?.category, item?.subcategory].filter(Boolean).join(" ").toLowerCase();
  return text.includes("safa");
}

function getTimePeriod(timeStr: string) {
  if (!timeStr) return "";
  const hour = parseInt(timeStr.split(":")[0], 10);
  if (isNaN(hour)) return "";
  if (hour >= 6 && hour < 12) return "Morning";
  if (hour >= 12 && hour < 17) return "Afternoon";
  if (hour >= 17 && hour < 21) return "Evening";
  return "Night";
}

const DEFAULT_POLICIES = `1. Please return the rented piece on or before the due date to avoid penalty charges.\n2. Any damage, burns, or alterations to the piece will incur additional fees.\n3. Booking advance is strictly non-refundable.\n4. Original ID proof must be deposited at the time of pickup.\n\n1. कृपया पेनल्टी शुल्क से बचने के लिए किराए पर ली गई ड्रेस को नियत तारीख पर या उससे पहले वापस करें।\n2. ड्रेस में किसी भी प्रकार का नुकसान, जलने या बदलाव होने पर अतिरिक्त शुल्क लिया जाएगा।\n3. बुकिंग एडवांस वापस नहीं किया जाएगा।\n4. पिकअप के समय मूल आईडी प्रूफ जमा करना अनिवार्य है।`;
function getPoliciesHtml() {
  const policies = typeof window !== "undefined" ? localStorage.getItem("rental_policies") ?? DEFAULT_POLICIES : DEFAULT_POLICIES;
  return policies.replace(/\n/g, "<br/>");
}

export function EditRentalDialog({
  rental,
  onUpdated,
  trigger,
  disabled,
}: {
  rental: Rental;
  onUpdated?: (updated: Rental) => void;
  trigger: React.ReactNode;
  disabled?: boolean;
}) {
  const { items, customers, getItem, getCustomer, updateRental, addRental, deleteRental, updateItem, rentals } = useStore();

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [addPieceOpen, setAddPieceOpen] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [activePieceIndex, setActivePieceIndex] = useState(0);

  const relatedRentals = useMemo(() => {
    if (rental.billNo) {
      return rentals.filter((r) => r.billNo === rental.billNo);
    }
    return [rental];
  }, [rentals, rental.billNo, rental.id]);

  const [form, setForm] = useState<{
    billNo: string;
    address: string;
    customerId: string;
    advance: number;
    securityAmount: number;
    securityReturned: boolean;
    remark: string;
    signature: string;
    status: RentalStatus;
    ownerNumber: string;
    instaId: string;
    billMakingDate: string;
    confirmationChecked: boolean;
    pieces: Array<{
      id: string;
      rentalId?: string;
      itemId: string;
      itemNo: string;
      deliveryDate: string;
      deliveryTime: string;
      deliveryTimePeriod: string;
      startDate: string;
      endDate: string;
      endTime: string;
      endTimePeriod: string;
      quantity: number;
      lostQuantity: number;
      rate: number;
      remark: string;
      remarkCompleted: boolean;
      remarkConfirmedBy: string;
      fittingCompleted: boolean;
      fittingCompletedBy: string;
      drycleanCompleted: boolean;
      drycleanCompletedBy: string;
      drycleanAdminConfirmed: boolean;
      drycleanAdminConfirmedBy: string;
    }>;
  }>({
    billNo: rental.billNo ?? "",
    address: rental.address ?? "",
    customerId: rental.customerId ?? "",
    advance: rental.advance ?? 0,
    securityAmount: rental.securityAmount ?? 0,
    securityReturned: Boolean((rental as any).securityReturned),
    remark: rental.remark ?? "",
    signature: (rental.signature as string | undefined) ?? "",
    status: (rental.status ?? "upcoming") as RentalStatus,
    ownerNumber: (rental as any).ownerNumber ?? "",
    instaId: (rental as any).instaId ?? "",
    billMakingDate: (rental as any).billMakingDate ? String((rental as any).billMakingDate).slice(0, 10) : today(),
    confirmationChecked: Boolean((rental as any).confirmationChecked),
    pieces: [],
  });

  useEffect(() => {
    if (open) {
      const totalAdvance = relatedRentals.reduce((sum, r) => sum + (r.advance ?? 0), 0);
      const totalSecurity = relatedRentals.reduce((sum, r) => sum + (r.securityAmount ?? 0), 0);

      const piecesData = relatedRentals.map((r) => {
        const rItem = getItem(r.itemId);
        return {
          id: r.id || Math.random().toString(),
          rentalId: r.id,
          itemId: r.itemId || "",
          itemNo: r.itemNo || r.itemId || "",
          deliveryDate: r.deliveryDate ? r.deliveryDate.slice(0, 10) : today(),
          deliveryTime: (r as any).deliveryTime || "10:00",
          deliveryTimePeriod: (r as any).deliveryTimePeriod || "Morning",
          startDate: r.startDate ? r.startDate.slice(0, 10) : (r.deliveryDate ? r.deliveryDate.slice(0, 10) : today()),
          endDate: r.endDate ? r.endDate.slice(0, 10) : today(),
          endTime: (r as any).endTime || "10:00",
          endTimePeriod: (r as any).endTimePeriod || "Morning",
          quantity: (r as any).quantity ?? 1,
          lostQuantity: (r as any).lostQuantity ?? 0,
          rate: getRentalAmount(
            r,
            rItem ? rItem.pricePerDay * daysBetween(r.startDate || today(), r.endDate || today()) : 0,
          ),
          remark: r.remark ?? "",
          remarkCompleted: Boolean((r as any).remarkCompleted),
          remarkConfirmedBy: (r as any).remarkConfirmedBy ?? "",
          fittingCompleted: Boolean((r as any).fittingCompleted),
          fittingCompletedBy: (r as any).fittingCompletedBy ?? "",
          drycleanCompleted: Boolean((r as any).drycleanCompleted),
          drycleanCompletedBy: (r as any).drycleanCompletedBy ?? "",
          drycleanAdminConfirmed: Boolean((r as any).drycleanAdminConfirmed),
          drycleanAdminConfirmedBy: (r as any).drycleanAdminConfirmedBy ?? "",
        };
      });

      setForm({
        billNo: rental.billNo ?? "",
        address: rental.address ?? "",
        customerId: rental.customerId ?? "",
        advance: totalAdvance,
        securityAmount: totalSecurity,
        securityReturned: Boolean((rental as any).securityReturned),
        remark: rental.remark ?? "",
        signature: (rental.signature as string | undefined) ?? "",
        status: (rental.status ?? "upcoming") as RentalStatus,
        ownerNumber: (rental as any).ownerNumber ?? "",
        instaId: (rental as any).instaId ?? "",
        billMakingDate: (rental as any).billMakingDate ? String((rental as any).billMakingDate).slice(0, 10) : today(),
        confirmationChecked: Boolean((rental as any).confirmationChecked),
        pieces: piecesData.length > 0 ? piecesData : [{
          id: Math.random().toString(),
          rentalId: rental.id,
          itemId: rental.itemId || "",
          itemNo: rental.itemNo || rental.itemId || "",
          deliveryDate: rental.deliveryDate ? rental.deliveryDate.slice(0, 10) : today(),
          deliveryTime: (rental as any).deliveryTime || "10:00",
          deliveryTimePeriod: (rental as any).deliveryTimePeriod || "Morning",
          startDate: rental.startDate ? rental.startDate.slice(0, 10) : today(),
          endDate: rental.endDate ? rental.endDate.slice(0, 10) : today(),
          endTime: (rental as any).endTime || "10:00",
          endTimePeriod: (rental as any).endTimePeriod || "Morning",
          quantity: (rental as any).quantity ?? 1,
          lostQuantity: (rental as any).lostQuantity ?? 0,
          rate: getRentalAmount(rental, getItem(rental.itemId) ? (getItem(rental.itemId)!.pricePerDay * daysBetween(rental.startDate || today(), rental.endDate || today())) : 0),
          remark: rental.remark ?? "",
          remarkCompleted: Boolean((rental as any).remarkCompleted),
          remarkConfirmedBy: (rental as any).remarkConfirmedBy ?? "",
          fittingCompleted: Boolean((rental as any).fittingCompleted),
          fittingCompletedBy: (rental as any).fittingCompletedBy ?? "",
          drycleanCompleted: Boolean((rental as any).drycleanCompleted),
          drycleanCompletedBy: (rental as any).drycleanCompletedBy ?? "",
          drycleanAdminConfirmed: Boolean((rental as any).drycleanAdminConfirmed),
          drycleanAdminConfirmedBy: (rental as any).drycleanAdminConfirmedBy ?? "",
        }],
      });
    }
  }, [open, rental, relatedRentals, getItem]);

  const [billNoLoading, setBillNoLoading] = useState(false);

  async function ensureBillNo() {
    if (form.billNo?.trim()) return;
    setBillNoLoading(true);

    const existingNos = rentals
      .map((r) => r.billNo)
      .filter(Boolean)
      .map((b) => {
        const match = String(b).match(/(?:INV|BILL)-(\d+)/i);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);

    const sorted = Array.from(new Set(existingNos)).sort((a, b) => a - b);
    let nextSeq = 1;
    for (const num of sorted) {
      if (num === nextSeq) {
        nextSeq++;
      } else if (num > nextSeq) {
        break;
      }
    }

    setForm((c) => ({ ...c, billNo: `BILL-${String(nextSeq).padStart(4, "0")}` }));
    setBillNoLoading(false);
  }

  const customer = useMemo(() => getCustomer(form.customerId || rental.customerId), [getCustomer, form.customerId, rental.customerId]);

  const computedPieces = useMemo(() => {
    let aggSubtotalLocal = 0;

    const pieces = form.pieces.map((p) => {
      const rItem = getItem(p.itemId);
      const rStartDate = p.startDate || p.deliveryDate || today();
      const rEndDate = p.endDate || today();
      const rDeliveryDate = p.deliveryDate || today();
      const rDeliveryTime = p.deliveryTime || "";
      const rDeliveryTimePeriod = p.deliveryTimePeriod || "";
      const rEndTime = p.endTime || "";
      const rEndTimePeriod = p.endTimePeriod || "";
      const rQuantity = isSafaItem(rItem) ? Math.max(1, Number(p.quantity) || 1) : 1;
      const rLostQuantity = Number(p.lostQuantity) || 0;
      const d = daysBetween(rStartDate, rEndDate);
      const rRate = p.rate || 0;
      const rSubtotal = rRate * rQuantity;

      aggSubtotalLocal += rSubtotal;

      return {
        r: { id: p.rentalId || p.id, itemNo: p.itemNo || p.itemId, itemId: p.itemId },
        rItem,
        isCurrent: true,
        rStartDate,
        rEndDate,
        rDeliveryDate,
        rDeliveryTime,
        rDeliveryTimePeriod,
        rEndTime,
        rEndTimePeriod,
        d,
        rRate,
        rSubtotal,
        rQuantity,
        rLostQuantity,
      };
    });

    const aggAdvanceLocal = form.advance || 0;
    const aggSecurityLocal = form.securityAmount || 0;
    const aggSecurityRefundDueLocal = form.status === "returned" && form.securityReturned ? 0 : aggSecurityLocal;
    const aggTotalLocal = aggSubtotalLocal + aggSecurityLocal;
    const aggFinalDueLocal = Math.max(0, aggTotalLocal - aggAdvanceLocal);

    return {
      pieces,
      aggSubtotal: aggSubtotalLocal,
      aggAdvance: aggAdvanceLocal,
      aggSecurity: aggSecurityLocal,
      aggSecurityRefundDue: aggSecurityRefundDueLocal,
      aggTotal: aggTotalLocal,
      aggFinalDue: aggFinalDueLocal,
    };
  }, [form.pieces, form.advance, form.securityAmount, form.securityReturned, form.status, getItem]);

  const piecesData = computedPieces.pieces;
  const aggSubtotal = computedPieces.aggSubtotal;
  const aggAdvance = computedPieces.aggAdvance;
  const aggSecurity = computedPieces.aggSecurity;
  const aggSecurityRefundDue = computedPieces.aggSecurityRefundDue;
  const aggTotal = computedPieces.aggTotal;
  const aggFinalDue = computedPieces.aggFinalDue;

  function renderThermalBody() {
    let invoiceTitle = "INVOICE";
    if (form.status === "upcoming") invoiceTitle = "BOOKING INVOICE";
    else if (form.status === "active") invoiceTitle = "DELIVERY INVOICE";
    else if (form.status === "returned") invoiceTitle = "FINAL INVOICE";
    else if (form.status === "overdue") invoiceTitle = "OVERDUE FINAL BILL";

    const thermalPiecesHtml = piecesData
      .map(
        ({
          r,
          rItem,
          rDeliveryDate,
          rEndDate,
          rDeliveryTime,
          rDeliveryTimePeriod,
          rEndTime,
          rEndTimePeriod,
          rRate,
          rQuantity,
          rLostQuantity,
        }) => `
      ${rItem?.image ? `<div style="text-align: center; margin-bottom: 6px;"><img src="${rItem.image}" style="max-height: 80px; max-width: 100%; border-radius: 4px; object-fit: cover;" /></div>` : ""}
      <div class="thermal-item-name">${rItem?.name || "Unknown item"}</div>
      <div class="thermal-row"><span>Item No</span><span>${r.itemNo || r.itemId}</span></div>
      <div class="thermal-row"><span>Dates</span><span>Del: ${formatDate(rDeliveryDate.slice(0, 10))}${rDeliveryTime ? ` ${rDeliveryTime}` : ""}${rDeliveryTimePeriod ? ` (${rDeliveryTimePeriod})` : ""} | Return: ${formatDate(rEndDate.slice(0, 10))}${rEndTime ? ` ${rEndTime}` : ""}${rEndTimePeriod ? ` (${rEndTimePeriod})` : ""}</span></div>
      <div class="thermal-row"><span>Qty / Rate</span><span>${rQuantity} x ${formatCurrencyINR(rRate)}</span></div>
      ${rLostQuantity > 0 ? `<div class="thermal-row"><span>Lost Safa</span><span>${rLostQuantity}</span></div>` : ""}
      <div class="thermal-divider"></div>
    `,
      )
      .join("");

    return `
      <div class="thermal">
        <div style="text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 6px;">
          <div style="margin-bottom: 2px;">॥ श्री शंखेश्वर पार्श्वनाथाय नमः ॥</div>
          <div>॥ श्री आदिनाथाय नमः ॥</div>
        </div>
        <div style="text-align: center; margin-bottom: 6px;">
          <h2 style="margin: 0; font-size: 14px;">SAJAN SAGAR COLLECTION</h2>
          <div style="font-size: 10px; margin-top: 2px;">Address: Maharana Pratap chowk near gas agency</div>
          <div style="font-size: 10px; margin-top: 2px;">Contact: 9907050222, 7509942222 | Insta: Sajansagar_</div>
        </div>
        <div class="thermal-title">${invoiceTitle}</div>
        <div class="thermal-row"><span>Invoice</span><span># ${form.billNo || rental.billNo || rental.id}</span></div>
        <div class="thermal-row"><span>Date</span><span>${form.billMakingDate ? new Date(form.billMakingDate).toLocaleDateString("en-IN") : "-"}</span></div>
        <div class="thermal-row"><span>Client</span><span>${customer?.name || rental.customerId}</span></div>
        ${form.instaId ? `<div class="thermal-row"><span>Insta ID</span><span>${form.instaId}</span></div>` : ""}
        <div class="thermal-divider"></div>

        ${thermalPiecesHtml}

        <div class="thermal-row"><span>Total Rent</span><span>${formatCurrencyINR(aggSubtotal)}</span></div>
        <div class="thermal-row"><span>Security Received</span><span>${formatCurrencyINR(aggSecurity)}</span></div>
        <div class="thermal-row"><span>Total Bill</span><span>${formatCurrencyINR(aggTotal)}</span></div>
        <div class="thermal-row"><span>Amount Paid</span><span>${formatCurrencyINR(aggAdvance)}</span></div>
        <div class="thermal-row"><span>Security Refund</span><span>${formatCurrencyINR(aggSecurityRefundDue)}</span></div>
        <div class="thermal-row thermal-total"><span>Balance</span><span>${formatCurrencyINR(aggFinalDue)}</span></div>

        <div class="thermal-divider"></div>
        <div style="font-size: 9px; margin-top: 10px; color: #444;">
          <strong style="font-size: 10px; color: #111;">Terms & Conditions:</strong><br/>
          ${getPoliciesHtml()}
        </div>

        <div class="thermal-signs">
          <div class="thermal-sign-box">
            ${form.signature ? `<img src="${form.signature}" class="thermal-sign-img" />` : ""}
            <div class="thermal-sign-line">Authorized Signature</div>
          </div>
          <div style="text-align: center; margin-top: 10px;">
            <span>${form.confirmationChecked ? "☑" : "☐"} Confirmed</span>
          </div>
        </div>

        <div class="thermal-footer">Thank you for choosing SAJAN SAGAR COLLECTION!</div>

      </div>
    `;
  }

  const invoiceNote =
    form.status === "returned" || form.status === "overdue"
      ? "Final bill confirms rental dues and security refund clearance."
      : form.status === "active"
      ? "Delivery invoice reflects the current balance. Set status to Returned for the final bill."
      : "Booking invoice reflects the advance paid. Change status to Active for delivery or Returned for the final bill.";

  const handleStatusChange = (v: RentalStatus) => {
    if (v === "returned") {
      const confirmed = window.confirm(
        "Are all dues clear? Please confirm that all balances are settled before marking as returned.",
      );
      if (!confirmed) return;
    }

    let newAdvance = form.advance;
    let newSecurityReturned = form.securityReturned;

    if (v === "active" && form.status !== "active") {
      const unreadyPieces = form.pieces.filter(p => !p.remarkCompleted || !p.fittingCompleted || !p.drycleanCompleted);
      if (unreadyPieces.length > 0) {
        toast.error("Cannot deliver! All item readiness, fitting, and drycleaning checks must be marked READY first.");
        alert("Cannot deliver item!\nAll checks (Item Readiness, Fitting, and Drycleaning) must be completed and marked READY first.");
        return;
      }
      const confirmed = window.confirm("Is all amount paid?");
      if (confirmed) {
        newAdvance = aggTotal;
        toast.success("Balance cleared for delivery");
      }
    }

    if (v === "returned") {
      if (newAdvance !== aggTotal) {
        newAdvance = aggTotal;
        toast.success("Balance cleared for final bill");
      }

      if (form.securityAmount > 0 && !form.securityReturned) {
        const securityConfirmed = window.confirm(
          `Has the security amount ${formatCurrencyINR(form.securityAmount)} been returned to the customer and cleared?`,
        );
        if (!securityConfirmed) {
          toast.error("Security amount must be cleared before marking returned");
          return;
        }
        newSecurityReturned = true;
      }
    } else {
      newSecurityReturned = false;
    }

    const nextFinalDue = Math.max(0, aggTotal - newAdvance);

    if (v === "returned" && nextFinalDue > 0) {
      toast.error("All dues must be cleared before marking as returned");
      return;
    }

    setForm((c) => ({
      ...c,
      status: v,
      advance: newAdvance,
      securityReturned: newSecurityReturned,
    }));
  };

  const handleSignatureUpload = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file for the signature");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Signature file must be smaller than 2 MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setForm((c) => ({ ...c, signature: (reader.result as string) ?? "" }));
      }
    };
    reader.onerror = () => toast.error("Could not read signature file");
    reader.readAsDataURL(file);
  };

  function shareOnWhatsApp() {
    let invoiceTitle = "Invoice";
    if (form.status === "upcoming") invoiceTitle = "Booking Invoice";
    else if (form.status === "active") invoiceTitle = "Delivery Invoice";
    else if (form.status === "returned") invoiceTitle = "Final Invoice";
    else if (form.status === "overdue") invoiceTitle = "Overdue Final Bill";

    const message = `*SAJAN SAGAR COLLECTION - ${invoiceTitle}*
      
*Invoice:* ${form.billNo || rental.billNo || rental.id}
*Date:* ${form.billMakingDate ? new Date(form.billMakingDate).toLocaleDateString("en-IN") : "-"}
*Client:* ${customer?.name || rental.customerId}
*Pieces:* 
${piecesData
  .map(
    (p) =>
      `- ${p.rItem?.name || "Unknown"} (${p.r.itemNo || p.r.itemId}) [Qty: ${p.rQuantity}${p.rLostQuantity > 0 ? `, Lost: ${p.rLostQuantity}` : ""} | Del: ${formatDate(p.rDeliveryDate.slice(0, 10))}${p.rDeliveryTime ? ` ${p.rDeliveryTime}` : ""}${p.rDeliveryTimePeriod ? ` (${p.rDeliveryTimePeriod})` : ""} | Return: ${formatDate(p.rEndDate.slice(0, 10))}${p.rEndTime ? ` ${p.rEndTime}` : ""}${p.rEndTimePeriod ? ` (${p.rEndTimePeriod})` : ""}] - ${formatCurrencyINR(p.rSubtotal)}`,
  )
  .join("\n")}

*Total Rent:* ${formatCurrencyINR(aggSubtotal)}
*Security Received:* ${formatCurrencyINR(aggSecurity)}
*Total Bill:* ${formatCurrencyINR(aggTotal)}
*Amount Paid:* ${formatCurrencyINR(aggAdvance)}
*Security Refund:* ${formatCurrencyINR(aggSecurityRefundDue)}
*Balance:* ${formatCurrencyINR(aggFinalDue)}

Thank you for choosing SAJAN SAGAR COLLECTION!`;

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank");
  }

  type InvoiceMode = "A4" | "THERMAL";

  function getInvoiceContent() {
    let invoiceTitle = "Invoice";
    if (form.status === "upcoming") invoiceTitle = "Booking Invoice";
    else if (form.status === "active") invoiceTitle = "Delivery Invoice";
    else if (form.status === "returned") invoiceTitle = "Final Invoice";
    else if (form.status === "overdue") invoiceTitle = "Overdue Final Bill";

    const piecesHtml = piecesData
      .map(
        ({
          r,
          rItem,
          rDeliveryDate,
          rDeliveryTime,
          rDeliveryTimePeriod,
          rEndDate,
          rEndTime,
          rEndTimePeriod,
          rRate,
          rSubtotal,
          rQuantity,
          rLostQuantity,
        }) => `
      <tr>
        <td>${rItem?.image ? `<img src="${rItem.image}" style="width: 35px; height: 45px; object-fit: cover; border-radius: 3px;" />` : ""}</td>
        <td><strong>${rItem?.name || "Unknown item"}</strong><br/><span style="font-size: 9px; color: #666;">Qty: ${rQuantity}${rLostQuantity > 0 ? ` | Lost: ${rLostQuantity}` : ""} | Del: ${formatDate(rDeliveryDate.slice(0, 10))}${rDeliveryTime ? ` ${rDeliveryTime}` : ""}${rDeliveryTimePeriod ? ` (${rDeliveryTimePeriod})` : ""} | Return: ${formatDate(rEndDate.slice(0, 10))}${rEndTime ? ` ${rEndTime}` : ""}${rEndTimePeriod ? ` (${rEndTimePeriod})` : ""}</span></td>
        <td>${r.itemNo || r.itemId}</td>
        <td class="text-right">${formatCurrencyINR(rRate)}</td>
        <td class="text-right">${formatCurrencyINR(rSubtotal)}</td>
      </tr>
    `,
      )
      .join("");

    return `
      <style>
        .header { display: flex; align-items: center; border-bottom: 2px solid #d4af37; padding-bottom: 6px; margin-bottom: 10px; }
        .logo { width: 45px; height: 45px; margin-right: 12px; }
        .company-info h1 { margin: 0; font-size: 18px; color: #111; letter-spacing: 1.2px; text-transform: uppercase; }
        .company-info p { margin: 2px 0 0 0; color: #666; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; }
        .invoice-title { margin-left: auto; text-align: right; }
        .invoice-title h2 { margin: 0; color: #d4af37; font-size: 22px; letter-spacing: 1.2px; text-transform: uppercase; }
        .invoice-title p { margin: 2px 0 0 0; font-size: 11px; color: #555; }
        .grid { display: flex; justify-content: space-between; margin-bottom: 10px; gap: 15px; }
        .col { flex: 1; }
        .label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
        .value { font-size: 11px; margin: 0 0 2px 0; line-height: 1.3; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
        th, td { padding: 4px 6px; text-align: left; border-bottom: 1px solid #eaeaea; font-size: 11px; }
        th { font-size: 9px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; border-bottom: 2px solid #222; }
        .text-right { text-align: right; }
        .summary-box { width: 50%; margin-left: auto; }
        .row { display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eaeaea; font-size: 11px; }
        .row.total { font-weight: bold; font-size: 13px; border-top: 2px solid #222; border-bottom: none; padding-top: 6px; margin-top: 4px; color: #d4af37; }
        .signatures { display: flex; justify-content: space-between; margin-top: 20px; page-break-inside: avoid; }
        .sign-box { flex: 0 0 40%; text-align: center; min-height: 50px; border-bottom: 1px solid #222; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 4px; }
        .sign-box p { margin: 0; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
        .sign-img { max-height: 45px; max-width: 100%; margin: 0 auto 4px auto; object-fit: contain; }
        .invoice-half { min-height: 100%; padding: 5mm 0; box-sizing: border-box; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; position: relative; z-index: 1; }
        .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 60px; color: rgba(212, 175, 55, 0.1); z-index: -1; white-space: nowrap; pointer-events: none; font-weight: bold; }
        tr { page-break-inside: avoid; }
      </style>
      <div class="invoice-half">
        <div class="watermark">SAJAN SAGAR COLLECTION</div>
        <div style="text-align: center; font-size: 14px; font-weight: bold; color: #d4af37; margin-bottom: 12px;">
          <div style="margin-bottom: 4px;">॥ श्री शंखेश्वर पार्श्वनाथाय नमः ॥</div>
          <div>॥ श्री आदिनाथाय नमः ॥</div>
        </div>
        <div class="header">
          <svg class="logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
            <rect width="100" height="100" fill="#111" rx="8" />
            <text x="50" y="62" text-anchor="middle" font-family="Georgia, serif" font-size="28" fill="#d4af37" font-style="italic">SS</text>
          </svg>
          <div class="company-info">
            <h1 style="margin-bottom: 4px;">SAJAN SAGAR COLLECTION</h1>
            <p style="text-transform: none; margin-bottom: 2px;">Address: Maharana Pratap chowk near gas agency</p>
            <p style="text-transform: none; margin-bottom: 2px; color: #111;">Contact: <strong>9907050222, 7509942222</strong> | Insta: <strong>Sajansagar_</strong></p>
          </div>
          <div class="invoice-title">
            <h2>${invoiceTitle}</h2>
            <p># ${form.billNo || rental.billNo || rental.id}</p>
            <p>Date: ${form.billMakingDate ? new Date(form.billMakingDate).toLocaleDateString("en-IN") : "-"}</p>
          </div>
        </div>
        
        <div class="grid">
          <div class="col">
            <div class="label">Billed To</div>
            <p class="value"><strong>${customer?.name || rental.customerId}</strong></p>
            <p class="value">${customer?.email || ""}</p>
            <p class="value">${customer?.phone || ""}</p>
            <p class="value">${form.address || rental.address || ""}</p>
            ${form.instaId ? `<p class="value"><strong>Insta ID:</strong> ${form.instaId}</p>` : ""}
          </div>
          <div class="col" style="text-align: right;">
            <div class="label">Rental Details</div>
            <p class="value"><strong>Status:</strong> ${form.status.toUpperCase()}</p>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 60px;">Image</th>
              <th>Item Description & Dates</th>
              <th>Item No</th>
              <th class="text-right">Rate</th>
              <th class="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${piecesHtml}
          </tbody>
        </table>

        <div class="summary-box">
          <div class="row"><span>Total Rent</span><span>${formatCurrencyINR(aggSubtotal)}</span></div>
          <div class="row"><span>Security Deposit</span><span>${formatCurrencyINR(aggSecurity)}</span></div>
          <div class="row"><span>Total Bill</span><span>${formatCurrencyINR(aggTotal)}</span></div>
          <div class="row"><span>Amount Paid</span><span>${formatCurrencyINR(aggAdvance)}</span></div>
          <div class="row"><span>Security Refund</span><span>${formatCurrencyINR(aggSecurityRefundDue)}</span></div>
          <div class="row total"><span>Balance</span><span>${formatCurrencyINR(aggFinalDue)}</span></div>
        </div>

        <div style="margin-top: 20px; font-size: 10px; color: #555; border-top: 1px solid #eaeaea; padding-top: 10px; line-height: 1.5;">
          <strong style="color: #222; font-size: 11px;">Terms & Conditions:</strong><br/>
          ${getPoliciesHtml()}
        </div>

        <div class="signatures" style="margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end;">
          <div style="display: flex; align-items: flex-end; gap: 20px; flex: 1;">
            <div class="sign-box" style="flex: 1;">
              ${form.signature ? `<img src="${form.signature}" class="sign-img" />` : ""}
              <p>Authorized Signature</p>
            </div>
            <div style="padding-bottom: 5px;">
              <p class="value"><span style="font-size: 22px; vertical-align: middle;">${form.confirmationChecked ? "☑" : "☐"}</span> <strong style="vertical-align: middle;">Confirmed</strong></p>
            </div>
          </div>
          <div class="sign-box" style="flex: 1;">
            <p>Client Signature</p>
          </div>
        </div>
      </div>
    `;
  }

  function getInvoiceHtml(mode: InvoiceMode = "A4") {
    if (mode === "THERMAL") {
      return `
        <html>
          <head>
            <title>Invoice ${form.billNo || rental.id}</title>
            <style>
              @page { size: 80mm auto; margin: 0; }
              body { margin: 0; padding: 0; }
              .thermal { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 10px 6px; color: #111; font-size: 11px; }
              .thermal-title { text-align: center; font-weight: 800; letter-spacing: 1px; margin-bottom: 6px; }
              .thermal-row { display: flex; justify-content: space-between; gap: 10px; margin: 3px 0; }
              .thermal-divider { border-top: 1px dashed #bbb; margin: 10px 0; }
              .thermal-item-name { font-weight: 800; margin-top: 6px; }
              .thermal-item-sub { margin-top: 2px; color: #666; font-size: 10px; }
              .thermal-total { font-weight: 800; }
              .thermal-signs { margin-top: 14px; }
              .thermal-sign-box { border-top: 1px solid #222; padding-top: 12px; display: flex; flex-direction: column; align-items: center; }
              .thermal-sign-img { max-height: 50px; max-width: 100%; margin-bottom: 4px; }
              .thermal-sign-line { font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #666; margin-top: 2px; }
              .thermal-footer { text-align: center; margin-top: 12px; font-size: 10px; color: #555; }
            </style>
          </head>
          <body>
            ${renderThermalBody()}
          </body>
        </html>
      `;
    }

    return `
      <html>
        <head>
          <title>Invoice ${form.billNo || rental.id}</title>
          <style>
            @page { size: A4; margin: 10mm 15mm; }
            body { margin: 0; padding: 0; background: #fff; }
          </style>
        </head>
        <body>
          ${getInvoiceContent()}
        </body>
      </html>
    `;
  }

  async function downloadBill() {
    if (typeof window === "undefined") return;

    toast.info("Generating PDF...");

    // @ts-ignore
    const html2pdf = (await import("html2pdf.js")).default;

    const filenameSafe = `${form.billNo || rental.billNo || "Invoice"}-${rental.id}`.replace(/[^a-z0-9-_]/gi, "-");
    const filename = `Invoice-${filenameSafe}.pdf`;

    try {
      const tempDiv = document.createElement("div");
      tempDiv.id = "pdf-container-node";
      tempDiv.style.position = "fixed";
      tempDiv.style.left = "-9999px";
      tempDiv.style.top = "-9999px";
      tempDiv.style.width = "794px";
      tempDiv.style.backgroundColor = "#ffffff";
      tempDiv.style.color = "#000000";
      tempDiv.innerHTML = getInvoiceContent();
      document.body.appendChild(tempDiv);

      await html2pdf()
        .set({
          margin: 10,
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: "#ffffff",
          },
          jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        })
        .from(tempDiv)
        .save();

      document.body.removeChild(tempDiv);
      toast.success("Bill downloaded as PDF");
    } catch (err) {
      console.error(err);
      toast.info("Opening PDF print window...");
      printInvoice();
    }
  }

  function printInvoice() {
    if (typeof window === "undefined") return;

    const invoiceHtml = getInvoiceHtml("A4");

    const printWindow = window.open("", "_blank", "width=800,height=900");
    if (!printWindow) {
      toast.error("Unable to open print window.");
      return;
    }
    printWindow.document.write(invoiceHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await ensureBillNo();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    if (parsed.data.pieces.some((p) => new Date(p.endDate) < new Date(p.deliveryDate))) {
      toast.error("End date must be after delivery date for all pieces");
      return;
    }

    const piecesData = parsed.data.pieces.map((p) => {
      const item = items.find((i) => i.id === p.itemId);
      const quantity = isSafaItem(item) ? p.quantity : 1;
      const lineTotal = p.rate * quantity;
      return { ...p, item, lineTotal };
    });

    if (piecesData.some((p) => !p.item)) {
      toast.error("Select a valid piece for all entries");
      return;
    }

    const currentRentalIds = form.pieces.map((p) => p.rentalId).filter(Boolean) as string[];

    for (const p of piecesData) {
      const newStart = new Date(p.deliveryDate || p.startDate);
      newStart.setHours(0, 0, 0, 0);
      const newEnd = new Date(p.endDate);
      newEnd.setHours(0, 0, 0, 0);

      const overlappingRentals = rentals.filter((r) => {
        if (r.billNo && r.billNo === form.billNo) return false;
        if (currentRentalIds.includes(r.id)) return false;
        if (r.itemId !== p.itemId) return false;
        if (r.status === "returned") return false;

        const existingStart = new Date(r.startDate || r.deliveryDate || "");
        existingStart.setHours(0, 0, 0, 0);
        const existingEnd = new Date(r.endDate || "");
        existingEnd.setHours(0, 0, 0, 0);

        return newStart.getTime() <= existingEnd.getTime() && newEnd.getTime() >= existingStart.getTime();
      });

      if (isSafaItem(p.item)) {
        const bookedQty = overlappingRentals.reduce((sum, r) => sum + (Number((r as any).quantity) || 1), 0);
        const stockQty = Number((p.item as any)?.quantity) || 1;
        if (bookedQty + p.quantity > stockQty) {
          toast.error(`Only ${Math.max(0, stockQty - bookedQty)} Safa available for selected dates.`);
          return;
        }
      } else if (overlappingRentals.length > 0) {
        const overlappingRental = overlappingRentals[0];
        toast.error(
          `"${p.item?.name || p.itemId}" is already booked from ${formatDate(overlappingRental.startDate)} to ${formatDate(overlappingRental.endDate)}.`,
        );
        return;
      }
    }

    setLoading(true);
    try {
      const originalRentalIds = relatedRentals.map((r) => r.id);
      const remainingRentalIds = form.pieces.map((p) => p.rentalId).filter(Boolean) as string[];
      const deletedRentalIds = originalRentalIds.filter((id) => !remainingRentalIds.includes(id));

      for (const delId of deletedRentalIds) {
        await deleteRental(delId);
      }

      const piecesTotal = piecesData.reduce((acc, p) => acc + p.lineTotal, 0);

      for (const p of piecesData) {
        const ratio = piecesTotal > 0 ? p.lineTotal / piecesTotal : 1 / piecesData.length;
        const pieceAdvance = Math.round(parsed.data.advance * ratio);
        const pieceSecurity = Math.round(parsed.data.securityAmount * ratio);

        const payload: any = {
          billNo: parsed.data.billNo ?? "",
          address: parsed.data.address ?? "",
          customerId: parsed.data.customerId || rental.customerId,
          deliveryDate: p.deliveryDate,
          deliveryTime: p.deliveryTime,
          deliveryTimePeriod: p.deliveryTimePeriod,
          startDate: p.startDate || p.deliveryDate,
          endDate: p.endDate,
          endTime: p.endTime,
          endTimePeriod: p.endTimePeriod,
          rate: p.rate,
          quantity: p.quantity,
          lostQuantity: p.lostQuantity,
          advance: pieceAdvance,
          securityAmount: pieceSecurity,
          securityReturned: parsed.data.securityReturned ?? false,
          ...(parsed.data.securityReturned ? { securityReturnedAt: new Date().toISOString() } : {}),
          remarkCompleted: p.remarkCompleted ?? false,
          remarkConfirmedBy: p.remarkConfirmedBy ?? "",
          fittingCompleted: p.fittingCompleted ?? false,
          fittingCompletedBy: p.fittingCompletedBy ?? "",
          drycleanCompleted: p.drycleanCompleted ?? false,
          drycleanCompletedBy: p.drycleanCompletedBy ?? "",
          drycleanAdminConfirmed: p.drycleanAdminConfirmed ?? false,
          drycleanAdminConfirmedBy: p.drycleanAdminConfirmedBy ?? "",
          remark: p.remark || parsed.data.remark || "",
          signature: parsed.data.signature ?? "",
          status: parsed.data.status,
          total: p.lineTotal,
          ownerNumber: parsed.data.ownerNumber ?? "",
          instaId: parsed.data.instaId ?? "",
          billMakingDate: parsed.data.billMakingDate ?? "",
          confirmationChecked: parsed.data.confirmationChecked ?? false,
          itemId: p.itemId,
          itemNo: p.itemNo,
          category: p.item?.category || "Uncategorized",
          subcategory: (p.item as any)?.subcategory || "Uncategorized",
        };

        if (p.rentalId) {
          const updated = await updateRental(p.rentalId, payload);
          if (p.item && isSafaItem(p.item)) {
            const originalRental = relatedRentals.find((r) => r.id === p.rentalId);
            const previousLost = Number((originalRental as any)?.lostQuantity) || 0;
            const nextLost = parsed.data.status === "returned" ? p.lostQuantity : 0;
            const lostDelta = nextLost - previousLost;
            if (lostDelta !== 0) {
              const currentStock = Number((p.item as any).quantity) || 0;
              await updateItem(p.item.id, {
                quantity: Math.max(0, currentStock - lostDelta),
              } as any);
            }
          }
          if (p.rentalId === rental.id) {
            onUpdated?.(updated);
          }
        } else {
          await addRental(payload);
        }
      }

      toast.success(`Rental bill ${form.billNo || rental.id} updated successfully`);
      setOpen(false);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to update rental ${rental.id}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>{trigger}</DialogTrigger>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Edit Rental</DialogTitle>
            <DialogDescription>Update rental bill details, change items, or add new pieces.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-2">
            {/* General Info Section */}
            <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                General Info
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="billNo">Bill No</Label>
                  <Input
                    id="billNo"
                    value={form.billNo}
                    onChange={(e) => setForm((c) => ({ ...c, billNo: e.target.value }))}
                    placeholder={billNoLoading ? "Generating..." : "Enter bill number"}
                    maxLength={40}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => handleStatusChange(v as RentalStatus)}
                  >
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(["upcoming", "active", "returned", "overdue"] as const).map((s) => (
                        <SelectItem key={s} value={s}>
                          {s[0].toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="client">Client</Label>
                    <button
                      type="button"
                      onClick={() => setAddClientOpen(true)}
                      className="text-[11px] text-gold hover:underline inline-flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" /> Add client
                    </button>
                  </div>
                  <Select
                    value={form.customerId}
                    onValueChange={(v) => setForm((c) => ({ ...c, customerId: v }))}
                  >
                    <SelectTrigger id="client" className="[&>span]:truncate">
                      <SelectValue placeholder="Choose a client..." />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} - {c.tier}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="address">Delivery Address</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))}
                    placeholder="Street, city, landmark"
                    maxLength={200}
                  />
                </div>
              </div>
            </div>

            {/* Rental Pieces Section */}
            <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Rental Pieces ({form.pieces.length})
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    const firstPiece = form.pieces[0];
                    setForm((f) => ({
                      ...f,
                      pieces: [
                        ...f.pieces,
                        {
                          id: Math.random().toString(),
                          itemId: "",
                          itemNo: "",
                          deliveryDate: firstPiece?.deliveryDate || today(),
                          deliveryTime: firstPiece?.deliveryTime || "10:00",
                          deliveryTimePeriod: firstPiece?.deliveryTimePeriod || "Morning",
                          startDate: firstPiece?.startDate || today(),
                          endDate: firstPiece?.endDate || today(),
                          endTime: firstPiece?.endTime || "10:00",
                          endTimePeriod: firstPiece?.endTimePeriod || "Morning",
                          quantity: 1,
                          lostQuantity: 0,
                          rate: 0,
                          remark: "",
                          remarkCompleted: false,
                          remarkConfirmedBy: "",
                          fittingCompleted: false,
                          fittingCompletedBy: "",
                          drycleanCompleted: false,
                          drycleanCompletedBy: "",
                          drycleanAdminConfirmed: false,
                          drycleanAdminConfirmedBy: "",
                        },
                      ],
                    }));
                  }}
                  className="text-xs text-gold hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <Plus className="h-3.5 w-3.5" /> Add piece
                </button>
              </div>

              {form.pieces.map((piece, index) => {
                const currentItem = items.find((i) => i.id === piece.itemId);
                const isSafa = isSafaItem(currentItem);

                return (
                  <div
                    key={piece.id}
                    className="relative rounded-md border border-border p-4 bg-background shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="font-semibold text-xs text-gold uppercase tracking-wider">
                        Piece {index + 1} {piece.itemNo ? `(${piece.itemNo})` : ""}
                      </span>
                      {form.pieces.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setForm((f) => ({
                              ...f,
                              pieces: f.pieces.filter((p) => p.id !== piece.id),
                            }));
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                      <div className="grid gap-2 min-w-0 sm:col-span-5">
                        <div className="flex items-center justify-between">
                          <Label>Select Piece</Label>
                          {index === 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setActivePieceIndex(index);
                                setAddPieceOpen(true);
                              }}
                              className="text-[11px] text-gold hover:underline inline-flex items-center gap-1"
                            >
                              <Plus className="h-3 w-3" /> New inventory item
                            </button>
                          )}
                        </div>
                        <Select
                          value={piece.itemId}
                          onValueChange={(v) => {
                            const item = items.find((i) => i.id === v);
                            setForm((f) => {
                              const newPieces = [...f.pieces];
                              newPieces[index] = {
                                ...newPieces[index],
                                itemId: v,
                                itemNo: item?.id ?? "",
                                rate: item?.pricePerDay ?? 0,
                                quantity: isSafaItem(item) ? Math.max(1, newPieces[index].quantity || 1) : 1,
                              };
                              return { ...f, pieces: newPieces };
                            });
                          }}
                        >
                          <SelectTrigger className="[&>span]:truncate">
                            <SelectValue placeholder="Choose a piece..." />
                          </SelectTrigger>
                          <SelectContent>
                            {items.map((i) => (
                              <SelectItem key={i.id} value={i.id}>
                                {i.name} - {formatCurrencyINR(i.pricePerDay)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid gap-2 min-w-0 sm:col-span-4">
                        <Label>Item No</Label>
                        <Input
                          value={piece.itemNo}
                          onChange={(e) => {
                            const itemNo = e.target.value;
                            setForm((f) => {
                              const newPieces = [...f.pieces];
                              newPieces[index] = { ...newPieces[index], itemNo };
                              const found = items.find((i) => i.customId === itemNo);
                              if (found) {
                                newPieces[index] = {
                                  ...newPieces[index],
                                  itemId: found.id,
                                  rate: found.pricePerDay ?? 0,
                                  quantity: isSafaItem(found) ? Math.max(1, newPieces[index].quantity || 1) : 1,
                                };
                              }
                              return { ...f, pieces: newPieces };
                            });
                          }}
                          placeholder="Enter Item No"
                        />
                      </div>

                      <div className="grid gap-2 min-w-0 sm:col-span-3">
                        <Label>Rate (INR)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={piece.rate}
                          onChange={(e) => {
                            const rate = Number(e.target.value);
                            setForm((f) => {
                              const newPieces = [...f.pieces];
                              newPieces[index] = { ...newPieces[index], rate };
                              return { ...f, pieces: newPieces };
                            });
                          }}
                          required
                        />
                      </div>

                      {isSafa && (
                        <div className="grid gap-2 min-w-0 sm:col-span-3">
                          <Label>Safa Quantity</Label>
                          <Input
                            type="number"
                            min={1}
                            max={(currentItem as any)?.quantity || undefined}
                            value={piece.quantity}
                            onChange={(e) => {
                              const qty = Math.max(1, Number(e.target.value) || 1);
                              setForm((f) => {
                                const newPieces = [...f.pieces];
                                newPieces[index] = { ...newPieces[index], quantity: qty };
                                return { ...f, pieces: newPieces };
                              });
                            }}
                            required
                          />
                        </div>
                      )}

                      {isSafa && form.status === "returned" && (
                        <div className="grid gap-2 min-w-0 sm:col-span-3">
                          <Label>Lost Safa</Label>
                          <Input
                            type="number"
                            min={0}
                            max={piece.quantity}
                            value={piece.lostQuantity}
                            onChange={(e) => {
                              const lost = Math.max(0, Math.min(piece.quantity, Number(e.target.value) || 0));
                              setForm((f) => {
                                const newPieces = [...f.pieces];
                                newPieces[index] = { ...newPieces[index], lostQuantity: lost };
                                return { ...f, pieces: newPieces };
                              });
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Dates & Times for this piece */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="grid gap-2 p-3 border border-border rounded-md bg-secondary/20">
                        <Label className="font-semibold text-gold text-xs">Delivery</Label>
                        <div className="grid gap-1.5">
                          <Label className="text-[11px] text-muted-foreground">Date</Label>
                          <div className="relative">
                            <Input
                              value={formatDate(piece.deliveryDate)}
                              readOnly
                              className="pr-8 h-8 text-xs bg-background"
                            />
                            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              type="date"
                              value={piece.deliveryDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = { ...newPieces[index], deliveryDate: val, startDate: val };
                                  return { ...f, pieces: newPieces };
                                });
                              }}
                              onClick={(e) => {
                                try {
                                  (e.target as HTMLInputElement).showPicker?.();
                                } catch (err) {}
                              }}
                              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <Label className="text-[11px] text-muted-foreground">Time</Label>
                            <Input
                              type="time"
                              className="h-8 text-xs bg-background"
                              value={piece.deliveryTime || ""}
                              onChange={(e) => {
                                const time = e.target.value;
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = {
                                    ...newPieces[index],
                                    deliveryTime: time,
                                    deliveryTimePeriod: getTimePeriod(time),
                                  };
                                  return { ...f, pieces: newPieces };
                                });
                              }}
                              required
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-[11px] text-muted-foreground">Period</Label>
                            <Select
                              value={piece.deliveryTimePeriod}
                              onValueChange={(v) => {
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = { ...newPieces[index], deliveryTimePeriod: v };
                                  return { ...f, pieces: newPieces };
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Period" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Morning">Morning</SelectItem>
                                <SelectItem value="Afternoon">Afternoon</SelectItem>
                                <SelectItem value="Evening">Evening</SelectItem>
                                <SelectItem value="Night">Night</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 p-3 border border-border rounded-md bg-secondary/20">
                        <Label className="font-semibold text-gold text-xs">Return</Label>
                        <div className="grid gap-1.5">
                          <Label className="text-[11px] text-muted-foreground">Date</Label>
                          <div className="relative">
                            <Input
                              value={formatDate(piece.endDate)}
                              readOnly
                              className="pr-8 h-8 text-xs bg-background"
                            />
                            <Calendar className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                            <Input
                              type="date"
                              value={piece.endDate}
                              onChange={(e) => {
                                const val = e.target.value;
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = { ...newPieces[index], endDate: val };
                                  return { ...f, pieces: newPieces };
                                });
                              }}
                              onClick={(e) => {
                                try {
                                  (e.target as HTMLInputElement).showPicker?.();
                                } catch (err) {}
                              }}
                              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="grid gap-1">
                            <Label className="text-[11px] text-muted-foreground">Time</Label>
                            <Input
                              type="time"
                              className="h-8 text-xs bg-background"
                              value={piece.endTime || ""}
                              onChange={(e) => {
                                const time = e.target.value;
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = {
                                    ...newPieces[index],
                                    endTime: time,
                                    endTimePeriod: getTimePeriod(time),
                                  };
                                  return { ...f, pieces: newPieces };
                                });
                              }}
                              required
                            />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-[11px] text-muted-foreground">Period</Label>
                            <Select
                              value={piece.endTimePeriod}
                              onValueChange={(v) => {
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = { ...newPieces[index], endTimePeriod: v };
                                  return { ...f, pieces: newPieces };
                                });
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs bg-background">
                                <SelectValue placeholder="Period" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Morning">Morning</SelectItem>
                                <SelectItem value="Afternoon">Afternoon</SelectItem>
                                <SelectItem value="Evening">Evening</SelectItem>
                                <SelectItem value="Night">Night</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Per piece actions & readiness */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-border/40">
                      <div className="grid gap-1">
                        <Label className="text-[11px] text-muted-foreground">Item Ready</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant={piece.remarkCompleted ? "default" : "outline"}
                          onClick={() => {
                            if (!piece.remarkCompleted) {
                              const name = window.prompt("Enter employee name to mark item as ready:");
                              if (name) {
                                const trimmed = name.trim();
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = {
                                    ...newPieces[index],
                                    remarkCompleted: true,
                                    remarkConfirmedBy: trimmed,
                                  };
                                  return { ...f, pieces: newPieces };
                                });
                              }
                            } else {
                              setForm((f) => {
                                const newPieces = [...f.pieces];
                                newPieces[index] = {
                                  ...newPieces[index],
                                  remarkCompleted: false,
                                  remarkConfirmedBy: "",
                                };
                                return { ...f, pieces: newPieces };
                              });
                            }
                          }}
                          className={
                            piece.remarkCompleted
                              ? "bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                              : "h-8 text-xs"
                          }
                        >
                          {piece.remarkCompleted ? `Ready (${piece.remarkConfirmedBy})` : "Mark Ready"}
                        </Button>
                      </div>

                      <div className="grid gap-1">
                        <Label className="text-[11px] text-muted-foreground">Fitting Done</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant={piece.fittingCompleted ? "default" : "outline"}
                          onClick={() => {
                            if (!piece.fittingCompleted) {
                              const name = window.prompt("Enter employee name to confirm fitting:");
                              if (name) {
                                const trimmed = name.trim();
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = {
                                    ...newPieces[index],
                                    fittingCompleted: true,
                                    fittingCompletedBy: trimmed,
                                  };
                                  return { ...f, pieces: newPieces };
                                });
                              }
                            } else {
                              setForm((f) => {
                                const newPieces = [...f.pieces];
                                newPieces[index] = {
                                  ...newPieces[index],
                                  fittingCompleted: false,
                                  fittingCompletedBy: "",
                                };
                                return { ...f, pieces: newPieces };
                              });
                            }
                          }}
                          className={
                            piece.fittingCompleted
                              ? "bg-purple-600 hover:bg-purple-700 text-white h-8 text-xs"
                              : "h-8 text-xs"
                          }
                        >
                          {piece.fittingCompleted ? `Fitting (${piece.fittingCompletedBy})` : "Mark Fitting"}
                        </Button>
                      </div>

                      <div className="grid gap-1">
                        <Label className="text-[11px] text-muted-foreground">Dryclean Done</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant={piece.drycleanCompleted ? "default" : "outline"}
                          onClick={() => {
                            if (!piece.drycleanCompleted) {
                              const name = window.prompt("Enter employee name to confirm dryclean:");
                              if (name) {
                                const trimmed = name.trim();
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = {
                                    ...newPieces[index],
                                    drycleanCompleted: true,
                                    drycleanCompletedBy: trimmed,
                                  };
                                  return { ...f, pieces: newPieces };
                                });
                              }
                            } else {
                              setForm((f) => {
                                const newPieces = [...f.pieces];
                                newPieces[index] = {
                                  ...newPieces[index],
                                  drycleanCompleted: false,
                                  drycleanCompletedBy: "",
                                };
                                return { ...f, pieces: newPieces };
                              });
                            }
                          }}
                          className={
                            piece.drycleanCompleted
                              ? "bg-green-600 hover:bg-green-700 text-white h-8 text-xs"
                              : "h-8 text-xs"
                          }
                        >
                          {piece.drycleanCompleted ? `Cleaned (${piece.drycleanCompletedBy})` : "Mark Dryclean"}
                        </Button>
                      </div>

                      <div className="grid gap-1">
                        <Label className="text-[11px] text-muted-foreground">Admin Confirm</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant={piece.drycleanAdminConfirmed ? "default" : "outline"}
                          onClick={() => {
                            if (!piece.drycleanAdminConfirmed) {
                              const name = window.prompt("Enter Admin name to confirm:");
                              if (name) {
                                const trimmed = name.trim();
                                setForm((f) => {
                                  const newPieces = [...f.pieces];
                                  newPieces[index] = {
                                    ...newPieces[index],
                                    drycleanAdminConfirmed: true,
                                    drycleanAdminConfirmedBy: trimmed,
                                  };
                                  return { ...f, pieces: newPieces };
                                });
                              }
                            } else {
                              setForm((f) => {
                                const newPieces = [...f.pieces];
                                newPieces[index] = {
                                  ...newPieces[index],
                                  drycleanAdminConfirmed: false,
                                  drycleanAdminConfirmedBy: "",
                                };
                                return { ...f, pieces: newPieces };
                              });
                            }
                          }}
                          className={
                            piece.drycleanAdminConfirmed
                              ? "bg-blue-600 hover:bg-blue-700 text-white h-8 text-xs"
                              : "h-8 text-xs"
                          }
                        >
                          {piece.drycleanAdminConfirmed
                            ? `Confirmed (${piece.drycleanAdminConfirmedBy})`
                            : "Admin Confirm"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Payment & Notes Section */}
            <div className="space-y-4 rounded-lg border border-border bg-secondary/10 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground border-b border-border pb-2">
                Payment & Notes
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="advance">Amount Paid</Label>
                  <Input
                    id="advance"
                    type="number"
                    min={0}
                    value={form.advance}
                    onChange={(e) => setForm((c) => ({ ...c, advance: Number(e.target.value) }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="securityAmount">Security Deposit</Label>
                  <Input
                    id="securityAmount"
                    type="number"
                    min={0}
                    value={form.securityAmount}
                    onChange={(e) => setForm((c) => ({ ...c, securityAmount: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid gap-4 mt-2">
                <div className="grid gap-2">
                  <Label htmlFor="remark">Remark</Label>
                  <Textarea
                    id="remark"
                    value={form.remark}
                    onChange={(e) => setForm((c) => ({ ...c, remark: e.target.value }))}
                    placeholder="Any special notes"
                    rows={3}
                  />
                </div>
                <div className="grid gap-2 sm:max-w-sm">
                  <Label htmlFor="signature">Owner Signature</Label>
                  <div className="grid gap-2 rounded-md border border-border bg-background p-3">
                    {form.signature ? (
                      <img
                        src={form.signature}
                        alt="Owner signature"
                        className="h-20 w-full object-contain border border-border rounded-sm"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground mb-1">
                        Upload an image of the owner signature.
                      </p>
                    )}
                    <Input
                      id="signature"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleSignatureUpload(e.target.files?.[0])}
                      className="text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Summary Footer */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Computed total (Bill)
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="font-display text-2xl text-gold">{formatCurrencyINR(aggTotal)}</p>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                      Balance: {formatCurrencyINR(aggFinalDue)}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 space-y-0.5">
                    <p>{form.pieces.length} piece(s)</p>
                    <p>Security refund: {formatCurrencyINR(aggSecurityRefundDue)}</p>
                    {form.securityReturned ? <p className="text-emerald-600">Security clear</p> : null}
                  </div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  Total Rent: {formatCurrencyINR(aggSubtotal)}
                  <br />
                  Total Bill: {formatCurrencyINR(aggTotal)}
                </div>
              </div>

              <div className="rounded-md border border-border bg-secondary/40 px-4 py-3 flex flex-col justify-between">
                <div className="space-y-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground leading-tight">
                      {invoiceNote}
                    </p>
                  </div>

                  {/* Total Rental Balance Breakdown */}
                  <div className="border-t border-border/50 pt-3 space-y-2">
                    <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
                      Total Rental Balance
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total Rental:</span>
                        <span className="font-semibold text-gold">{formatCurrencyINR(aggSubtotal)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Security Deposit:</span>
                        <span className="font-semibold text-gold">{formatCurrencyINR(aggSecurity)}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border/50 pt-1">
                        <span className="text-muted-foreground">Total Bill:</span>
                        <span className="font-semibold text-gold">{formatCurrencyINR(aggTotal)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Amount Paid:</span>
                        <span className="font-semibold text-emerald-600">-{formatCurrencyINR(aggAdvance)}</span>
                      </div>
                      <div className="flex items-center justify-between bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                        <span className="text-red-600 font-semibold">Balance Due:</span>
                        <span className="font-bold text-red-600">{formatCurrencyINR(aggFinalDue)}</span>
                      </div>
                      {aggSecurityRefundDue > 0 && (
                        <div className="flex items-center justify-between pt-1 border-t border-border/50">
                          <span className="text-muted-foreground">Security Refund Due:</span>
                          <span className="font-semibold text-amber-600">
                            {formatCurrencyINR(aggSecurityRefundDue)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-1.5 mt-3 pt-3 border-t border-border/50">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={shareOnWhatsApp}
                  >
                    WA
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={printInvoice}
                  >
                    Print
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gold text-gold-foreground hover:bg-gold/90"
                disabled={loading || disabled}
              >
                {loading ? "Updating..." : "Update Rental"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AddPieceDialog
        open={addPieceOpen}
        onOpenChange={setAddPieceOpen}
      />

      <AddCustomerDialog
        open={addClientOpen}
        onOpenChange={setAddClientOpen}
        onCreated={(newCustId: string) => {
          const newCustomer = getCustomer(newCustId);
          setForm((f) => ({
            ...f,
            customerId: newCustId,
            address: (newCustomer as any)?.address || f.address,
          }));
        }}
      />
    </>
  );
}
