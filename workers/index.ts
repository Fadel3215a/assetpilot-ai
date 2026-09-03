import "dotenv/config";
import { Worker } from "bullmq";
import { createIngestionWorker } from "./ingestion";
import { createAiAnalysisWorker } from "./ai-analysis";
import { createRenditionWorker } from "./rendition";
import { closeQueues } from "@/lib/queue/queues";

/**
 * Stage 1.2 — Worker entry point / lifecycle.
 *
 * Loads environment variables first (Next auto-loads .env, but a standalone
 * Node worker does not), then instantiates every background worker (ingestion,
 * AI analysis, rendition) and keeps the process alive while they drain work. On
 * SIGINT/SIGTERM it gracefully closes each worker (draining in-flight jobs) and
 * shuts down the queue connections before exiting.
 */

export interface WorkerRuntime {
  workers: Worker[];
  shutdown: (signal?: NodeJS.Signals) => Promise<void>;
}

export function startWorkers(): WorkerRuntime {
  const started: Worker[] = [];
  for (const worker of [
    createIngestionWorker(),
    createAiAnalysisWorker(),
    createRenditionWorker(),
  ]) {
    if (worker) started.push(worker);
  }

  let shuttingDown = false;

  const shutdown = async (signal?: NodeJS.Signals): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(
      signal
        ? `[workers] received ${signal}, shutting down gracefully...`
        : "[workers] shutting down gracefully...",
    );
    try {
      await Promise.all(started.map((worker) => worker.close()));
      await closeQueues();
    } catch (error) {
      console.error("[workers] error during shutdown", error);
    } finally {
      // Allow the event loop to flush remaining I/O before exiting.
      setTimeout(() => process.exit(0), 200);
    }
  };

  if (started.length === 0) {
    console.warn(
      "[workers] no workers started (Redis is not configured). Configure REDIS_URL/REDIS_HOST to enable job processing.",
    );
    process.exit(0);
  }

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  const names = started.map((w) => w.name).join(", ");
  console.log(`[workers] started ${started.length} workers (${names})`);

  return { workers: started, shutdown };
}

if (require.main === module) {
  startWorkers();
}
