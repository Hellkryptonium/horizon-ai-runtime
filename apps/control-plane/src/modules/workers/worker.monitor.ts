import type { WorkerService } from "./worker.service.js";

export const startWorkerStaleMonitor = (
  service: WorkerService,
  intervalMs = 10_000,
  staleAfterMs = 30_000,
) => {
  const timer = setInterval(async () => {
    try {
      const staleWorkers = await service.markStaleWorkers(new Date(), staleAfterMs);

      if (staleWorkers.length > 0) {
        console.log(`Marked ${staleWorkers.length} stale worker(s) offline.`);
      }
    } catch (error) {
      console.error("Worker stale monitor failed:", error);
    }
  }, intervalMs);

  timer.unref();
  return () => clearInterval(timer);
};