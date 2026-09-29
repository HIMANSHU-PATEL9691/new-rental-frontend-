import { useMemo, useState, useEffect } from "react";

import { AppShell } from "@/components/AppShell";
import { useStore } from "@/data/store";
import { formatCurrencyINR, cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Mail,
  Phone,
  Plus,
  Trash2,
  Search,
  TableProperties,
  LayoutGrid,
  Eye,
  Edit2,
  MapPin,
} from "lucide-react";
import { AddCustomerDialog } from "@/components/forms/AddCustomerDialog";
import { EditCustomerDialog } from "@/components/forms/EditCustomerDialog";
import { CustomerProfileDialog } from "@/components/forms/CustomerProfileDialog";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string; params?: any }) => {
    let path = options.to;
    if (options.params?.customerId) {
      path = path.replace("$customerId", options.params.customerId);
    }
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };
};

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

export default function CustomersPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem("user_role");
    if (!role) {
      navigate({ to: "/login" });
    } else if (role !== "admin" && role !== "reception") {
      navigate({ to: "/availability" });
    }
  }, []);

  const { customers, rentals, loading, searchQuery, deleteCustomer } = useStore();
  const [localSearch, setLocalSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const query = (localSearch || searchQuery || "").trim().toLowerCase();

  async function handleDelete(id: string, name: string) {
    setDeletingId(id);
    try {
      if (deleteCustomer) await deleteCustomer(id);
      toast.success(`Client ${name} deleted`);
    } catch (error) {
      console.error(error);
      toast.error(`Failed to delete client ${name}`);
    } finally {
      setDeletingId(null);
    }
  }

  const customersWithLiveStats = useMemo(() => {
    return customers.map((c) => {
      const customerRentals = rentals.filter((r) => r.customerId === c.id);
      const liveTotalSpent = customerRentals.reduce(
        (sum, r) => sum + (r.total || 0) + (r.penalty || 0),
        0
      );
      return {
        ...c,
        rentals: customerRentals.length,
        totalSpent: liveTotalSpent,
      };
    });
  }, [customers, rentals]);

  const filteredCustomers = customersWithLiveStats.filter((c) => {
    const searchable = [
      c.id,
      c.name,
      c.email,
      c.phone,
      c.secondaryPhone,
      c.tier,
      String(c.totalSpent),
      String(c.rentals),
    ]
      .join(" ")
      .toLowerCase();
    return !query || searchable.includes(query);
  });

  const totalRevenue = useMemo(() => {
    return customersWithLiveStats.reduce((sum, c) => sum + (c.totalSpent || 0), 0);
  }, [customersWithLiveStats]);

  const totalRentals = useMemo(() => {
    return customersWithLiveStats.reduce((sum, c) => sum + (c.rentals || 0), 0);
  }, [customersWithLiveStats]);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center h-64">
          <div className="text-slate-700 font-medium">Loading clients...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8 font-sans">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-amber-700 font-bold">Clientele</p>
          <h1 className="mt-1 font-sans text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Clients
          </h1>
          <p className="text-sm font-medium text-slate-600 mt-1">
            {customers.length} total members · {customers.filter((c) => c.tier === "Platinum").length} Platinum
          </p>
        </div>
        <AddCustomerDialog
          trigger={
            <Button className="bg-amber-600 text-white hover:bg-amber-700 font-semibold self-start sm:self-auto shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" /> Add Client
            </Button>
          }
        />
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-5 sm:mb-8 font-sans">
        <Card className="bg-white border border-slate-200/90 shadow-xs p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-slate-500 truncate">
            Total Clients
          </p>
          <p className="font-sans text-xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            {customers.length}
          </p>
        </Card>
        <Card className="bg-white border border-slate-200/90 shadow-xs p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-slate-500 truncate">
            Members Breakdown
          </p>
          <div className="text-[11px] sm:text-sm font-bold mt-2 flex flex-wrap items-center gap-1 sm:gap-1.5">
            <span className="text-purple-700 bg-purple-50 border border-purple-200 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs">
              {customers.filter((c) => c.tier === "Platinum").length} Plat
            </span>
            <span className="text-amber-800 bg-amber-50 border border-amber-200 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs">
              {customers.filter((c) => c.tier === "Gold").length} Gold
            </span>
            <span className="text-slate-700 bg-slate-100 border border-slate-200 px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs">
              {customers.filter((c) => c.tier === "Standard").length} Std
            </span>
          </div>
        </Card>
        <Card className="bg-white border border-slate-200/90 shadow-xs p-3.5 sm:p-5">
          <p className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-slate-500 truncate">
            Total Rentals
          </p>
          <p className="font-sans text-xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            {totalRentals}
          </p>
        </Card>
        <Card className="bg-white border border-amber-300 shadow-xs p-3.5 sm:p-5 bg-gradient-to-br from-amber-50/50 to-white">
          <p className="text-[10px] sm:text-xs uppercase tracking-wider font-bold text-amber-800 truncate">
            Total Lifetime Value
          </p>
          <p className="font-sans text-xl sm:text-3xl font-extrabold text-amber-700 mt-1">
            {formatCurrencyINR(totalRevenue)}
          </p>
        </Card>
      </div>

      {/* Toolbar: Search & View Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-5 font-sans">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Search name, phone, client ID..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            className="pl-9 w-full bg-white border-slate-300 text-slate-900 placeholder:text-slate-500 h-10 text-sm font-medium shadow-xs"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <div className="flex items-center bg-slate-200/80 rounded-lg p-1 border border-slate-300">
            <Button
              type="button"
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("table")}
              className={`h-8 px-3 text-xs gap-1.5 font-bold ${
                viewMode === "table"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <TableProperties className="h-4 w-4 text-amber-600" />
              <span>Rows & Columns</span>
            </Button>
            <Button
              type="button"
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className={`h-8 px-3 text-xs gap-1.5 font-bold ${
                viewMode === "grid"
                  ? "bg-white text-slate-900 shadow-sm border border-slate-300"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <LayoutGrid className="h-4 w-4 text-amber-600" />
              <span>Cards</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Row and Column Table View */}
      {viewMode === "table" ? (
        <>
          {/* Mobile Structured Row List (Screen < 768px: All 9 data fields visible without horizontal scroll!) */}
          <div className="md:hidden space-y-3 font-sans">
            {filteredCustomers.length === 0 ? (
              <Card className="bg-white border border-slate-300 p-8 text-center text-slate-600 rounded-xl">
                <p className="font-sans text-base text-slate-900 font-bold">No clients found</p>
                <p className="text-xs text-slate-500 mt-1">
                  {query
                    ? `No clients matching "${query}". Check name, phone, or ID.`
                    : "No clients registered yet. Click 'Add Client' to create one."}
                </p>
              </Card>
            ) : (
              filteredCustomers.map((c) => (
                <div
                  key={c.id}
                  className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs hover:border-amber-400 transition-all font-sans space-y-3"
                >
                  {/* Top Bar: ID Badge + Tier Badge + Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CustomerProfileDialog
                        customer={c}
                        trigger={
                          <button
                            type="button"
                            className="font-mono text-xs font-bold text-amber-900 bg-amber-100/90 hover:bg-amber-200 border border-amber-300 px-2.5 py-0.5 rounded-md tracking-wider cursor-pointer shadow-2xs"
                            title="Click to view profile"
                          >
                            {c.id}
                          </button>
                        }
                      />
                      <span
                        className={`inline-flex items-center text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border shadow-2xs ${
                          tierStyle[c.tier] || tierStyle.Standard
                        }`}
                      >
                        {c.tier}
                      </span>
                    </div>

                    {/* Quick Action Buttons (Profile, Edit, Delete) */}
                    <div className="flex items-center gap-1">
                      <CustomerProfileDialog
                        customer={c}
                        trigger={
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 bg-amber-50/70 border-amber-200 text-amber-900 hover:bg-amber-100 font-bold text-xs gap-1 shadow-2xs"
                            title="See Profile"
                            aria-label={`See profile of ${c.name}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye className="h-3.5 w-3.5 text-amber-700" />
                            <span>Profile</span>
                          </Button>
                        }
                      />
                      <EditCustomerDialog
                        customer={c}
                        trigger={
                          <Button
                            type="button"
                            size="icon"
                            variant="outline"
                            className="h-8 w-8 bg-white border-slate-300 text-blue-700 hover:bg-blue-50 hover:border-blue-300 shadow-2xs"
                            title="Edit Client"
                            aria-label={`Edit ${c.name}`}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                      <DeleteCustomerDialog
                        customerId={c.id}
                        customerName={c.name}
                        disabled={deletingId === c.id}
                        onDelete={() => handleDelete(c.id, c.name)}
                      />
                    </div>
                  </div>

                  {/* Client Info Row: Avatar + Name + Contact Details */}
                  <div className="flex items-start gap-3">
                    <CustomerProfileDialog
                      customer={c}
                      trigger={
                        <button
                          type="button"
                          className="cursor-pointer focus:outline-none shrink-0"
                          title="Click to view profile"
                        >
                          <Avatar className="h-11 w-11 border-2 border-slate-200 hover:border-amber-500 transition-colors">
                            <AvatarFallback className="bg-amber-100 text-amber-950 font-sans text-xs font-bold">
                              {initials(c.name)}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <CustomerProfileDialog
                        customer={c}
                        trigger={
                          <button
                            type="button"
                            className="text-left cursor-pointer focus:outline-none group block"
                            title="Click to view profile"
                          >
                            <h3 className="font-sans font-bold text-sm text-slate-900 group-hover:text-amber-700 transition-colors leading-snug">
                              {c.name}
                            </h3>
                          </button>
                        }
                      />

                      <div className="mt-1 space-y-1">
                        <a
                          href={`tel:${c.phone}`}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-900 hover:text-amber-800 font-mono"
                          title="Tap to call"
                        >
                          <Phone className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                          <span>{c.phone}</span>
                        </a>
                        {c.secondaryPhone && (
                          <div>
                            <a
                              href={`tel:${c.secondaryPhone}`}
                              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 hover:text-amber-800 font-mono"
                              title="Tap to call secondary phone"
                            >
                              <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>{c.secondaryPhone}</span>
                            </a>
                          </div>
                        )}
                        {c.email && (
                          <div>
                            <a
                              href={`mailto:${c.email}`}
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-amber-800 truncate max-w-full"
                              title="Tap to email"
                            >
                              <Mail className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </a>
                          </div>
                        )}
                        {c.address && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{c.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Data Bar: Joined, Rentals count, Lifetime spent */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs bg-slate-50/80 -mx-3.5 -mb-3.5 px-3.5 py-2.5 rounded-b-xl">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-500">Since: </span>
                      <span className="font-semibold text-slate-700">{formatDate(c.joined)}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 mr-1">Rentals:</span>
                        <span className="font-extrabold text-slate-900 bg-white border border-slate-200 px-1.5 py-0.5 rounded text-xs">
                          {c.rentals}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 mr-1">Spent:</span>
                        <span className="font-extrabold text-amber-900 bg-amber-100/70 border border-amber-200 px-2 py-0.5 rounded text-xs">
                          {formatCurrencyINR(c.totalSpent)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop & Tablet Table (Screen >= 768px: Full 9-column tabular grid) */}
          <Card className="hidden md:block bg-white border border-slate-300 shadow-sm rounded-xl overflow-hidden p-0 font-sans">
            <div className="overflow-x-auto">
              <Table className="w-full min-w-[960px] text-slate-900">
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-b-2 border-slate-200 bg-slate-100">
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-800 py-4 pl-5">
                      Client ID
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-800 py-4">
                      Client Name
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-800 py-4">
                      Phone Numbers
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-800 py-4">
                      Email
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-800 py-4 text-center">
                      Tier
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-800 py-4">
                      Member Since
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-800 py-4 text-center">
                      Rentals
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-800 py-4 text-right">
                      Lifetime Spent
                    </TableHead>
                    <TableHead className="text-xs font-bold uppercase tracking-wider text-slate-800 py-4 text-right pr-5">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.length === 0 ? (
                    <TableRow className="border-border hover:bg-transparent">
                      <TableCell colSpan={9} className="py-12 text-center text-slate-600">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <p className="font-sans text-base text-slate-900 font-bold">
                            No clients found
                          </p>
                          <p className="text-sm text-slate-600">
                            {query
                              ? `No clients matching "${query}". Check name, phone, or ID.`
                              : "No clients registered yet. Click 'Add Client' to create one."}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCustomers.map((c) => (
                      <TableRow
                        key={c.id}
                        className="border-b border-slate-200 hover:bg-amber-50/40 transition-colors font-sans"
                      >
                        <TableCell className="pl-5">
                          <CustomerProfileDialog
                            customer={c}
                            trigger={
                              <button
                                type="button"
                                className="font-mono text-xs font-bold text-amber-900 bg-amber-100/90 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-md tracking-wider cursor-pointer shadow-2xs transition-colors"
                                title="Click to view profile"
                              >
                                {c.id}
                              </button>
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <CustomerProfileDialog
                            customer={c}
                            trigger={
                              <button
                                type="button"
                                className="flex items-center gap-3 py-1 cursor-pointer text-left focus:outline-none group"
                                title="Click to view profile"
                              >
                                <Avatar className="h-9 w-9 border-2 border-slate-200 group-hover:border-amber-500 transition-colors shrink-0">
                                  <AvatarFallback className="bg-amber-100 text-amber-950 font-sans text-xs font-bold">
                                    {initials(c.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="font-sans font-bold text-sm text-slate-900 group-hover:text-amber-700 transition-colors">
                                    {c.name}
                                  </p>
                                </div>
                              </button>
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            <a
                              href={`tel:${c.phone}`}
                              className="flex items-center gap-1.5 text-slate-900 font-mono font-bold text-xs hover:text-amber-800"
                            >
                              <Phone className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                              <span>{c.phone}</span>
                            </a>
                            {c.secondaryPhone && (
                              <a
                                href={`tel:${c.secondaryPhone}`}
                                className="flex items-center gap-1.5 text-slate-600 font-mono text-[11px] font-semibold hover:text-amber-800"
                              >
                                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                                <span>{c.secondaryPhone}</span>
                              </a>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {c.email ? (
                            <a
                              href={`mailto:${c.email}`}
                              className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 hover:text-amber-800"
                            >
                              <Mail className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                              <span className="truncate max-w-[180px]">{c.email}</span>
                            </a>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400 pl-2">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={`inline-flex items-center text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-2xs ${
                              tierStyle[c.tier] || tierStyle.Standard
                            }`}
                          >
                            {c.tier}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-slate-700 whitespace-nowrap">
                          {formatDate(c.joined)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block font-sans font-extrabold text-sm text-slate-900 bg-slate-100 px-3 py-1 rounded-md border border-slate-200">
                            {c.rentals}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-block font-sans font-bold text-sm text-amber-900 bg-amber-50 border border-amber-200 px-3 py-1 rounded-md">
                            {formatCurrencyINR(c.totalSpent)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-5">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* See Profile Button */}
                            <CustomerProfileDialog
                              customer={c}
                              trigger={
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2.5 bg-white border-slate-300 text-slate-700 hover:text-amber-900 hover:bg-amber-50 hover:border-amber-400 font-bold text-xs gap-1 shadow-2xs"
                                  title="See Profile"
                                  aria-label={`See profile of ${c.name}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Eye className="h-3.5 w-3.5 text-amber-600" />
                                  <span className="hidden xl:inline">Profile</span>
                                </Button>
                              }
                            />

                            {/* Edit Client Button */}
                            <EditCustomerDialog
                              customer={c}
                              trigger={
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-2.5 bg-white border-slate-300 text-slate-700 hover:text-blue-900 hover:bg-blue-50 hover:border-blue-400 font-bold text-xs gap-1 shadow-2xs"
                                  title="Edit Client"
                                  aria-label={`Edit ${c.name}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                                  <span className="hidden xl:inline">Edit</span>
                                </Button>
                              }
                            />

                            {/* Delete Client Dialog */}
                            <DeleteCustomerDialog
                              customerId={c.id}
                              customerName={c.name}
                              disabled={deletingId === c.id}
                              onDelete={() => handleDelete(c.id, c.name)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      ) : (
        /* Cards View (Adaptive grid for mobile and desktop) */
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-5 font-sans">
          {filteredCustomers.length === 0 && (
            <Card className="bg-white border border-slate-300 p-8 text-center text-sm text-slate-600 sm:col-span-2 xl:col-span-3 rounded-xl">
              No clients match your search.
            </Card>
          )}
          {filteredCustomers.map((c) => (
            <Card
              key={c.id}
              className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-0 flex flex-col justify-between"
            >
              <CardContent className="p-4 sm:p-5 flex-1 flex flex-col justify-between">
                <div>
                  {/* Top Header: ID + Tier on Left, Actions on Right */}
                  <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <CustomerProfileDialog
                        customer={c}
                        trigger={
                          <button
                            type="button"
                            className="font-mono text-xs font-bold text-amber-900 bg-amber-100/90 hover:bg-amber-200 border border-amber-300 px-2 py-0.5 rounded cursor-pointer"
                            title="Click to view profile"
                          >
                            {c.id}
                          </button>
                        }
                      />
                      <span
                        className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border font-bold shadow-2xs ${
                          tierStyle[c.tier] || tierStyle.Standard
                        }`}
                      >
                        {c.tier}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <CustomerProfileDialog
                        customer={c}
                        trigger={
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-600 hover:text-amber-800 hover:bg-amber-100"
                            title="See Profile"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                      <EditCustomerDialog
                        customer={c}
                        trigger={
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-slate-600 hover:text-blue-800 hover:bg-blue-100"
                            title="Edit Client"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                        }
                      />
                      <DeleteCustomerDialog
                        customerId={c.id}
                        customerName={c.name}
                        disabled={deletingId === c.id}
                        onDelete={() => handleDelete(c.id, c.name)}
                      />
                    </div>
                  </div>

                  {/* Client Info: Avatar + Name + Contacts */}
                  <div className="flex items-start gap-3 mt-3.5">
                    <CustomerProfileDialog
                      customer={c}
                      trigger={
                        <button
                          type="button"
                          className="cursor-pointer focus:outline-none shrink-0"
                          title="Click to view profile"
                        >
                          <Avatar className="h-12 w-12 border-2 border-slate-200 hover:border-amber-500 transition-colors">
                            <AvatarFallback className="bg-amber-100 text-amber-950 font-sans text-sm font-bold">
                              {initials(c.name)}
                            </AvatarFallback>
                          </Avatar>
                        </button>
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <CustomerProfileDialog
                        customer={c}
                        trigger={
                          <button
                            type="button"
                            className="text-left cursor-pointer focus:outline-none group block"
                            title="Click to view profile"
                          >
                            <h3 className="font-sans font-bold text-base leading-tight text-slate-900 group-hover:text-amber-700 transition-colors truncate">
                              {c.name}
                            </h3>
                          </button>
                        }
                      />
                      <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                        Member since {formatDate(c.joined)}
                      </p>

                      <div className="mt-2.5 space-y-1 text-xs">
                        <a
                          href={`tel:${c.phone}`}
                          className="flex items-center gap-1.5 font-mono font-bold text-slate-900 hover:text-amber-800"
                        >
                          <Phone className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                          <span>{c.phone}</span>
                        </a>
                        {c.secondaryPhone && (
                          <a
                            href={`tel:${c.secondaryPhone}`}
                            className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 hover:text-amber-800"
                          >
                            <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                            <span>{c.secondaryPhone}</span>
                          </a>
                        )}
                        {c.email && (
                          <a
                            href={`mailto:${c.email}`}
                            className="flex items-center gap-1.5 text-slate-600 hover:text-amber-800 truncate"
                          >
                            <Mail className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                            <span className="truncate">{c.email}</span>
                          </a>
                        )}
                        {c.address && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                            <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{c.address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Metric Bar */}
                <div className="border-t border-slate-100 mt-4 pt-3 grid grid-cols-2 bg-slate-50/60 -mx-4 sm:-mx-5 -mb-4 sm:-mb-5 px-4 sm:px-5 py-2.5 rounded-b-xl">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Lifetime Spent
                    </p>
                    <p className="font-sans font-extrabold text-base sm:text-lg text-amber-800 mt-0.5">
                      {formatCurrencyINR(c.totalSpent)}
                    </p>
                  </div>
                  <div className="border-l border-slate-200 pl-4">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">
                      Total Rentals
                    </p>
                    <p className="font-sans font-extrabold text-base sm:text-lg text-slate-900 mt-0.5">
                      {c.rentals}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function DeleteCustomerDialog({
  customerId,
  customerName,
  disabled,
  onDelete,
  className,
}: {
  customerId: string;
  customerName: string;
  disabled: boolean;
  onDelete: () => Promise<void> | void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const handleDelete = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    await onDelete();
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className={cn(
            "h-8 w-8 text-slate-500 hover:text-red-700 hover:bg-red-50",
            className
          )}
          aria-label={`Delete client ${customerName}`}
          onClick={(e) => e.stopPropagation()}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent onClick={(e) => e.stopPropagation()} className="bg-white border border-slate-300">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-sans font-bold text-xl text-slate-900">
            Delete client {customerName}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-600">
            This will permanently remove this client from the database.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={disabled} onClick={(e) => e.stopPropagation()} className="border-slate-300">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700 font-semibold"
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
