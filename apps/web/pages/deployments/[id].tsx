import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CopyButton, PageHeader, StatusBadge } from "../../components/ui/Primitives";
import { useDeleteDeploymentMutation, useDeploymentQuery, useInferenceMutation, useOwnedWorkersQuery, useRestartDeploymentMutation, useStopDeploymentMutation, useUpdateDeploymentMutation } from "../../lib/query";

export default function DeploymentDetail() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { data: deployment, isLoading } = useDeploymentQuery(id);
  const { data: workers = [] } = useOwnedWorkersQuery();
  const inference = useInferenceMutation();
  const stopDeployment = useStopDeploymentMutation();
  const restartDeployment = useRestartDeploymentMutation();
  const updateDeployment = useUpdateDeploymentMutation();
  const deleteDeployment = useDeleteDeploymentMutation();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [name, setName] = useState("");
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    if (deployment) setName(deployment.name);
  }, [deployment]);

  if (isLoading) return <div>Loading deployment...</div>;
  if (!deployment) return <div>Deployment not found.</div>;

  const worker = workers.find((item) => item.id === deployment.workerId);
  const canInfer = deployment.status === "running";
  const canStop = deployment.status === "running";
  const canRestart = deployment.status === "stopped" || deployment.status === "failed";
  const canDelete = deployment.status === "stopped" || deployment.status === "failed";

  const saveName = async () => {
    if (!name.trim()) return;
    await updateDeployment.mutateAsync({ deploymentId: deployment.id, name: name.trim() });
    setEditingName(false);
  };

  const removeDeployment = async () => {
    if (!window.confirm(`Delete ${deployment.name}? This cannot be undone.`)) return;
    await deleteDeployment.mutateAsync(deployment.id);
    await router.push("/deployments");
  };

  return <>
    <Link href="/deployments" className="back-link"><ArrowLeft size={15} /> Deployments</Link>
    <PageHeader
      title={editingName ? "Edit deployment" : deployment.name}
      description={`${deployment.model} on ${deployment.worker}.`}
      action={<div className="inline-actions">
        {canStop && <button className="button secondary" onClick={() => stopDeployment.mutate(deployment.id)} disabled={stopDeployment.isPending}>{stopDeployment.isPending ? "Stopping..." : "Stop deployment"}</button>}
        {canRestart && <button className="button secondary" onClick={() => restartDeployment.mutate(deployment.id)} disabled={restartDeployment.isPending}>{restartDeployment.isPending ? "Restarting..." : "Restart deployment"}</button>}
        {!editingName && <button className="button quiet" onClick={() => setEditingName(true)}>Rename</button>}
        {canDelete && <button className="button quiet danger-text" onClick={() => void removeDeployment()} disabled={deleteDeployment.isPending}>{deleteDeployment.isPending ? "Deleting..." : "Delete"}</button>}
      </div>}
    />
    {editingName && <section className="panel" style={{ padding: 20, marginBottom: 18 }}><label className="form-label" htmlFor="deployment-name">Deployment name</label><div className="inline-actions"><input id="deployment-name" className="input" value={name} onChange={(event) => setName(event.target.value)} autoFocus /><button className="button primary" onClick={() => void saveName()} disabled={updateDeployment.isPending || !name.trim()}>{updateDeployment.isPending ? "Saving..." : "Save name"}</button><button className="button quiet" onClick={() => { setName(deployment.name); setEditingName(false); }}>Cancel</button></div></section>}
    <div style={{ marginBottom: 19 }}><StatusBadge status={deployment.status} /></div>
    <section className="panel" style={{ marginBottom: 18 }}>
      <div className="detail-grid">
        <div className="detail-item"><div className="detail-label">Model</div><div className="detail-value">{deployment.model}</div></div>
        <div className="detail-item"><div className="detail-label">Runtime</div><div className="detail-value">{deployment.runtime}</div></div>
        <div className="detail-item"><div className="detail-label">Worker</div><div className="detail-value">{deployment.worker}</div></div>
        <div className="detail-item"><div className="detail-label">CPU</div><div className="detail-value">{worker ? `${worker.cpuCores} cores` : "Unavailable"}</div></div>
        <div className="detail-item"><div className="detail-label">Memory</div><div className="detail-value">{worker ? `${Math.round(worker.totalRamMb / 1024)} GB` : "Unavailable"}</div></div>
        <div className="detail-item"><div className="detail-label">GPU</div><div className="detail-value">{worker?.gpu || "None"}</div></div>
      </div>
      <div style={{ padding: 20 }}>
        <div className="detail-label" style={{ marginBottom: 8 }}>Endpoint</div>
        <div className="copy-row"><span>{deployment.endpoint}</span><CopyButton /></div>
      </div>
    </section>
    {canInfer && <section className="panel" style={{ padding: 20, marginBottom: 18 }}>
      <div className="detail-label" style={{ marginBottom: 8 }}>Inference prompt</div>
      <textarea className="input" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask the deployed model something..." rows={4} />
      <div className="wizard-actions">
        <button className="button primary" type="button" disabled={inference.isPending || !prompt.trim()} onClick={() => inference.mutate({ deploymentId: deployment.id, prompt }, { onSuccess: (result) => setResponse(result.response) })}>
          {inference.isPending ? "Sending..." : "Send"}
        </button>
      </div>
      {response && <div style={{ whiteSpace: "pre-wrap", marginTop: 16 }}>{response}</div>}
      {inference.isError && <div style={{ color: "var(--danger)", marginTop: 16 }}>{inference.error instanceof Error ? inference.error.message : "Inference failed."}</div>}
    </section>}
    {stopDeployment.isError && <div className="inline-state error">{stopDeployment.error instanceof Error ? stopDeployment.error.message : "Deployment could not be stopped."}</div>}
    {restartDeployment.isError && <div className="inline-state error">{restartDeployment.error instanceof Error ? restartDeployment.error.message : "Deployment could not be restarted."}</div>}
    {updateDeployment.isError && <div className="inline-state error">{updateDeployment.error instanceof Error ? updateDeployment.error.message : "Deployment name could not be updated."}</div>}
    {deleteDeployment.isError && <div className="inline-state error">{deleteDeployment.error instanceof Error ? deleteDeployment.error.message : "Deployment could not be deleted."}</div>}
    <Link href={`/deployments/${deployment.id}/playground`} className="button secondary">Open playground</Link>
  </>;
}
