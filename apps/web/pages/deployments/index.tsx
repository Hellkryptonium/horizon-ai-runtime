import Link from "next/link";
import { PageHeader, StatusBadge, Button } from "../../components/ui/Primitives";
import { Table } from "../../components/ui/Table";
import { useDeploymentsQuery } from "../../lib/query";

export default function Deployments() { const { data: deployments = [] } = useDeploymentsQuery(); return <><PageHeader title="Deployments" description="AI workloads running on your connected compute." action={<Button href="/deploy" icon="plus">New deployment</Button>} /><section className="panel"><Table><thead><tr><th>Name</th><th>Model</th><th>Status</th><th>Worker</th><th>Created</th><th>Endpoint</th></tr></thead><tbody>{deployments.map((deployment) => <tr key={deployment.id}><td><Link href={`/deployments/${deployment.id}`}><strong>{deployment.name}</strong></Link></td><td>{deployment.model}</td><td><StatusBadge status={deployment.status} /></td><td>{deployment.worker}</td><td>{deployment.created}</td><td className="endpoint">{deployment.endpoint}</td></tr>)}</tbody></Table></section></>; }
