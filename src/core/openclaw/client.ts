/**
 * OpenClaw browser automation client.
 *
 * This is a stub implementation. When the openclaw SDK is published to npm,
 * install it (`npm i openclaw`) and replace the stub methods below with
 * real SDK calls. The interface is stable — partners depend only on the
 * public methods of this class.
 */

export interface OpenClawOptions {
  headless?: boolean;
}

export class OpenClawClient {
  private readonly opts: OpenClawOptions;

  constructor(opts: OpenClawOptions = { headless: true }) {
    this.opts = opts;
  }

  async goto(url: string): Promise<void> {
    // TODO: await claw.browse(url)
    throw new Error(`OpenClaw not configured: goto ${url}`);
  }

  async fill(selector: string, value: string): Promise<void> {
    throw new Error(`OpenClaw not configured: fill ${selector}`);
  }

  async click(selector: string): Promise<void> {
    throw new Error(`OpenClaw not configured: click ${selector}`);
  }

  async waitFor(selector: string, opts?: { timeout?: number }): Promise<void> {
    throw new Error(`OpenClaw not configured: waitFor ${selector}`);
  }

  async waitForNavigation(opts?: { url?: string; timeout?: number }): Promise<void> {
    throw new Error("OpenClaw not configured: waitForNavigation");
  }

  async exists(selector: string, opts?: { timeout?: number }): Promise<boolean> {
    return false;
  }

  async textContent(selector: string): Promise<string> {
    throw new Error(`OpenClaw not configured: textContent ${selector}`);
  }

  async setCookies(cookies: object): Promise<void> {
    throw new Error("OpenClaw not configured: setCookies");
  }

  async getCookies(): Promise<object> {
    throw new Error("OpenClaw not configured: getCookies");
  }

  async dumpDom(): Promise<string> {
    return "";
  }

  async screenshot(): Promise<string> {
    return "";
  }

  async currentUrl(): Promise<string> {
    return "";
  }

  async close(): Promise<void> {
    // no-op until real SDK is wired
  }
}
