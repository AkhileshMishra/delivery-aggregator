import { writeFile, mkdir, readdir, stat, rm } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { logger } from "../observability/logger.js";

export interface DebugPacketInput {
  requestId: string;
  partner: string;
  errorType: string;
  message: string;
  failedAt?: string;
  stack?: string;
  domSnapshot?: string | null;
  screenshotPath?: string | null;
  url?: string | null;
}

export class ArtifactStore {
  async captureDebugPacket(input: DebugPacketInput): Promise<string> {
    const id = `dbg_${input.partner}_${randomBytes(4).toString("hex")}`;
    const dir = join(env.ARTIFACTS_DIR, id);
    await mkdir(dir, { recursive: true });

    await writeFile(
      join(dir, "meta.json"),
      JSON.stringify({ ...input, debugPacketId: id, capturedAt: new Date().toISOString() }, null, 2),
    );

    if (input.domSnapshot) await writeFile(join(dir, "dom.html"), input.domSnapshot);

    return id;
  }
}

/** Remove artifact directories older than ARTIFACTS_MAX_AGE_MS */
async function cleanupArtifacts(): Promise<void> {
  try {
    const entries = await readdir(env.ARTIFACTS_DIR).catch(() => []);
    const cutoff = Date.now() - env.ARTIFACTS_MAX_AGE_MS;

    for (const entry of entries) {
      if (entry === ".gitkeep") continue;
      const dirPath = join(env.ARTIFACTS_DIR, entry);
      try {
        const s = await stat(dirPath);
        if (s.isDirectory() && s.mtimeMs < cutoff) {
          await rm(dirPath, { recursive: true, force: true });
        }
      } catch { /* skip individual failures */ }
    }
  } catch (err) {
    logger.warn({ err }, "artifact_cleanup_error");
  }
}

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

export function startArtifactCleanup() {
  // Run cleanup every hour
  cleanupInterval = setInterval(cleanupArtifacts, 3_600_000);
  cleanupArtifacts().catch(() => {});
}

export function stopArtifactCleanup() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}
