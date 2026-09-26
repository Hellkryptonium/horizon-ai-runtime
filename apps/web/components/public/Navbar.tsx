import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const githubUrl = "https://github.com/Hellkryptonium/horizon-ai-runtime";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);
  return <header className="public-nav"><div className="public-nav-inner"><Link className="public-brand" href="/" aria-label="Horizon home"><Image src="/logo.png" width={28} height={28} alt="Horizon" /><span>Horizon</span></Link><nav className="public-links" aria-label="Primary navigation"><a href="#product">Product</a><Link href="/developer">Developers</Link><a href="#how-it-works">How it works</a></nav><div className="public-actions"><a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a><Link href="/login">Sign in</Link><Link className="public-button public-button-dark" href="/register">Get started</Link></div><button className="public-menu-button" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button></div>{open && <div className="mobile-public-menu" ref={menuRef}><a href="#product" onClick={() => setOpen(false)}>Product</a><Link href="/developer" onClick={() => setOpen(false)}>Developers</Link><a href="#how-it-works" onClick={() => setOpen(false)}>How it works</a><a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a><Link href="/login" onClick={() => setOpen(false)}>Sign in</Link><Link className="public-button public-button-dark" href="/register" onClick={() => setOpen(false)}>Get started</Link></div>}</header>;
}
