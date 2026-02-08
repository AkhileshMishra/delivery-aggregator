import { DeliveryPartner, type RunContext, type QuoteRequest, type QuoteResult } from "../DeliveryPartner.js";
import { LoginExpiredError } from "../../openclaw/errors.js";
import { SELECTORS } from "./selectors.js";

export class EasyparcelPartner extends DeliveryPartner {
  readonly id = "easyparcel_sg" as const;
  readonly loginUrl = "https://www.easyparcel.sg/login";
  readonly postLoginUrl = "https://www.easyparcel.sg/dashboard";

  async ensureAuthenticated(ctx: RunContext): Promise<void> {
    const cookies = await ctx.session.load(this.id);
    if (!cookies) throw new LoginExpiredError(this.id, "No stored session");
    await ctx.openclaw.setCookies(cookies);
    await ctx.openclaw.goto(this.postLoginUrl);
    const loggedIn = await ctx.openclaw.exists(SELECTORS.userBadge, { timeout: 5000 });
    if (!loggedIn) throw new LoginExpiredError(this.id, "Cookie session expired");
  }

  async fetchQuote(ctx: RunContext, req: QuoteRequest): Promise<QuoteResult> {
    await ctx.openclaw.fill(SELECTORS.pickupInput, req.source.address ?? `${req.source.lat},${req.source.lng}`);
    await ctx.openclaw.fill(SELECTORS.dropoffInput, req.destination.address ?? `${req.destination.lat},${req.destination.lng}`);
    await ctx.openclaw.click(SELECTORS.schedulePicker);
    await ctx.openclaw.fill(SELECTORS.timeInput, req.pickupTimeISO);
    await ctx.openclaw.waitFor(SELECTORS.rateCard, { timeout: ctx.config.partnerTimeoutMs(this.id) });

    const amount = parseFloat(await ctx.openclaw.textContent(SELECTORS.priceAmount));
    const dropoff = await ctx.openclaw.textContent(SELECTORS.estimatedDropoff);
    const courier = await ctx.openclaw.textContent(SELECTORS.courierName);

    return {
      partner: this.id,
      availability: true,
      price: { amount, currency: "SGD" },
      estimated_dropoff_time: dropoff,
      meta: { courier },
    };
  }
}