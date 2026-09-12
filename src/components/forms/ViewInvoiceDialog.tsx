import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { Printer, Receipt, Download, MessageSquare, Eye, FileText, CheckCircle } from "lucide-react";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { formatImageUrl } from "@/lib/api";
import { toast } from "sonner";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import type { Rental } from "@/data/mock";

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

function isSafaItem(item: any) {
  const text = [item?.name, item?.category, item?.subcategory].filter(Boolean).join(" ").toLowerCase();
  return text.includes("safa");
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

const DEFAULT_POLICIES = `1. Please return the rented piece on or before the due date to avoid penalty charges.
2. Any damage, burns, or alterations to the piece will incur additional fees.
3. Booking advance is strictly non-refundable.
4. Original ID proof must be deposited at the time of pickup.

1. कृपया पेनल्टी शुल्क से बचने के लिए किराए पर ली गई ड्रेस को नियत तारीख पर या उससे पहले वापस करें।
2. ड्रेस में किसी भी प्रकार का नुकसान, जलने या बदलाव होने पर अतिरिक्त शुल्क लिया जाएगा।
3. बुकिंग एडवांस वापस नहीं किया जाएगा।
4. पिकअप के समय मूल आईडी प्रूफ जमा करना अनिवार्य है।`;

function getPoliciesHtml() {
  const policies = typeof window !== "undefined" ? localStorage.getItem("rental_policies") ?? DEFAULT_POLICIES : DEFAULT_POLICIES;
  return policies.replace(/\n/g, "<br/>");
}

interface ViewInvoiceDialogProps {
  rental: Rental;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ViewInvoiceDialog({
  rental,
  trigger,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
}: ViewInvoiceDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [mode, setMode] = useState<"A4" | "THERMAL">("A4");

  const isControlled = externalOpen !== undefined;
  const isOpen = isControlled ? externalOpen : internalOpen;
  const setIsOpen = isControlled ? (externalOnOpenChange || (() => {})) : setInternalOpen;

  const { rentals, getItem, getCustomer } = useStore();

  const customer = getCustomer(rental.customerId);

  const relatedRentals = useMemo(() => {
    if (rental.billNo) {
      return rentals.filter((r) => r.billNo === rental.billNo);
    }
    return [rental];
  }, [rentals, rental.billNo, rental.id]);

  const piecesData = useMemo(() => {
    let aggSubtotal = 0;
    let aggAdvance = 0;
    let aggSecurity = 0;
    let aggSecurityRefundDue = 0;
    let aggDiscount = 0;
    let aggPenalty = 0;

    const list = relatedRentals.map((r) => {
      const rItem = getItem(r.itemId);
      const rStartDate = r.startDate || "";
      const rEndDate = r.endDate || "";
      const rDeliveryDate = r.deliveryDate || rStartDate;
      const rDeliveryTime = (r as any).deliveryTime || "";
      const rDeliveryTimePeriod = (r as any).deliveryTimePeriod || "";
      const rEndTime = (r as any).endTime || "";
      const rEndTimePeriod = (r as any).endTimePeriod || "";
      const rQuantity = isSafaItem(rItem) ? Math.max(1, Number((r as any).quantity) || 1) : 1;
      const rLostQuantity = Number((r as any).lostQuantity) || 0;
      const rRate = getRentalAmount(r, rItem ? rItem.pricePerDay * daysBetween(rStartDate, rEndDate) : 0);
      const rSubtotal = rRate * rQuantity;

      aggSubtotal += rSubtotal;
      aggAdvance += Number(r.advance) || 0;
      aggSecurity += Number(r.securityAmount) || 0;
      aggDiscount += Number(r.discount) || 0;
      aggPenalty += Number(r.penalty) || 0;

      const rSecReturned = Boolean((r as any).securityReturned);
      const rSecAmt = Number(r.securityAmount) || 0;
      if (!(r.status === "returned" && rSecReturned)) {
        aggSecurityRefundDue += rSecAmt;
      }

      return {
        r,
        rItem,
        rStartDate,
        rEndDate,
        rDeliveryDate,
        rDeliveryTime,
        rDeliveryTimePeriod,
        rEndTime,
        rEndTimePeriod,
        rRate,
        rSubtotal,
        rQuantity,
        rLostQuantity,
      };
    });

    const aggTotal = aggSubtotal + aggSecurity + aggPenalty - aggDiscount;
    const aggFinalDue = Math.max(0, aggTotal - aggAdvance);

    return {
      pieces: list,
      aggSubtotal,
      aggAdvance,
      aggSecurity,
      aggDiscount,
      aggPenalty,
      aggTotal,
      aggSecurityRefundDue,
      aggFinalDue,
    };
  }, [relatedRentals, getItem]);

  const {
    pieces,
    aggSubtotal,
    aggAdvance,
    aggSecurity,
    aggDiscount,
    aggTotal,
    aggSecurityRefundDue,
    aggFinalDue,
  } = piecesData;

  const billMakingDate = (rental as any).billMakingDate
    ? new Date((rental as any).billMakingDate).toLocaleDateString("en-IN")
    : "-";

  const getInvoiceTitle = (status: string) => {
    const s = (status || "").toLowerCase();
    if (s === "upcoming") return "Booking Invoice";
    if (s === "active") return "Delivery Invoice";
    if (s === "returned") return "Final Invoice";
    if (s === "overdue") return "Overdue Final Bill";
    return "Invoice";
  };

  const invoiceTitle = getInvoiceTitle(rental.status);

  // Generate A4 HTML for print window
  function getA4Html() {
    const piecesHtml = pieces
      .map(
        ({ r, rItem, rDeliveryDate, rDeliveryTime, rDeliveryTimePeriod, rEndDate, rEndTime, rEndTimePeriod, rRate, rSubtotal, rQuantity, rLostQuantity }) => `
      <tr>
        <td style="padding: 6px; border-bottom: 1px solid #eaeaea; vertical-align: middle;">
          ${rItem?.image ? `<img src="${rItem.image}" style="width: 40px; height: 50px; object-fit: cover; border-radius: 4px;" />` : `<div style="width:40px;height:50px;background:#f3f4f6;border-radius:4px;"></div>`}
        </td>
        <td style="padding: 6px; border-bottom: 1px solid #eaeaea;">
          <strong style="font-size: 12px; color: #111;">${rItem?.name || "Unknown item"}</strong><br/>
          <span style="font-size: 10px; color: #666;">
            Qty: ${rQuantity}${rLostQuantity > 0 ? ` | Lost: ${rLostQuantity}` : ""} | 
            Del: ${formatDate(rDeliveryDate.slice(0, 10))}${rDeliveryTime ? ` ${rDeliveryTime}` : ""}${rDeliveryTimePeriod ? ` (${rDeliveryTimePeriod})` : ""} | 
            Return: ${formatDate(rEndDate.slice(0, 10))}${rEndTime ? ` ${rEndTime}` : ""}${rEndTimePeriod ? ` (${rEndTimePeriod})` : ""}
          </span>
        </td>
        <td style="padding: 6px; border-bottom: 1px solid #eaeaea; font-size: 11px;">${r.itemNo || r.itemId}</td>
        <td style="padding: 6px; border-bottom: 1px solid #eaeaea; text-align: right; font-size: 11px;">${formatCurrencyINR(rRate)}</td>
        <td style="padding: 6px; border-bottom: 1px solid #eaeaea; text-align: right; font-size: 11px; font-weight: bold;">${formatCurrencyINR(rSubtotal)}</td>
      </tr>
    `
      )
      .join("");

    return `
      <html>
        <head>
          <title>Invoice ${rental.billNo || rental.id}</title>
          <style>
            @page { size: A4; margin: 10mm 15mm; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #222; margin: 0; padding: 20px; background: #fff; }
            .header { display: flex; align-items: center; border-bottom: 2px solid #d4af37; padding-bottom: 10px; margin-bottom: 15px; }
            .logo { width: 50px; height: 50px; margin-right: 14px; }
            .company-info h1 { margin: 0; font-size: 20px; color: #111; letter-spacing: 1.2px; text-transform: uppercase; }
            .company-info p { margin: 2px 0 0 0; color: #555; font-size: 11px; }
            .invoice-title { margin-left: auto; text-align: right; }
            .invoice-title h2 { margin: 0; color: #d4af37; font-size: 24px; letter-spacing: 1px; text-transform: uppercase; }
            .invoice-title p { margin: 2px 0 0 0; font-size: 12px; color: #555; }
            .grid { display: flex; justify-content: space-between; margin-bottom: 15px; gap: 20px; }
            .col { flex: 1; }
            .label { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 3px; }
            .value { font-size: 12px; margin: 0 0 3px 0; line-height: 1.4; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
            th { padding: 6px; text-align: left; font-size: 10px; text-transform: uppercase; color: #666; letter-spacing: 0.5px; border-bottom: 2px solid #222; }
            .summary-box { width: 50%; margin-left: auto; margin-top: 10px; }
            .row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #eaeaea; font-size: 12px; }
            .row.total { font-weight: bold; font-size: 14px; border-top: 2px solid #222; border-bottom: none; padding-top: 8px; margin-top: 6px; color: #d4af37; }
            .signatures { display: flex; justify-content: space-between; margin-top: 30px; }
            .sign-box { flex: 0 0 42%; text-align: center; border-bottom: 1px solid #222; padding-bottom: 6px; }
            .sign-box p { margin: 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #666; }
            .sign-img { max-height: 50px; max-width: 100%; margin: 0 auto 4px auto; object-fit: contain; }
            .watermark { position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%) rotate(-45deg); font-size: 65px; color: rgba(212, 175, 55, 0.08); z-index: 0; white-space: nowrap; pointer-events: none; font-weight: bold; }
          </style>
        </head>
        <body>
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
              <p style="margin-bottom: 2px;">Address: Maharana Pratap chowk near gas agency</p>
              <p style="color: #111;">Contact: <strong>9907050222, 7509942222</strong> | Insta: <strong>Sajansagar_</strong></p>
            </div>
            <div class="invoice-title">
              <h2>${invoiceTitle}</h2>
              <p># ${rental.billNo || rental.id}</p>
              <p>Date: ${billMakingDate}</p>
            </div>
          </div>

          <div class="grid">
            <div class="col">
              <div class="label">Billed To</div>
              <p class="value"><strong>${customer?.name || rental.customerId}</strong></p>
              <p class="value">${customer?.email || ""}</p>
              <p class="value">${customer?.phone || ""}</p>
              <p class="value">${(rental as any).address || ""}</p>
              ${(rental as any).instaId ? `<p class="value"><strong>Insta ID:</strong> ${(rental as any).instaId}</p>` : ""}
            </div>
            <div class="col" style="text-align: right;">
              <div class="label">Rental Details</div>
              <p class="value"><strong>Status:</strong> ${rental.status.toUpperCase()}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 50px;">Image</th>
                <th>Item Description & Dates</th>
                <th>Item No</th>
                <th style="text-align: right;">Rate</th>
                <th style="text-align: right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${piecesHtml}
            </tbody>
          </table>

          <div class="summary-box">
            <div class="row"><span>Total Rent</span><span>${formatCurrencyINR(aggSubtotal)}</span></div>
            ${aggDiscount > 0 ? `<div class="row"><span>Discount</span><span>-${formatCurrencyINR(aggDiscount)}</span></div>` : ""}
            <div class="row"><span>Security Received</span><span>${formatCurrencyINR(aggSecurity)}</span></div>
            <div class="row"><span>Total Bill</span><span>${formatCurrencyINR(aggTotal)}</span></div>
            <div class="row"><span>Amount Paid</span><span>${formatCurrencyINR(aggAdvance)}</span></div>
            <div class="row"><span>Security Refund</span><span>${formatCurrencyINR(aggSecurityRefundDue)}</span></div>
            <div class="row total"><span>Balance Due</span><span>${formatCurrencyINR(aggFinalDue)}</span></div>
          </div>

          <div style="margin-top: 25px; font-size: 11px; color: #555; border-top: 1px solid #eaeaea; padding-top: 10px; line-height: 1.5;">
            <strong style="color: #222;">Terms & Conditions:</strong><br/>
            ${getPoliciesHtml()}
          </div>

          <div class="signatures">
            <div style="display: flex; align-items: flex-end; gap: 20px; flex: 1;">
              <div class="sign-box" style="flex: 1;">
                ${(rental as any).signature ? `<img src="${(rental as any).signature}" class="sign-img" />` : ""}
                <p>Authorized Signature</p>
              </div>
              <div style="padding-bottom: 5px;">
                <p class="value"><span style="font-size: 20px; vertical-align: middle;">${(rental as any).confirmationChecked ? "☑" : "☐"}</span> <strong style="vertical-align: middle;">Confirmed</strong></p>
              </div>
            </div>
            <div class="sign-box" style="flex: 1;">
              <p>Client Signature</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  // Generate Thermal Slip (80mm) HTML
  function getThermalHtml() {
    const thermalPiecesHtml = pieces
      .map(
        ({ r, rItem, rDeliveryDate, rEndDate, rDeliveryTime, rDeliveryTimePeriod, rEndTime, rEndTimePeriod, rRate, rQuantity, rLostQuantity }) => `
      ${rItem?.image ? `<div style="text-align: center; margin-bottom: 6px;"><img src="${rItem.image}" style="max-height: 80px; max-width: 100%; border-radius: 4px; object-fit: cover;" /></div>` : ""}
      <div style="font-weight: bold; margin-top: 4px;">${rItem?.name || "Unknown item"}</div>
      <div style="display: flex; justify-content: space-between; margin: 2px 0;"><span>Item No</span><span>${r.itemNo || r.itemId}</span></div>
      <div style="display: flex; justify-content: space-between; margin: 2px 0; font-size: 10px; color: #444;"><span>Del/Return</span><span>${formatDate(rDeliveryDate.slice(0, 10))} to ${formatDate(rEndDate.slice(0, 10))}</span></div>
      <div style="display: flex; justify-content: space-between; margin: 2px 0;"><span>Qty x Rate</span><span>${rQuantity} x ${formatCurrencyINR(rRate)}</span></div>
      ${rLostQuantity > 0 ? `<div style="display: flex; justify-content: space-between; margin: 2px 0; color: red;"><span>Lost Safa</span><span>${rLostQuantity}</span></div>` : ""}
      <div style="border-top: 1px dashed #bbb; margin: 6px 0;"></div>
    `
      )
      .join("");

    return `
      <html>
        <head>
          <title>Thermal Invoice ${rental.billNo || rental.id}</title>
          <style>
            @page { size: 80mm auto; margin: 0; }
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 12px 8px; color: #111; font-size: 11px; margin: 0; background: #fff; }
            .thermal-title { text-align: center; font-weight: 800; letter-spacing: 1px; margin-bottom: 6px; text-transform: uppercase; font-size: 13px; color: #d4af37; }
            .row { display: flex; justify-content: space-between; gap: 10px; margin: 3px 0; }
            .divider { border-top: 1px dashed #bbb; margin: 8px 0; }
            .total-row { font-weight: bold; font-size: 12px; }
          </style>
        </head>
        <body>
          <div style="text-align: center; font-size: 11px; font-weight: bold; margin-bottom: 6px;">
            <div style="margin-bottom: 2px;">॥ श्री शंखेश्वर पार्श्वनाथाय नमः ॥</div>
            <div>॥ श्री आदिनाथाय नमः ॥</div>
          </div>
          <div style="text-align: center; margin-bottom: 8px;">
            <h2 style="margin: 0; font-size: 15px;">SAJAN SAGAR COLLECTION</h2>
            <div style="font-size: 10px; margin-top: 2px; color: #444;">Address: Maharana Pratap chowk near gas agency</div>
            <div style="font-size: 10px; margin-top: 2px; color: #444;">Contact: 9907050222, 7509942222 | Insta: Sajansagar_</div>
          </div>
          <div class="thermal-title">${invoiceTitle}</div>
          <div class="row"><span>Invoice</span><span># ${rental.billNo || rental.id}</span></div>
          <div class="row"><span>Date</span><span>${billMakingDate}</span></div>
          <div class="row"><span>Client</span><span>${customer?.name || rental.customerId}</span></div>
          ${(rental as any).instaId ? `<div class="row"><span>Insta ID</span><span>${(rental as any).instaId}</span></div>` : ""}
          <div class="divider"></div>

          ${thermalPiecesHtml}

          <div class="row"><span>Total Rent</span><span>${formatCurrencyINR(aggSubtotal)}</span></div>
          <div class="row"><span>Security Received</span><span>${formatCurrencyINR(aggSecurity)}</span></div>
          <div class="row"><span>Total Bill</span><span>${formatCurrencyINR(aggTotal)}</span></div>
          <div class="row"><span>Amount Paid</span><span>${formatCurrencyINR(aggAdvance)}</span></div>
          <div class="row"><span>Security Refund</span><span>${formatCurrencyINR(aggSecurityRefundDue)}</span></div>
          <div class="row total-row"><span>Balance Dues</span><span>${formatCurrencyINR(aggFinalDue)}</span></div>

          <div class="divider"></div>
          <div style="font-size: 9px; margin-top: 8px; color: #444;">
            <strong style="font-size: 10px; color: #111;">Terms & Conditions:</strong><br/>
            ${getPoliciesHtml()}
          </div>
          <div style="text-align: center; margin-top: 12px; font-size: 10px; color: #666;">
            Thank you for choosing SAJAN SAGAR COLLECTION!
          </div>
        </body>
      </html>
    `;
  }

  function handlePrint(printMode: "A4" | "THERMAL" = "A4") {
    const htmlContent = printMode === "A4" ? getA4Html() : getThermalHtml();
    const printWindow = window.open("", "_blank", "width=850,height=950");
    if (!printWindow) {
      toast.error("Unable to open print popup. Check pop-up blocker settings.");
      return;
    }
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  async function handleDownloadPdf() {
    toast.info("Generating Invoice PDF...");
    try {
      const targetId = mode === "THERMAL" ? "printable-invoice-card-thermal" : "printable-invoice-card";
      const liveElement = document.getElementById(targetId) || document.getElementById("printable-invoice-card");

      if (!liveElement) {
        toast.error("Invoice preview not found.");
        return;
      }

      // Pre-convert all img elements in live preview to inline Base64 Data URLs
      const images = Array.from(liveElement.querySelectorAll("img"));
      const originalSrcs: { img: HTMLImageElement; origSrc: string }[] = [];

      for (const img of images) {
        const currentSrc = img.src;
        if (!currentSrc || currentSrc.startsWith("data:")) continue;
        originalSrcs.push({ img, origSrc: currentSrc });
        try {
          const targetUrl = formatImageUrl(currentSrc);
          const res = await fetch(targetUrl, { mode: "cors" });
          if (res.ok) {
            const blob = await res.blob();
            const base64 = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve((reader.result as string) || "");
              reader.onerror = () => resolve("");
              reader.readAsDataURL(blob);
            });
            if (base64) {
              img.src = base64;
            }
          }
        } catch (err) {
          console.warn("Base64 fetch fallback for image:", currentSrc, err);
        }
      }

      const isModernColor = (val: any) => {
        if (!val || typeof val !== "string") return false;
        return /oklch|oklab|lab|lch|color\(/i.test(val);
      };

      // 2. Temporarily disable all document stylesheets so html2canvas ignores Tailwind v4 cssRules
      const disabledSheets: CSSStyleSheet[] = [];
      Array.from(document.styleSheets).forEach((sheet) => {
        try {
          if (!sheet.disabled) {
            sheet.disabled = true;
            disabledSheets.push(sheet);
          }
        } catch (e) {}
      });

      // 3. Temporarily sanitize style elements in the main document while html2canvas initializes
      const mainStyleEls = Array.from(document.querySelectorAll("style"));
      const savedStyles: { el: HTMLStyleElement; original: string }[] = [];

      mainStyleEls.forEach((el) => {
        if (el.textContent && isModernColor(el.textContent)) {
          savedStyles.push({ el, original: el.textContent });
          el.textContent = el.textContent
            .replace(/oklch\([^)]+\)/gi, "#111111")
            .replace(/oklab\([^)]+\)/gi, "#111111")
            .replace(/lab\([^)]+\)/gi, "#111111")
            .replace(/lch\([^)]+\)/gi, "#111111")
            .replace(/color\([^)]+\)/gi, "#111111");
        }
      });

      let canvas: HTMLCanvasElement;
      try {
        // Render target element to canvas using html2canvas directly
        canvas = await html2canvas(liveElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          scrollX: 0,
          scrollY: 0,
          windowWidth: liveElement.scrollWidth || 794,
          onclone: (clonedDoc: Document) => {
            const win = clonedDoc.defaultView || window;

            // Intercept getComputedStyle (and getPropertyValue) to map any oklab / oklch color string to safe RGB/HEX
            if (win && win.getComputedStyle) {
              const origGetComputedStyle = win.getComputedStyle;
              win.getComputedStyle = function (el: Element, pseudoElt?: string | null) {
                const style = origGetComputedStyle.call(win, el, pseudoElt);
                return new Proxy(style, {
                  get(target, prop, receiver) {
                    if (prop === "getPropertyValue") {
                      return function (propertyName: string) {
                        try {
                          const val = target.getPropertyValue(propertyName);
                          if (typeof val === "string" && isModernColor(val)) {
                            const propLower = String(propertyName).toLowerCase();
                            if (propLower.includes("shadow")) return "none";
                            if (propLower.includes("background")) return "rgb(255, 255, 255)";
                            if (propLower.includes("border")) return "rgb(229, 231, 235)";
                            return "rgb(17, 17, 17)";
                          }
                          return val;
                        } catch (e) {
                          return "";
                        }
                      };
                    }
                    const val = Reflect.get(target, prop, receiver);
                    if (typeof val === "string" && isModernColor(val)) {
                      const propName = String(prop).toLowerCase();
                      if (propName.includes("shadow")) return "none";
                      if (propName.includes("background")) return "rgb(255, 255, 255)";
                      if (propName.includes("border")) return "rgb(229, 231, 235)";
                      return "rgb(17, 17, 17)";
                    }
                    return typeof val === "function" ? val.bind(target) : val;
                  },
                });
              };
            }

            // Remove/Replace any raw oklab/oklch occurrences inside style tags
            const styleEls = Array.from(clonedDoc.getElementsByTagName("style"));
            styleEls.forEach((style) => {
              if (style.textContent && isModernColor(style.textContent)) {
                style.textContent = style.textContent
                  .replace(/oklch\([^)]+\)/gi, "#111111")
                  .replace(/oklab\([^)]+\)/gi, "#111111")
                  .replace(/lab\([^)]+\)/gi, "#111111")
                  .replace(/lch\([^)]+\)/gi, "#111111")
                  .replace(/color\([^)]+\)/gi, "#111111");
              }
            });

            // Explicitly sanitize inline styles on all elements in clonedTarget
            const clonedTarget = clonedDoc.getElementById(targetId) || clonedDoc.getElementById("printable-invoice-card");
            if (clonedTarget) {
              const allEls = [clonedTarget, ...Array.from(clonedTarget.querySelectorAll("*"))] as HTMLElement[];
              allEls.forEach((el) => {
                try {
                  el.style.boxShadow = "none";
                  el.style.textShadow = "none";
                  el.style.filter = "none";
                  const comp = win.getComputedStyle(el);
                  if (comp) {
                    if (isModernColor(comp.backgroundColor)) {
                      el.style.backgroundColor = "#ffffff";
                    }
                    if (isModernColor(comp.color)) {
                      el.style.color = "#111111";
                    }
                    if (isModernColor(comp.borderColor)) {
                      el.style.borderColor = "#e5e7eb";
                    }
                  }
                } catch (e) {
                  el.style.color = "#111111";
                }
              });
            }

            // Mark all cloned images as crossOrigin = anonymous
            const imgEls = Array.from(clonedDoc.querySelectorAll("img"));
            imgEls.forEach((img) => {
              img.setAttribute("crossOrigin", "anonymous");
            });
          },
        });
      } finally {
        // Re-enable document stylesheets
        disabledSheets.forEach((sheet) => {
          try {
            sheet.disabled = false;
          } catch (e) {}
        });

        // Restore original main document style text
        for (const { el, original } of savedStyles) {
          el.textContent = original;
        }

        // Restore original src URLs immediately
        for (const { img, origSrc } of originalSrcs) {
          img.src = origSrc;
        }
      }

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      const filenameSafe = `${rental.billNo || "Invoice"}-${rental.id}`.replace(/[^a-z0-9-_]/gi, "-");
      const filename = `Invoice-${filenameSafe}.pdf`;

      // Build PDF using jsPDF directly
      if (mode === "THERMAL") {
        const pdfWidth = 80;
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        const pdf = new jsPDF({
          unit: "mm",
          format: [pdfWidth, Math.max(100, pdfHeight)],
          orientation: "portrait",
        });
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, pdfHeight);
        pdf.save(filename);
      } else {
        const pdf = new jsPDF({
          unit: "mm",
          format: "a4",
          orientation: "portrait",
        });
        const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
        const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm
        const margin = 8;
        const imgWidth = pdfWidth - margin * 2;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;

        let heightLeft = imgHeight;
        let position = margin;

        pdf.addImage(imgData, "JPEG", margin, position, imgWidth, Math.min(imgHeight, pdfHeight - margin * 2));
        heightLeft -= (pdfHeight - margin * 2);

        while (heightLeft > 0) {
          position = heightLeft - (pdfHeight - margin * 2);
          pdf.addPage();
          pdf.addImage(imgData, "JPEG", margin, margin, imgWidth, Math.min(heightLeft, pdfHeight - margin * 2));
          heightLeft -= (pdfHeight - margin * 2);
        }

        pdf.save(filename);
      }

      toast.success("Invoice downloaded as PDF!");
    } catch (err) {
      console.error("PDF Download error:", err);
      toast.error("Failed to generate PDF download.");
    }
  }

  function handleShareWhatsApp() {
    const phone = customer?.phone ? customer.phone.replace(/[^0-9]/g, "") : "";
    const message = `*SAJAN SAGAR COLLECTION - ${invoiceTitle}*
      
*Invoice:* ${rental.billNo || rental.id}
*Date:* ${billMakingDate}
*Client:* ${customer?.name || rental.customerId}
*Pieces:* 
${pieces
  .map(
    (p) =>
      `- ${p.rItem?.name || "Piece"} (${p.r.itemNo || p.r.itemId}) [Qty: ${p.rQuantity} | Del: ${formatDate(p.rDeliveryDate.slice(0, 10))} | Return: ${formatDate(p.rEndDate.slice(0, 10))}] - ${formatCurrencyINR(p.rSubtotal)}`
  )
  .join("\n")}

*Total Rent:* ${formatCurrencyINR(aggSubtotal)}
*Security Received:* ${formatCurrencyINR(aggSecurity)}
*Total Bill:* ${formatCurrencyINR(aggTotal)}
*Amount Paid:* ${formatCurrencyINR(aggAdvance)}
*Balance Due:* ${formatCurrencyINR(aggFinalDue)}

Thank you for choosing SAJAN SAGAR COLLECTION!`;

    const url = phone ? `https://wa.me/91${phone}?text=${encodeURIComponent(message)}` : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {trigger ? (
        <DialogTrigger asChild>{trigger}</DialogTrigger>
      ) : (
        <DialogTrigger asChild>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8 border-gold/40 text-gold hover:bg-gold/10"
            title="View & Print Invoice"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden bg-background border-gold/30">
        {/* Top Dialog Header */}
        <DialogHeader className="p-4 sm:p-6 border-b border-border bg-secondary/30 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] uppercase tracking-[0.3em] text-gold font-semibold font-mono">
                INVOICE PREVIEW
              </span>
              <span className="text-muted-foreground">•</span>
              <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-gold/10 text-gold border border-gold/30 font-semibold">
                {rental.billNo || rental.id}
              </span>
              <StatusBadge status={rental.status} kind="rental" />
            </div>
            <DialogTitle className="font-display text-xl sm:text-2xl mt-1.5">
              {invoiceTitle} - {customer?.name || "Client Invoice"}
            </DialogTitle>
          </div>

          {/* Action Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-secondary rounded-lg p-0.5 border border-border">
              <button
                type="button"
                onClick={() => setMode("A4")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  mode === "A4" ? "bg-gold text-gold-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                A4 Paper
              </button>
              <button
                type="button"
                onClick={() => setMode("THERMAL")}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  mode === "THERMAL" ? "bg-gold text-gold-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                POS Slip (80mm)
              </button>
            </div>

            <Button
              onClick={() => handlePrint(mode)}
              className="bg-gold text-gold-foreground hover:bg-gold/90 text-xs font-semibold h-9 px-3 gap-1.5 shadow-md"
            >
              <Printer className="h-4 w-4" /> Print Invoice
            </Button>

            <Button
              variant="outline"
              onClick={handleDownloadPdf}
              className="border-gold/40 text-foreground hover:bg-gold/10 text-xs font-semibold h-9 px-3 gap-1.5"
            >
              <Download className="h-4 w-4" /> PDF
            </Button>

            <Button
              variant="outline"
              onClick={handleShareWhatsApp}
              className="border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 text-xs font-semibold h-9 px-3 gap-1.5"
            >
              <MessageSquare className="h-4 w-4" /> WhatsApp
            </Button>
          </div>
        </DialogHeader>

        {/* Live Rendered Invoice Sheet */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-zinc-950/60 flex justify-center">
          {mode === "A4" ? (
            <div id="printable-invoice-card" className="w-full max-w-3xl bg-white text-zinc-900 rounded-lg shadow-2xl p-6 sm:p-10 border border-zinc-200 min-h-[700px] text-xs font-sans relative">
              {/* Watermark */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-[-45deg] text-5xl font-extrabold text-amber-500/10 select-none pointer-events-none whitespace-nowrap">
                SAJAN SAGAR COLLECTION
              </div>

              {/* Devotional Heading */}
              <div className="text-center font-bold text-amber-700 text-sm mb-3">
                <p>॥ श्री शंखेश्वर पार्श्वनाथाय नमः ॥</p>
                <p className="mt-0.5">॥ श्री आदिनाथाय नमः ॥</p>
              </div>

              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-amber-600 pb-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center text-amber-500 font-serif italic text-2xl font-bold shadow">
                    SS
                  </div>
                  <div>
                    <h1 className="font-serif text-lg font-bold uppercase tracking-wider text-black">
                      SAJAN SAGAR COLLECTION
                    </h1>
                    <p className="text-[11px] text-zinc-600">Address: Maharana Pratap chowk near gas agency</p>
                    <p className="text-[11px] text-zinc-900 font-medium">
                      Contact: <strong>9907050222, 7509942222</strong> | Insta: <strong>Sajansagar_</strong>
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <h2 className="text-xl font-bold text-amber-600 uppercase tracking-wide">
                    {invoiceTitle}
                  </h2>
                  <p className="text-xs font-semibold text-zinc-700"># {rental.billNo || rental.id}</p>
                  <p className="text-[11px] text-zinc-500">Date: {billMakingDate}</p>
                </div>
              </div>

              {/* Billed To Grid */}
              <div className="grid grid-cols-2 gap-4 mb-5 pb-3 border-b border-zinc-200">
                <div>
                  <p className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider mb-1">
                    Billed To
                  </p>
                  <p className="text-sm font-bold text-zinc-900">{customer?.name || rental.customerId}</p>
                  {customer?.email && <p className="text-xs text-zinc-600">{customer.email}</p>}
                  {customer?.phone && <p className="text-xs text-zinc-600">Phone: {customer.phone}</p>}
                  {(rental as any).address && <p className="text-xs text-zinc-600">Address: {(rental as any).address}</p>}
                  {(rental as any).instaId && <p className="text-xs text-zinc-600 font-medium">Insta ID: {(rental as any).instaId}</p>}
                </div>

                <div className="text-right">
                  <p className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider mb-1">
                    Rental Details
                  </p>
                  <p className="text-xs font-semibold text-zinc-900">
                    Status: <span className="uppercase text-amber-600">{rental.status}</span>
                  </p>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-left border-collapse mb-5">
                <thead>
                  <tr className="border-b-2 border-zinc-900 text-[10px] uppercase tracking-wider text-zinc-600">
                    <th className="py-2 px-1">Piece</th>
                    <th className="py-2 px-1">Item Description & Dates</th>
                    <th className="py-2 px-1">Item No</th>
                    <th className="py-2 px-1 text-right">Rate</th>
                    <th className="py-2 px-1 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {pieces.map(({ r, rItem, rDeliveryDate, rEndDate, rDeliveryTime, rDeliveryTimePeriod, rEndTime, rEndTimePeriod, rRate, rSubtotal, rQuantity, rLostQuantity }) => (
                    <tr key={r.id}>
                      <td className="py-2 px-1">
                        {rItem?.image ? (
                          <img src={formatImageUrl(rItem.image)} alt="" className="w-10 h-12 object-cover rounded border border-zinc-200" />
                        ) : (
                          <div className="w-10 h-12 bg-zinc-100 rounded border border-zinc-200" />
                        )}
                      </td>
                      <td className="py-2 px-1">
                        <p className="font-bold text-zinc-900 text-xs">{rItem?.name || "Unknown item"}</p>
                        <p className="text-[10px] text-zinc-500">
                          Qty: {rQuantity}{rLostQuantity > 0 ? ` | Lost: ${rLostQuantity}` : ""} | Del: {formatDate(rDeliveryDate.slice(0, 10))}{rDeliveryTime ? ` ${rDeliveryTime}` : ""}${rDeliveryTimePeriod ? ` (${rDeliveryTimePeriod})` : ""} | Return: {formatDate(rEndDate.slice(0, 10))}{rEndTime ? ` ${rEndTime}` : ""}${rEndTimePeriod ? ` (${rEndTimePeriod})` : ""}
                        </p>
                      </td>
                      <td className="py-2 px-1 font-mono text-xs">{r.itemNo || r.itemId}</td>
                      <td className="py-2 px-1 text-right font-medium">{formatCurrencyINR(rRate)}</td>
                      <td className="py-2 px-1 text-right font-bold text-zinc-900">{formatCurrencyINR(rSubtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Summary Box */}
              <div className="w-full sm:w-1/2 ml-auto space-y-1.5 text-xs mb-6 bg-zinc-50 p-4 rounded-lg border border-zinc-200">
                <div className="flex justify-between text-zinc-600">
                  <span>Total Rent</span>
                  <span className="font-medium text-zinc-900">{formatCurrencyINR(aggSubtotal)}</span>
                </div>
                {aggDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount</span>
                    <span className="font-medium">-{formatCurrencyINR(aggDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-600">
                  <span>Security Deposit Received</span>
                  <span className="font-medium text-zinc-900">{formatCurrencyINR(aggSecurity)}</span>
                </div>
                <div className="flex justify-between text-zinc-800 font-semibold border-t border-zinc-200 pt-1.5">
                  <span>Total Bill Amount</span>
                  <span>{formatCurrencyINR(aggTotal)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Amount Paid / Advance</span>
                  <span>{formatCurrencyINR(aggAdvance)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Security Refund</span>
                  <span>{formatCurrencyINR(aggSecurityRefundDue)}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-bold text-sm border-t-2 border-zinc-900 pt-2 mt-2">
                  <span>Rental Balance Due</span>
                  <span>{formatCurrencyINR(aggFinalDue)}</span>
                </div>
              </div>

              {/* Policies */}
              <div className="border-t border-zinc-200 pt-3 text-[10px] text-zinc-600 leading-relaxed mb-8">
                <strong className="text-zinc-900 text-xs font-bold">Terms & Conditions:</strong>
                <p className="mt-1 whitespace-pre-line">{DEFAULT_POLICIES}</p>
              </div>

              {/* Signatures */}
              <div className="flex justify-between items-end pt-4 border-t border-zinc-200">
                <div className="text-center w-40">
                  {(rental as any).signature && (
                    <img src={formatImageUrl((rental as any).signature)} alt="Signature" className="max-h-12 mx-auto mb-1 object-contain" />
                  )}
                  <div className="border-b border-zinc-900 pb-1 mb-1 font-semibold text-[10px] uppercase tracking-wider text-zinc-500">
                    Authorized Signature
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-zinc-700">
                  <CheckCircle className="w-4 h-4 text-emerald-600" /> <strong>Confirmed Order</strong>
                </div>
                <div className="text-center w-40 border-b border-zinc-900 pb-1 mb-1 font-semibold text-[10px] uppercase tracking-wider text-zinc-500">
                  Client Signature
                </div>
              </div>
            </div>
          ) : (
            /* Thermal POS Slip Preview (80mm) */
            <div id="printable-invoice-card-thermal" className="w-[340px] bg-white text-zinc-900 rounded-lg shadow-2xl p-4 border border-zinc-300 text-xs font-mono">
              <div className="text-center font-bold text-amber-700 text-xs mb-2">
                <p>॥ श्री शंखेश्वर पार्श्वनाथाय नमः ॥</p>
                <p>॥ श्री आदिनाथाय नमः ॥</p>
              </div>

              <div className="text-center mb-3">
                <h2 className="font-bold text-base text-black uppercase">SAJAN SAGAR COLLECTION</h2>
                <p className="text-[10px] text-zinc-600">Maharana Pratap chowk near gas agency</p>
                <p className="text-[10px] text-zinc-600">Contact: 9907050222, 7509942222</p>
              </div>

              <div className="text-center font-bold uppercase text-amber-600 border-y border-zinc-300 py-1 mb-3">
                {invoiceTitle}
              </div>

              <div className="space-y-1 text-[11px] mb-3">
                <div className="flex justify-between"><span>Bill No:</span><span className="font-bold">{rental.billNo || rental.id}</span></div>
                <div className="flex justify-between"><span>Date:</span><span>{billMakingDate}</span></div>
                <div className="flex justify-between"><span>Client:</span><span className="font-semibold">{customer?.name || rental.customerId}</span></div>
                {(rental as any).instaId && <div className="flex justify-between"><span>Insta ID:</span><span>{(rental as any).instaId}</span></div>}
              </div>

              <div className="border-t border-dashed border-zinc-400 my-2" />

              {pieces.map(({ r, rItem, rDeliveryDate, rEndDate, rRate, rQuantity }) => (
                <div key={r.id} className="mb-2 pb-2 border-b border-dashed border-zinc-300 text-[11px]">
                  <p className="font-bold text-black">{rItem?.name || "Unknown item"}</p>
                  <div className="flex justify-between text-zinc-600"><span>Item No:</span><span>{r.itemNo || r.itemId}</span></div>
                  <div className="flex justify-between text-zinc-600"><span>Dates:</span><span>{formatDate(rDeliveryDate.slice(0, 10))} - {formatDate(rEndDate.slice(0, 10))}</span></div>
                  <div className="flex justify-between font-medium mt-1"><span>{rQuantity} x {formatCurrencyINR(rRate)}</span><span>{formatCurrencyINR(rRate * rQuantity)}</span></div>
                </div>
              ))}

              <div className="space-y-1 text-xs pt-1">
                <div className="flex justify-between"><span>Total Rent:</span><span>{formatCurrencyINR(aggSubtotal)}</span></div>
                <div className="flex justify-between"><span>Security Recd:</span><span>{formatCurrencyINR(aggSecurity)}</span></div>
                <div className="flex justify-between font-semibold"><span>Total Bill:</span><span>{formatCurrencyINR(aggTotal)}</span></div>
                <div className="flex justify-between text-emerald-700"><span>Amount Paid:</span><span>{formatCurrencyINR(aggAdvance)}</span></div>
                <div className="flex justify-between font-bold text-amber-700 text-sm border-t border-zinc-900 pt-1 mt-1">
                  <span>Balance Due:</span><span>{formatCurrencyINR(aggFinalDue)}</span>
                </div>
              </div>

              <div className="border-t border-dashed border-zinc-400 my-3" />
              <p className="text-[9px] text-zinc-500 text-center">Thank you for choosing SAJAN SAGAR COLLECTION!</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
