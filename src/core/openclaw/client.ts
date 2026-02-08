/**
 * Thin wrapper around OpenClaw browser automation.
 * In production, this delegates to the openclaw SDK.
 * Stubbed here for compilation — replace with real openclaw imports.
 */
export interface OpenClawOptions {
  headless?: boolean;
}

export class OpenClawClient {
  constructor(private opts: OpenClawOptions = { headless: true }) {}

  async goto(url: string): Promise<void> {
    // openclaw.browse(url)
    throw new Error(`Not implemented: goto ${url}`);
  }

  async fill(selector: string, value: string): Promise<void> {
    throw new Error(`Not implemented: fill ${selector}`);
  }

  async click(selector: string): Promise<void> {
    throw new Error(`Not implemented: click ${selector}`);
  }

  async waitFor(selector: string, opts?: { timeout?: number }): Promise<void> {
    throw new Error(`Not implemented: waitFor ${selector}`);
  }

  async waitForNavigation(opts?: { url?: string; timeout?: number }): Promise<void> {
    throw new Error("Not implemented: waitForNavigation");
  }

  async exists(selector: string, opts?: { timeout?: number }): Promise<boolean> {
    throw new Error(`Not implemented: exists ${selector}`);
  }

  async textContent(selector: string): Promise<string> {
    throw new Error(`Not implemented: textContent ${selector}`);
  }

  async setCookies(cookies: object): Promise<void> {
    // inject cookies into browser context
    throw new Error("Not implemented: setCookies");
  }

  async getCookies(): Promise<object> {
    throw new Error("Not implemented: getCookies");
  }

  async dumpDom(): Promise<string> {
    throw new Error("Not implemented: dumpDom");
  }

  async screenshot(): Promise<string> {
    throw new Error("Not implemented: screenshot");
  }

  async currentUrl(): Promise<string> {
    throw new Error("Not implemented: currentUrl");
  }

  async close(): Promise<void> {
    // cleanup browser context
  }
}
