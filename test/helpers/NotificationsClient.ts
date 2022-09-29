import { getAuthHeaders } from "solid-auth-fetcher";
import AuthFetcher from "solid-auth-fetcher/dist/AuthFetcher";
import WebSocket = require("ws");

const PROTOCOL_STRING = "solid-0.1";

export class NotificationsClient {
  received: string[];
  sent: string[];
  resourceUrl: string;
  disabled: boolean;
  authFetcher;
  insecureWs;
  constructor(resourceUrl: string, authFetcher: AuthFetcher) {
    this.received = [];
    this.sent = [];
    this.resourceUrl = resourceUrl;
    this.authFetcher = authFetcher;
    this.disabled = !!process.env.SKIP_WPS;
  }
  async getReady(): Promise<void> {
    if (this.disabled) {
      return;
    }
    const result = await this.authFetcher.fetch(this.resourceUrl, {
      method: "HEAD",
    });
    const linkHeaders = result.headers.get("link");
    console.log(linkHeaders);
    for (const header of result.headers) {
      console.log(header);
    }
    console.log("pairs done");
    const wssUrl = result.headers.get("updates-via");
    if (wssUrl.length > 0) {
      this.setupInsecureWs(wssUrl);
    }
  }
  async setupInsecureWs(wssUrl: string): Promise<void> {
    this.insecureWs = new WebSocket(wssUrl, PROTOCOL_STRING);
    this.insecureWs.on("message", (msg) => {
      // console.log("WS <", msg);
      this.received.push(msg);
    });
    await new Promise<void>((resolve) => {
      this.insecureWs.on("open", async () => {
        const authHeaders = await getAuthHeaders(
          this.resourceUrl,
          "GET",
          this.authFetcher
        );
        await this.send(`auth ${authHeaders.Authorization}`);
        await this.send(`dpop ${authHeaders.DPop}`);
        await this.send(`sub ${this.resourceUrl}`);
        resolve();
      });
    });
  }
  // NB: this will fail if you didn't await getReady first:
  send(str: string): Promise<any> {
    if (this.disabled) {
      return;
    }
    // console.log("WS > ", str);
    this.sent.push(str);
    return new Promise((resolve) => this.insecureWs.send(str, resolve));
  }
  disconnect(): any {
    if (this.disabled) {
      return;
    }
    if (this.insecureWs) {
      this.insecureWs.terminate();
      delete this.insecureWs;
    }
  }
}
