import { useState } from "react";
import { PageHeader, Button, StatusBadge } from "../components/ui/Primitives";
import { useConnectionRequestsQuery, useDeploymentRequestsQuery, useDecideConnectionMutation, useModelsQuery, useMarketplaceWorkersQuery, useRequestConnectionMutation, useRequestDeploymentMutation } from "../lib/query";

const connectionLabel = (status?: string) => status === "ACCEPTED" ? "online" : status === "REQUESTED" ? "pending" : "offline";

export default function Marketplace() {
  const { data: workers = [], isLoading } = useMarketplaceWorkersQuery();
  const { data: connections = [] } = useConnectionRequestsQuery();
  const { data: deploymentRequests = [] } = useDeploymentRequestsQuery();
  const { data: models = [] } = useModelsQuery();
  const requestConnection = useRequestConnectionMutation();
  const decideConnection = useDecideConnectionMutation();
  const requestDeployment = useRequestDeploymentMutation();
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [modelId, setModelId] = useState("");
  const [deploymentName, setDeploymentName] = useState("");
  const selectedWorker = workers.find((worker) => worker.id === selectedWorkerId);
  const selectedConnection = connections.find((connection) => connection.workerId === selectedWorkerId && connection.status === "ACCEPTED");

  return <>
    <PageHeader title="Marketplace" description="Find connected machines and request permission to use their compute." action={<Button href="/requests" icon="arrow">View requests</Button>} />
    <section className="panel">
      <div className="section-heading" style={{ marginTop: 0 }}><div><h2>Available machines</h2><p style={{ color: "var(--muted)", margin: "4px 0 0" }}>Connection approval comes before every deployment request.</p></div><span className="detail-label">{workers.length} online</span></div>
      {isLoading ? <p>Loading available machines...</p> : workers.length === 0 ? <p style={{ color: "var(--muted)" }}>No shared machines are online right now.</p> : <div className="marketplace-grid">{workers.map((worker) => {
        const connection = connections.find((item) => item.workerId === worker.id && item.status !== "CANCELLED" && item.status !== "REJECTED");
        const hasDeployment = deploymentRequests.some((item) => item.workerId === worker.id && ["REQUESTED", "ACCEPTED", "DEPLOYING", "RUNNING"].includes(item.status));
        return <article className="marketplace-machine" key={worker.id}>
          <div className="section-heading" style={{ marginTop: 0 }}><div><h3>{worker.name}</h3><small>{worker.providerName}</small></div><StatusBadge status={connectionLabel(connection?.status)} /></div>
          <div className="machine-specs"><span>{worker.cpuCores} CPU cores</span><span>{Math.round(worker.totalRamMb / 1024)} GB RAM</span><span>{worker.gpu || "CPU only"}</span><span>{worker.operatingSystem} · {worker.architecture || "unknown"}</span></div>
          {!connection ? <button className="button primary" onClick={() => requestConnection.mutate(worker.id)} disabled={requestConnection.isPending}>Request connection</button> : connection.status === "REQUESTED" ? <button className="button quiet" disabled>Connection pending</button> : connection.status === "ACCEPTED" ? <button className="button secondary" onClick={() => setSelectedWorkerId(worker.id)} disabled={hasDeployment}>Request deployment</button> : <button className="button quiet" onClick={() => requestConnection.mutate(worker.id)} disabled={requestConnection.isPending}>Request again</button>}
        </article>;
      })}</div>}
    </section>
    {selectedWorker && selectedConnection && <section className="panel" style={{ marginTop: 18 }}><div className="section-heading" style={{ marginTop: 0 }}><div><h2>Request deployment</h2><p style={{ color: "var(--muted)", margin: "4px 0 0" }}>{selectedWorker.name} is connected and available.</p></div><button className="button quiet" onClick={() => setSelectedWorkerId("")}>Close</button></div><div className="form-grid"><label>Model<select className="input" value={modelId} onChange={(event) => setModelId(event.target.value)}><option value="">Choose a model</option>{models.map((model) => <option key={model.id} value={model.id}>{model.name} · {model.runtime}</option>)}</select></label><label>Name<input className="input" value={deploymentName} onChange={(event) => setDeploymentName(event.target.value)} placeholder="Shared deployment" /></label></div><button className="button primary" style={{ marginTop: 16 }} onClick={() => requestDeployment.mutate({ workerId: selectedWorker.id, modelId, connectionRequestId: selectedConnection.id, name: deploymentName || undefined }, { onSuccess: () => { setSelectedWorkerId(""); setModelId(""); setDeploymentName(""); } })} disabled={!modelId || requestDeployment.isPending}>{requestDeployment.isPending ? "Sending request..." : "Send deployment request"}</button>{requestDeployment.isError && <p className="inline-state error">{requestDeployment.error instanceof Error ? requestDeployment.error.message : "Deployment request failed."}</p>}</section>}
  </>;
}
