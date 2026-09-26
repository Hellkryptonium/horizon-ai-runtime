import { Copy } from "lucide-react";

export function CodeBlock({ children, language = "bash" }: { children: string; language?: string }) {
  return <div className="code-block"><div className="code-header"><span>{language}</span><button aria-label="Copy code"><Copy size={14} /> Copy</button></div><pre><code>{children}</code></pre></div>;
}
