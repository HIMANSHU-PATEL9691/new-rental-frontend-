import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, CheckCircle, Calendar, ArrowDownLeft, Search, Clock } from "lucide-react";
import { toast } from "sonner";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewInvoiceDialog } from "@/components/forms/ViewInvoiceDialog";
import { matchesRentalSearch } from "@/lib/searchUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

function today() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

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

export function DeliveriesPage() {
  const { rentals, items, customers, updateRental } = useStore();
  const storedRole = typeof window !== 'undefined' ? localStorage.getItem("user_role")?.trim().toLowerCase() || "" : "";
  const [role, setRole] = useState(storedRole);
  const [selectedDate, setSelectedDate] = useState(() => today());
  const [statusFilter, setStatusFilter] = useState("all");
  const [localSearch, setLocalSearch] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const canUpdateDeliveries = ["admin", "reception"].includes(role);
  const canSeeFinancials = ["admin", "reception"].includes(role);

  useEffect(() => {
    if (!role) {
      setRole(localStorage.getItem("user_role")?.trim().toLowerCase() || "");
    }
  }, [role]);

  const deliveriesList = useMemo(() => {
    const query = localSearch.trim().toLowerCase();
    const targetStr = selectedDate.slice(0, 10);

    return rentals
      .filter((r) => {
        const startStr = (r.deliveryDate || r.startDate || "").slice(0, 10);
        const endStr = (r.endDate || "").slice(0, 10);
        const actualReturnStr = ((r as any).returnedAt || (r as any).updatedAt || r.endDate || "").slice(0, 10);
        
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        
        if (statusFilter === "returned") {
          return targetStr === endStr || targetStr === actualReturnStr;
        }
        
        if (r.status === "returned") {
          return targetStr === startStr || targetStr === endStr || targetStr === actualReturnStr;
        }
        
        const fallsWithin = targetStr >= startStr && targetStr <= endStr;
        const isPendingAction = endStr < targetStr;
        
        return fallsWithin || isPendingAction;
      })
      .map((rental) => {
        const item = items.find((i) => i.id === rental.itemId);
        const customer = customers.find((c) => c.id === rental.customerId);
        return { ...rental, customer, item };
      })
      .filter((r) => matchesRentalSearch(r, r.item, r.customer, query));
  }, [rentals, items, customers, selectedDate, statusFilter, localSearch]);

  const handleStatusUpdate = async (rental: any, newStatus: string, message: string) => {
    setUpdating(rental.id);
    try {
      const payload: any = { status: newStatus };
      if (typeof rental.advance === "number") {
        payload.advance = rental.advance;
      }
      if (newStatus === "returned") {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        payload.returnedAt = d.toISOString();
        if (rental.securityReturned) {
          payload.securityReturned = true;
        }
        if (rental.securityReturnedAt) {
          payload.securityReturnedAt = rental.securityReturnedAt;
        }
      }

      await updateRental(rental.id, payload);
      toast.success(message);
    } catch (err) {
      toast.error("Failed to update status.");
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  const handleDeliver = (rental: any) => {
    const isItemReadyPending = !(rental as any).remarkCompleted;
    const isFittingPending = !(rental as any).fittingCompleted;
    const isDrycleanPending = !(rental as any).drycleanCompleted;

    if (isItemReadyPending || isFittingPending || isDrycleanPending) {
      const pendingTasks = [];
      if (isItemReadyPending) pendingTasks.push("Item Readiness");
      if (isFittingPending) pendingTasks.push("Fitting");
      if (isDrycleanPending) pendingTasks.push("Dryclean");
      
      const errMsg = `Delivery Blocked!\nThe following checks are still PENDING:\n• ${pendingTasks.join("\n• ")}\n\nDelivery cannot be processed until all checks are marked READY.`;
      toast.error(`Cannot deliver! Pending: ${pendingTasks.join(", ")}`);
      alert(errMsg);
      return;
    }

    const relatedRentals = rental.billNo ? rentals.filter((r) => r.billNo === rental.billNo) : [rental];
    let aggRent = 0;
    let aggSecurity = 0;
    let aggAdvance = 0;
    for (const r of relatedRentals) {
      aggRent += (Number(r.total) || 0) + (Number(r.penalty) || 0) - (Number(r.discount) || 0);
      aggSecurity += Number(r.securityAmount) || 0;
      aggAdvance += Number(r.advance) || 0;
    }
    const totalBill = aggRent + aggSecurity;
    const balance = Math.max(0, totalBill - aggAdvance);

    let msg = `Are you sure you want to mark this product as delivered?\n\n`;
    msg += `Payment Summary:\n`;
    msg += `• Total Rent: ${formatCurrencyINR(aggRent)}\n`;
    if (aggSecurity > 0) msg += `• Security Deposit: ${formatCurrencyINR(aggSecurity)}\n`;
    msg += `• Total Bill: ${formatCurrencyINR(totalBill)}\n`;
    msg += `• Amount Paid: ${formatCurrencyINR(aggAdvance)}\n`;
    msg += `• Balance Due: ${formatCurrencyINR(balance)}\n\n`;

    if (balance > 0) {
      msg += `Pending Balance to collect: ${formatCurrencyINR(balance)}\n\n`;
    }
    msg += `Click OK to confirm delivery and collect any remaining balance.`;

    const confirmed = window.confirm(msg);
    if (confirmed) {
      const updates: any = {};
      if (balance > 0) {
        updates.advance = (rental.advance || 0) + balance;
      }
      handleStatusUpdate({ ...rental, ...updates }, "active", "Product marked as delivered (Active)!");
    }
  };

  const handleReturn = (rental: any) => {
    const relatedRentals = rental.billNo ? rentals.filter((r) => r.billNo === rental.billNo) : [rental];
    let aggRent = 0;
    let aggSecurity = 0;
    let aggAdvance = 0;
    for (const r of relatedRentals) {
      aggRent += (Number(r.total) || 0) + (Number(r.penalty) || 0) - (Number(r.discount) || 0);
      aggSecurity += Number(r.securityAmount) || 0;
      aggAdvance += Number(r.advance) || 0;
    }
    const totalBill = aggRent + aggSecurity;
    const balance = Math.max(0, totalBill - aggAdvance);
    const securityToRefund = (rental.securityAmount || 0) > 0 && !(rental as any).securityReturned ? rental.securityAmount : 0;
    
    let msg = `Are you sure you want to mark this product as returned?\n\n`;
    msg += `Payment Summary:\n`;
    msg += `• Total Rent: ${formatCurrencyINR(aggRent)}\n`;
    if (aggSecurity > 0) msg += `• Security Deposit: ${formatCurrencyINR(aggSecurity)}\n`;
    msg += `• Total Bill: ${formatCurrencyINR(totalBill)}\n`;
    msg += `• Amount Paid: ${formatCurrencyINR(aggAdvance)}\n`;
    msg += `• Balance Due: ${formatCurrencyINR(balance)}\n`;
    
    if (balance > 0) {
      msg += `\nPending Balance to collect: ${formatCurrencyINR(balance)}`;
    }
    if (securityToRefund > 0) {
      msg += `\nSecurity Deposit to refund: ${formatCurrencyINR(securityToRefund)}`;
    }
    msg += `\n\nAre all dues (balance & security) clear? Clicking OK will update and clear the amounts.`;

    const confirmed = window.confirm(msg);
    if (confirmed) {
      const updates: any = {};
      if (balance > 0) {
        updates.advance = (rental.advance || 0) + balance;
      }
      if (securityToRefund > 0) {
        updates.securityReturned = true;
        updates.securityReturnedAt = new Date().toISOString();
      }
      handleStatusUpdate({ ...rental, ...updates }, "returned", "Product marked as returned!");
    }
  };

  const renderActionButtons = (rental: any) => {
    const isItemReadyPending = !(rental as any).remarkCompleted;
    const isFittingPending = !(rental as any).fittingCompleted;
    const isDrycleanPending = !(rental as any).drycleanCompleted;
    const isNotReady = isItemReadyPending || isFittingPending || isDrycleanPending;

    return (
      <div className="flex items-center justify-end gap-2">
        <ViewInvoiceDialog rental={rental} />
        {canUpdateDeliveries && rental.status === "upcoming" && (
          <Button
            size="sm"
            disabled={updating === rental.id}
            onClick={() => handleDeliver(rental)}
            className={isNotReady ? "bg-orange-500 hover:bg-orange-600 text-white gap-1 text-xs h-8 px-2.5" : "bg-emerald-500 hover:bg-emerald-600 text-white gap-1 text-xs h-8 px-2.5"}
          >
            <CheckCircle className="w-3.5 h-3.5" />
            {updating === rental.id ? "Activating..." : isNotReady ? "Not Ready" : "Deliver"}
          </Button>
        )}
      {canUpdateDeliveries && (rental.status === "active" || rental.status === "overdue") && (
        <Button
          size="sm"
          disabled={updating === rental.id}
          onClick={() => handleReturn(rental)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1 text-xs h-8 px-2.5"
        >
          <Clock className="w-3.5 h-3.5" /> Return
        </Button>
      )}
      {canUpdateDeliveries && rental.status === "returned" && (
        <Button size="sm" variant="outline" disabled className="text-xs h-8 px-2.5">
          Returned
        </Button>
      )}
    </div>
    );
  };

  return (
    <div className="p-0 sm:p-2 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Logistics</p>
          <h1 className="mt-2 text-3xl font-display font-bold text-foreground flex items-center gap-3">
            <Package className="w-8 h-8 text-gold" />
            Deliveries & Returns
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {canUpdateDeliveries
              ? "Manage product deliveries, active rentals, and returns for the selected date."
              : "View product deliveries, active rentals, and returns for the selected date."}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
          <div className="relative w-full sm:w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search bill, item no..." 
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-9 w-full bg-card border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-35 bg-card border-border">
              <SelectValue placeholder="Filter Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="returned">Returned</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative w-full sm:w-40 shrink-0">
            <Input value={formatDate(selectedDate)} readOnly className="pr-8 bg-card border-border" />
            <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              onClick={(e) => {
                try {
                  (e.target as HTMLInputElement).showPicker?.();
                } catch (err) {}
              }}
              className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card overflow-hidden">
        {/* Mobile View: Cards (No horizontal scrollbar required) */}
        <div className="divide-y divide-border sm:hidden">
          {deliveriesList.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground flex flex-col items-center justify-center gap-1">
              <p className="font-display text-base text-foreground font-semibold">No item found</p>
              <p className="text-xs text-muted-foreground">
                {localSearch ? `No deliveries found matching "${localSearch}".` : "No deliveries scheduled for this date."}
              </p>
            </div>
          ) : (
            deliveriesList.map((rental) => {
              const dueAmount = getDueAmount(rental, rentals);
              return (
                <div key={rental.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-amber-800 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      Bill #{rental.billNo || rental.id}
                    </span>
                    <StatusBadge status={rental.status} kind="rental" />
                  </div>

                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">{rental.customer?.name || "Unknown Client"}</p>
                    <p className="text-[11px] text-muted-foreground">{rental.customer?.phone || "No phone"}</p>
                  </div>

                  <div className="bg-secondary/30 p-2.5 rounded-md space-y-1.5 text-xs">
                    <p className="font-medium text-foreground">{rental.item?.name || "Unknown Piece"}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">ID: {rental.itemNo || rental.itemId}</p>
                    
                    <div className="flex flex-wrap gap-1 pt-1">
                      {(rental as any).remarkCompleted ? (
                        <span className="inline-block text-[9px] font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">Item Ready</span>
                      ) : (
                        <span className="inline-block text-[9px] font-medium text-orange-600 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">Item Pending</span>
                      )}
                      {(rental as any).fittingCompleted ? (
                        <span className="inline-block text-[9px] font-medium text-purple-600 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">Fitting Ready</span>
                      ) : (
                        <span className="inline-block text-[9px] font-medium text-orange-600 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">Fitting Pending</span>
                      )}
                      {(rental as any).drycleanCompleted ? (
                        <span className="inline-block text-[9px] font-medium text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">Dryclean Ready</span>
                      ) : (
                        <span className="inline-block text-[9px] font-medium text-orange-600 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">Dryclean Pending</span>
                      )}
                    </div>

                    <div className="pt-1 text-[11px] text-muted-foreground">
                      Del: <span className="font-semibold text-foreground">{formatDate(rental.deliveryDate || rental.startDate)}</span> | Ret: <span className="font-semibold text-foreground">{formatDate(rental.endDate)}</span>
                    </div>
                  </div>

                  {canSeeFinancials && dueAmount > 0 && (
                    <div className="text-xs font-semibold text-destructive">
                      Due: {formatCurrencyINR(dueAmount)}
                    </div>
                  )}

                  <div className="pt-2 border-t border-border">
                    {renderActionButtons(rental)}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block w-full overflow-x-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b bg-secondary/40">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Order Info</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Customer</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Piece / Item No</th>
                <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Dates</th>
                <th className="h-12 px-4 text-center align-middle font-medium text-muted-foreground">Status</th>
                <th className="h-12 px-4 text-right align-middle font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {deliveriesList.length === 0 ? (
                <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                  <td colSpan={6} className="p-8 align-middle text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <p className="font-display text-base text-foreground font-semibold">No item found</p>
                      <p className="text-xs text-muted-foreground">
                        {localSearch ? `No deliveries found matching "${localSearch}".` : "No deliveries scheduled for this date."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                deliveriesList.map((rental) => {
                  const dueAmount = getDueAmount(rental, rentals);
                  return (
                    <tr key={rental.id} className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                      <td className="p-4 align-middle font-medium">
                        <div>{rental.billNo || rental.id}</div>
                        {canSeeFinancials && (
                          <div className="mt-1.5 flex flex-col gap-0.5">
                            <div className={`text-xs ${rental.status !== 'active' && dueAmount > 0 ? "text-destructive font-medium" : "text-muted-foreground font-normal"}`}>
                              Due: {formatCurrencyINR(rental.status === 'active' ? 0 : dueAmount)}
                            </div>
                            {(rental.securityAmount || 0) > 0 && !(rental as any).securityReturned && (
                              <div className="text-xs font-medium text-amber-600">
                                Refund Security: {formatCurrencyINR(rental.securityAmount || 0)}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-4 align-middle">
                        <div className="font-semibold">{rental.customer?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{rental.customer?.phone}</div>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="font-medium text-foreground line-clamp-1">{rental.item?.name || "Unknown"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{rental.itemNo || rental.itemId}</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(rental as any).remarkCompleted ? (
                            <span className="inline-block text-[9px] font-medium tracking-wide text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">Item Ready</span>
                          ) : (
                            <span className="inline-block text-[9px] font-medium tracking-wide text-orange-600 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">Item Pending</span>
                          )}
                          {(rental as any).fittingCompleted ? (
                            <span className="inline-block text-[9px] font-medium tracking-wide text-purple-600 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">Fitting Ready</span>
                          ) : (
                            <span className="inline-block text-[9px] font-medium tracking-wide text-orange-600 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">Fitting Pending</span>
                          )}
                          {(rental as any).drycleanCompleted ? (
                            <span className="inline-block text-[9px] font-medium tracking-wide text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded">Dryclean Ready</span>
                          ) : (
                            <span className="inline-block text-[9px] font-medium tracking-wide text-orange-600 bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">Dryclean Pending</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-middle">
                        <div className="whitespace-nowrap">Del: {formatDate(rental.deliveryDate || rental.startDate)}</div>
                        {rental.status === "returned" ? (
                          <div className="text-xs text-emerald-500 font-medium whitespace-nowrap mt-0.5">
                            Returned: {formatDate(((rental as any).returnedAt || (rental as any).updatedAt || rental.endDate).slice(0, 10))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground whitespace-nowrap mt-0.5">Ret: {formatDate(rental.endDate)}</div>
                        )}
                      </td>
                      <td className="p-4 align-middle text-center">
                        <StatusBadge status={rental.status} kind="rental" />
                      </td>
                      <td className="p-4 align-middle text-right">
                        {renderActionButtons(rental)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
