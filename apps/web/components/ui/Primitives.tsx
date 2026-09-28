import { Copy, ExternalLink, Plus, ArrowRight } from "lucide-react";
import { useState, type MouseEvent, type ReactNode } from "react";
import type { Status } from "../../lib/types";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-header"><div><div className="eyebrow">{eyebrow || "Workspace"}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

export function Button({ children, href, variant = "primary", icon, type = "button", onClick }: { children: ReactNode; href?: string; variant?: "primary" | "secondary" | "quiet"; icon?: "plus" | "arrow" | "external"; type?: "button" | "submit" | "reset"; onClick?: () => void }) {
  const Icon = icon === "plus" ? Plus : icon === "arrow" ? ArrowRight : icon === "external" ? ExternalLink : null;
  const content = <>{Icon && <Icon size={16} />}<span>{children}</span></>;
  return href ? <a className={`button ${variant}`} href={href}>{content}</a> : <button type={type} onClick={onClick} className={`button ${variant}`}>{content}</button>;
}

export function StatusBadge({ status }: { status: Status }) {
  const label = status[0].toUpperCase() + status.slice(1);
  return <span className={`status-badge ${status}`}><span className="status-dot" />{label}</span>;
}

export function CopyButton({ value = "Copy", text }: { value?: string; text?: string }) { const [copied, setCopied] = useState(false); const copy = async (event: MouseEvent<HTMLButtonElement>) => { const content = text || event.currentTarget.parentElement?.querySelector("span")?.textContent; if (content) await navigator.clipboard?.writeText(content); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }; return <button className="copy-button" onClick={copy} aria-label={`Copy ${value}`}><Copy size={14} /> <span>{copied ? "Copied" : value}</span></button>; }

export function StatCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) { return <div className={`stat-card ${tone}`}><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>; }
