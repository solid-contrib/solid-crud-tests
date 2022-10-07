import { getAuthHeaders } from "solid-auth-fetcher";
import AuthFetcher from "solid-auth-fetcher/dist/AuthFetcher";
import WebSocket = require("ws");
import parseLinkHeader = require("parse-link-header");
import { URL } from "url";
import { createServer } from "https";
import { readFileSync } from "fs";

const PROTOCOL_STRING = "solid-0.1";
export const SECURE_WEBSOCKETS_TYPE = "WebSocketSubscription2021";
export const WEBHOOKS_TYPE = "WebHookSubscription2022"; // see https://github.com/solid/specification/issues/457

const WEBHOOK_ENDPOINT = "https://tester:8123/hook";
const HTTPS_OPTIONS = {
  key: readFileSync("/tls/server.key"),
  cert: readFileSync("/tls/server.cert"),
};
function tryRel(obj: any, rel: string, base: string): string | undefined {
  // console.log(obj);
  if (obj[rel] === undefined) {
    return;
  }
  const urlStr = obj[rel]["url"];
  // console.log("relative", urlStr);
  if (typeof urlStr === "string") {
    const urlObj = new URL(urlStr, base);
    return urlObj.toString();
  }
}

export class NotificationsClient {
  receivedInsecure: string[];
  sentInsecure: string[];
  receivedSecure: string[];
  sentSecure: string[];
  receivedHook: string[];
  sentHook: string[];
  resourceUrl: string;
  disabled: boolean;
  authFetcher;
  insecureWs;
  secureWs;
  webHookListener;
  discoveryLinks: {
    insecureWs?: string;
    storageWide?: string;
    resourceSpecific?: string;
  };
  description: {
    [url: string]: any;
  };
  webHooksPort: number;
  constructor(resourceUrl: string, authFetcher: AuthFetcher, webHooksPort?: number) {
    this.receivedInsecure = [];
    this.sentInsecure = [];
    this.receivedSecure = [];
    this.sentSecure = [];
    this.receivedHook = [];
    this.sentHook = [];
    this.resourceUrl = resourceUrl;
    this.authFetcher = authFetcher;
    this.disabled = !!process.env.SKIP_WPS && !!process.env.SKIP_SECURE_WEBSOCKETS && !!process.env.SKIP_WEBHOOKS;
    this.discoveryLinks = {
      insecureWs: undefined,
      storageWide: undefined,
      resourceSpecific: undefined,
    };
    this.description = {};
    this.webHooksPort = webHooksPort;
  }
  async getLinksToNotifications(): Promise<{
    insecureWs?: string;
    storageWide?: string;
    resourceSpecific?: string;
  }> {
    const resourceFetchResult = await this.authFetcher.fetch(this.resourceUrl, {
      method: "HEAD",
    });
    const linkHeaders = resourceFetchResult.headers.raw()["link"];
    console.log({linkHeaders});
    if (Array.isArray(linkHeaders) && linkHeaders.length > 0) {
      let obj = {};
      for (let i = 0; i < linkHeaders.length; i++) {
        obj = {
          ...parseLinkHeader(linkHeaders[i]),
          ...obj,
        };
      }
      if (!this.discoveryLinks.storageWide) {
        this.discoveryLinks.storageWide = tryRel(
          obj,
          "http://www.w3.org/ns/solid#storageDescription",
          this.resourceUrl
        );
      }
      if (!this.discoveryLinks.resourceSpecific) {
        this.discoveryLinks.resourceSpecific = tryRel(
          obj,
          "describedby",
          this.resourceUrl
        );
      }
    }

    this.discoveryLinks.insecureWs = resourceFetchResult.headers.get(
      "updates-via"
    );
    return this.discoveryLinks;
  }
  async fetchAndParseDescription(url: string): Promise<any> {
    // console.log("absolute", url);
    const descriptionFetchResult = await this.authFetcher.fetch(url, {
      headers: {
        Accept: "application/ld+json",
      },
    });
    this.description[url] = await descriptionFetchResult.json();
    // console.log(this.description);
    return this.description[url].notificationChannel;
    /// tbc!
  }

  async subscribeToChannels(descriptionUrl: string): Promise<void> {
    // console.log("subscribing to channels", descriptionUrl);
    const channels = await this.fetchAndParseDescription(descriptionUrl);
    for (let i = 0; i < channels.length; i++) {
      // console.log(channels[i]);
      let absolute: string;
      if (typeof channels[i].subscription === "string") {
        const urlObj = new URL(channels[i].subscription, descriptionUrl);
        absolute = urlObj.toString();
      }
      if (channels[i].type == SECURE_WEBSOCKETS_TYPE) {
        await this.setupSecureWs(absolute);
      }
      if (channels[i].type == WEBHOOKS_TYPE) {
        await this.setupWebHookListener(absolute);
      }
    }
  }

  async getReady(): Promise<void> {
    console.log('in getReady!');
    if (this.disabled) {
      console.log('disabled, not getting ready!');
      return;
    }
    const descriptions = await this.getLinksToNotifications();
    console.log({ descriptions });
    if (
      typeof descriptions.insecureWs === "string" &&
      descriptions.insecureWs.length > 0 && !process.env.SKIP_WPS
    ) {
      // console.log("get ready for insecure websockets");
      await this.setupInsecureWs(descriptions.insecureWs);
    }
    if (
      typeof descriptions.storageWide === "string" &&
      descriptions.storageWide.length > 0 && !process.env.SKIP_SECURE_WEBSOCKETS
    ) {
      // console.log("get ready for storage wide");
      await this.subscribeToChannels(descriptions.storageWide);
    }
    if (
      typeof descriptions.resourceSpecific === "string" &&
      descriptions.resourceSpecific.length > 0 && !process.env.SKIP_WEBHOOKS
    ) {
      // console.log("get ready for resource specific");
      await this.subscribeToChannels(descriptions.resourceSpecific);
    }
  }

  async setupSecureWs(subscribeUrl: string): Promise<void> {
    // console.log("Setting up Secure Ws!", subscribeUrl);
    const result = await this.authFetcher.fetch(subscribeUrl, {
      headers: {
        Accept: "application/json",
        // Accept: "application/ld+json",
      },
      method: "POST",
      body: JSON.stringify({
        "@context": ["https://www.w3.org/ns/solid/notification/v1"],
        type: "WebSocketSubscription2021",
        topic: this.resourceUrl,
      }),
    });
    const obj = await result.json();
    // console.log(obj);
    if (typeof obj.source !== "string" || !obj.source.startsWith("http")) {
      throw new Error(
        "could not find source for secure websockets subscription"
      );
    }
    const wssUrl = "ws" + obj.source.substring("http".length);
    // console.log({ wssUrl });
    this.secureWs = new WebSocket(wssUrl, PROTOCOL_STRING);
    this.secureWs.on("message", (msg) => {
      // console.log("SWS <", msg);
      this.receivedSecure.push(msg);
    });
    await new Promise<void>((resolve) => {
      this.secureWs.on("open", async () => {
        // FIXME presumably this will no longer be necessary?
        // await this.send(`sub ${this.resourceUrl}`);
        resolve();
      });
    });
  }

  async setupWebHookListener(subscribeUrl: string): Promise<void> {
    console.log('setupWebHookListener', this.webHooksPort);
    if (!this.webHooksPort) {
      // Don't need to listen for webhooks for these tests
      return;
    }
    console.log("Setting up Webhook!", subscribeUrl);
    this.webHookListener = createServer(HTTPS_OPTIONS, (req, res) => {
      let msg = "";
      req.on("data", (chunk) => {
        msg += chunk;
        console.log("HOOK <", msg);
      });
      req.on("end", () => {
        console.log("HOOK END!");
        this.receivedHook.push(msg);
        res.end("OK");
      });
    });
    this.webHookListener.listen(this.webHooksPort);
    const bodyObj = {
      "@context": ["https://www.w3.org/ns/solid/notification/v1"],
      type: "WebHookSubscription2022",
      topic: this.resourceUrl,
      target: WEBHOOK_ENDPOINT,
    };
    console.log("sending", bodyObj);
    const result = await this.authFetcher.fetch(subscribeUrl, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        // Accept: "application/ld+json",
        // "Content-Type": "application/ld+json",
      },
      method: "POST",
      body: JSON.stringify(bodyObj),
    });
    // const txt = await result.text();
    // console.log(txt);
    const obj = await result.json();
    console.log(obj);
  }

  async setupInsecureWs(wssUrl: string): Promise<void> {
    // console.log("Setting up Insecure Ws!", wssUrl);

    this.insecureWs = new WebSocket(wssUrl, PROTOCOL_STRING);
    this.insecureWs.on("message", (msg) => {
      // console.log("WPS <", msg);
      this.receivedInsecure.push(msg);
    });
    await new Promise<void>((resolve) => {
      this.insecureWs.on("open", async () => {
        await this.send(`sub ${this.resourceUrl}`);
        resolve();
      });
    });
  }
  // NB: this will fail if you didn't await getReady first:
  async send(str: string): Promise<any> {
    if (this.disabled) {
      return;
    }
    if (this.insecureWs) {
      await new Promise((resolve) => this.insecureWs.send(str, resolve));
      // console.log("WPS > ", str);
      this.sentInsecure.push(str);
    }
    if (this.secureWs) {
      await new Promise((resolve) => this.secureWs.send(str, resolve));
      // console.log("SWS > ", str);
      this.sentSecure.push(str);
    }
  }
  async disconnect(): Promise<any> {
    if (this.disabled) {
      return;
    }
    if (this.insecureWs) {
      this.insecureWs.terminate();
      delete this.insecureWs;
    }
    if (this.secureWs) {
      this.secureWs.terminate();
      delete this.secureWs;
    }
    if (this.webHookListener) {
      await new Promise((resolve) => this.webHookListener.close(resolve));
      delete this.secureWs;
    }
  }
}

