import os from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

import type { RuntimeHealth, RuntimeModel, RuntimeProvisioner } from "./provisioning.types.js";

const execFileAsync = promisify(execFile);
const modelPattern = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,127}$/;

type Fetch = typeof fetch;

export interface OllamaProvisionerOptions {
  baseUrl: string;
  timeoutMs: number;
  fetchImpl?: Fetch;
  platform?: NodeJS.Platform;
  log?: (message: string) => void;
}

export class OllamaProvisioner implements RuntimeProvisioner {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: Fetch;
  private readonly platform: NodeJS.Platform;
  private readonly log: (message: string) => void;

  constructor(options: OllamaProvisionerOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.timeoutMs = options.timeoutMs;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.platform = options.platform ?? os.platform();
    this.log = options.log ?? (() => undefined);
  }

  async health(): Promise<RuntimeHealth> {
    try {
      const response = await this.request("/api/version");
      if (!response.ok) return { available: false };
      const body = await response.json() as { version?: unknown };
      if (typeof body.version !== "string") return { available: false };
      const location = await this.findLocation();
      return { available: true, version: body.version, ...(location ? { location } : {}) };
    } catch {
      return { available: false };
    }
  }

  async listModels(): Promise<RuntimeModel[]> {
    const response = await this.request("/api/tags");
    if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);
    const body = await response.json() as { models?: { name?: unknown }[] };
    return (body.models ?? []).filter((model): model is { name: string; size?: number } => typeof model.name === "string").map((model) => ({
      name: model.name,
      ...(typeof model.size === "number" ? { sizeMb: Math.round(model.size / 1024 / 1024) } : {}),
    }));
  }

  async pullModel(modelId: string): Promise<void> {
    this.validateModelId(modelId);
    this.log(`[provisioning] pulling Ollama model ${modelId}`);
    const response = await this.request("/api/pull", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ model: modelId, stream: false }),
    });
    if (!response.ok) throw new Error(`Ollama model pull returned HTTP ${response.status}.`);
    this.log(`[provisioning] Ollama model ${modelId} is ready`);
  }

  async install(): Promise<void> {
    if (this.platform === "win32") {
      this.log("[provisioning] installing Ollama with winget");
      await this.runInstaller("winget.exe", ["install", "--id", "Ollama.Ollama", "--exact", "--accept-source-agreements", "--accept-package-agreements"]);
      return;
    }
    if (this.platform === "darwin") {
      this.log("[provisioning] installing Ollama with Homebrew");
      await this.runInstaller("brew", ["install", "--cask", "ollama"]);
      return;
    }
    throw new Error("Automatic Ollama installation is supported only on Windows and macOS.");
  }

  private validateModelId(modelId: string) {
    if (!modelPattern.test(modelId)) throw new Error("Invalid Ollama model identifier.");
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(new URL(path, `${this.baseUrl}/`), { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
  }

  private async findLocation(): Promise<string | undefined> {
    if (this.platform !== "win32" && this.platform !== "darwin") return undefined;
    try {
      const command = this.platform === "win32" ? "where.exe" : "which";
      const result = await execFileAsync(command, ["ollama"]);
      return result.stdout.trim().split(/\r?\n/)[0] || undefined;
    } catch {
      return undefined;
    }
  }

  private runInstaller(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { windowsHide: false });
      child.stdout.on("data", (chunk: Buffer) => {
        const output = chunk.toString().trim();
        if (output) this.log(output);
      });
      child.stderr.on("data", (chunk: Buffer) => {
        const output = chunk.toString().trim();
        if (output) this.log(`[provisioning] ${output}`);
      });
      child.once("error", (error) => reject(new Error(`Unable to start ${command}: ${error.message}`)));
      child.once("close", (code) => {
        if (code === 0) {
          this.log(`[provisioning] ${command} completed`);
          resolve();
        } else {
          reject(new Error(`${command} exited with code ${code ?? "unknown"}. Administrator approval may be required.`));
        }
      });
    });
  }
}
