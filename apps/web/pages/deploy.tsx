import { useRouter } from "next/router";
import { useForm } from "react-hook-form";
import { Check } from "lucide-react";
import { Button, PageHeader } from "../components/ui/Primitives";
import { useModelsQuery, useWorkersQuery } from "../lib/query";
import { deploymentsApi } from "../lib/api";
import { useDeploymentWizardStore } from "../stores/deploymentWizardStore";

type FormValues = { deploymentName: string };

export default function Deploy() {
  const router = useRouter(); const { data: models = [] } = useModelsQuery(); const { data: workers = [] } = useWorkersQuery();
  const { currentStep, selectedModelId, selectedWorkerId, deploymentName, setStep, selectModel, selectWorker, setDeploymentName, reset } = useDeploymentWizardStore();
  const { register, handleSubmit } = useForm<FormValues>({ defaultValues: { deploymentName } });
  const model = models.find((item) => item.id === selectedModelId); const worker = workers.find((item) => item.id === selectedWorkerId);
  const review = async (values: FormValues) => { setDeploymentName(values.deploymentName); if (currentStep < 3) { setStep(currentStep + 1); return; } if (!model || !worker) return; const created = await deploymentsApi.create({ name: values.deploymentName, model: model.name, modelId: model.id, worker: worker.name, workerId: worker.id }); reset(); void router.push(`/deployments/${created.id}`); };
  return <div className="wizard"><PageHeader title="New deployment" description="Deploy a model to one of your connected computers." />
    <div className="stepper">{["Select model", "Select hardware", "Review"].map((label, index) => <div key={label} style={{ display: "contents" }}><div className={`step ${currentStep >= index + 1 ? "active" : ""}`}><span className="step-number">{index + 1}</span>{label}</div>{index < 2 && <div className="step-line" />}</div>)}</div>
    <section className="panel" style={{ padding: 22 }}>
      {currentStep === 1 && <><div className="section-heading" style={{ marginTop: 0 }}><h2>Step 1 — Select a model</h2></div><div className="selection-list">{models.map((item) => <div key={item.id} className={`selection-row ${selectedModelId === item.id ? "selected" : ""}`} onClick={() => selectModel(item.id)}><span className="radio" /><div className="selection-content"><div className="selection-title">{item.name}</div><div className="selection-meta">{item.runtime} · {item.size} · {item.ram} RAM · {item.gpu} GPU</div></div></div>)}</div></>}
      {currentStep === 2 && <><div className="section-heading" style={{ marginTop: 0 }}><h2>Step 2 — Select hardware</h2></div><div className="selection-list">{workers.filter((item) => item.status === "online").map((item) => <div key={item.id} className={`selection-row ${selectedWorkerId === item.id ? "selected" : ""}`} onClick={() => selectWorker(item.id)}><span className="radio" /><div className="selection-content"><div className="selection-title">{item.name}</div><div className="selection-meta">{item.cpu} · {item.memory} · {item.gpu}</div></div><span className="status-badge online"><span className="status-dot online" />Online</span></div>)}</div>{selectedWorkerId && <div className="compatibility"><span><Check size={13} /> Meets memory requirement</span><span><Check size={13} /> Runtime available</span><span><Check size={13} /> GPU requirement satisfied</span></div>}</>}
      {currentStep === 3 && <><div className="section-heading" style={{ marginTop: 0 }}><h2>Step 3 — Review and deploy</h2></div><form onSubmit={handleSubmit(review)}><label className="form-label" htmlFor="deploymentName">Deployment name</label><input id="deploymentName" className="input" placeholder="qwen-production" {...register("deploymentName", { required: true })} /><div className="detail-grid" style={{ marginTop: 22, border: "1px solid var(--line)", borderRadius: 7 }}>{[["Model", model?.name || "Select a model"], ["Worker", worker?.name || "Select hardware"], ["Runtime", model?.runtime || "Ollama"], ["Resources", `${model?.ram || "8 GB"} RAM · ${worker?.gpu || "GPU optional"}`]].map(([label, value]) => <div className="detail-item" key={label}><div className="detail-label">{label}</div><div className="detail-value">{value}</div></div>)}</div><div className="wizard-actions"><Button type="button" variant="secondary" onClick={() => setStep(2)}>Back</Button><Button type="submit">Deploy</Button></div></form></>}
      {currentStep < 3 && <div className="wizard-actions"><Button type="button" variant="secondary" onClick={() => setStep(Math.max(1, currentStep - 1))}>Back</Button><Button type="button" onClick={() => setStep(currentStep + 1)}>{currentStep === 2 ? "Review deployment" : "Continue"}</Button></div>}
    </section>
  </div>;
}
