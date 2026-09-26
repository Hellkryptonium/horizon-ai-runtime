import Link from "next/link";
import { PageHeader } from "../components/ui/Primitives";
import { Card } from "../components/ui/Card";

export default function Help() {
  return <div style={{ maxWidth: 820 }}><PageHeader title="Help & docs" description="Guides for connecting hardware and deploying workloads on Horizon." /><div className="help-grid"><Card><div className="eyebrow">Getting started</div><h2 className="content-title">Connect a computer</h2><p>Install the Worker Agent and connect your local machine to the Horizon control plane.</p><Link href="/workers/connect" className="text-link">View connection guide →</Link></Card><Card><div className="eyebrow">Deployments</div><h2 className="content-title">Deploy your first service</h2><p>Select a model, choose connected hardware, and expose a deployment endpoint.</p><Link href="/deploy" className="text-link">Create a deployment →</Link></Card><Card><div className="eyebrow">API reference</div><h2 className="content-title">Inference API</h2><p>Use deployment-scoped tokens to call your running workloads from any application.</p><Link href="/developer" className="text-link">Read the API guide →</Link></Card></div></div>;
}
