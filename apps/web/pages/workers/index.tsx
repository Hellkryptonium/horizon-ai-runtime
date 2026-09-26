import Link from "next/link";
import { PageHeader, StatusBadge, Button } from "../../components/ui/Primitives";
import { Table } from "../../components/ui/Table";
import { useWorkersQuery } from "../../lib/query";

export default function Workers() {
  const { data: workers = [], isLoading } = useWorkersQuery();
  return <><PageHeader title="Hardware" description="Computers connected to your Horizon account." action={<Button href="/workers/connect" icon="plus">Connect computer</Button>} /><section className="panel"><Table><thead><tr><th>Name</th><th>Status</th><th>CPU</th><th>Memory</th><th>GPU</th><th>OS</th><th>Architecture</th><th>Last seen</th></tr></thead><tbody>{isLoading ? <tr><td colSpan={8}>Loading hardware...</td></tr> : workers.map((worker) => <tr key={worker.id}><td><strong>{worker.name}</strong></td><td><StatusBadge status={worker.status} /></td><td>{worker.cpu}</td><td>{worker.memory}</td><td>{worker.gpu}</td><td>{worker.os.split(" ")[0]}</td><td>{worker.os.split(" ")[1]}</td><td>{worker.lastSeen}</td></tr>)}</tbody></Table></section><div className="section-heading"><h2>Need another machine?</h2></div><section className="panel" style={{ padding: 22 }}><strong>Connect your own computer</strong><p style={{ color: "var(--muted)", margin: "5px 0 14px" }}>Install the Worker Agent and make local compute available to your deployments.</p><Link href="/workers/connect" className="button secondary">View connection instructions</Link></section></>;
}
