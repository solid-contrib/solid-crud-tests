import { getAuthHeaders } from "solid-auth-fetcher";
import AuthFetcher from "solid-auth-fetcher/dist/AuthFetcher";
import WebSocket = require("ws");

const PROTOCOL_STRING = "solid-0.1";

export class WPSClient {
  received: string[];
  sent: string[];
  resourceUrl: string;
  disabled: boolean;
  authFetcher;
  ws;
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
    const wssUrl = result.headers.get("updates-via");
    this.ws = new WebSocket(wssUrl, PROTOCOL_STRING);
    this.ws.on("message", (msg) => {
      // console.log("WS <", msg);
      this.received.push(msg);
    });
    await new Promise<void>((resolve) => {
      this.ws.on("open", async () => {
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
    return new Promise((resolve) => this.ws.send(str, resolve));
  }
  disconnect(): any {
    if (this.disabled) {
      return;
    }
    if (this.ws) {
      this.ws.terminate();
      delete this.ws;
    }
  }
}
