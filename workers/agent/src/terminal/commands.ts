import type { HardwareInfo } from "../hardware/detect.js";
import type { RuntimeManager } from "../runtime/runtime.manager.js";

export type TerminalOutput = {
  kind: "info" | "success" | "warning" | "error" | "table" | "clear";
  text: string;
};

export interface WorkerCommandContext {
  workerId: string;
  hardware: HardwareInfo;
  connected: () => boolean;
  runtime: RuntimeManager;
}

export interface WorkerCommandResult {
  output: TerminalOutput[];
  exit: boolean;
}

const help = (): WorkerCommandResult => ({
  exit: false,
  output: [{ kind: "info", text: [
    "help                       Show available commands",
    "status                     Show worker connection status",
    "hardware                   Show detected hardware",
    "runtime health             Check the local Ollama runtime",
    "runtime models             List locally available models",
    "model pull <model-id>      Pull an explicit Ollama model",
    "clear                      Clear the terminal",
    "exit                       Close the terminal",
  ].join("\n") }],
});

export const executeWorkerCommand = async (line: string, context: WorkerCommandContext): Promise<WorkerCommandResult> => {
  const input = line.trim();
  if (!input) return { output: [], exit: false };
  const parts = input.split(/\s+/);
  const command = parts[0]?.toLowerCase();

  if (command === "help") return help();
  if (command === "exit" || command === "quit") return { output: [{ kind: "info", text: "Goodbye." }], exit: true };
  if (command === "clear") return { output: [{ kind: "clear", text: "" }], exit: false };
  if (command === "status") return { output: [{ kind: context.connected() ? "success" : "warning", text: `Worker ${context.workerId}\nConnection: ${context.connected() ? "connected" : "reconnecting"}` }], exit: false };
  if (command === "hardware") {
    return { output: [{ kind: "table", text: `CPU: ${context.hardware.cpuCores} cores\nRAM: ${context.hardware.totalRamMb} MB\nOS: ${context.hardware.operatingSystem}\nArchitecture: ${context.hardware.architecture}\nGPU: ${context.hardware.gpu ?? "none"}\nVRAM: ${context.hardware.vramMb ?? "unknown"} MB` }], exit: false };
  }

  if (command === "runtime" && parts[1] === "health") {
    try {
      const health = await context.runtime.provision("ollama", "runtime.health");
      return { output: [{ kind: "success", text: JSON.stringify(health) }], exit: false };
    } catch (error) { return { output: [{ kind: "error", text: error instanceof Error ? error.message : "Runtime health failed." }], exit: false }; }
  }
  if (command === "runtime" && parts[1] === "models") {
    try {
      const result = await context.runtime.provision("ollama", "model.status");
      return { output: [{ kind: "table", text: JSON.stringify(result) }], exit: false };
    } catch (error) { return { output: [{ kind: "error", text: error instanceof Error ? error.message : "Model listing failed." }], exit: false }; }
  }
  if (command === "model" && parts[1] === "pull" && parts[2]) {
    try {
      const result = await context.runtime.provision("ollama", "model.pull", parts[2]);
      return { output: [{ kind: "success", text: JSON.stringify(result) }], exit: false };
    } catch (error) { return { output: [{ kind: "error", text: error instanceof Error ? error.message : "Model pull failed." }], exit: false }; }
  }

  return { output: [{ kind: "error", text: `Unknown command: ${input}. Type help for available commands.` }], exit: false };
};
