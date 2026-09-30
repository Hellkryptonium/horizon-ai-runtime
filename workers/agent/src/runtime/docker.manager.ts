import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface DockerContainerOptions {
  name: string;
  image: string;
  memoryMb: number;
  cpuLimit: number;
  network: string;
  port: number;
}

export interface DockerContainerStatus {
  id: string;
  name: string;
  running: boolean;
  hostPort?: number;
  ipAddress?: string;
  status: string;
}

export interface DockerClient {
  isAvailable(): Promise<boolean>;
  ensureNetwork(network: string): Promise<void>;
  pullImage(image: string): Promise<void>;
  createContainer(options: DockerContainerOptions): Promise<string>;
  startContainer(containerId: string): Promise<void>;
  stopContainer(containerId: string): Promise<void>;
  removeContainer(containerId: string): Promise<void>;
  inspectContainer(containerId: string): Promise<DockerContainerStatus>;
  logs(containerId: string): Promise<string>;
}

export const buildDockerCreateArgs = (options: DockerContainerOptions): string[] => [
  "create", "--name", options.name, "--publish", `127.0.0.1::${options.port}/tcp`,
  "--memory", `${options.memoryMb}m`, "--cpus", String(options.cpuLimit),
  "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true",
  "--network", options.network, "--log-opt", "max-size=10m", "--log-opt", "max-file=2",
  options.image,
];

export class DockerCommandError extends Error {
  readonly code = "DOCKER_COMMAND_FAILED";

  constructor(command: string, detail: string) {
    super(`Docker command '${command}' failed: ${detail}`);
    this.name = "DockerCommandError";
  }
}

export interface DockerCliClientOptions {
  executable?: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
}

interface DockerInspectResult {
  Id?: string;
  Name?: string;
  State?: { Status?: string; Running?: boolean };
  NetworkSettings?: {
    IPAddress?: string;
    Ports?: Record<string, Array<{ HostPort?: string }> | null>;
  };
}

export class DockerCliClient implements DockerClient {
  private readonly executable: string;
  private readonly timeoutMs: number;
  private readonly maxBuffer: number;

  constructor(options: DockerCliClientOptions = {}) {
    this.executable = options.executable ?? "docker";
    this.timeoutMs = options.timeoutMs ?? 30_000;
    this.maxBuffer = options.maxBufferBytes ?? 256 * 1024;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await this.run(["info", "--format", "{{.ServerVersion}}"]);
      return true;
    } catch {
      return false;
    }
  }

  async pullImage(image: string): Promise<void> {
    await this.run(["pull", image]);
  }

  async ensureNetwork(network: string): Promise<void> {
    try {
      await this.run(["network", "inspect", network]);
    } catch {
      await this.run(["network", "create", "--internal", network]);
    }
  }

  async createContainer(options: DockerContainerOptions): Promise<string> {
    const output = await this.run(buildDockerCreateArgs(options));
    return output.trim();
  }

  async startContainer(containerId: string): Promise<void> {
    await this.run(["start", containerId]);
  }

  async stopContainer(containerId: string): Promise<void> {
    await this.run(["stop", "--time", "5", containerId]);
  }

  async removeContainer(containerId: string): Promise<void> {
    await this.run(["rm", "-f", containerId]);
  }

  async inspectContainer(containerId: string): Promise<DockerContainerStatus> {
    const output = await this.run(["inspect", containerId]);
    const result = JSON.parse(output) as DockerInspectResult[];
    const container = result[0];
    if (!container?.Id || !container.State) throw new DockerCommandError("inspect", "invalid response");
    const publishedPort = container.NetworkSettings?.Ports?.["8000/tcp"]?.[0]?.HostPort;
    return {
      id: container.Id,
      name: (container.Name ?? "").replace(/^\//, ""),
      running: container.State.Running === true,
      hostPort: publishedPort ? Number(publishedPort) : undefined,
      ipAddress: container.NetworkSettings?.IPAddress || undefined,
      status: container.State.Status ?? "unknown",
    };
  }

  async logs(containerId: string): Promise<string> {
    return this.run(["logs", "--tail", "100", containerId]);
  }

  private async run(args: string[]): Promise<string> {
    try {
      const result = await execFileAsync(this.executable, args, {
        timeout: this.timeoutMs,
        maxBuffer: this.maxBuffer,
        windowsHide: true,
      });
      return result.stdout;
    } catch (error: unknown) {
      const detail = error && typeof error === "object" && "stderr" in error
        ? String(error.stderr).trim().slice(0, 500)
        : error instanceof Error ? error.message : "unknown error";
      throw new DockerCommandError(args[0] ?? "docker", detail || "unknown error");
    }
  }
}