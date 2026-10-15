import { UnsupportedRuntimeError } from "./runtime.errors.js";
import type { RuntimeAdapter } from "./runtime.types.js";
import type { RuntimeProvisioner } from "./provisioning.types.js";

export class RuntimeRegistry {
  private readonly adapters = new Map<string, RuntimeAdapter>();
  private readonly provisioners = new Map<string, RuntimeProvisioner>();

  register(name: string, adapter: RuntimeAdapter, provisioner?: RuntimeProvisioner): this {
    const key = name.trim().toLowerCase();
    if (!key) throw new Error("Runtime name must not be empty.");
    if (this.adapters.has(key)) throw new Error(`Runtime '${key}' is already registered.`);
    this.adapters.set(key, adapter);
    if (provisioner) this.provisioners.set(key, provisioner);
    return this;
  }

  getAdapter(name: string): RuntimeAdapter {
    const adapter = this.adapters.get(name.trim().toLowerCase());
    if (!adapter) throw new UnsupportedRuntimeError(name);
    return adapter;
  }

  getProvisioner(name: string): RuntimeProvisioner | undefined {
    return this.provisioners.get(name.trim().toLowerCase());
  }

  names(): string[] {
    return [...this.adapters.keys()].sort();
  }
}