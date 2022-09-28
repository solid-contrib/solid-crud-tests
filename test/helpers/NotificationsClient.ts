
export class WPSClient {
  received: string[];
  sent: string[];
  resourceUrl: string;
  disabled: boolean;
  authFetcher;
  ws;
  constructor(resourceUrl: string, authFetcher) {
    this.received = [];
    this.sent = [];
    this.resourceUrl = resourceUrl;
    this.authFetcher = authFetcher;
    this.disabled = !!process.env.SKIP_WPS;
  }
  async getReady() {
    if (this.disabled) {
      return;
    }
    const result = await this.authFetcher.fetch(this.resourceUrl, {
      method: "HEAD",
    });
    const wssUrl = result.headers.get("updates-via");
    this.ws = new WebSocket(wssUrl, PROTOCOL_STRING, {
      perMessageDeflate: false,
    });
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
  send(str) {
    if (this.disabled) {
      return;
    }
    // console.log("WS > ", str);
    this.sent.push(str);
    return new Promise((resolve) => this.ws.send(str, resolve));
  }
  disconnect() {
    if (this.disabled) {
      return;
    }
    if (this.ws) {
      this.ws.terminate();
      delete this.ws;
    }
  }
}