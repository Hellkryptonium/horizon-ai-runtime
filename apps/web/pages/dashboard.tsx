import Link from "next/link";
import { PageHeader, StatCard, StatusBadge, Button } from "../components/ui/Primitives";
import { Table } from "../components/ui/Table";
import { useDeploymentsQuery, useOwnedWorkersQuery } from "../lib/query";

export default function Dashboard() {
  const { data: workers = [], isLoading: workersLoading, isError: workersError, refetch: refetchWorkers } = useOwnedWorkersQuery();
  const { data: deployments = [], isLoading: deploymentsLoading, isError: deploymentsError, refetch: refetchDeployments } = useDeploymentsQuery();
  const stats = [
    { label: "Connected hardware", value: String(workers.length), detail: `${workers.filter((worker) => worker.status === "ONLINE").length} online`, tone: "green" },
    { label: "Deployments", value: String(deployments.length), detail: `${deployments.filter((deployment) => deployment.status === "running").length} running`, tone: "amber" },
    { label: "Compute available", value: `${Math.round(workers.reduce((total, worker) => total + worker.availableRamMb, 0) / 1024)} GB`, detail: "Across connected workers", tone: "blue" },
  ];
  return <>
    <PageHeader title="Dashboard" description="Manage your compute, models, and deployments." action={<Button href="/deploy" icon="plus">New deployment</Button>} />
    <div className="stats-grid">{stats.map((stat) => <StatCard key={stat.label} {...stat} />)}</div>
    <div className="section-heading"><h2>Your hardware</h2><Link href="/workers">View all hardware →</Link></div>
    <section className="panel"><Table><thead><tr><th scope="col">Name</th><th scope="col">Status</th><th scope="col">CPU</th><th scope="col">Memory</th><th scope="col">GPU</th><th scope="col">Last seen</th></tr></thead><tbody>{workersLoading ? <tr><td colSpan={6}>Loading hardware...</td></tr> : workersError ? <tr><td colSpan={6}><div className="inline-state error">Unable to load hardware. <button onClick={() => void refetchWorkers()}>Retry</button></div></td></tr> : workers.length === 0 ? <tr><td colSpan={6}>No workers connected.</td></tr> : workers.slice(0, 2).map((worker) => <tr key={worker.id}><td><strong>{worker.name}</strong><small>{worker.operatingSystem}</small></td><td><StatusBadge status={worker.status.toLowerCase() as "online" | "offline" | "running"} /></td><td>{worker.cpuCores} cores</td><td>{Math.round(worker.totalRamMb / 1024)} GB</td><td>{worker.gpu || "None"}</td><td>{worker.lastHeartbeat ? new Date(worker.lastHeartbeat).toLocaleString() : "Never"}</td></tr>)}</tbody></Table></section>
    <div className="section-heading"><h2>Recent deployments</h2><Link href="/deployments">View all deployments →</Link></div>
    <section className="panel"><Table><thead><tr><th scope="col">Name</th><th scope="col">Model</th><th scope="col">Status</th><th scope="col">Worker</th><th scope="col">Created</th></tr></thead><tbody>{deploymentsLoading ? <tr><td colSpan={5}>Loading deployments...</td></tr> : deploymentsError ? <tr><td colSpan={5}><div className="inline-state error">Unable to load deployments. <button onClick={() => void refetchDeployments()}>Retry</button></div></td></tr> : deployments.length === 0 ? <tr><td colSpan={5}>No deployments yet.</td></tr> : deployments.map((deployment) => <tr key={deployment.id}><td><Link href={`/deployments/${deployment.id}`}><strong>{deployment.name}</strong></Link></td><td>{deployment.model}</td><td><StatusBadge status={deployment.status} /></td><td>{deployment.worker}</td><td>{deployment.created}</td></tr>)}</tbody></Table></section>
  </>;
}
