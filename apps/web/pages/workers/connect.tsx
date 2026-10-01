import { useState } from "react";
import { Copy } from "lucide-react";
import { PageHeader, Button } from "../../components/ui/Primitives";
import { CodeBlock } from "../../components/ui/CodeBlock";
import { useCreateWorkerEnrollmentMutation } from "../../lib/query";

export default function ConnectWorker() {
  const [platform, setPlatform] = useState("macOS");
  const [token, setToken] = useState<{ value: string; expiresAt: string } | null>(null);
  const enrollment = useCreateWorkerEnrollmentMutation();
  const generateToken = async () => {
    const result = await enrollment.mutateAsync();
    setToken({ value: result.token, expiresAt: result.expiresAt });
  };
  const copyToken = async () => {
    if (token) await navigator.clipboard.writeText(token.value);
  };
  const tokenCommand = token ? `--env WORKER_ENROLLMENT_TOKEN=${token.value}` : "--env WORKER_ENROLLMENT_TOKEN=<enrollment-token>";
  const nativeCommand = token ? `DOCKER_FASTAPI_URL=http://127.0.0.1:8000 WORKER_ENROLLMENT_TOKEN=${token.value} npm run dev` : "DOCKER_FASTAPI_URL=http://127.0.0.1:8000 WORKER_ENROLLMENT_TOKEN=<enrollment-token> npm run dev";
  return <div style={{ maxWidth: 780 }}><PageHeader title="Connect a computer" description="Run the Horizon Worker Agent on your computer to make its compute available to your deployments." />
    <div className="stepper"><div className="step active"><span className="step-number">1</span> Install agent</div><div className="step-line" /><div className="step active"><span className="step-number">2</span> Connect computer</div><div className="step-line" /><div className="step"><span className="step-number">3</span> Confirm connection</div></div>
    <section className="panel" style={{ padding: 22, marginBottom: 14 }}><div className="section-heading" style={{ marginTop: 0 }}><h2>Install the Worker Agent</h2></div><div className="inline-actions" style={{ marginBottom: 8 }}>{["macOS", "Windows", "Linux"].map((item) => <button key={item} className={`button ${platform === item ? "primary" : "secondary"}`} onClick={() => setPlatform(item)}>{item}</button>)}</div><CodeBlock language="shell">cd workers/agent
  npm ci</CodeBlock></section>
    <section className="panel" style={{ padding: 22, marginBottom: 14 }}><div className="section-heading" style={{ marginTop: 0 }}><h2>Make the Docker model available</h2></div><p style={{ color: "var(--muted)", marginTop: 0 }}>Run the Worker Agent with npm, and keep the FastAPI model running in Docker on the same machine.</p><CodeBlock language="shell">docker run --rm -p 127.0.0.1:8000:8000 horizon/ml-sentiment:0.1</CodeBlock><p style={{ color: "var(--muted)", marginBottom: 0 }}>After the worker connects, open Models, register <strong>Horizon Sentiment</strong> with runtime <strong>Docker FastAPI</strong> and image <strong>horizon/ml-sentiment:0.1</strong>, then create a deployment.</p></section>
    <section className="panel" style={{ padding: 22, marginBottom: 14 }}><div className="section-heading" style={{ marginTop: 0 }}><h2>Connect your computer</h2></div><p style={{ color: "var(--muted)" }}>Generate a one-time token, then provide it to the Worker Agent on the computer you want to enroll.</p>{token ? <><div className="copy-row"><span style={{ overflowWrap: "anywhere" }}>{token.value}</span><button className="copy-button" onClick={copyToken}><Copy size={14} /> Copy</button></div><p style={{ color: "var(--muted)", fontSize: 12 }}>Expires {new Date(token.expiresAt).toLocaleString()}.</p><CodeBlock language="shell">{nativeCommand}</CodeBlock></> : <Button onClick={generateToken}>{enrollment.isPending ? "Generating token..." : "Generate enrollment token"}</Button>}{enrollment.isError && <p style={{ color: "var(--danger)" }}>Unable to generate an enrollment token.</p>}</section>
    <section className="panel" style={{ padding: 22 }}><div className="section-heading" style={{ marginTop: 0 }}><h2>Confirm connection</h2></div><div style={{ display: "flex", alignItems: "center", gap: 9, color: "var(--muted)" }}><span className="status-dot deploying" /> Waiting for the Worker Agent...</div><p style={{ color: "var(--faint)", fontSize: 12, marginBottom: 0 }}>The computer will appear in Hardware after the Worker Agent successfully enrolls it.</p></section>
  </div>;
}
