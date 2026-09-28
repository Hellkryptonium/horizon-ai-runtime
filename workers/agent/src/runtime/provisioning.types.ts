export type ProvisioningOperation = "runtime.health" | "runtime.install" | "model.status" | "model.pull";

export interface RuntimeHealth {
  available: boolean;
  version?: string;
  location?: string;
}

export interface RuntimeModel {
  name: string;
  sizeMb?: number;
}

export interface RuntimeProvisioner {
  health(): Promise<RuntimeHealth>;
  listModels(): Promise<RuntimeModel[]>;
  pullModel(modelId: string): Promise<void>;
  install(): Promise<void>;
}
