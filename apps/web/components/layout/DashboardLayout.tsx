import Link from "next/link";
import { useRouter } from "next/router";
import { Activity, Boxes, Coins, Cpu, Gauge, HelpCircle, Layers3, LayoutDashboard, LogOut, Menu, Settings, TerminalSquare, X, Zap } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUserQuery, useDeploymentsQuery, useLogoutMutation } from "../../lib/query";

const primaryNav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/services", label: "Services", icon: Activity },
  { href: "/deployments", label: "Deployments", icon: Layers3 },
  { href: "/workers", label: "Hardware", icon: Cpu },
  { href: "/credits", label: "Credits", icon: Coins },
  { href: "/models", label: "Models", icon: Boxes },
  { href: "/developer", label: "Developer", icon: TerminalSquare },
  { href: "/operations", label: "Operations", icon: Zap },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUserQuery();
  const { data: deployments = [] } = useDeploymentsQuery();
  const logout = useLogoutMutation();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) => router.pathname === href || router.pathname.startsWith(`${href}/`);

  return <div className="app-shell">
    <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
      <div className="sidebar-brand"><span className="brand-mark">H</span><span>Horizon</span><button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close navigation"><X size={18} /></button></div>
      <div className="workspace-switcher"><span className="workspace-avatar">MP</span><span><strong>Multi Horizon</strong><small>Personal workspace</small></span><span className="chevron">⌄</span></div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <div className="nav-label">Workspace</div>
        {primaryNav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-item ${isActive(href) ? "active" : ""}`} onClick={() => setOpen(false)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{label === "Deployments" && deployments.length > 0 && <span className="nav-count">{deployments.length}</span>}</Link>)}
        <div className="nav-divider" />
        <div className="nav-label">Manage</div>
        <Link href="/settings" className={`nav-item ${isActive("/settings") ? "active" : ""}`} onClick={() => setOpen(false)}><Settings size={17} strokeWidth={1.8} /><span>Settings</span></Link>
        <Link href="/help" className="nav-item" onClick={() => setOpen(false)}><HelpCircle size={17} strokeWidth={1.8} /><span>Help & docs</span></Link>
      </nav>
      <div className="sidebar-footer"><div className="user-avatar">{user?.name.slice(0, 2).toUpperCase() || "--"}</div><div className="user-info"><strong>{user?.name || "Loading user"}</strong><small>{user?.email || ""}</small></div><button className="icon-button" aria-label="Log out" onClick={() => { logout.mutate(undefined, { onSuccess: () => { queryClient.removeQueries({ queryKey: ["current-user"] }); void router.replace("/login"); } }); }}><LogOut size={16} /></button></div>
    </aside>
    <div className="main-column"><header className="topbar"><button className="mobile-menu" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumb"><Activity size={15} /> <span>Workspace</span><span className="slash">/</span><strong>{router.pathname === "/dashboard" ? "Dashboard" : router.pathname.split("/")[1] || "Dashboard"}</strong></div><div className="topbar-actions"><span className="connection"><span className="status-dot online" /> All systems operational</span><button className="icon-button" aria-label="View metrics"><Gauge size={17} /></button></div></header><main className="main-content">{children}</main></div>
    {open && <button className="sidebar-scrim" onClick={() => setOpen(false)} aria-label="Close navigation overlay" />}
  </div>;
}
