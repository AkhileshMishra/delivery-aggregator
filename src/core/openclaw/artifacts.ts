import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { env } from "../config/env.js";

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
