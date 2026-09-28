import Image from "next/image";
import Link from "next/link";

const githubUrl = "https://github.com/Hellkryptonium/horizon-ai-runtime";

export function Footer() {
  return <footer className="public-footer"><div className="public-footer-grid"><div className="footer-brand"><Image src="/logo.png" width={30} height={30} alt="Horizon" /><strong>Horizon</strong><p>Distributed AI Compute,<br />Powered by Everyone.</p></div><div><h3>Product</h3><Link href="/dashboard">Dashboard</Link><Link href="/deployments">Deployments</Link><Link href="/models">Models</Link><Link href="/workers">Hardware</Link></div><div><h3>Developers</h3><Link href="/developer">Developer</Link><Link href="/developer">API</Link><a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a></div><div><h3>Documentation</h3><Link href="/developer">Developer docs</Link><Link href="/help">Help & docs</Link></div><div><h3>Legal</h3><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">Cookies</Link></div></div><div className="public-footer-bottom"><span>© 2026 Horizon AI Runtime</span><span>Distributed AI Compute, Powered by Everyone.</span></div></footer>;
}
