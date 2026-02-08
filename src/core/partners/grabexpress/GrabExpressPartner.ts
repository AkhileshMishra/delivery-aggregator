import { DeliveryPartner, type RunContext, type QuoteRequest, type QuoteResult } from "../DeliveryPartner.js";
import { LoginExpiredError } from "../../openclaw/errors.js";
import { SELECTORS } from "./selectors.js";

export class GrabExpressPartner extends DeliveryPartner {
  readonly id = "grabexpress" as const;
  readonly loginUrl = "https://express.grab.com/login";
  readonly postLoginUrl = "https://express.grab.com/dashboard";

  async ensureAuthenticated(ctx: RunContext): Promise<void> {
    const cookies = await ctx.session.load(this.id);
    if (!cookies) throw new LoginExpiredError(this.id, "No stored session");
    await ctx.openclaw.setCookies(cookies);
    await ctx.openclaw.goto(this.postLoginUrl);
    const loggedIn = await ctx.openclaw.exists(SELECTORS.userMenu, { timeout: 5000 });
    if (!loggedIn) throw new LoginExpiredError(this.id, "Cookie session expired");
  }

  async fetchQuote(ctx: RunContext, req: QuoteRequest): Promise<QuoteResult> {
    await ctx.openclaw.fill(SELECTORS.pickupInput, req.source.address ?? `${req.source.lat},${req.source.lng}`);
    await ctx.openclaw.fill(SELECTORS.dropoffInput, req.destination.address ?? `${req.destination.lat},${req.destination.lng}`);
    await ctx.openclaw.click(SELECTORS.scheduleBtn);
    await ctx.openclaw.fill(SELECTORS.timeInput, req.pickupTimeISO);
    await ctx.openclaw.waitFor(SELECTORS.quoteCard, { timeout: ctx.config.partnerTimeoutMs(this.id) });

    const amount = parseFloat(await ctx.openclaw.textContent(SELECTORS.priceAmount));
    const dropoff = await ctx.openclaw.textContent(SELECTORS.estimatedDropoff);
    const vehicleType = await ctx.openclaw.textContent(SELECTORS.vehicleType);

    return {
      partner: this.id,
      availability: true,
      price: { amount, currency: "SGD" },
      estimated_dropoff_time: dropoff,
      meta: { vehicle_type: vehicleType },
    };
  }
}