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
    "help                              Show available commands",
    "status                            Show worker connection and runtimes",
    "hardware                          Show detected hardware",
    "runtime list                      List registered runtimes",
    "runtime health [runtime]          Check one or all runtimes",
    "runtime models [runtime]          List models for a runtime",
    "model pull <model-id>             Pull an Ollama model",
    "model pull <runtime> <model-id>   Pull a model using a runtime",
    "clear                             Clear the terminal",
    "exit                              Close the terminal",
  ].join("\n") }],
});

const formatValue = (value: unknown): string => {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
};

const formatRows = (rows: Array<[string, unknown]>): string => {
  const width = Math.max(...rows.map(([label]) => label.length));
  return rows.map(([label, value]) => `${label.padEnd(width)}  ${formatValue(value)}`).join("\n");
};

const runtimeNames = (context: WorkerCommandContext, requested?: string): string[] => {
  if (requested) return [requested.toLowerCase()];
  return context.runtime.listRuntimes();
};

export const executeWorkerCommand = async (line: string, context: WorkerCommandContext): Promise<WorkerCommandResult> => {
  const input = line.trim();
  if (!input) return { output: [], exit: false };
  const parts = input.split(/\s+/);
  const command = parts[0]?.toLowerCase();

  if (command === "help") return help();
  if (command === "exit" || command === "quit") return { output: [{ kind: "info", text: "Goodbye." }], exit: true };
  if (command === "clear") return { output: [{ kind: "clear", text: "" }], exit: false };
  if (command === "status") return { output: [{ kind: context.connected() ? "success" : "warning", text: formatRows([
    ["Worker", context.workerId],
    ["Connection", context.connected() ? "connected" : "reconnecting"],
    ["Runtimes", context.runtime.listRuntimes().join(", ") || "none"],
  ]) }], exit: false };
  if (command === "hardware") {
    return { output: [{ kind: "table", text: formatRows([
      ["CPU", `${context.hardware.cpuCores} cores`],
      ["RAM", `${context.hardware.totalRamMb} MB`],
      ["OS", context.hardware.operatingSystem],
      ["Architecture", context.hardware.architecture],
      ["GPU", context.hardware.gpu ?? "none"],
      ["VRAM", `${context.hardware.vramMb ?? "unknown"} MB`],
    ]) }], exit: false };
  }

  if (command === "runtime" && parts[1] === "list") {
    return { output: [{ kind: "table", text: context.runtime.listRuntimes().map((runtime) => `- ${runtime}`).join("\n") || "No runtimes registered." }], exit: false };
  }
  if (command === "runtime" && parts[1] === "health") {
    const results: Array<[string, unknown]> = [];
    for (const runtime of runtimeNames(context, parts[2])) {
      try {
        results.push([runtime, await context.runtime.checkRuntime(runtime)]);
      } catch (error) {
        results.push([runtime, error instanceof Error ? error.message : "health check failed"]);
      }
    }
    return { output: [{ kind: results.every(([, value]) => value === true) ? "success" : "warning", text: formatRows(results) }], exit: false };
  }
  if (command === "runtime" && parts[1] === "models") {
    const runtime = parts[2] || "ollama";
    try {
      const result = await context.runtime.provision(runtime, "model.status");
      const models = "models" in result ? result.models : [];
      return { output: [{ kind: "table", text: models.length ? models.map((model) => `${model.name}${model.sizeMb ? `  ${model.sizeMb} MB` : ""}`).join("\n") : "No models available." }], exit: false };
    } catch (error) { return { output: [{ kind: "error", text: error instanceof Error ? error.message : "Model listing failed." }], exit: false }; }
  }
  if (command === "model" && parts[1] === "pull" && parts[2]) {
    const runtime = parts[3] ? parts[2] : "ollama";
    const modelId = parts[3] || parts[2];
    try {
      await context.runtime.provision(runtime, "model.pull", modelId);
      return { output: [{ kind: "success", text: `Model ready: ${modelId} (${runtime})` }], exit: false };
    } catch (error) { return { output: [{ kind: "error", text: error instanceof Error ? error.message : "Model pull failed." }], exit: false }; }
  }

  return { output: [{ kind: "error", text: `Unknown command: ${input}. Type help for available commands.` }], exit: false };
};
