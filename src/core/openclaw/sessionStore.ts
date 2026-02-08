import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { PartnerId } from "../partners/DeliveryPartner.js";
import { env } from "../config/env.js";

const ALG = "aes-256-gcm";

export class SessionStore {
  private key: Buffer;

  constructor() {
    this.key = Buffer.from(env.SESSION_ENCRYPTION_KEY, "hex");
  }

  private path(partner: PartnerId) {
    return join(env.SESSION_DIR, `${partner}.enc`);
  }

  async save(partner: PartnerId, cookies: object): Promise<void> {
    await mkdir(env.SESSION_DIR, { recursive: true });
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALG, this.key, iv);
    const plain = JSON.stringify(cookies);
    const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    await writeFile(this.path(partner), Buffer.concat([iv, tag, encrypted]));
  }

  async load(partner: PartnerId): Promise<object | null> {
    try {
      const buf = await readFile(this.path(partner));
      const iv = buf.subarray(0, 16);
      const tag = buf.subarray(16, 32);
      const encrypted = buf.subarray(32);
      const decipher = createDecipheriv(ALG, this.key, iv);
      decipher.setAuthTag(tag);
      const plain = decipher.update(encrypted) + decipher.final("utf8");
      return JSON.parse(plain);
    } catch {
      return null;
    }
  }
}
