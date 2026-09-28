import { useState } from "react";
import { Copy } from "lucide-react";
import { PageHeader, Button } from "../../components/ui/Primitives";
import { CodeBlock } from "../../components/ui/CodeBlock";
import { useCreateWorkerEnrollmentMutation } from "../../lib/query";

export default function ConnectWorker() {
  const [platform, setPlatform] = useState("Windows");
  const [token, setToken] = useState<{ value: string; expiresAt: string } | null>(null);
  const enrollment = useCreateWorkerEnrollmentMutation();
  const generateToken = async () => {
    const result = await enrollment.mutateAsync();
    setToken({ value: result.token, expiresAt: result.expiresAt });
  };
  const copyToken = async () => {
    if (token) await navigator.clipboard.writeText(token.value);
  };
  const tokenCommand = token ? `horizon-worker connect --token ${token.value}` : "horizon-worker connect --token <enrollment-token>";
  return <div style={{ maxWidth: 780 }}><PageHeader title="Connect a computer" description="Run the Horizon Worker Agent on your computer to make its compute available to your deployments." />
    <div className="stepper"><div className="step active"><span className="step-number">1</span> Install agent</div><div className="step-line" /><div className="step active"><span className="step-number">2</span> Connect computer</div><div className="step-line" /><div className="step"><span className="step-number">3</span> Confirm connection</div></div>
    <section className="panel" style={{ padding: 22, marginBottom: 14 }}><div className="section-heading" style={{ marginTop: 0 }}><h2>Install the Worker Agent</h2></div><div className="inline-actions" style={{ marginBottom: 8 }}>{["Windows", "macOS", "Linux"].map((item) => <button key={item} className={`button ${platform === item ? "primary" : "secondary"}`} onClick={() => setPlatform(item)}>{item}</button>)}</div><CodeBlock>{platform === "Windows" ? "npm install -g @horizon/worker\nhorizon-worker --version" : `curl -fsSL https://get.horizon.dev/worker | sh\nhorizon-worker --version`}</CodeBlock></section>
    <section className="panel" style={{ padding: 22, marginBottom: 14 }}><div className="section-heading" style={{ marginTop: 0 }}><h2>Connect your computer</h2></div><p style={{ color: "var(--muted)" }}>Generate a one-time token, then provide it to the Worker Agent on the computer you want to enroll.</p>{token ? <><div className="copy-row"><span style={{ overflowWrap: "anywhere" }}>{token.value}</span><button className="copy-button" onClick={copyToken}><Copy size={14} /> Copy</button></div><p style={{ color: "var(--muted)", fontSize: 12 }}>Expires {new Date(token.expiresAt).toLocaleString()}.</p><CodeBlock language="shell">{tokenCommand}</CodeBlock></> : <Button onClick={generateToken}>{enrollment.isPending ? "Generating token..." : "Generate enrollment token"}</Button>}{enrollment.isError && <p style={{ color: "var(--danger)" }}>Unable to generate an enrollment token.</p>}</section>
    <section className="panel" style={{ padding: 22 }}><div className="section-heading" style={{ marginTop: 0 }}><h2>Confirm connection</h2></div><div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--muted)" }}><span className="status-dot deploying" /> Waiting for the Worker Agent...</div><p style={{ color: "var(--faint)", fontSize: 12, marginBottom: 0 }}>The computer will appear in Hardware after the Worker Agent successfully enrolls it.</p></section>
  </div>;
}
