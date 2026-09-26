import { PageHeader, Button } from "../../components/ui/Primitives";
import { Table } from "../../components/ui/Table";
import { useModelsQuery } from "../../lib/query";

export default function Models() { const { data: models = [] } = useModelsQuery(); return <><PageHeader title="Models" description="Models available for deployment." action={<Button variant="secondary" icon="plus">Add model</Button>} /><section className="panel"><Table><thead><tr><th>Name</th><th>Version</th><th>Runtime</th><th>Format</th><th>Size</th><th>RAM</th><th>GPU</th><th>Context</th></tr></thead><tbody>{models.map((model) => <tr key={model.id}><td><strong>{model.name}</strong></td><td>{model.version}</td><td>{model.runtime}</td><td>{model.format}</td><td>{model.size}</td><td>{model.ram}</td><td>{model.gpu}</td><td>4096</td></tr>)}</tbody></Table></section></>; }
