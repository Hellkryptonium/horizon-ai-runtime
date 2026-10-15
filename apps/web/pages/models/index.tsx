import { useState } from "react";
import { PageHeader } from "../../components/ui/Primitives";
import { Table } from "../../components/ui/Table";
import { useCreateModelMutation, useDeleteModelMutation, useModelsQuery, useUpdateModelMutation } from "../../lib/query";
import type { Model } from "../../lib/types";

export default function Models() {
  const { data: models = [], isLoading, isError, refetch } = useModelsQuery();
  const updateModel = useUpdateModelMutation();
  const createModel = useCreateModelMutation();
  const deleteModel = useDeleteModelMutation();
  const [editing, setEditing] = useState<Model | null>(null);
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [message, setMessage] = useState("");
  const [runtime, setRuntime] = useState("ollama");
  const [newModel, setNewModel] = useState({ name: "", version: "", runtimeModelId: "", format: "OLLAMA", sizeMb: "", minRamMb: "", modelArchitecture: "", contextLength: "", minVramMb: "" });

  const beginEdit = (model: Model) => {
    setEditing(model);
    setName(model.name);
    setVersion(model.version);
    setMessage("");
  };

  const save = async () => {
    if (!editing || !name.trim() || !version.trim()) return;
    try {
      await updateModel.mutateAsync({ modelId: editing.id, model: { ...editing.metadata, name: name.trim(), version: version.trim() } });
      setEditing(null);
      setMessage("Model updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Model could not be updated.");
    }
  };

  const remove = async (model: Model) => {
    if (!window.confirm(`Delete ${model.name}? Models used by deployments cannot be deleted.`)) return;
    try {
      await deleteModel.mutateAsync(model.id);
      setMessage("Model deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Model could not be deleted.");
    }
  };

  const create = async () => {
    if (!newModel.name.trim() || !newModel.version.trim() || !newModel.runtimeModelId.trim() || !newModel.sizeMb || !newModel.minRamMb || !newModel.modelArchitecture.trim()) {
      setMessage("Name, version, runtime model ID, size, RAM, and architecture are required.");
      return;
    }
    try {
      await createModel.mutateAsync({ name: newModel.name.trim(), version: newModel.version.trim(), runtime, runtimeModelId: newModel.runtimeModelId.trim(), format: runtime === "docker-fastapi" ? "DOCKER" : "OLLAMA", sizeMb: Number(newModel.sizeMb), minRamMb: Number(newModel.minRamMb), minVramMb: newModel.minVramMb ? Number(newModel.minVramMb) : null, requiresGpu: false, modelArchitecture: newModel.modelArchitecture.trim(), contextLength: newModel.contextLength ? Number(newModel.contextLength) : null, downloadUrl: null });
      setMessage("Model registered.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Model could not be registered.");
    }
  };

  return <>
    <PageHeader title="Models" description="Manage the shared model catalog used by deployments." />
    <section className="panel" style={{ padding: 20, marginBottom: 18 }}><h2 className="content-title">Register a model</h2><div className="settings-grid"><div><label className="form-label" htmlFor="new-model-name">Name</label><input id="new-model-name" className="input" placeholder="Model name" value={newModel.name} onChange={(event) => setNewModel({ ...newModel, name: event.target.value })} /></div><div><label className="form-label" htmlFor="new-model-runtime">Runtime</label><select id="new-model-runtime" className="input" value={runtime} onChange={(event) => { setRuntime(event.target.value); setNewModel({ ...newModel, format: event.target.value === "docker-fastapi" ? "DOCKER" : "OLLAMA" }); }}><option value="docker-fastapi">Docker FastAPI</option><option value="ollama">Ollama</option></select></div><div><label className="form-label" htmlFor="new-model-version">Version</label><input id="new-model-version" className="input" placeholder="1.0" value={newModel.version} onChange={(event) => setNewModel({ ...newModel, version: event.target.value })} /></div><div><label className="form-label" htmlFor="new-model-image">Image or runtime model ID</label><input id="new-model-image" className="input" placeholder="provider-model:tag" value={newModel.runtimeModelId} onChange={(event) => setNewModel({ ...newModel, runtimeModelId: event.target.value })} /></div><div><label className="form-label" htmlFor="new-model-architecture">Architecture</label><input id="new-model-architecture" className="input" placeholder="llama, bert, or custom" value={newModel.modelArchitecture} onChange={(event) => setNewModel({ ...newModel, modelArchitecture: event.target.value })} /></div><div><label className="form-label" htmlFor="new-model-ram">Minimum RAM (MB)</label><input id="new-model-ram" className="input" type="number" min="1" placeholder="1024" value={newModel.minRamMb} onChange={(event) => setNewModel({ ...newModel, minRamMb: event.target.value })} /></div></div><div className="wizard-actions"><button className="button primary" onClick={() => void create()} disabled={createModel.isPending}>{createModel.isPending ? "Registering..." : "Register model"}</button></div></section>
    {editing && <section className="panel" style={{ padding: 20, marginBottom: 18 }}><h2 className="content-title">Edit model</h2><div className="settings-grid"><div><label className="form-label" htmlFor="model-name">Name</label><input id="model-name" className="input" value={name} onChange={(event) => setName(event.target.value)} /></div><div><label className="form-label" htmlFor="model-version">Version</label><input id="model-version" className="input" value={version} onChange={(event) => setVersion(event.target.value)} /></div></div><div className="wizard-actions"><button className="button primary" onClick={() => void save()} disabled={updateModel.isPending}>{updateModel.isPending ? "Saving..." : "Save changes"}</button><button className="button quiet" onClick={() => setEditing(null)}>Cancel</button></div></section>}
    {message && <div className={`inline-state ${deleteModel.isError || updateModel.isError ? "error" : ""}`} style={{ marginBottom: 14 }}>{message}</div>}
    <section className="panel"><Table><thead><tr><th>Name</th><th>Version</th><th>Runtime</th><th>Format</th><th>Size</th><th>RAM</th><th>GPU</th><th aria-label="Actions" /></tr></thead><tbody>{isLoading ? <tr><td colSpan={8}>Loading models...</td></tr> : isError ? <tr><td colSpan={8}><div className="inline-state error">Unable to load models. <button onClick={() => void refetch()}>Retry</button></div></td></tr> : models.length === 0 ? <tr><td colSpan={8}>No models registered.</td></tr> : models.map((model) => <tr key={model.id}><td><strong>{model.name}</strong></td><td>{model.version}</td><td>{model.runtime}</td><td>{model.format}</td><td>{model.size}</td><td>{model.ram}</td><td>{model.gpu}</td><td><div className="inline-actions"><button className="button quiet" onClick={() => beginEdit(model)}>Edit</button><button className="button quiet danger-text" onClick={() => void remove(model)} disabled={deleteModel.isPending}>Delete</button></div></td></tr>)}</tbody></Table></section>
  </>;
}
