import Link from "next/link";
import { useState } from "react";
import { PageHeader, StatusBadge, Button } from "../../components/ui/Primitives";
import { Table } from "../../components/ui/Table";
import { useModelPullMutation, useModelStatusMutation, useOwnedWorkersQuery, useRevokeWorkerMutation, useRuntimeHealthMutation, useRuntimeInstallMutation, useWorkerTerminalHistoryQuery, useWorkerTerminalMutation } from "../../lib/query";

const displayStatus = (status: "ONLINE" | "OFFLINE" | "BUSY") => status.toLowerCase() as "online" | "offline" | "running";
const displayLastSeen = (value: string | null) => value ? new Date(value).toLocaleString() : "Never";

export default function Workers() {
  const { data: workers = [], isLoading, isError } = useOwnedWorkersQuery();
  const revokeWorker = useRevokeWorkerMutation();
  const [modelId, setModelId] = useState("");
  const [terminalWorkerId, setTerminalWorkerId] = useState("");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalOutput, setTerminalOutput] = useState<string[]>([]);
  const worker = workers.find((item) => item.status === "ONLINE") ?? workers[0];
  const health = useRuntimeHealthMutation();
  const install = useRuntimeInstallMutation();
  const modelStatus = useModelStatusMutation();
  const pull = useModelPullMutation();
  const terminal = useWorkerTerminalMutation();
  const terminalWorker = terminalOpen ? workers.find((item) => item.id === terminalWorkerId) : undefined;
  const terminalHistory = useWorkerTerminalHistoryQuery(terminalWorkerId, Boolean(terminalWorker));

  const revoke = (workerId: string, workerName: string) => {
    if (!window.confirm(`Revoke ${workerName}? It will disconnect and can no longer authenticate.`)) return;
    revokeWorker.mutate(workerId);
  };

  return <>
    <PageHeader title="Hardware" description="Computers connected to your Horizon account." action={<Button href="/workers/connect" icon="plus">Connect computer</Button>} />
    <section className="panel">
      <Table>
        <thead><tr><th>Name</th><th>Status</th><th>CPU</th><th>Memory</th><th>GPU</th><th>OS</th><th>Last seen</th><th aria-label="Actions" /></tr></thead>
        <tbody>
          {isLoading ? <tr><td colSpan={8}>Loading hardware...</td></tr> : isError ? <tr><td colSpan={8}>Unable to load hardware.</td></tr> : workers.length === 0 ? <tr><td colSpan={8}>No computers connected yet.</td></tr> : workers.map((item) => <tr key={item.id}>
            <td><strong>{item.name}</strong><small>{item.architecture || "Architecture unknown"}</small></td>
            <td><StatusBadge status={displayStatus(item.status)} /></td>
            <td>{item.cpuCores} cores</td>
            <td>{Math.round(item.totalRamMb / 1024)} GB</td>
            <td>{item.gpu || "None"}</td>
            <td>{item.operatingSystem}</td>
            <td>{displayLastSeen(item.lastHeartbeat)}</td>
            <td><div className="inline-actions"><button className="button quiet" onClick={() => { setTerminalWorkerId(item.id); setTerminalOutput([]); setTerminalOpen(true); }} disabled={item.status !== "ONLINE"}>Terminal</button><button className="button quiet" onClick={() => revoke(item.id, item.name)} disabled={revokeWorker.isPending}>Revoke</button></div></td>
          </tr>)}
        </tbody>
      </Table>
    </section>
    {revokeWorker.isError && <div className="inline-state error" style={{ marginTop: 14 }}>{revokeWorker.error instanceof Error ? revokeWorker.error.message : "Worker could not be revoked."}</div>}
    {terminalWorker && <section className="panel" style={{ padding: 22, marginTop: 18, background: "#101820", color: "#d7e2e8" }}>
      <div className="section-heading" style={{ marginTop: 0 }}><h2 style={{ color: "#f6fafc" }}>Worker terminal</h2><div className="inline-actions"><small>{terminalWorker.name} · {terminalWorker.status.toLowerCase()}</small><button className="button quiet" type="button" onClick={() => setTerminalOpen(false)}>Close</button></div></div>
      <pre style={{ minHeight: 150, maxHeight: 280, overflow: "auto", whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: 13 }}>{terminalOutput.join("\n") || "Type help to see available commands."}</pre>
      <form className="inline-actions" onSubmit={(event) => { event.preventDefault(); if (!terminalCommand.trim() || terminalWorker.status !== "ONLINE") return; const command = terminalCommand.trim(); setTerminalCommand(""); setTerminalOutput((lines) => [...lines, `horizon> ${command}`]); terminal.mutate({ workerId: terminalWorker.id, command }, { onSuccess: (result) => { setTerminalOutput((lines) => [...lines, ...result.output.map((item) => item.text)]); void terminalHistory.refetch(); if (result.exit) setTerminalOpen(false); }, onError: (error) => setTerminalOutput((lines) => [...lines, error instanceof Error ? error.message : "Command failed."]) }); }}>
        <input className="input" value={terminalCommand} onChange={(event) => setTerminalCommand(event.target.value)} placeholder="help" aria-label="Worker terminal command" disabled={terminalWorker.status !== "ONLINE" || terminal.isPending} /><button className="button primary" type="submit" disabled={terminalWorker.status !== "ONLINE" || terminal.isPending || !terminalCommand.trim()}>{terminal.isPending ? "Running..." : "Run"}</button>
      </form>
      <div style={{ marginTop: 18 }}><div className="detail-label" style={{ color: "#98a2b3", marginBottom: 8 }}>Recent history</div>{terminalHistory.data?.history.length ? terminalHistory.data.history.slice(0, 8).map((entry) => <button key={entry.requestId} type="button" className="terminal-history-row" onClick={() => setTerminalOutput(entry.output.map((item) => item.text))}><span>{entry.command}</span><small>{new Date(entry.createdAt).toLocaleTimeString()}</small></button>) : <small style={{ color: "#98a2b3" }}>No recorded commands yet.</small>}</div>
    </section>}
    <section className="panel" style={{ padding: 22, marginTop: 18 }}>
      <div className="section-heading" style={{ marginTop: 0 }}><h2>Ollama runtime</h2></div>
      {!worker ? <p style={{ color: "var(--muted)" }}>Connect a worker to manage Ollama.</p> : <>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>Manage the runtime on <strong>{worker.name}</strong>.</p>
        <div className="inline-actions"><button className="button secondary" onClick={() => health.mutate(worker.id)} disabled={health.isPending}>Check health</button><button className="button secondary" onClick={() => install.mutate(worker.id)} disabled={install.isPending}>{install.isPending ? "Installing Ollama..." : "Install Ollama"}</button><button className="button secondary" onClick={() => modelStatus.mutate(worker.id)} disabled={modelStatus.isPending}>Check models</button></div>
        {health.data && <p style={{ color: health.data.data.available ? "var(--success)" : "var(--danger)" }}>{health.data.data.available ? `Ollama ${health.data.data.version || "available"}${health.data.data.location ? ` at ${health.data.data.location}` : ""}` : "Ollama unavailable"}</p>}
        {install.isSuccess && <p style={{ color: install.data.data.available ? "var(--success)" : "var(--danger)" }}>{install.data.data.available ? "Ollama is installed and reachable." : "Install completed, but Ollama is not reachable yet."}</p>}
        <div className="inline-actions"><input className="input" value={modelId} onChange={(event) => setModelId(event.target.value)} placeholder="Model identifier" aria-label="Ollama model" /><button className="button primary" onClick={() => pull.mutate({ workerId: worker.id, modelId })} disabled={pull.isPending || !modelId.trim()}>Prepare model</button></div>
        {modelStatus.data && <p style={{ color: "var(--muted)" }}>Available models: {modelStatus.data.data.models.map((model) => `${model.name}${model.sizeMb ? ` (${model.sizeMb} MB)` : ""}`).join(", ") || "none"}</p>}
        {pull.isSuccess && <p style={{ color: "var(--success)" }}>Model prepared successfully.</p>}
        {(health.isError || install.isError || modelStatus.isError || pull.isError) && <p style={{ color: "var(--danger)" }}>Provisioning request failed. Check the worker log for details.</p>}
      </>}
    </section>
    <div className="section-heading"><h2>Need another machine?</h2></div>
    <section className="panel" style={{ padding: 22 }}><strong>Connect your own computer</strong><p style={{ color: "var(--muted)", margin: "5px 0 14px" }}>Install the Worker Agent and make local compute available to your deployments.</p><Link href="/workers/connect" className="button secondary">View connection instructions</Link></section>
  </>;
}
