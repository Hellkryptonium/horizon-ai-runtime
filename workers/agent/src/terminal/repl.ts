import { createInterface } from "node:readline";
import { stdin as input, stdout as output } from "node:process";

import type { WorkerCommandContext } from "./commands.js";
import { executeWorkerCommand } from "./commands.js";

export const startWorkerRepl = async (context: WorkerCommandContext) => {
  const terminal = createInterface({ input, output, prompt: "horizon> " });
  output.write("\nInteractive terminal ready. Type help for available commands.\n");
  terminal.prompt();
  await new Promise<void>((resolve) => {
    let processing = false;
    terminal.on("line", (line) => {
      if (processing) return;
      processing = true;
      void (async () => {
      const result = await executeWorkerCommand(line, context);
      for (const entry of result.output) {
        if (entry.kind === "clear") {
          output.write("\x1b[2J\x1b[3J");
        }
        else output.write(`${entry.text}\n`);
      }
      processing = false;
      if (result.exit) {
        terminal.close();
        resolve();
        return;
      }
      terminal.prompt();
      })().catch((error: unknown) => {
        processing = false;
        output.write(`${error instanceof Error ? error.message : "Command failed."}\n`);
        terminal.prompt();
      });
    });
    terminal.on("close", resolve);
  });
};
