/**
 * OpenClaw browser automation client.
 * Wraps the openclaw SDK to provide browser context lifecycle,
 * cookie management, and page interaction primitives.
 */
import { Claw } from "openclaw";

export interface OpenClawOptions {
  headless?: boolean;
}

export class OpenClawClient {
  private claw: Claw | null = null;
  private readonly opts: OpenClawOptions;

  constructor(opts: OpenClawOptions = { headless: true }) {
    this.opts = opts;
  }

  private async ensureClaw(): Promise<Claw> {
    if (!this.claw) {
      this.claw = await Claw.create({ headless: this.opts.headless ?? true });
    }
    return this.claw;
  }

  async goto(url: string): Promise<void> {
    const c = await this.ensureClaw();
    await c.browse(url);
  }

  async fill(selector: string, value: string): Promise<void> {
    const c = await this.ensureClaw();
    await c.fill(selector, value);
  }

  async click(selector: string): Promise<void> {
    const c = await this.ensureClaw();
    await c.click(selector);
  }

  async waitFor(selector: string, opts?: { timeout?: number }): Promise<void> {
    const c = await this.ensureClaw();
    await c.waitForSelector(selector, { timeout: opts?.timeout ?? 30_000 });
  }

  async waitForNavigation(opts?: { url?: string; timeout?: number }): Promise<void> {
    const c = await this.ensureClaw();
    await c.waitForNavigation({ url: opts?.url, timeout: opts?.timeout ?? 30_000 });
  }

  async exists(selector: string, opts?: { timeout?: number }): Promise<boolean> {
    const c = await this.ensureClaw();
    try {
      await c.waitForSelector(selector, { timeout: opts?.timeout ?? 5000 });
      return true;
    } catch {
      return false;
    }
  }

  async textContent(selector: string): Promise<string> {
    const c = await this.ensureClaw();
    return await c.textContent(selector) ?? "";
  }

  async setCookies(cookies: object): Promise<void> {
    const c = await this.ensureClaw();
    await c.setCookies(cookies as any[]);
  }

  async getCookies(): Promise<object> {
    const c = await this.ensureClaw();
    return await c.getCookies();
  }

  async dumpDom(): Promise<string> {
    const c = await this.ensureClaw();
    return await c.content();
  }

  async screenshot(): Promise<string> {
    const c = await this.ensureClaw();
    return await c.screenshot();
  }

  async currentUrl(): Promise<string> {
    const c = await this.ensureClaw();
    return c.url();
  }

  async close(): Promise<void> {
    if (this.claw) {
      await this.claw.close().catch(() => {});
      this.claw = null;
    }
  }
}
