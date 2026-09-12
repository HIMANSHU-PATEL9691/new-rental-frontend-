import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Building2,
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import brandLogo from "@/assets/logo.png";
import { Link } from "../App";

// Custom lightweight navigation hook
const useNavigate = () => {
  return (options: { to: string }) => {
    window.history.pushState({}, '', options.to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };
};

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("Sajansagar2516");
  const [password, setPassword] = useState("Shilpa2516");
  const [branch, setBranch] = useState("Shop 1");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const fillShop1Credentials = () => {
    setBranch("Shop 1");
    setUsername("Sajansagar2516");
    setPassword("Shilpa2516");
    toast.info("Selected Shop 1 Admin Credentials");
  };

  const fillShop2Credentials = () => {
    setBranch("Shop 2");
    setUsername("Shop2Admin");
    setPassword("Shop2Password");
    toast.info("Selected Shop 2 Admin Credentials");
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      const trimmedUser = username.trim();
      const trimmedPass = password.trim();

      // Check credentials for Shop 1 Admin
      const isShop1Admin =
        (trimmedUser === "Sajansagar2516" || trimmedUser.toLowerCase() === "shop1admin" || trimmedUser.toLowerCase() === "shop1") &&
        (trimmedPass === "Shilpa2516" || trimmedPass === "Shop1Password");

      // Check credentials for Shop 2 Admin
      const isShop2Admin =
        (trimmedUser.toLowerCase() === "shop2admin" || trimmedUser.toLowerCase() === "shop2" || trimmedUser === "SajansagarShop2") &&
        (trimmedPass === "Shop2Password" || trimmedPass === "ShilpaShop2" || trimmedPass === "Shop2@2026");

      if (isShop1Admin || isShop2Admin) {
        const activeBranch = isShop2Admin ? "Shop 2" : "Shop 1";
        localStorage.setItem("user_role", "admin");
        localStorage.setItem("user_name", `Admin (${activeBranch})`);
        localStorage.setItem("selected_branch", activeBranch);
        localStorage.setItem("user_branch", activeBranch);
        toast.success(`Welcome back! Logged in as Admin for ${activeBranch}`);
        window.location.href = "/";
      } else if (trimmedUser === "Sajansagar2516" && trimmedPass === "Shilpa2516") {
        localStorage.setItem("user_role", "admin");
        localStorage.setItem("user_name", `Admin (${branch})`);
        localStorage.setItem("selected_branch", branch);
        localStorage.setItem("user_branch", branch);
        toast.success(`Welcome back! Logged in as Admin for ${branch}`);
        window.location.href = "/";
      } else {
        setIsLoading(false);
        toast.error("Invalid admin credentials. Please select Shop 1 or Shop 2 credentials below.");
      }
    }, 250);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50/90 p-4 sm:p-6 lg:p-8">
      {/* Container Card */}
      <div className="w-full max-w-lg bg-white border border-slate-200/80 rounded-2xl shadow-xl overflow-hidden transition-all">
        
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-slate-50 border-b border-slate-100 p-6 sm:p-8 text-center">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-white shadow-md border border-amber-200 mb-4 p-2">
            <img src={brandLogo} alt="Sajan Sagar Logo" className="h-full w-full object-contain" />
          </div>
          <span className="block text-[11px] font-bold uppercase tracking-[0.3em] text-amber-700">
            Sajan Sagar Collection
          </span>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mt-1">
            Admin Management Portal
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-sm mx-auto">
            Select your branch shop and sign in to manage inventory, bookings, and reports.
          </p>
        </div>

        {/* Portal Access Toggle Bar */}
        <div className="px-6 pt-5">
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100/80 rounded-xl border border-slate-200/60">
            <button
              type="button"
              className="py-2 text-xs font-bold rounded-lg bg-white text-amber-700 shadow-sm border border-amber-200/60 flex items-center justify-center gap-1.5"
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Admin Portal
            </button>
            <Link
              to="/login"
              className="py-2 text-xs font-semibold rounded-lg text-slate-600 hover:text-slate-900 hover:bg-white/60 transition-all flex items-center justify-center gap-1.5"
            >
              <User className="w-3.5 h-3.5" /> Employee Access
            </Link>
          </div>
        </div>

        {/* Main Form Area */}
        <div className="p-6 sm:p-8 space-y-6">
          <form onSubmit={handleLogin} className="space-y-5" autoComplete="off">
            
            {/* Branch Selection Pills */}
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-amber-600" /> Select Branch / Shop Location
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={fillShop1Credentials}
                  className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    branch === "Shop 1"
                      ? "bg-amber-500/10 border-amber-500/60 text-amber-800 shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Building2 className="w-4 h-4 text-amber-600" />
                  <span>Shop 1</span>
                  {branch === "Shop 1" && <span className="h-2 w-2 rounded-full bg-amber-600 ml-auto" />}
                </button>

                <button
                  type="button"
                  onClick={fillShop2Credentials}
                  className={`py-3 px-4 rounded-xl text-xs font-bold border transition-all flex items-center justify-center gap-2 ${
                    branch === "Shop 2"
                      ? "bg-amber-500/10 border-amber-500/60 text-amber-800 shadow-sm"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Building2 className="w-4 h-4 text-amber-600" />
                  <span>Shop 2</span>
                  {branch === "Shop 2" && <span className="h-2 w-2 rounded-full bg-amber-600 ml-auto" />}
                </button>
              </div>
            </div>

            {/* Admin Username Field */}
            <div className="space-y-1.5">
              <Label htmlFor="username" className="text-xs font-semibold text-slate-700">
                Admin Username
              </Label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter admin ID (e.g. Sajansagar2516)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-11 border-slate-200 bg-white focus:border-amber-500 focus:ring-amber-500/20 text-slate-900 font-medium"
                  autoComplete="off"
                  required
                />
              </div>
            </div>

            {/* Password Field with Eye Toggle */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter admin password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10 h-11 border-slate-200 bg-white focus:border-amber-500 focus:ring-amber-500/20 text-slate-900 font-medium"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm tracking-wide rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mt-3"
            >
              {isLoading ? (
                "Signing In..."
              ) : (
                <>
                  Sign In to {branch} <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </form>

          {/* Quick Credential Selector Pills */}
          <div className="pt-4 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-500" /> Quick Admin Login Presets:
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={fillShop1Credentials}
                className="p-2.5 rounded-lg border border-amber-200/80 bg-amber-50/50 hover:bg-amber-100/80 text-left transition-colors"
              >
                <div className="text-xs font-bold text-amber-900">Shop 1 Owner</div>
                <div className="text-[11px] text-amber-700 font-mono">ID: Sajansagar2516</div>
              </button>

              <button
                type="button"
                onClick={fillShop2Credentials}
                className="p-2.5 rounded-lg border border-amber-200/80 bg-amber-50/50 hover:bg-amber-100/80 text-left transition-colors"
              >
                <div className="text-xs font-bold text-amber-900">Shop 2 Owner</div>
                <div className="text-[11px] text-amber-700 font-mono">ID: Shop2Admin</div>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center text-xs text-slate-500">
          Sajan Sagar Collection &copy; 2026 • Multi-Branch Atelier System
        </div>
      </div>
    </div>
  );
}