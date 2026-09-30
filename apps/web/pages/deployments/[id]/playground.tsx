import { useState } from "react";
import { useRouter } from "next/router";
import { Button, PageHeader } from "../../../components/ui/Primitives";
import { useDeploymentQuery, useInferenceMutation } from "../../../lib/query";

export default function DeploymentPlayground() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { data: deployment, isLoading } = useDeploymentQuery(id);
  const inference = useInferenceMutation();
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");

  if (isLoading) return <div>Loading deployment...</div>;
  if (!deployment) return <div>Deployment not found.</div>;

  const sendPrompt = () => inference.mutate({ deploymentId: deployment.id, prompt }, { onSuccess: (result) => setResponse(result.response) });

  return <>
    <PageHeader eyebrow="API console" title={`${deployment.name} playground`} description={`${deployment.model} on ${deployment.worker}.`} action={<Button href={`/deployments/${deployment.id}`} variant="secondary">Back to overview</Button>} />
    <section className="panel console-panel" style={{ padding: 22 }}>
      <div className="detail-label" style={{ marginBottom: 8 }}>Prompt</div>
      <textarea className="input" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask the deployed model something..." rows={8} />
      <div className="wizard-actions"><button className="button primary" type="button" onClick={sendPrompt} disabled={inference.isPending || !prompt.trim()}>{inference.isPending ? "Running inference..." : "Run inference"}</button></div>
      {inference.isError && <div className="inline-state error">{inference.error instanceof Error ? inference.error.message : "Inference failed."}</div>}
      {response && <div style={{ marginTop: 22 }}><div className="detail-label" style={{ marginBottom: 8 }}>Response</div><div className="panel" style={{ padding: 16, whiteSpace: "pre-wrap" }}>{response}</div></div>}
    </section>
  </>;
}
