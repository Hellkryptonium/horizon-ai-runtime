export type Status = "online" | "running" | "deploying" | "offline" | "pending" | "failed";

export type Worker = {
  id: string;
  name: string;
  status: Status;
  cpu: string;
  memory: string;
  gpu: string;
  os: string;
  lastSeen: string;
};

export type Model = {
  id: string;
  name: string;
  version: string;
  runtime: string;
  format: string;
  size: string;
  ram: string;
  gpu: string;
};

export type Deployment = {
  id: string;
  name: string;
  model: string;
  modelId: string;
  status: Status;
  worker: string;
  workerId: string;
  created: string;
  endpoint: string;
  runtime: string;
};

export const mockWorkers: Worker[] = [
  { id: "worker-macbook", name: "macbook-pro", status: "online", cpu: "10 cores", memory: "16 GB", gpu: "Apple GPU", os: "macOS arm64", lastSeen: "just now" },
  { id: "worker-windows", name: "windows-01", status: "online", cpu: "12 cores", memory: "16 GB", gpu: "RTX 3050 · 4 GB", os: "Windows x64", lastSeen: "12 sec ago" },
  { id: "worker-linux", name: "render-node-03", status: "offline", cpu: "8 cores", memory: "32 GB", gpu: "None", os: "Linux x64", lastSeen: "2 hr ago" },
];

export const mockModels: Model[] = [
  { id: "qwen-25-3b", name: "Qwen 2.5 3B", version: "3B", runtime: "Ollama", format: "OLLAMA", size: "2.2 GB", ram: "8 GB", gpu: "Optional" },
  { id: "llama-31-8b", name: "Llama 3.1 8B", version: "8B", runtime: "Ollama", format: "OLLAMA", size: "4.9 GB", ram: "12 GB", gpu: "Recommended" },
  { id: "deepseek-r1-7b", name: "DeepSeek R1", version: "7B", runtime: "Ollama", format: "OLLAMA", size: "4.7 GB", ram: "12 GB", gpu: "Optional" },
];

export const mockDeployments: Deployment[] = [
  { id: "91e30701-abc123", name: "qwen-production", model: "Qwen 2.5 3B", modelId: "qwen-25-3b", status: "running", worker: "windows-01", workerId: "worker-windows", created: "2 min ago", endpoint: "/v1/deployments/91e30701-abc123/inference", runtime: "Ollama" },
  { id: "6b2f091e-def456", name: "research-sandbox", model: "Llama 3.1 8B", modelId: "llama-31-8b", status: "deploying", worker: "macbook-pro", workerId: "worker-macbook", created: "18 min ago", endpoint: "/v1/deployments/6b2f091e-def456/inference", runtime: "Ollama" },
];

export const dashboardStats = [
  { label: "Connected hardware", value: "3", detail: "2 online", tone: "green" },
  { label: "Running deployments", value: "2", detail: "1 deploying", tone: "amber" },
  { label: "API requests", value: "12.4K", detail: "+8.2% this week", tone: "blue" },
  { label: "Compute available", value: "42.8 GB", detail: "Across 2 workers", tone: "neutral" },
];
