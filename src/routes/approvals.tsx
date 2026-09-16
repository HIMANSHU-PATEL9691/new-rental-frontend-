
import { useState, useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle, XCircle, Trash2, Users, AlertCircle, Eye, EyeOff, Key, Building2, Phone, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { authApi } from "@/lib/api";

import { useStore } from "@/data/store";

interface User {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  role: string;
  status: string;
  branch?: string;
  rawPassword?: string;
  password?: string;
  createdAt: string;
}

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
        <Button size="sm" type="submit" disabled={loading} className="h-7 px-2 text-[11px] bg-amber-600 hover:bg-amber-700 text-white">
          Save
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={() => { setIsEditing(false); setNewPassword(""); }} className="h-7 px-1.5 text-[11px]">
          Cancel
        </Button>
      </form>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-xs bg-slate-100 text-slate-800 px-2 py-1 rounded border border-slate-200">
      <Key className="w-3 h-3 text-amber-600 shrink-0" />
      <span className="font-semibold">{show ? (pwd || "(Not set)") : (pwd ? "••••••••" : "Not Set")}</span>
      
      <button
        type="button"
        onClick={() => setShow(!show)}
        className="ml-1 text-slate-500 hover:text-slate-800 p-0.5"
        title={show ? "Hide Password" : "Show Password"}
      >
        {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
      </button>

      <button
        type="button"
        onClick={() => { setIsEditing(true); setNewPassword(pwd || ""); }}
        className="text-amber-700 hover:text-amber-900 ml-1 p-0.5 hover:bg-amber-100 rounded"
        title="Change Password"
      >
        <Pencil className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function ApprovalsPage() {
  const { selectedBranch } = useStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("");

  useEffect(() => {
    const savedRole = localStorage.getItem("user_role")?.trim().toLowerCase();
    setRole(savedRole || "");

    if (savedRole !== "admin") {
      toast.error("Only admins can access this page.");
      window.location.href = "/";
      return;
    }

    fetchUsers();
  }, [selectedBranch]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await authApi.getUsers(selectedBranch);
      setUsers(data as any);
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (identifier: string) => {
    try {
      await authApi.updateUserStatus(identifier, "active" as any);
      toast.success("User approved successfully!");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to approve user");
    }
  };

  const handleReject = async (identifier: string) => {
    try {
      await authApi.updateUserStatus(identifier, "disabled" as any);
      toast.success("User rejected successfully!");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to reject user");
    }
  };

  const handleDelete = async (identifier: string) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;

    try {
      await authApi.deleteUser(identifier);
      toast.success("User deleted successfully!");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete user");
    }
  };

  const pendingUsers = users.filter((u) => u.status === "pending");
  const activeUsers = users.filter((u) => u.status === "active");
  const disabledUsers = users.filter((u) => u.status === "disabled");

  const getIdentifier = (user: User) => user.phone || user.email || user._id;

  const getRoleBadgeColor = (role: string) => {
    if (role === "admin") return "bg-red-100 text-red-800 border-red-300";
    if (role === "reception") return "bg-blue-100 text-blue-800 border-blue-300";
    return "bg-green-100 text-green-800 border-green-300";
  };

  const getRoleLabel = (role: string) => {
    if (role === "admin") return "👤 Admin";
    if (role === "reception") return "🏢 Reception";
    return "👨‍💼 Employee";
  };

  if (role !== "admin") {
    return null;
  }

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-gold">User Management</p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl flex items-center gap-3">
            <Users className="w-8 h-8 text-gold" />
            Staff Approvals
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Manage employees and reception staff approvals
          </p>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">Loading users...</div>
      ) : (
        <div className="space-y-6">
          {/* Pending Approvals */}
          {pendingUsers.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                  Pending Approvals ({pendingUsers.length})
                </CardTitle>
                <CardDescription>Users waiting for admin approval</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {pendingUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border border-amber-200 rounded-lg bg-background"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">{user.name}</p>
                          <Badge className={`${getRoleBadgeColor(user.role)} border`}>
                            {getRoleLabel(user.role)}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-amber-300 bg-amber-50 text-amber-800 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-amber-600" />
                            {user.branch || "Shop 1"}
                          </Badge>
                          <span className="text-xs font-semibold text-amber-700 bg-amber-100 px-2 py-1 rounded border border-amber-200">PENDING</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1.5">
                          <div className="flex items-center gap-1 font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>ID: <strong>{user.phone}</strong></span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">Pass:</span>
                            <StaffPasswordCell user={user} onUpdated={fetchUsers} />
                          </div>
                          {user.email && <span>{user.email}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleApprove(getIdentifier(user))}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleReject(getIdentifier(user))}
                          variant="outline"
                          className="border-red-300 text-red-700 hover:bg-red-50"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Active Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Active Staff ({activeUsers.length})
              </CardTitle>
              <CardDescription>Approved and active users</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                {activeUsers.length === 0 ? (
                  <p className="text-muted-foreground">No active users yet</p>
                ) : (
                  activeUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border rounded-lg hover:bg-secondary/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">{user.name}</p>
                          <Badge className={`${getRoleBadgeColor(user.role)} border`}>
                            {getRoleLabel(user.role)}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-amber-300 bg-amber-50 text-amber-800 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-amber-600" />
                            {user.branch || "Shop 1"}
                          </Badge>
                          <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded border border-green-200">ACTIVE</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1.5">
                          <div className="flex items-center gap-1 font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>ID: <strong>{user.phone}</strong></span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">Pass:</span>
                            <StaffPasswordCell user={user} onUpdated={fetchUsers} />
                          </div>
                          {user.email && <span>{user.email}</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleDelete(getIdentifier(user))}
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Disabled Users */}
          {disabledUsers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-red-600" />
                  Rejected/Disabled ({disabledUsers.length})
                </CardTitle>
                <CardDescription>Rejected or disabled user accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {disabledUsers.map((user) => (
                    <div
                      key={user._id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 border border-red-200 rounded-lg bg-red-50/30"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-medium text-foreground truncate">{user.name}</p>
                          <Badge className={`${getRoleBadgeColor(user.role)} border`}>
                            {getRoleLabel(user.role)}
                          </Badge>
                          <Badge variant="outline" className="text-xs border-amber-300 bg-amber-50 text-amber-800 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-amber-600" />
                            {user.branch || "Shop 1"}
                          </Badge>
                          <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded border border-red-200">REJECTED</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mt-1.5">
                          <div className="flex items-center gap-1 font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                            <Phone className="w-3 h-3 text-slate-500" />
                            <span>ID: <strong>{user.phone}</strong></span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">Pass:</span>
                            <StaffPasswordCell user={user} />
                          </div>
                          {user.email && <span>{user.email}</span>}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleDelete(getIdentifier(user))}
                        variant="ghost"
                        className="text-red-600 hover:text-red-700 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </AppShell>
  );
}
