import Link from "next/link";
import { PageHeader, StatCard, StatusBadge, Button } from "../components/ui/Primitives";
import { Table } from "../components/ui/Table";
import { useDashboardStatsQuery, useDeploymentsQuery, useWorkersQuery } from "../lib/query";

export default function Dashboard() {
  const { data: stats = [] } = useDashboardStatsQuery();
  const { data: workers = [] } = useWorkersQuery();
  const { data: deployments = [] } = useDeploymentsQuery();
  return <>
    <PageHeader title="Dashboard" description="Manage your compute, models, and deployments." action={<Button href="/deploy" icon="plus">New deployment</Button>} />
    <div className="stats-grid">{stats.map((stat) => <StatCard key={stat.label} {...stat} />)}</div>
    <div className="section-heading"><h2>Your hardware</h2><Link href="/workers">View all hardware →</Link></div>
    <section className="panel"><Table><thead><tr><th>Name</th><th>Status</th><th>CPU</th><th>Memory</th><th>GPU</th><th>Last seen</th></tr></thead><tbody>{workers.slice(0, 2).map((worker) => <tr key={worker.id}><td><strong>{worker.name}</strong><small>{worker.os}</small></td><td><StatusBadge status={worker.status} /></td><td>{worker.cpu}</td><td>{worker.memory}</td><td>{worker.gpu}</td><td>{worker.lastSeen}</td></tr>)}</tbody></Table></section>
    <div className="section-heading"><h2>Recent deployments</h2><Link href="/deployments">View all deployments →</Link></div>
    <section className="panel"><Table><thead><tr><th>Name</th><th>Model</th><th>Status</th><th>Worker</th><th>Created</th></tr></thead><tbody>{deployments.map((deployment) => <tr key={deployment.id}><td><Link href={`/deployments/${deployment.id}`}><strong>{deployment.name}</strong></Link></td><td>{deployment.model}</td><td><StatusBadge status={deployment.status} /></td><td>{deployment.worker}</td><td>{deployment.created}</td></tr>)}</tbody></Table></section>
  </>;
}
