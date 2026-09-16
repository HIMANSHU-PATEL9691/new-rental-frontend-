import { AppShell } from "@/components/AppShell";
import { useStore } from "@/data/store";
import { formatCurrencyINR } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useMemo, useEffect } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileText, Filter, UserCheck, UserX, Trash2, Calendar, Download, Eye, EyeOff, Key, Building2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { toast } from "sonner";
import { authApi, type User } from "@/lib/api";
import * as XLSX from "xlsx";

function StaffPasswordCell({ user, onUpdated }: { user: User; onUpdated?: () => void }) {
  const [show, setShow] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const pwd = user.rawPassword || user.password;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      toast.error("Password cannot be empty");
      return;
    }
    try {
      setLoading(true);
      const identifier = user.phone || user.email || user._id;
      await authApi.updateUserPassword(identifier, newPassword.trim());
      toast.success(`Password updated for ${user.name}!`);
      setIsEditing(false);
      setNewPassword("");
      if (onUpdated) onUpdated();
    } catch (err: any) {
      toast.error(err.message || "Failed to update password");
    } finally {
      setLoading(false);
    }
  };

  if (isEditing) {
    return (
      <form onSubmit={handleSave} className="inline-flex items-center gap-1">
        <Input
          type="text"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="New password"
          className="h-7 text-xs w-28 px-2 border-gold/50 bg-background font-mono"
          autoFocus
        />
        <Button size="sm" type="submit" disabled={loading} className="h-7 px-2 text-[11px] bg-gold text-gold-foreground hover:bg-gold/90">
          Save
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => { setIsEditing(false); setNewPassword(""); }} className="h-7 px-1.5 text-[11px]">
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-xs bg-secondary/50 text-foreground px-2 py-1 rounded border border-border">
      <Key className="w-3 h-3 text-gold shrink-0" />
      <span className="font-semibold">{show ? (pwd || "(Not set)") : (pwd ? "••••••••" : "Not Set")}</span>
      
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="ml-1 text-muted-foreground hover:text-foreground p-0.5"
        title={show ? "Hide Password" : "Show Password"}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>

      <button
        type="button"
        onClick={() => { setIsEditing(true); setNewPassword(pwd || ""); }}
        className="text-gold hover:text-gold/80 ml-1 p-0.5 hover:bg-gold/10 rounded"
        title="Change Password"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

function formatDate(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("T")[0].split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  if (parts.length === 2) return `${parts[1]}/${parts[0]}`;
  return dateStr;
}

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

export default function ReportsPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState("");

  useEffect(() => {
    const savedRole = localStorage.getItem("user_role")?.trim().toLowerCase();
    setRole(savedRole || "");
    
    if (!savedRole) {
      navigate({ to: "/login" });
    } else if (savedRole !== "admin") {
      navigate({ to: "/availability" });
    }
  }, []);

  const { rentals, items, customers, loading, selectedBranch } = useStore();
  // Default to daily for all users (works for both admin and reception)
  const [reportType, setReportType] = useState<"daily" | "monthly" | "items" | "staff">("daily");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [staffList, setStaffList] = useState<User[]>([]);

  const pendingStaff = staffList.filter((s) => s.status === "pending" || !s.status);
  const approvedStaff = staffList.filter((s) => s.status !== "pending" && s.status);


  const safeString = (v: string | undefined) => v ?? "";
  const safePhoneOrEmail = (s: User) => safeString(s.id || (s as any).phone || (s as any).email);
  const getPhoneEmail = (s: User) => (safeString((s as any).phone) || safeString((s as any).email));

  const filteredRentals = useMemo(() => {
    if (reportType === "daily") {
      return rentals.filter(r => (r.createdAt || r.startDate || "").slice(0, 10) === selectedDate);
    } else {
      return rentals.filter(r => (r.createdAt || r.startDate || "").slice(0, 7) === selectedMonth);
    }
  }, [rentals, reportType, selectedDate, selectedMonth]);

  const stats = useMemo(() => {
    let totalIncome = 0;
    let totalDiscount = 0;
    let totalAdvance = 0;
    let newRentalsCount = filteredRentals.length;

    filteredRentals.forEach(r => {
      const rentBill = Math.max(0, (Number(r.total) || 0) + (Number(r.penalty) || 0) - (Number(r.discount) || 0));
      const rentIncome = Math.min(rentBill, Math.max(0, Number(r.advance) || 0));
      totalIncome += rentIncome;
      totalDiscount += Number(r.discount) || 0;
      totalAdvance += rentIncome;
    });

    return { totalIncome, totalDiscount, totalAdvance, newRentalsCount };
  }, [filteredRentals]);

  const itemStats = useMemo(() => {
    if (reportType !== "items") return [];
    return items.map(item => {
      const itemRentals = rentals.filter(r => r.itemId === item.id);
      const revenue = itemRentals.reduce((sum, r) => {
        const rentBill = Math.max(0, (Number(r.total) || 0) + (Number(r.penalty) || 0) - (Number(r.discount) || 0));
        return sum + Math.min(rentBill, Math.max(0, Number(r.advance) || 0));
      }, 0);
      return {
        ...item,
        revenue,
        rentalCount: itemRentals.length
      };
    }).sort((a, b) => b.revenue - a.revenue);
  }, [items, rentals, reportType]);


  const loadUsers = async () => {
    try {
      console.log("[Staff Report] Fetching users for branch:", selectedBranch);
      const data = await authApi.getUsers(selectedBranch);
      console.log("[Staff Report] Users fetched:", data);
      const formattedData = data.map((u) => ({ ...u, id: u.id || u._id }));
      setStaffList(formattedData.filter((u) => u.role !== "admin"));
    } catch (err) {
      console.error("Failed to load users", err);
      toast.error(err instanceof Error ? err.message : "Could not connect to backend to load staff.");
    }
  };

  useEffect(() => {
    if (reportType === "staff") {
      loadUsers();
    }
  }, [reportType, selectedBranch]);

  const updateUserStatus = async (identifier: string, status: string, message: string) => {
    try {
      console.log(`[Staff Report] Updating user status: ${identifier} -> ${status}`);
      await authApi.updateUserStatus(identifier, status as "active" | "pending");
      console.log(`[Staff Report] User status updated successfully.`);
      toast.success(message);
      loadUsers();
    } catch (err) {
      console.error(`[Staff Report] Error updating user status:`, err);
      toast.error(err instanceof Error ? err.message : "Error connecting to server.");
    }
  };

  const removeUser = async (identifier: string, message: string) => {
    try {
      console.log(`[Staff Report] Removing user: ${identifier}`);
      await authApi.deleteUser(identifier);
      console.log(`[Staff Report] User removed successfully.`);
      toast.success(message);
      loadUsers();
    } catch (err) {
      console.error(`[Staff Report] Error removing user:`, err);
      toast.error(err instanceof Error ? err.message : "Error connecting to server.");
    }
  };

  const handleExportExcel = () => {
    let exportData: any[] = [];
    let filename = "Report.xlsx";
    let sheetName = "Report";

    if (reportType === "daily" || reportType === "monthly") {
      if (filteredRentals.length === 0) {
        toast.error("No data to export for this period");
        return;
      }
      exportData = filteredRentals.map((r) => {
        const client = customers.find((c) => c.id === r.customerId);
        const item = items.find((i) => i.id === r.itemId);
        return {
          "Date": formatDate((r.createdAt || r.startDate || "").slice(0, 10)),
          "Bill No": r.billNo || r.id,
          "Client Name": client?.name || "Unknown",
          "Client Phone": client?.phone || "-",
          "Piece": item?.name || "Unknown",
          "Item No": r.itemNo || r.itemId,
          "Status": r.status,
          "Total Value (INR)": r.total || 0,
          "Advance Paid (INR)": r.advance || 0,
          "Discount (INR)": r.discount || 0,
        };
      });
      filename = reportType === "daily" ? `Daily_Report_${selectedDate}.xlsx` : `Monthly_Report_${selectedMonth}.xlsx`;
      sheetName = "Bookings";
    } else if (reportType === "items") {
      if (itemStats.length === 0) {
        toast.error("No items data to export");
        return;
      }
      exportData = itemStats.map((item) => ({
        "Item ID": item.id,
        "Item No": item.customId || "-",
        "Piece": item.name,
        "Designer": item.designer || "-",
        "Category": item.category || "-",
        "Subcategory": item.subcategory || "-",
        "Total Rentals": item.rentalCount,
        "Revenue Generated (INR)": item.revenue,
      }));
      filename = "Items_Performance_Report.xlsx";
      sheetName = "Item Performance";
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    XLSX.writeFile(workbook, filename);
    toast.success(`${filename} exported successfully!`);
  };

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading reports...
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">Financial</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl flex items-center gap-3">
            <FileText className="w-8 h-8 text-gold" />
            Reports
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            View daily and monthly booking and revenue reports.
          </p>
        </div>
        <Button 
          onClick={handleExportExcel} 
          className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 w-full sm:w-auto shrink-0"
        >
          <Download className="w-4 h-4" /> Export Excel
        </Button>
      </div>

      <Tabs value={reportType} onValueChange={(v) => setReportType(v as "daily" | "monthly" | "items" | "staff")} className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <TabsList className="flex flex-wrap h-auto w-full sm:w-auto justify-start gap-1 sm:gap-0">
            <TabsTrigger value="daily" className="flex-1 sm:flex-none text-xs sm:text-sm">Daily</TabsTrigger>
            <TabsTrigger value="monthly" className="flex-1 sm:flex-none text-xs sm:text-sm">Monthly</TabsTrigger>
            <TabsTrigger value="items" className="flex-1 sm:flex-none text-xs sm:text-sm">Items</TabsTrigger>
            {role === "admin" && (
              <TabsTrigger value="staff" className="flex-1 sm:flex-none text-xs sm:text-sm">Staff</TabsTrigger>
            )}
          </TabsList>
          
          {(reportType === "daily" || reportType === "monthly") && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
              {/* keep header responsive on mobile */}

              {reportType === "daily" ? (
                <div className="relative w-full sm:w-40 shrink-0">
                  <Input value={formatDate(selectedDate)} readOnly className="pr-8 bg-card border-border" />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input 
                    type="date" 
                    value={selectedDate} 
                    onChange={(e) => setSelectedDate(e.target.value)}
                    onClick={(e) => {
                      try { (e.target as HTMLInputElement).showPicker?.(); } catch (err) {}
                    }}
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              ) : (
                <div className="relative w-full sm:w-40 shrink-0">
                  <Input value={formatDate(selectedMonth)} readOnly className="pr-8 bg-card border-border" />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input 
                    type="month" 
                    value={selectedMonth} 
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    onClick={(e) => {
                      try { (e.target as HTMLInputElement).showPicker?.(); } catch (err) {}
                    }}
                    className="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {reportType === "staff" ? (
          <div className="space-y-6">
            <Card className="glass-panel overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Pending Approvals</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table className="w-full min-w-[700px]">
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs uppercase tracking-wider">Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Shop</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Staff ID (Phone)</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Password</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Role</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingStaff.length === 0 ? (
                      <TableRow className="border-border hover:bg-transparent">
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No pending approvals.
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingStaff.map((s) => (
                        <TableRow key={s.id} className="border-border hover:bg-secondary/30">
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Building2 className="w-3 h-3 text-amber-600" />
                              {s.branch || "Shop 1"}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">{getPhoneEmail(s)}</TableCell>
                          <TableCell><StaffPasswordCell user={s} onUpdated={loadUsers} /></TableCell>
                          <TableCell className="capitalize">{s.role}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateUserStatus(safePhoneOrEmail(s), "active", "Staff approved")}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              >
                                <UserCheck className="w-4 h-4 mr-1.5" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeUser(safePhoneOrEmail(s), "Staff rejected")}
                              >
                                <UserX className="w-4 h-4 mr-1.5" /> Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>

            <Card className="glass-panel overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">Active Staff</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <Table className="w-full min-w-[700px]">
                  <TableHeader>
                    <TableRow className="border-border">
                      <TableHead className="text-xs uppercase tracking-wider">Name</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Shop</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Staff ID (Phone)</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Password</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider">Role</TableHead>
                      <TableHead className="text-xs uppercase tracking-wider text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {approvedStaff.length === 0 ? (
                      <TableRow className="border-border hover:bg-transparent">
                        <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                          No active staff found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      approvedStaff.map((s) => (
                        <TableRow key={s.id} className="border-border hover:bg-secondary/30">
                          <TableCell className="font-medium">{s.name}</TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                              <Building2 className="w-3 h-3 text-amber-600" />
                              {s.branch || "Shop 1"}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">{getPhoneEmail(s)}</TableCell>
                          <TableCell><StaffPasswordCell user={s} onUpdated={loadUsers} /></TableCell>
                          <TableCell className="capitalize">{s.role}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => removeUser(safePhoneOrEmail(s), "Staff removed")}
                              className="text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4 mr-1.5" /> Remove
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </div>
        ) : reportType === "items" ? (
          <Card className="glass-panel overflow-hidden">
            <CardHeader>
              <CardTitle className="text-lg">All-Time Item Performance</CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <Table className="w-full min-w-[700px]">
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-xs uppercase tracking-wider">Item ID</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Piece</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider">Category</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">Total Rentals</TableHead>
                    <TableHead className="text-xs uppercase tracking-wider text-right">Revenue Generated</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {itemStats.length === 0 ? (
                    <TableRow className="border-border hover:bg-transparent">
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No items found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    itemStats.map(item => (
                      <TableRow key={item.id} className="border-border hover:bg-secondary/30">
                        <TableCell className="whitespace-nowrap text-muted-foreground">{item.id}</TableCell>
                        <TableCell>
                          <div className="truncate max-w-50 font-medium">{item.name}</div>
                          <div className="text-[10px] text-muted-foreground">{item.designer}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">{item.category}</div>
                          <div className="text-[10px] text-muted-foreground">{item.subcategory}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">{item.rentalCount}</TableCell>
                        <TableCell className="text-right text-gold font-medium">{formatCurrencyINR(item.revenue)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="glass-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-normal">
                    Bookings
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-2xl sm:text-3xl truncate">{stats.newRentalsCount}</div>
                </CardContent>
              </Card>
              <Card className="glass-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-normal">
                    Total Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-2xl sm:text-3xl text-gold truncate">{formatCurrencyINR(stats.totalIncome)}</div>
                </CardContent>
              </Card>
              <Card className="glass-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-normal">
                    Advance Collected
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-2xl sm:text-3xl text-emerald-500 truncate">{formatCurrencyINR(stats.totalAdvance)}</div>
                </CardContent>
              </Card>
              <Card className="glass-panel">
                <CardHeader className="pb-2">
                  <CardTitle className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground font-normal">
                    Discounts Given
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-display text-2xl sm:text-3xl truncate">{formatCurrencyINR(stats.totalDiscount)}</div>
                </CardContent>
              </Card>
            </div>

            <Card className="glass-panel overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="text-base sm:text-lg">
                  {reportType === "daily" ? `Bookings on ${formatDate(selectedDate)}` : `Bookings in ${formatDate(selectedMonth)}`}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Mobile View: Clean Card List (No horizontal scrollbar required) */}
                <div className="divide-y divide-border sm:hidden">
                  {filteredRentals.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No bookings found for the selected period.
                    </div>
                  ) : (
                    filteredRentals.map((r) => {
                      const client = customers.find((c) => c.id === r.customerId);
                      const item = items.find((i) => i.id === r.itemId);
                      return (
                        <div key={r.id} className="p-3.5 space-y-2 hover:bg-secondary/20 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-amber-800 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                              Bill #{r.billNo || r.id}
                            </span>
                            <span className="text-[11px] text-muted-foreground font-medium">
                              {formatDate((r.createdAt || r.startDate || "").slice(0, 10))}
                            </span>
                          </div>

                          <div className="flex items-start justify-between gap-3 pt-0.5">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-foreground truncate">
                                {client?.name || "Unknown Client"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate mt-0.5">
                                {item?.name || "Unknown Item"} <span className="text-[10px] text-muted-foreground/80 font-mono">({r.itemNo || r.itemId})</span>
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs font-bold text-foreground">
                                {formatCurrencyINR(r.total || 0)}
                              </p>
                              <p className="text-[11px] font-semibold text-emerald-600 mt-0.5">
                                Adv: {formatCurrencyINR(r.advance || 0)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Tablet / Desktop View: Full Table */}
                <div className="hidden sm:block overflow-x-auto w-full">
                  <Table className="w-full">
                    <TableHeader>
                      <TableRow className="border-border">
                        <TableHead className="text-xs uppercase tracking-wider whitespace-nowrap">Date</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider whitespace-nowrap">Bill No</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Client</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">Piece</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right whitespace-nowrap">Value</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right whitespace-nowrap">Advance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRentals.length === 0 ? (
                        <TableRow className="border-border hover:bg-transparent">
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            No bookings found for the selected period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRentals.map(r => {
                          const client = customers.find(c => c.id === r.customerId);
                          const item = items.find(i => i.id === r.itemId);
                          return (
                            <TableRow key={r.id} className="border-border hover:bg-secondary/30">
                              <TableCell className="whitespace-nowrap font-medium text-xs">{formatDate((r.createdAt || r.startDate || "").slice(0, 10))}</TableCell>
                              <TableCell className="whitespace-nowrap font-mono text-xs font-semibold">{r.billNo || r.id}</TableCell>
                              <TableCell className="font-medium text-xs">{client?.name || "Unknown"}</TableCell>
                              <TableCell>
                                <div className="font-medium text-xs">{item?.name || "Unknown"}</div>
                                <div className="text-[10px] text-muted-foreground">{r.itemNo || r.itemId}</div>
                              </TableCell>
                              <TableCell className="text-right font-display text-sm whitespace-nowrap">{formatCurrencyINR(r.total || 0)}</TableCell>
                              <TableCell className="text-right font-display text-sm whitespace-nowrap text-emerald-600 font-semibold">{formatCurrencyINR(r.advance || 0)}</TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </Tabs>
    </AppShell>
  );
}
