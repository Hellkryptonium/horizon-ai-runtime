import Link from "next/link";
import { PublicShell } from "../components/public/PublicShell";

export default function NotFound() { return <PublicShell><main className="not-found landing-container"><div><div className="public-eyebrow" style={{ justifyContent: "center" }}>Horizon / 404</div><h1>404</h1><p>This route doesn't exist.</p><Link className="public-button public-button-dark" href="/">Return to Horizon</Link></div></main></PublicShell>; }
