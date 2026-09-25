import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface HardwareInfo {
  name: string;
  cpuCores: number;
  totalRamMb: number;
  availableRamMb: number;
  gpu: string | null;
  vramMb: number | null;
  architecture: string;
  operatingSystem: string;
}

export interface DynamicHardwareInfo {
  availableRamMb: number;
  gpu: string | null;
  vramMb: number | null;
}

interface GpuInfo {
  gpu: string | null;
  vramMb: number | null;
}

export const normalizeOperatingSystem = (platform: string): string => {
  switch (platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    case "linux":
      return "linux";
    default:
      return platform;
  }
};

export const normalizeArchitecture = (architecture: string): string => {
  switch (architecture) {
    case "x32":
      return "ia32";
    default:
      return architecture;
  }
};

const bytesToMegabytes = (bytes: number) => Math.floor(bytes / 1024 / 1024);

export const detectGpu = async (): Promise<GpuInfo> => {
  if (os.platform() !== "win32") {
    return { gpu: null, vramMb: null };
  }

  try {
    const { stdout } = await execFileAsync("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress",
    ]);
    const parsed = JSON.parse(stdout) as
      | { Name?: string; AdapterRAM?: number }
      | Array<{ Name?: string; AdapterRAM?: number }>;
    const adapters = Array.isArray(parsed) ? parsed : [parsed];
    const adapter =
      adapters.find((candidate) => /nvidia|geforce|rtx|gtx|amd|radeon/i.test(candidate.Name ?? "")) ??
      adapters[0];

    if (!adapter?.Name) {
      return { gpu: null, vramMb: null };
    }

    return {
      gpu: adapter.Name,
      vramMb:
        typeof adapter.AdapterRAM === "number" && adapter.AdapterRAM > 0
          ? bytesToMegabytes(adapter.AdapterRAM)
          : null,
    };
  } catch {
    return { gpu: null, vramMb: null };
  }
};

export const detectHardware = async (): Promise<HardwareInfo> => {
  const gpu = await detectGpu();

  return {
    name: os.hostname(),
    cpuCores: os.cpus().length,
    totalRamMb: bytesToMegabytes(os.totalmem()),
    availableRamMb: bytesToMegabytes(os.freemem()),
    ...gpu,
    architecture: normalizeArchitecture(os.arch()),
    operatingSystem: normalizeOperatingSystem(os.platform()),
  };
};

export const detectDynamicResources = async (): Promise<DynamicHardwareInfo> => ({
  availableRamMb: bytesToMegabytes(os.freemem()),
  ...(await detectGpu()),
});