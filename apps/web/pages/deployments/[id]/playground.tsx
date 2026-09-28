import { useRouter } from "next/router";
import { Button, PageHeader } from "../../../components/ui/Primitives";
import { useDeploymentQuery } from "../../../lib/query";

export default function Playground() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { data: deployment, isLoading } = useDeploymentQuery(id);
  if (isLoading) return <div>Loading deployment...</div>;
  if (!deployment) return <div>Deployment not found.</div>;
  return <><PageHeader eyebrow="API console" title={`${deployment.name} playground`} description="Inference routing is not available yet." action={<Button href={`/deployments/${deployment.id}`} variant="secondary">Back to overview</Button>} /><section className="panel console-panel"><div className="empty-console">No inference endpoint is available for this deployment yet.</div></section></>;
}
