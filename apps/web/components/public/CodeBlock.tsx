import { Copy } from "lucide-react";
import { useState } from "react";

export function PublicCodeBlock({ children }: { children: string }) { const [copied, setCopied] = useState(false); const copy = async () => { await navigator.clipboard?.writeText(children); setCopied(true); window.setTimeout(() => setCopied(false), 1600); }; return <div className="public-code"><div className="public-code-bar"><span><i /><i /><i /></span><small>request.json</small><button onClick={copy} aria-label="Copy code"><Copy size={14} /> {copied ? "Copied" : "Copy"}</button></div><pre><code>{children}</code></pre></div>; }
