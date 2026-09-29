import { useState, useMemo, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/StatusBadge";
import { Card } from "@/components/ui/card";
import {
  Phone,
  Mail,
  Edit2,
  Package,
  IndianRupee,
  Clock,
  Copy,
  Check,
} from "lucide-react";
import { formatCurrencyINR } from "@/lib/utils";
import { useStore } from "@/data/store";
import type { Customer } from "@/data/mock";
import { EditCustomerDialog } from "./EditCustomerDialog";
import { toast } from "sonner";

const tierStyle: Record<string, string> = {
  Platinum: "border-purple-300 bg-purple-100 text-purple-950 font-bold",
  Gold: "border-amber-400 bg-amber-100 text-amber-950 font-bold",
  Standard: "border-slate-300 bg-slate-100 text-slate-800 font-semibold",
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "-";
  const datePart = dateStr.includes("T") ? dateStr.split("T")[0] : dateStr;
  const parts = datePart.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
}

export function CustomerProfileDialog({
  customer,
  trigger,
  open,
  onOpenChange,
}: {
  customer: Customer;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { rentals, getItem } = useStore();
  const [internalOpen, setInternalOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const setOpen = isControlled ? onOpenChange! : setInternalOpen;

  // Filter rentals for this customer
  const customerRentals = useMemo(() => {
    return rentals.filter((r) => r.customerId === customer.id);
  }, [rentals, customer.id]);

  const activeRentalsCount = useMemo(() => {
    return customerRentals.filter((r) => r.status === "active").length;
  }, [customerRentals]);

  const totalSpent = useMemo(() => {
    return customerRentals.reduce(
      (sum, r) => sum + (Number(r.total) || 0) + (Number(r.penalty) || 0),
      0
    );
  }, [customerRentals]);

  const totalDue = useMemo(() => {
    return customerRentals.reduce((sum, r) => {
      const total =
        (Number(r.total) || 0) +
        (Number(r.securityAmount) || 0) +
        (Number(r.penalty) || 0) -
        (Number(r.discount) || 0);
      const advance = Number(r.advance) || 0;
      const due = Math.max(0, total - advance);
      return sum + due;
    }, 0);
  }, [customerRentals]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    toast.success(`Copied ${label} to clipboard`);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setOpen}>
        {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
        <DialogContent
          className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white border border-slate-300 shadow-2xl font-sans"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Banner */}
          <div className="bg-slate-100 p-6 border-b border-slate-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16 border-2 border-slate-300 shadow-sm">
                  <AvatarFallback className="bg-amber-100 font-sans text-xl font-extrabold text-amber-950">
                    {initials(customer.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-sans text-2xl font-extrabold text-slate-900 leading-tight">
                      {customer.name}
                    </h2>
                    <span
                      className={`text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-2xs ${
                        tierStyle[customer.tier] || tierStyle.Standard
                      }`}
                    >
                      {customer.tier}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 font-medium mt-1 flex items-center gap-2">
                    <span className="font-mono bg-amber-100 border border-amber-300 text-amber-900 px-2 py-0.5 rounded font-bold">
                      {customer.id}
                    </span>
                    <span>•</span>
                    <span>Member since {formatDate(customer.joined)}</span>
                  </p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
                className="bg-white border-slate-300 text-slate-800 hover:text-blue-900 hover:bg-blue-50 hover:border-blue-400 font-bold gap-1.5 self-start sm:self-auto shadow-xs"
              >
                <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                <span>Edit Profile</span>
              </Button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-white border border-slate-200 p-3.5 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Package className="h-4 w-4 text-amber-600" />
                  <p className="text-xs uppercase tracking-wider font-bold">Total Rentals</p>
                </div>
                <p className="font-sans text-2xl font-extrabold mt-1 text-slate-900">
                  {customerRentals.length}
                </p>
              </Card>

              <Card className="bg-white border border-slate-200 p-3.5 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <p className="text-xs uppercase tracking-wider font-bold">Active Orders</p>
                </div>
                <p className="font-sans text-2xl font-extrabold mt-1 text-amber-700">
                  {activeRentalsCount}
                </p>
              </Card>

              <Card className="bg-white border border-slate-200 p-3.5 shadow-2xs">
                <div className="flex items-center gap-1.5 text-slate-500">
                  <IndianRupee className="h-4 w-4 text-emerald-600" />
                  <p className="text-xs uppercase tracking-wider font-bold">Total Spent</p>
                </div>
                <p className="font-sans text-xl font-extrabold mt-1 text-emerald-700">
                  {formatCurrencyINR(totalSpent)}
                </p>
              </Card>

              <Card
                className={`bg-white border p-3.5 shadow-2xs ${
                  totalDue > 0 ? "border-red-300 bg-red-50/30" : "border-slate-200"
                }`}
              >
                <div className="flex items-center gap-1.5 text-slate-500">
                  <IndianRupee
                    className={`h-4 w-4 ${
                      totalDue > 0 ? "text-red-600" : "text-emerald-600"
                    }`}
                  />
                  <p className="text-xs uppercase tracking-wider font-bold">Balance Due</p>
                </div>
                <p
                  className={`font-sans text-xl font-extrabold mt-1 ${
                    totalDue > 0 ? "text-red-700 font-black" : "text-emerald-700"
                  }`}
                >
                  {formatCurrencyINR(totalDue)}
                </p>
              </Card>
            </div>

            {/* Contact Details Card */}
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-600">
                Contact Information
              </h3>
              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <Phone className="h-4 w-4 text-amber-700 shrink-0" />
                    <div>
                      <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                        Primary Phone
                      </p>
                      <a
                        href={`tel:${customer.phone}`}
                        className="font-mono text-sm font-bold text-slate-900 hover:text-amber-700 transition-colors"
                      >
                        {customer.phone}
                      </a>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                    onClick={() => copyToClipboard(customer.phone, "Phone")}
                  >
                    {copiedField === "Phone" ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {customer.secondaryPhone && (
                  <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 shadow-2xs">
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                      <div>
                        <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                          Secondary Phone
                        </p>
                        <a
                          href={`tel:${customer.secondaryPhone}`}
                          className="font-mono text-sm font-bold text-slate-900 hover:text-amber-700 transition-colors"
                        >
                          {customer.secondaryPhone}
                        </a>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                      onClick={() =>
                        copyToClipboard(customer.secondaryPhone!, "Secondary Phone")
                      }
                    >
                      {copiedField === "Secondary Phone" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                )}

                <div className="flex items-center justify-between p-3 rounded-lg bg-white border border-slate-200 shadow-2xs sm:col-span-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Mail className="h-4 w-4 text-amber-700 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                        Email Address
                      </p>
                      {customer.email ? (
                        <a
                          href={`mailto:${customer.email}`}
                          className="text-sm font-semibold text-slate-900 hover:text-amber-700 transition-colors truncate block"
                        >
                          {customer.email}
                        </a>
                      ) : (
                        <p className="text-sm text-slate-500 font-medium">Not provided</p>
                      )}
                    </div>
                  </div>
                  {customer.email && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-500 hover:text-slate-900 hover:bg-slate-100 shrink-0"
                      onClick={() => copyToClipboard(customer.email!, "Email")}
                    >
                      {copiedField === "Email" ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Rental History Section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wider font-bold text-slate-700">
                  Rental History ({customerRentals.length})
                </h3>
              </div>

              {customerRentals.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl text-slate-500 text-sm font-medium">
                  No rental orders found for this client.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto max-h-64">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3 uppercase tracking-wider text-[11px] font-bold text-slate-700">
                            Order / Bill
                          </th>
                          <th className="py-2.5 px-3 uppercase tracking-wider text-[11px] font-bold text-slate-700">
                            Piece
                          </th>
                          <th className="py-2.5 px-3 uppercase tracking-wider text-[11px] font-bold text-slate-700">
                            Dates
                          </th>
                          <th className="py-2.5 px-3 uppercase tracking-wider text-[11px] font-bold text-slate-700 text-right">
                            Total
                          </th>
                          <th className="py-2.5 px-3 uppercase tracking-wider text-[11px] font-bold text-slate-700 text-right">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {customerRentals.map((r) => {
                          const item = getItem(r.itemId);
                          return (
                            <tr key={r.id} className="hover:bg-amber-50/40 transition-colors">
                              <td className="py-2.5 px-3 font-mono font-bold text-amber-900">
                                {r.billNo || r.id}
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-900">
                                {item?.name || r.itemId || "Rental Piece"}
                              </td>
                              <td className="py-2.5 px-3 text-slate-700 font-medium whitespace-nowrap">
                                {formatDate(r.startDate)} → {formatDate(r.endDate)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                                {formatCurrencyINR(r.total)}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <StatusBadge status={r.status} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Embedded Edit Customer Dialog */}
      <EditCustomerDialog
        customer={customer}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
