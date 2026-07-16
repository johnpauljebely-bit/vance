import { useEffect, useState } from "react";
import {
  Outlet,
  NavLink,
  useNavigate,
  useLocation,
  Link,
} from "react-router-dom";
import { authApi } from "@/lib/api";
import { ASSETS } from "@/lib/brand";
import {
  LayoutDashboard,
  Inbox,
  Package,
  MessagesSquare,
  KanbanSquare,
  Wand2,
  Calendar,
  FilesIcon,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { toast } from "sonner";

const NAV = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, n: "01" },
  { to: "/admin/requests", label: "Requests", icon: Inbox, n: "02" },
  { to: "/admin/orders", label: "Orders", icon: Package, n: "03" },
  { to: "/admin/messages", label: "Messages", icon: MessagesSquare, n: "04" },
  { to: "/admin/taskboard", label: "Task Board", icon: KanbanSquare, n: "05" },
  { to: "/admin/automation", label: "Automation", icon: Wand2, n: "06" },
  { to: "/admin/calendar", label: "Calendar", icon: Calendar, n: "07" },
  { to: "/admin/templates", label: "Templates", icon: FilesIcon, n: "08" },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3, n: "09" },
  { to: "/admin/settings", label: "Settings", icon: Settings, n: "10" },
];

export default function AdminLayout() {
  const [me, setMe] = useState(null);
  const [checking, setChecking] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem("vance_admin_token");
    if (!token) {
      navigate("/staff/login", { replace: true });
      return;
    }
    authApi
      .me()
      .then((data) => {
        setMe(data);
        setChecking(false);
      })
      .catch(() => {
        localStorage.removeItem("vance_admin_token");
        navigate("/staff/login", { replace: true });
      });
  }, [navigate]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  const logout = () => {
    localStorage.removeItem("vance_admin_token");
    toast.success("Signed out");
    navigate("/staff/login");
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#F7F5F2] grid place-items-center">
        <div className="text-sm text-[#8A8588]">Verifying session…</div>
      </div>
    );
  }

  const currentPage = NAV.find((n) => location.pathname.startsWith(n.to));
  const greeting = getGreeting();

  return (
    <div
      data-testid="admin-layout"
      className="min-h-screen bg-[#F7F5F2] flex flex-col md:flex-row"
    >
      {/* Sidebar */}
      <aside
        data-testid="admin-sidebar"
        className={`${
          mobileOpen ? "block" : "hidden"
        } md:block md:sticky md:top-0 md:h-screen md:w-64 shrink-0 border-r border-[rgba(26,26,26,0.08)] bg-white`}
      >
        <div className="flex h-full flex-col">
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-3 px-6 py-5 border-b border-[rgba(26,26,26,0.06)]"
          >
            <img src={ASSETS.logoBlack} alt="Vance" className="h-9 w-9" />
            <div>
              <p className="text-base font-bold leading-none">
                vance<span className="text-[#FF6B35]">.</span>
              </p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-widest text-[#8A8588]">
                Admin Studio
              </p>
            </div>
          </Link>

          <nav className="flex-1 px-3 py-5">
            <ul className="space-y-0.5">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    data-testid={`sidebar-${item.label.replace(/\s+/g, "-").toLowerCase()}`}
                    className={({ isActive }) =>
                      `group flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-[#1A1A1A] text-white"
                          : "text-[#1A1A1A]/70 hover:bg-[#F7F5F2] hover:text-[#1A1A1A]"
                      }`
                    }
                  >
                    <span className={`text-[10px] font-bold tabular-nums opacity-60`}>
                      {item.n}
                    </span>
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>

          <div className="border-t border-[rgba(26,26,26,0.06)] px-4 py-4">
            <p className="text-xs text-[#8A8588] truncate">{me?.email}</p>
            <button
              type="button"
              onClick={logout}
              data-testid="admin-logout-btn"
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-pill border border-[rgba(26,26,26,0.15)] px-3 py-2 text-xs font-semibold text-[#1A1A1A] transition-colors hover:bg-[#1A1A1A] hover:text-white"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0">
        <header
          data-testid="admin-header"
          className="sticky top-0 z-30 bg-[#F7F5F2]/85 backdrop-blur-md border-b border-[rgba(26,26,26,0.06)]"
        >
          <div className="flex items-center justify-between px-5 md:px-10 py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen((o) => !o)}
                data-testid="admin-mobile-toggle"
                className="md:hidden rounded-full p-2 hover:bg-white"
                aria-label="Toggle sidebar"
              >
                {mobileOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF6B35]">
                  {greeting}
                </p>
                <h1 className="text-2xl md:text-3xl font-bold tracking-[-0.02em]">
                  {currentPage?.label || "Admin"}
                </h1>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-[#8A8588]">
              <time className="tabular-nums">
                {new Date().toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            </div>
          </div>
        </header>

        <main
          data-testid="admin-main"
          className="mx-auto max-w-[1400px] px-5 md:px-10 py-8 md:py-10"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night, Vance";
  if (h < 12) return "Good morning, Vance";
  if (h < 17) return "Good afternoon, Vance";
  if (h < 21) return "Good evening, Vance";
  return "Late night, Vance";
}
