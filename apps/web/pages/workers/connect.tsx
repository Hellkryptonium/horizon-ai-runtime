import { useState } from "react";
import { Copy } from "lucide-react";
import { PageHeader, Button } from "../../components/ui/Primitives";
import { CodeBlock } from "../../components/ui/CodeBlock";

export default function ConnectWorker() {
  const [platform, setPlatform] = useState("Windows");
  return <div style={{ maxWidth: 780 }}><PageHeader title="Connect a computer" description="Run the Horizon Worker Agent on your computer to make its compute available to your deployments." />
    <div className="stepper"><div className="step active"><span className="step-number">1</span> Install agent</div><div className="step-line" /><div className="step active"><span className="step-number">2</span> Connect computer</div><div className="step-line" /><div className="step"><span className="step-number">3</span> Confirm connection</div></div>
    <section className="panel" style={{ padding: 22, marginBottom: 14 }}><div className="section-heading" style={{ marginTop: 0 }}><h2>Install the Worker Agent</h2></div><div className="inline-actions" style={{ marginBottom: 8 }}>{["Windows", "macOS", "Linux"].map((item) => <button key={item} className={`button ${platform === item ? "primary" : "secondary"}`} onClick={() => setPlatform(item)}>{item}</button>)}</div><CodeBlock>{platform === "Windows" ? "npm install -g @horizon/worker\nhorizon-worker --version" : `curl -fsSL https://get.horizon.dev/worker | sh\nhorizon-worker --version`}</CodeBlock></section>
    <section className="panel" style={{ padding: 22, marginBottom: 14 }}><div className="section-heading" style={{ marginTop: 0 }}><h2>Connect your computer</h2></div><p style={{ color: "var(--muted)" }}>Use this one-time enrollment token to authenticate the Worker Agent.</p><div className="copy-row"><span>hzn_enroll_7Qm2••••••••••••</span><button className="copy-button"><Copy size={14} /> Copy</button></div><CodeBlock language="shell">{"horizon-worker connect --token hzn_enroll_7Qm2••••••••••••"}</CodeBlock></section>
    <section className="panel" style={{ padding: 22 }}><div className="section-heading" style={{ marginTop: 0 }}><h2>Confirm connection</h2></div><div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--muted)" }}><span className="status-dot deploying" /> Waiting for connection...</div><p style={{ color: "var(--faint)", fontSize: 12, marginBottom: 0 }}>This page will update automatically when your Worker Agent connects.</p></section>
  </div>;
}
