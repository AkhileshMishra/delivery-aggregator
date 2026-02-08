import { partners } from "../partners/index.js";
import { OpenClawClient } from "../openclaw/client.js";
import { SessionStore } from "../openclaw/sessionStore.js";
import { logger } from "../observability/logger.js";
import type { PartnerId } from "../partners/DeliveryPartner.js";

export async function reauth(partnerId: string): Promise<{ ok: boolean; message: string }> {
  const partner = partners.find((p) => p.id === partnerId);
  if (!partner) return { ok: false, message: `Unknown partner: ${partnerId}` };

  const client = new OpenClawClient({ headless: false });
  const session = new SessionStore();

  try {
    if (partner.performLogin) {
      await partner.performLogin({ openclaw: client, session } as any);
    } else {
      await client.goto(partner.loginUrl);
      logger.info({ partner: partnerId }, "reauth_waiting — operator must complete login in browser");
      await client.waitForNavigation({ url: partner.postLoginUrl, timeout: 300_000 });
    }

    const cookies = await client.getCookies();
    await session.save(partner.id as PartnerId, cookies);
    logger.info({ partner: partnerId }, "reauth_success");
    return { ok: true, message: `Session refreshed for ${partnerId}` };
  } catch (err: any) {
    logger.error({ partner: partnerId, error: err.message }, "reauth_failed");
    return { ok: false, message: err.message };
  } finally {
    await client.close();
  }
}
