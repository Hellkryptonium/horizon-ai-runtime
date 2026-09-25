import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

interface WorkerIdentityFile {
  workerId: string;
}

export const loadWorkerId = async (identityFilePath: string): Promise<string | null> => {
  try {
    const content = await readFile(identityFilePath, "utf8");
    const identity = JSON.parse(content) as Partial<WorkerIdentityFile>;

    return typeof identity.workerId === "string" && identity.workerId.length > 0
      ? identity.workerId
      : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    return null;
  }
};

export const saveWorkerId = async (identityFilePath: string, workerId: string): Promise<void> => {
  await mkdir(dirname(identityFilePath), { recursive: true });
  await writeFile(identityFilePath, `${JSON.stringify({ workerId }, null, 2)}\n`, "utf8");
};

export const removeWorkerIdentity = async (identityFilePath: string): Promise<void> => {
  try {
    await unlink(identityFilePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
};

export interface WorkerIdentityResolution {
  workerId: string;
  reconnected: boolean;
}

export const resolveWorkerIdentity = async (options: {
  identityFilePath: string;
  register: () => Promise<string>;
  reconnect: (workerId: string) => Promise<void>;
  isWorkerNotFound: (error: unknown) => boolean;
}): Promise<WorkerIdentityResolution> => {
  const savedWorkerId = await loadWorkerId(options.identityFilePath);

  if (savedWorkerId) {
    try {
      await options.reconnect(savedWorkerId);
      return { workerId: savedWorkerId, reconnected: true };
    } catch (error) {
      if (!options.isWorkerNotFound(error)) {
        console.error(
          `Heartbeat failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
        console.error("Will retry on next interval.");
        return { workerId: savedWorkerId, reconnected: true };
      }
      await removeWorkerIdentity(options.identityFilePath);
    }
  }

  const workerId = await options.register();
  await saveWorkerId(options.identityFilePath, workerId);
  return { workerId, reconnected: false };
};
