import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUserQuery, useLogoutMutation } from "../../lib/query";

const githubUrl = "https://github.com/Hellkryptonium/horizon-ai-runtime";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { data: user } = useCurrentUserQuery(true);
  const logout = useLogoutMutation();
  const queryClient = useQueryClient();
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  const signOut = () => logout.mutate(undefined, { onSuccess: () => { queryClient.removeQueries({ queryKey: ["current-user"] }); setAccountOpen(false); } });
  return <header className="public-nav"><div className="public-nav-inner"><Link className="public-brand" href="/" aria-label="Horizon home"><Image src="/logo.png" width={28} height={28} alt="Horizon" /><span>Horizon</span></Link><nav className="public-links" aria-label="Primary navigation"><a href="/#product">Product</a><Link href="/developer">Developers</Link><a href="/#how-it-works">How it works</a></nav><div className="public-actions">{user ? <div className="account-menu"><button className="avatar-button" aria-label="Open account menu" aria-expanded={accountOpen} onClick={() => setAccountOpen(!accountOpen)}>{user.name.slice(0, 1).toUpperCase()}</button>{accountOpen && <div className="account-popover"><strong>{user.name}</strong><Link href="/dashboard">Dashboard</Link><Link href="/settings">Settings</Link><button onClick={signOut}>Log out</button></div>}</div> : <><Link href="/login">Login</Link><Link className="public-button public-button-dark" href="/register">Get started</Link></>}</div><button className="public-menu-button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button></div>{open && <div className="mobile-public-menu" ref={menuRef}><a href="/#product" onClick={() => setOpen(false)}>Product</a><Link href="/developer" onClick={() => setOpen(false)}>Developers</Link><a href="/#how-it-works" onClick={() => setOpen(false)}>How it works</a>{user ? <><Link href="/dashboard" onClick={() => setOpen(false)}>Dashboard</Link><Link href="/settings" onClick={() => setOpen(false)}>Settings</Link><button onClick={signOut}>Log out</button></> : <><Link href="/login" onClick={() => setOpen(false)}>Login</Link><Link className="public-button public-button-dark" href="/register" onClick={() => setOpen(false)}>Get started</Link></>}</div>}</header>;
}
