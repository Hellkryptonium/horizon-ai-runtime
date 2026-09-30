import { useMemo, useState } from "react";
import { PageHeader, StatusBadge } from "../components/ui/Primitives";
import { Table } from "../components/ui/Table";
import { useApiKeysQuery, useChatCompletionMutation, useControlPlaneConfigQuery, useCreateApiKeyMutation, useDeploymentReplicasQuery, useDeploymentsQuery, useInferenceRequestsQuery, useInferenceUsageQuery, useOwnedWorkersQuery } from "../lib/query";
import { controlPlaneUrl } from "../lib/api/client";

type RequestRow = { requestId: string; deploymentId: string; status: string; attempts: number; queuedAt: string; completedAt?: string | null; error?: string | null };

export default function Operations() {
  const { data: deployments = [] } = useDeploymentsQuery();
  const { data: keys = [] } = useApiKeysQuery();
  const { data: workers = [] } = useOwnedWorkersQuery();
  const config = useControlPlaneConfigQuery();
  const [deploymentId, setDeploymentId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [prompt, setPrompt] = useState("Explain how Horizon routes an inference request.");
  const [response, setResponse] = useState("");
  const [requestId, setRequestId] = useState("");
  const [newKey, setNewKey] = useState("");
  const chat = useChatCompletionMutation();
  const createKey = useCreateApiKeyMutation();
  const requests = useInferenceRequestsQuery(deploymentId || undefined);
  const usage = useInferenceUsageQuery();
  const replicas = useDeploymentReplicasQuery(deploymentId);
  const selected = deployments.find((deployment) => deployment.id === deploymentId);
  const requestRows = (requests.data || []) as RequestRow[];
  const totals = useMemo(() => (usage.data || []).reduce((result, item) => ({ prompt: result.prompt + item.usage.promptTokens, completion: result.completion + item.usage.completionTokens }), { prompt: 0, completion: 0 }), [usage.data]);
  const apiBaseUrl = config.data?.apiBaseUrl || controlPlaneUrl;
  const endpoint = `${apiBaseUrl}/v1/chat/completions`;
  const powershellExample = `$headers = @{ Authorization = "Bearer ${apiKey || "hz_live_..."}"; "Content-Type" = "application/json" }
$body = @{ deployment_id = "${deploymentId || "<deployment-id>"}"; model = "${selected?.model || "<model>"}"; messages = @(@{ role = "user"; content = "Hello" }) } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "${endpoint}" -Method Post -Headers $headers -Body $body`;

  const runChat = async () => {
    if (!deploymentId || !apiKey.trim() || !prompt.trim() || !selected) return;
    try {
      const result = await chat.mutateAsync({ deploymentId, model: selected.model, content: prompt.trim(), apiKey: apiKey.trim() });
      setResponse(result.choices[0]?.message.content || "");
      setRequestId(result.id.replace("chatcmpl-", ""));
    } catch { setResponse(""); }
  };

  const createIntegrationKey = async () => {
    const result = await createKey.mutateAsync("Operations test key");
    setNewKey(result.token);
    setApiKey(result.token);
  };

  const copy = async (value: string) => { await navigator.clipboard?.writeText(value); };

  return <>
    <PageHeader eyebrow="Control plane" title="Inference operations" description="Exercise the public API and inspect queue, replica, and usage state in one place." />
    <section className="panel integration-panel"><div><div className="detail-label">Live integration endpoint</div><code className="integration-url">{endpoint}</code><p className="ops-hint">Use this URL from your application with an API key and deployment ID.</p></div><div className="integration-actions"><button className="button secondary" type="button" onClick={() => void copy(endpoint)}>Copy URL</button><button className="button primary" type="button" onClick={() => void createIntegrationKey()} disabled={createKey.isPending}>{createKey.isPending ? "Creating..." : "Create test key"}</button></div></section>
    {newKey && <section className="inline-state key-created"><strong>New key created.</strong> Store it now; it will not be shown again.<div className="key-token"><code>{newKey}</code><button className="copy-button" type="button" onClick={() => void copy(newKey)}>Copy key</button></div></section>}
    <div className="ops-layout">
      <section className="panel ops-console">
        <div className="console-title"><strong>OpenAI-compatible chat</strong><span>POST /v1/chat/completions</span></div>
        <label className="form-label" htmlFor="ops-deployment">Deployment</label>
        <select className="input" id="ops-deployment" value={deploymentId} onChange={(event) => setDeploymentId(event.target.value)}><option value="">Select a deployment</option>{deployments.map((deployment) => <option key={deployment.id} value={deployment.id}>{deployment.name} · {deployment.status}</option>)}</select>
        <label className="form-label ops-label" htmlFor="ops-key">API key</label>
        <input className="input" id="ops-key" type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Paste hz_live_..." />
        {keys.length > 0 && <small className="ops-hint">Stored keys: {keys.map((key) => `${key.name} (${key.prefix}...)`).join(", ")}. The full token is never retrievable.</small>}
        <label className="form-label ops-label" htmlFor="ops-prompt">Message</label>
        <textarea className="request-editor ops-message" id="ops-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={6} />
        <button className="button primary" type="button" onClick={() => void runChat()} disabled={chat.isPending || !deploymentId || !apiKey.trim() || !prompt.trim()}>{chat.isPending ? "Waiting for worker..." : "Send request"}</button>
        {chat.isError && <div className="inline-state error">{chat.error instanceof Error ? chat.error.message : "Request failed. Check the API key, deployment, and worker."}</div>}
        {requestId && <div className="ops-meta"><span>Request ID</span><code>{requestId}</code></div>}
        {response && <div className="ops-response"><div className="detail-label">Assistant response</div><p>{response}</p></div>}
      </section>
      <section className="ops-side">
        <div className="panel ops-card"><div className="section-heading"><h2>Live capacity</h2><span className="ops-refresh">5s</span></div>{!deploymentId ? <p className="ops-muted">Select a deployment to inspect replicas.</p> : replicas.isLoading ? <p className="ops-muted">Loading replicas...</p> : replicas.data?.length ? replicas.data.map((replica) => { const worker = workers.find((item) => item.id === replica.workerId); return <div className="capacity-row" key={replica.id}><div><strong>{worker?.name || replica.workerId.slice(0, 8)}</strong><small>{worker?.status || "Unknown"} · {replica.lastHealthAt ? new Date(replica.lastHealthAt).toLocaleTimeString() : "No health report"}</small></div><b>{replica.activeRequests}/{replica.maxConcurrency}</b></div>; }) : <p className="ops-muted">No explicit replicas configured.</p>}</div>
        <div className="panel ops-card"><div className="section-heading"><h2>Usage totals</h2></div><div className="usage-total"><strong>{totals.prompt + totals.completion}</strong><span>estimated tokens</span></div><div className="usage-split"><span>Prompt <b>{totals.prompt}</b></span><span>Completion <b>{totals.completion}</b></span></div><small className="ops-hint ops-note">Estimates use characters ÷ 4. Exact model tokenizer usage is not available from the worker yet.</small></div>
      </section>
    </div>
    <section className="panel code-panel"><div className="section-heading"><h2>PowerShell integration</h2><button className="copy-button" type="button" onClick={() => void copy(powershellExample)}>Copy command</button></div><pre>{powershellExample}</pre></section>
    <div className="section-heading ops-heading"><h2>Inference queue</h2><span className="ops-muted">Auto-refreshes every 3 seconds</span></div>
    <section className="panel"><Table><thead><tr><th>Request</th><th>Deployment</th><th>Status</th><th>Attempts</th><th>Queued</th><th>Completed</th><th>Error</th></tr></thead><tbody>{requests.isLoading ? <tr><td colSpan={7}>Loading requests...</td></tr> : requestRows.length === 0 ? <tr><td colSpan={7}>No inference requests yet.</td></tr> : requestRows.map((item) => <tr key={item.requestId}><td><code>{item.requestId.slice(0, 12)}...</code></td><td>{deployments.find((deployment) => deployment.id === item.deploymentId)?.name || item.deploymentId.slice(0, 8)}</td><td><StatusBadge status={(item.status || "pending").toLowerCase() as "running" | "pending" | "failed" | "stopped"} /></td><td>{item.attempts}</td><td>{new Date(item.queuedAt).toLocaleTimeString()}</td><td>{item.completedAt ? new Date(item.completedAt).toLocaleTimeString() : "-"}</td><td className="ops-error-cell">{item.error || "-"}</td></tr>)}</tbody></Table></section>
  </>;
}