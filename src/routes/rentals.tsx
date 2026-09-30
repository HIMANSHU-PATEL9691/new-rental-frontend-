import { useState, useEffect, useMemo } from "react";

import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { formatImageUrl, FALLBACK_IMG } from "@/lib/api";
import type { RentalStatus } from "@/data/mock";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Edit2, Plus, Trash2, Search, Layers, Package, Phone } from "lucide-react";
import { EditRentalDialog } from "@/components/forms/EditRentalDialog";
import { NewRentalDialog } from "@/components/forms/NewRentalDialog";
import { ViewInvoiceDialog } from "@/components/forms/ViewInvoiceDialog";
import { matchesRentalSearch } from "@/lib/searchUtils";
import { toast } from "sonner";

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function isSafaItem(item: any) {
  const text = [item?.name, item?.category, item?.subcategory].filter(Boolean).join(" ").toLowerCase();
  return text.includes("safa");
}

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

function getDueAmount(rental: any, allRentals: any[] = []) {
  if (rental.billNo && allRentals.length > 0) {
    const relatedRentals = allRentals.filter((r) => r.billNo === rental.billNo);
    let aggTotal = 0;
    let aggAdvance = 0;
    for (const r of relatedRentals) {
      aggTotal += (Number(r.total) || 0) + (Number(r.securityAmount) || 0) + (Number(r.penalty) || 0) - (Number(r.discount) || 0);
      aggAdvance += Number(r.advance) || 0;
    }
    return Math.max(0, aggTotal - aggAdvance);
  }
  return Math.max(
    0,
    (Number(rental.total) || 0) +
      (Number(rental.securityAmount) || 0) +
      (Number(rental.penalty) || 0) -
      (Number(rental.discount) || 0) -
      (Number(rental.advance) || 0),
  );
}

export default function RentalsPage() {
  const navigate = useNavigate();
  const role = typeof window !== 'undefined' ? localStorage.getItem("user_role") : null;

  useEffect(() => {
    if (!role) {
      navigate({ to: "/login" });
    } else if (role !== "admin" && role !== "reception") {
      navigate({ to: "/availability" });
    }
  }, [role]);

  const { rentals, getItem, getCustomer, loading, deleteRental, searchQuery } = useStore();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState("");
  const [viewMode, setViewMode] = useState<"orders" | "pieces">("orders");
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const toggleOrderExpand = (billNo: string) => {
    setExpandedOrders((prev) => ({ ...prev, [billNo]: !prev[billNo] }));
  };

  const query = (localSearch || searchQuery || "").trim().toLowerCase();

  const dueAmountMap = useMemo(() => {
    const billTotals = new Map<string, { total: number; advance: number }>();
    for (const r of rentals) {
      if (r.billNo) {
        const current = billTotals.get(r.billNo) || { total: 0, advance: 0 };
        current.total += (Number(r.total) || 0) + (Number(r.securityAmount) || 0) + (Number(r.penalty) || 0) - (Number(r.discount) || 0);
        current.advance += Number(r.advance) || 0;
        billTotals.set(r.billNo, current);
      }
    }
    const dueMap = new Map<string, number>();
    for (const [billNo, totals] of billTotals.entries()) {
      dueMap.set(billNo, Math.max(0, totals.total - totals.advance));
    }
    return dueMap;
  }, [rentals]);

  const calcRentalDue = (rental: any) => {
    if (rental.billNo && dueAmountMap.has(rental.billNo)) {
      return dueAmountMap.get(rental.billNo)!;
    }
    return Math.max(
      0,
      (Number(rental.total) || 0) +
        (Number(rental.securityAmount) || 0) +
        (Number(rental.penalty) || 0) -
        (Number(rental.discount) || 0) -
        (Number(rental.advance) || 0),
    );
  };

  const filteredRentals = useMemo(() => {
    return rentals.filter((r) => {
      const item = getItem(r.itemId);
      const customer = getCustomer(r.customerId);
      const dueAmount = calcRentalDue(r);
      return matchesRentalSearch(r, item, customer, query, [
        String(r.total),
        String(dueAmount),
        String(r.discount),
        String(r.advance),
        String(r.securityAmount),
      ]);
    });
  }, [rentals, getItem, getCustomer, query, dueAmountMap]);

  // Group rentals by billNo (or fallback to id)
  const groupedOrders = useMemo(() => {
    const map = new Map<string, {
      billNo: string;
      primaryRental: any;
      items: Array<{ rental: any; item: any }>;
      customer: any;
      startDate: string;
      endDate: string;
      deliveryDate: string;
      totalRent: number;
      advance: number;
      securityAmount: number;
      dueAmount: number;
      status: RentalStatus;
      rentalIds: string[];
    }>();

    for (const r of filteredRentals) {
      const key = r.billNo ? `bill-${r.billNo}` : `id-${r.id}`;
      const item = getItem(r.itemId);
      const customer = getCustomer(r.customerId);

      if (!map.has(key)) {
        map.set(key, {
          billNo: r.billNo || r.id,
          primaryRental: r,
          items: [{ rental: r, item }],
          customer,
          startDate: r.startDate ? r.startDate.slice(0, 10) : "",
          endDate: r.endDate ? r.endDate.slice(0, 10) : "",
          deliveryDate: r.deliveryDate ? r.deliveryDate.slice(0, 10) : (r.startDate ? r.startDate.slice(0, 10) : ""),
          totalRent: Number(r.total) || 0,
          advance: Number(r.advance) || 0,
          securityAmount: Number(r.securityAmount) || 0,
          dueAmount: calcRentalDue(r),
          status: (r.status ?? "upcoming") as RentalStatus,
          rentalIds: [r.id],
        });
      } else {
        const entry = map.get(key)!;
        entry.items.push({ rental: r, item });
        entry.totalRent += Number(r.total) || 0;
        entry.advance += Number(r.advance) || 0;
        entry.securityAmount += Number(r.securityAmount) || 0;
        entry.rentalIds.push(r.id);

        const rStart = r.startDate ? r.startDate.slice(0, 10) : "";
        const rEnd = r.endDate ? r.endDate.slice(0, 10) : "";
        if (rStart && (!entry.startDate || rStart < entry.startDate)) {
          entry.startDate = rStart;
        }
        if (rEnd && (!entry.endDate || rEnd > entry.endDate)) {
          entry.endDate = rEnd;
        }
      }
    }

    return Array.from(map.values());
  }, [filteredRentals, getItem, getCustomer, dueAmountMap]);

  const totals = useMemo(() => ({
    active: filteredRentals.filter((r) => r.status === "active").length,
    upcoming: filteredRentals.filter((r) => r.status === "upcoming").length,
    overdue: filteredRentals.filter((r) => r.status === "overdue").length,
    returned: filteredRentals.filter((r) => r.status === "returned").length,
  }), [filteredRentals]);

  const getUniqueBillBalances = (rentalsList: typeof rentals) => {
    const bills = new Set<string>();
    let total = 0;
    let fallbackTotal = 0;

    for (const r of rentalsList) {
      if (r.billNo) {
        if (!bills.has(r.billNo)) {
          bills.add(r.billNo);
          total += calcRentalDue(r);
        }
      } else {
        fallbackTotal += calcRentalDue(r);
      }
    }
    return total + fallbackTotal;
  };

  // Calculate balance summary
  const balanceSummary = useMemo(() => ({
    active: getUniqueBillBalances(filteredRentals.filter((r) => r.status === "active")),
    upcoming: getUniqueBillBalances(filteredRentals.filter((r) => r.status === "upcoming")),
    overdue: getUniqueBillBalances(filteredRentals.filter((r) => r.status === "overdue")),
    returned: getUniqueBillBalances(filteredRentals.filter((r) => r.status === "returned")),
    total: getUniqueBillBalances(filteredRentals),
  }), [filteredRentals, dueAmountMap]);

  async function handleDelete(rentalIds: string | string[], billNo?: string) {
    const ids = Array.isArray(rentalIds) ? rentalIds : [rentalIds];
    console.info("[RentalsPage] delete requested", { ids, billNo });
    setDeletingId(ids[0]);
    try {
      for (const id of ids) {
        await deleteRental(id);
      }
      toast.success(`Order ${billNo || ids[0]} deleted`);
      console.info("[RentalsPage] delete success", { ids });
    } catch (error) {
      console.error("[RentalsPage] delete failed", { ids, error });
      toast.error(`Failed to delete order ${billNo || ids[0]}`);
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading rentals...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold font-bold">Ledger</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl">Rentals</h1>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-4 sm:mt-0">
          {/* View mode toggle */}
          <div className="flex items-center gap-1 bg-secondary/80 p-1 rounded-lg border border-border shrink-0 self-stretch sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("orders")}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                viewMode === "orders"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>By Orders ({groupedOrders.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("pieces")}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                viewMode === "pieces"
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Package className="h-3.5 w-3.5" />
              <span>All Pieces ({filteredRentals.length})</span>
            </button>
          </div>

          <div className="relative w-full sm:w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search bill no, item no..." 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-9 w-full bg-card border-border"
            />
          </div>
          <NewRentalDialog
            trigger={
              <Button className="bg-gold text-gold-foreground hover:bg-gold/90 self-start sm:self-auto w-full sm:w-auto font-medium">
                <Plus className="h-4 w-4 mr-1.5" /> New Rental
              </Button>
            }
          />
        </div>
      </div>

      {/* Metric Cards - Simple Modern Sans Numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {(["active", "upcoming", "overdue", "returned"] as const).map((k) => (
          <Card key={k} className="glass-panel p-4 sm:p-5">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
              {k}
            </p>
            <p className="font-sans font-bold text-2xl sm:text-3xl mt-2 text-foreground tracking-tight">
              {totals[k]}
            </p>
          </Card>
        ))}
      </div>

      {/* Balance Summary Cards - Simple Modern Sans Numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6 sm:mb-8">
        {(["active", "upcoming", "overdue", "returned"] as const).map((k) => (
          <Card key={`balance-${k}`} className="glass-panel p-4 sm:p-5 border-gold/20">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-semibold">
              {k} Balance
            </p>
            <p className={`font-sans font-bold text-lg sm:text-2xl mt-2 tracking-tight ${balanceSummary[k] > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {formatCurrencyINR(balanceSummary[k])}
            </p>
          </Card>
        ))}
        <Card className="glass-panel p-4 sm:p-5 border border-gold/30 bg-gold/5 col-span-2 lg:col-span-1">
          <p className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-gold font-bold">
            Total Balance
          </p>
          <p className={`font-sans font-bold text-2xl sm:text-3xl mt-2 tracking-tight ${balanceSummary.total > 0 ? "text-red-600" : "text-emerald-600"}`}>
            {formatCurrencyINR(balanceSummary.total)}
          </p>
        </Card>
      </div>

      {/* Mobile view */}
      <div className="space-y-3 sm:hidden">
        {groupedOrders.length === 0 && (
          <Card className="glass-panel p-6 text-center text-muted-foreground flex flex-col items-center justify-center gap-1">
            <p className="font-sans font-semibold text-base text-foreground">No rentals found</p>
            <p className="text-xs text-muted-foreground">
              {query
                ? `No rentals match "${query}". Please check your search term.`
                : "No rentals available. Create a rental to see it here."}
            </p>
          </Card>
        )}
        {viewMode === "orders" ? (
          groupedOrders.map((order) => (
            <Card key={order.billNo} className="glass-panel p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-xs bg-secondary px-2 py-0.5 rounded border border-border">
                    #{order.billNo}
                  </span>
                  <span className="ml-2 text-xs font-semibold text-foreground">
                    {order.customer?.name ?? "Walk-in Client"}
                  </span>
                </div>
                <StatusBadge status={order.status} kind="rental" />
              </div>

              {/* Compact pieces view: does not show every item name by default */}
              <div className="mt-3 border-t border-border pt-2.5">
                {(() => {
                  const first = order.items[0];
                  if (!first) return null;
                  const isExpanded = !!expandedOrders[order.billNo];

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5 text-xs">
                        <div className="relative shrink-0">
                          <img
                            src={formatImageUrl(first.item?.image)}
                            alt=""
                            className="h-10 w-8 object-cover rounded border border-border shrink-0 bg-secondary/40"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                            }}
                          />
                          {order.items.length > 1 && (
                            <span className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[8px] font-bold px-1 rounded-full">
                              +{order.items.length - 1}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-foreground truncate">{first.item?.name ?? "Piece"}</p>
                            {order.items.length > 1 && (
                              <span className="text-[10px] font-semibold text-gold bg-gold/10 px-1 py-0.2 rounded shrink-0">
                                +{order.items.length - 1} more
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground font-mono">
                            Item: {first.rental.itemNo || first.item?.customId || "N/A"}
                          </p>
                        </div>
                        {order.items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => toggleOrderExpand(order.billNo)}
                            className="text-[11px] text-gold font-semibold shrink-0 hover:underline cursor-pointer"
                          >
                            {isExpanded ? "Hide ▲" : `View all (${order.items.length}) ▼`}
                          </button>
                        )}
                      </div>

                      {isExpanded && (
                        <div className="pl-3 pt-2 border-t border-dashed border-border space-y-1.5">
                          {order.items.slice(1).map(({ rental: r, item }, idx) => (
                            <div key={r.id || idx} className="flex items-center gap-2 text-xs">
                              <img
                                src={formatImageUrl(item?.image)}
                                alt=""
                                className="h-8 w-6 object-cover rounded border border-border shrink-0 bg-secondary/40"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                                }}
                              />
                              <span className="font-medium text-foreground truncate">{item?.name || "Piece"}</span>
                              <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-1 py-0.5 rounded">
                                #{r.itemNo || item?.customId || "N/A"}
                              </span>
                              <span className="font-sans font-semibold text-slate-700 text-[11px] ml-auto">
                                {formatCurrencyINR(Number(r.total) || Number(r.rate) || 0)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="mt-3 pt-2.5 border-t border-border space-y-2 text-xs">
                <div className="flex items-center justify-between text-muted-foreground text-[11px]">
                  <span>Dates: <strong className="text-foreground font-sans font-medium">{formatDate(order.deliveryDate || order.startDate)} to {formatDate(order.endDate)}</strong></span>
                  {order.customer?.phone && (
                    <a href={`tel:${order.customer.phone}`} className="text-gold hover:underline font-mono text-[11px] font-semibold">
                      {order.customer.phone}
                    </a>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-1.5 bg-secondary/30 rounded-lg p-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Rent</p>
                    <p className="font-sans font-bold text-xs text-foreground mt-0.5">{formatCurrencyINR(order.totalRent)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Advance</p>
                    <p className="font-sans font-bold text-xs text-emerald-600 mt-0.5">{formatCurrencyINR(order.advance)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Due</p>
                    <p className={`font-sans font-bold text-xs mt-0.5 ${order.dueAmount > 0 ? "text-destructive" : "text-emerald-600"}`}>
                      {formatCurrencyINR(order.dueAmount)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 flex justify-end items-center gap-2">
                <ViewInvoiceDialog rental={order.primaryRental} />
                <EditRentalDialog
                  rental={order.primaryRental}
                  trigger={
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      className="h-8 w-8 border-border bg-transparent hover:bg-secondary/30"
                      aria-label={`Edit order ${order.billNo}`}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  }
                  disabled={deletingId === order.primaryRental.id}
                  onUpdated={() => toast.success(`Order ${order.billNo} updated`)}
                />
                <DeleteRentalDialog
                  rentalId={order.primaryRental.id}
                  billNo={order.billNo}
                  disabled={deletingId === order.primaryRental.id}
                  onDelete={() => handleDelete(order.rentalIds, order.billNo)}
                />
              </div>
            </Card>
          ))
        ) : (
          filteredRentals.map((r) => {
            const item = getItem(r.itemId);
            const customer = getCustomer(r.customerId);
            const dueAmount = getDueAmount(r, rentals);
            return (
              <Card key={r.id} className="glass-panel p-4">
                <div className="flex items-start gap-3">
                  <img
                    src={formatImageUrl(item?.image)}
                    alt=""
                    width={48}
                    height={64}
                    loading="lazy"
                    className="h-16 w-12 object-cover rounded border border-border shrink-0 bg-secondary/40"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-base leading-tight truncate text-foreground">
                          {item?.name ?? `Piece (${r.itemId || "unknown"})`}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          Item: {r.itemNo || item?.customId || "N/A"}
                        </p>
                      </div>
                      <StatusBadge status={r.status} kind="rental" />
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-mono bg-secondary px-1.5 py-0.5 rounded text-[11px] font-bold">
                          #{r.billNo || r.id}
                        </span>
                        <span className="ml-1.5 font-semibold text-foreground truncate">
                          {customer?.name ?? "Client"}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground font-medium shrink-0">
                        {formatDate(r.startDate)} to {formatDate(r.endDate)}
                      </span>
                    </div>

                    <div className="mt-2.5 grid grid-cols-3 gap-1 bg-secondary/30 rounded-lg p-1.5 text-center text-xs">
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Total</p>
                        <p className="font-sans font-bold text-xs text-foreground mt-0.5">{formatCurrencyINR(r.total)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Advance</p>
                        <p className="font-sans font-bold text-xs text-emerald-600 mt-0.5">{formatCurrencyINR(r.advance || 0)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">Due</p>
                        <p className={`font-sans font-bold text-xs mt-0.5 ${dueAmount > 0 ? "text-destructive" : "text-emerald-600"}`}>
                          {formatCurrencyINR(dueAmount)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex justify-end items-center gap-2">
                      <ViewInvoiceDialog rental={r} />
                      <EditRentalDialog
                        rental={r}
                        trigger={
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 border-border bg-transparent hover:bg-secondary/30"
                            aria-label={`Edit rental ${r.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        }
                        disabled={deletingId === r.id}
                        onUpdated={() => toast.success(`Rental ${r.id} updated`)}
                      />
                      <DeleteRentalDialog
                        rentalId={r.id}
                        billNo={r.billNo}
                        disabled={deletingId === r.id}
                        onDelete={() => handleDelete(r.id, r.billNo)}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Desktop / Tablet Table */}
      <Card className="glass-panel overflow-hidden p-0 hidden sm:block">
        <div className="overflow-x-auto">
          <Table className="w-full min-w-[750px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border bg-secondary/30">
                <TableHead className="text-[11px] font-bold uppercase tracking-wider w-24">
                  Order
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                  Piece(s) & Details
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                  Client
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider">
                  Dates
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">
                  Total
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right">
                  Due
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-center w-28">
                  Status
                </TableHead>
                <TableHead className="text-[11px] font-bold uppercase tracking-wider text-right w-36">
                  Action
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(viewMode === "orders" ? groupedOrders.length === 0 : filteredRentals.length === 0) && (
                <TableRow className="border-border hover:bg-transparent">
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <p className="font-sans font-semibold text-base text-foreground">No rentals found</p>
                      <p className="text-xs text-muted-foreground">
                        {query
                          ? `No rentals match "${query}". Please verify your search.`
                          : "No rented items found. Create a rental to show it here."}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {/* View Mode 1: By Orders (cleanly grouped by bill with all pieces) */}
              {viewMode === "orders" &&
                groupedOrders.map((order) => (
                  <TableRow
                    key={order.billNo}
                    className="border-border hover:bg-secondary/20 transition-colors"
                  >
                    {/* Order No */}
                    <TableCell className="align-top py-3.5">
                      <div className="space-y-1.5">
                        <span className="font-mono font-bold text-xs bg-secondary text-slate-800 border border-border px-2 py-0.5 rounded inline-block">
                          #{order.billNo}
                        </span>
                        {order.items.length > 1 && (
                          <span className="block text-[10px] font-semibold text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded w-fit">
                            {order.items.length} pieces
                          </span>
                        )}
                      </div>
                    </TableCell>

                    {/* Piece(s) - compact: does NOT show every item name */}
                    <TableCell className="align-top py-3.5">
                      {(() => {
                        const first = order.items[0];
                        if (!first) return <span className="text-xs text-muted-foreground">No pieces</span>;

                        const firstItem = first.item;
                        const firstRental = first.rental;

                        if (order.items.length === 1) {
                          return (
                            <div className="flex items-center gap-3">
                              <img
                                src={formatImageUrl(firstItem?.image)}
                                alt=""
                                width={40}
                                height={52}
                                loading="lazy"
                                className="h-12 w-9 object-cover rounded border border-border shrink-0 bg-secondary/40 shadow-xs"
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                                }}
                              />
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">
                                  {firstItem?.name ?? `Piece (${firstRental.itemId || "unknown"})`}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  <span className="font-mono text-[11px] font-medium text-slate-700 bg-secondary px-1.5 py-0.2 rounded border border-border/50">
                                    Item: {firstRental.itemNo || firstItem?.customId || firstItem?.id || "N/A"}
                                  </span>
                                  {isSafaItem(firstItem) && (firstRental as any).quantity > 1 && (
                                    <span className="text-[10px] text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded font-medium">
                                      Qty: {(firstRental as any).quantity}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        const isExpanded = !!expandedOrders[order.billNo];

                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-3">
                              <div className="relative shrink-0">
                                <img
                                  src={formatImageUrl(firstItem?.image)}
                                  alt=""
                                  width={40}
                                  height={52}
                                  loading="lazy"
                                  className="h-12 w-9 object-cover rounded border border-border shrink-0 bg-secondary/40 shadow-xs"
                                  onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                                  }}
                                />
                                <span className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-[9px] font-bold px-1 rounded-full shadow-xs">
                                  +{order.items.length - 1}
                                </span>
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-foreground truncate">
                                    {firstItem?.name ?? "Piece"}
                                  </p>
                                  <span className="text-[10px] font-semibold text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded shrink-0">
                                    +{order.items.length - 1} more
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                  <span className="font-mono text-[11px] font-medium text-slate-700 bg-secondary px-1.5 py-0.2 rounded border border-border/50">
                                    Item: {firstRental.itemNo || firstItem?.customId || "N/A"}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleOrderExpand(order.billNo);
                                    }}
                                    className="text-[11px] text-gold hover:underline font-semibold cursor-pointer"
                                  >
                                    {isExpanded ? "Hide items ▲" : `View all (${order.items.length}) ▼`}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Collapsible items list */}
                            {isExpanded && (
                              <div className="mt-2 pt-2 border-t border-dashed border-border space-y-1.5 pl-2">
                                {order.items.slice(1).map(({ rental: r, item }, idx) => (
                                  <div key={r.id || idx} className="flex items-center gap-2.5 text-xs">
                                    <img
                                      src={formatImageUrl(item?.image)}
                                      alt=""
                                      className="h-7 w-5 object-cover rounded border border-border shrink-0 bg-secondary/40"
                                      onError={(e) => {
                                        (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                                      }}
                                    />
                                    <span className="font-medium text-foreground truncate">{item?.name || "Piece"}</span>
                                    <span className="font-mono text-[10px] text-muted-foreground bg-secondary px-1 py-0.5 rounded shrink-0">
                                      #{r.itemNo || item?.customId || "N/A"}
                                    </span>
                                    <span className="font-sans font-semibold text-slate-700 text-[11px] shrink-0 ml-auto">
                                      {formatCurrencyINR(Number(r.total) || Number(r.rate) || 0)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </TableCell>

                    {/* Client */}
                    <TableCell className="align-top py-3.5">
                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-foreground">
                          {order.customer?.name ?? `Client (${order.primaryRental.customerId || "unknown"})`}
                        </p>
                        {order.customer?.phone && (
                          <p className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {order.customer.phone}
                          </p>
                        )}
                        {(order.customer?.address || order.primaryRental.address) && (
                          <p className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                            {order.customer?.address || order.primaryRental.address}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Dates */}
                    <TableCell className="align-top py-3.5 text-xs text-muted-foreground whitespace-nowrap">
                      <div className="font-sans font-medium text-foreground">
                        {formatDate(order.deliveryDate || order.startDate)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        to {formatDate(order.endDate)}
                      </div>
                    </TableCell>

                    {/* Total */}
                    <TableCell className="align-top py-3.5 text-right whitespace-nowrap">
                      <div className="font-sans font-bold text-sm sm:text-base text-foreground">
                        {formatCurrencyINR(order.totalRent)}
                      </div>
                      {order.advance > 0 && (
                        <div className="text-[11px] text-emerald-700 font-sans font-medium">
                          Paid: {formatCurrencyINR(order.advance)}
                        </div>
                      )}
                    </TableCell>

                    {/* Due */}
                    <TableCell className="align-top py-3.5 text-right whitespace-nowrap">
                      <div className={`font-sans font-bold text-sm sm:text-base ${order.dueAmount > 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {formatCurrencyINR(order.dueAmount)}
                      </div>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="align-top py-3.5 text-center">
                      <StatusBadge status={order.status} kind="rental" />
                    </TableCell>

                    {/* Action */}
                    <TableCell className="align-top py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <ViewInvoiceDialog rental={order.primaryRental} />
                        <EditRentalDialog
                          rental={order.primaryRental}
                          trigger={
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              className="h-8 w-8 border-border bg-transparent hover:bg-secondary/30"
                              aria-label={`Edit order ${order.billNo}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          }
                          disabled={deletingId === order.primaryRental.id}
                          onUpdated={() => toast.success(`Order ${order.billNo} updated`)}
                        />
                        <DeleteRentalDialog
                          rentalId={order.primaryRental.id}
                          billNo={order.billNo}
                          disabled={deletingId === order.primaryRental.id}
                          onDelete={() => handleDelete(order.rentalIds, order.billNo)}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}

              {/* View Mode 2: All Pieces */}
              {viewMode === "pieces" &&
                filteredRentals.map((r) => {
                  const item = getItem(r.itemId);
                  const customer = getCustomer(r.customerId);
                  const dueAmount = getDueAmount(r, rentals);
                  return (
                    <TableRow
                      key={r.id}
                      className="border-border hover:bg-secondary/20 transition-colors"
                    >
                      <TableCell className="text-xs font-mono font-medium text-slate-800">
                        #{r.billNo || r.id}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img
                            src={formatImageUrl(item?.image)}
                            alt=""
                            width={40}
                            height={52}
                            loading="lazy"
                            className="h-12 w-9 object-cover rounded border border-border shrink-0 bg-secondary/40 shadow-xs"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).src = FALLBACK_IMG;
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {item?.name ?? `Piece (${r.itemId || "unknown"})`}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              Item: {r.itemNo || item?.customId || item?.id || "N/A"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-semibold text-foreground">
                          {customer?.name ?? `Client (${r.customerId || "unknown"})`}
                        </div>
                        {customer?.phone && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {customer.phone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="font-medium text-foreground">
                          {formatDate(r.startDate)}
                        </div>
                        <div>to {formatDate(r.endDate)}</div>
                      </TableCell>
                      <TableCell className="text-right font-sans font-bold text-sm sm:text-base whitespace-nowrap text-foreground">
                        {formatCurrencyINR(r.total)}
                      </TableCell>
                      <TableCell className={`text-right font-sans font-bold text-sm sm:text-base whitespace-nowrap ${dueAmount > 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {formatCurrencyINR(dueAmount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <StatusBadge status={r.status} kind="rental" />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <ViewInvoiceDialog rental={r} />
                          <EditRentalDialog
                            rental={r}
                            trigger={
                              <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                className="h-8 w-8 border-border bg-transparent hover:bg-secondary/30"
                                aria-label={`Edit rental ${r.id}`}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            }
                            disabled={deletingId === r.id}
                            onUpdated={() => toast.success(`Rental ${r.id} updated`)}
                          />
                          <DeleteRentalDialog
                            rentalId={r.id}
                            billNo={r.billNo}
                            disabled={deletingId === r.id}
                            onDelete={() => handleDelete(r.id, r.billNo)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
      </Card>
    </AppShell>
  );
}

function DeleteRentalDialog({
  rentalId,
  billNo,
  disabled,
  onDelete,
}: {
  rentalId: string;
  billNo?: string;
  disabled: boolean;
  onDelete: () => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    await onDelete();
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="destructive"
          className="h-8 w-8 bg-destructive/90 text-destructive-foreground hover:bg-destructive"
          aria-label={`Delete rental ${rentalId}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-2xl">
            Delete order {billNo || rentalId}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will remove this order record from the rentals ledger.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={disabled}
            onClick={handleDelete}
          >
            {disabled ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
