import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { ArrowLeft, Settings2 } from "lucide-react";
import { Button, CopyButton, PageHeader, StatusBadge } from "../../components/ui/Primitives";
import { useDeploymentQuery, useInferenceMutation, useOwnedWorkersQuery } from "../../lib/query";

export default function DeploymentDetail() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { data: deployment, isLoading } = useDeploymentQuery(id);
  const { data: workers = [] } = useOwnedWorkersQuery();
  const inference = useInferenceMutation();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  if (isLoading) return <div>Loading deployment...</div>;
  if (!deployment) return <div>Deployment not found.</div>;
  const worker = workers.find((item) => item.id === deployment.workerId);
  return <><Link href="/deployments" className="back-link"><ArrowLeft size={15} /> Deployments</Link><PageHeader title={deployment.name} description={`${deployment.model} on ${deployment.worker}.`} action={<div className="inline-actions"><Button variant="secondary">Redeploy unavailable</Button><button className="button quiet"><Settings2 size={16} /> Settings</button></div>} /><div style={{ marginBottom: 19 }}><StatusBadge status={deployment.status} /></div><section className="panel" style={{ marginBottom: 18 }}><div className="detail-grid"><div className="detail-item"><div className="detail-label">Model</div><div className="detail-value">{deployment.model}</div></div><div className="detail-item"><div className="detail-label">Runtime</div><div className="detail-value">{deployment.runtime}</div></div><div className="detail-item"><div className="detail-label">Worker</div><div className="detail-value">{deployment.worker}</div></div><div className="detail-item"><div className="detail-label">CPU</div><div className="detail-value">{worker ? `${worker.cpuCores} cores` : "Unavailable"}</div></div><div className="detail-item"><div className="detail-label">Memory</div><div className="detail-value">{worker ? `${Math.round(worker.totalRamMb / 1024)} GB` : "Unavailable"}</div></div><div className="detail-item"><div className="detail-label">GPU</div><div className="detail-value">{worker?.gpu || "None"}</div></div></div><div style={{ padding: 20 }}><div className="detail-label" style={{ marginBottom: 8 }}>Endpoint</div><div className="copy-row"><span>{deployment.endpoint}</span><CopyButton /></div></div></section>{deployment.status === "running" && <section className="panel" style={{ padding: 20, marginBottom: 18 }}><div className="detail-label" style={{ marginBottom: 8 }}>Inference prompt</div><textarea className="input" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask the deployed model something..." rows={4} /><div className="wizard-actions"><button className="button primary" type="button" disabled={inference.isPending || !prompt.trim()} onClick={() => inference.mutate({ deploymentId: deployment.id, prompt }, { onSuccess: (result) => setResponse(result.response) })}>{inference.isPending ? "Sending..." : "Send"}</button></div>{response && <div style={{ whiteSpace: "pre-wrap", marginTop: 16 }}>{response}</div>}{inference.isError && <div style={{ color: "var(--danger)", marginTop: 16 }}>{inference.error instanceof Error ? inference.error.message : "Inference failed."}</div>}</section>}<Link href={`/deployments/${deployment.id}/playground`} className="button secondary">Open playground</Link></>;
}
