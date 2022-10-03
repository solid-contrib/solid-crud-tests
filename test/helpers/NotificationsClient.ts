import { getAuthHeaders } from "solid-auth-fetcher";
import AuthFetcher from "solid-auth-fetcher/dist/AuthFetcher";
import WebSocket = require("ws");
import parseLinkHeader = require("parse-link-header");
import { URL } from "url";

const PROTOCOL_STRING = "solid-0.1";

function tryRel(obj: any, rel: string, base: string): string | undefined {
  // console.log(obj);
  if (obj[rel] === undefined) {
    return;
  }
  const urlStr = obj[rel]["url"];
  console.log("relative", urlStr);
  if (typeof urlStr === "string") {
    const urlObj = new URL(urlStr, base);
    return urlObj.toString();
  }
}

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
  async getLinksToNotifications(): Promise<{
    insecureWs?: string;
    storageWide?: string;
    resourceSpecific?: string;
  }> {
    const result = {
      insecureWs: undefined,
      storageWide: undefined,
      resourceSpecific: undefined,
    };
    const resourceFetchResult = await this.authFetcher.fetch(this.resourceUrl, {
      method: "HEAD",
    });
    const linkHeaders = resourceFetchResult.headers.raw()["link"];
    if (Array.isArray(linkHeaders) && linkHeaders.length > 0) {
      let obj = {};
      for (let i = 0; i < linkHeaders.length; i++) {
        obj = {
          ...parseLinkHeader(linkHeaders[i]),
          ...obj,
        };
      }
      if (!result.storageWide) {
        result.storageWide = tryRel(
          obj,
          "http://www.w3.org/ns/solid#storageDescription",
          this.resourceUrl
        );
      }
      if (!result.resourceSpecific) {
        result.resourceSpecific = tryRel(obj, "describedby", this.resourceUrl);
      }
    }

    result.insecureWs = resourceFetchResult.headers.get("updates-via");
    return result;
  }
  async fetchAndParseDescription(url: string) {
    // console.log("absolute", serverWideNotificationsDescription);
    const descriptionFetchResult = await this.authFetcher.fetch(url, {
      headers: {
        Accept: "application/ld_json",
      },
    });
    const obj = await descriptionFetchResult.json();
    return obj.notificationChannel;
    /// tbc!
  }

  async subscribeToChannels(descriptionUrl: string): Promise<void> {
    // console.log("subscribing to channels", descriptionUrl);
    const channels = await this.fetchAndParseDescription(descriptionUrl);
    for (let i = 0; i < channels.length; i++) {
      // console.log(channels[i]);
      if (channels[i].type == "WebSocketNotifications2021") {
        await this.setupSecureWs(channels[i].subscription);
      }
      if (channels[i].type == "WebHookNotifications2022") {
        await this.setupWebHookClient(channels[i].subscription);
      }
    }
  }

  async getReady(): Promise<void> {
    if (this.disabled) {
      return;
    }
    const descriptions = await this.getLinksToNotifications();
    if (
      typeof descriptions.insecureWs === "string" &&
      descriptions.insecureWs.length > 0
    ) {
      await this.setupInsecureWs(descriptions.insecureWs);
    }
    if (
      typeof descriptions.storageWide === "string" &&
      descriptions.storageWide.length > 0
    ) {
      await this.subscribeToChannels(descriptions.storageWide);
    }
    if (
      typeof descriptions.resourceSpecific === "string" &&
      descriptions.resourceSpecific.length > 0
    ) {
      await this.subscribeToChannels(descriptions.resourceSpecific);
    }
  }

  async setupSecureWs(subscribeUrl: string): Promise<void> {
    console.log("Setting up Secure Ws!", subscribeUrl);
    // TODO: implement
  }
  async setupWebHookClient(subscribeUrl: string): Promise<void> {
    console.log("Setting up Webhook!", subscribeUrl);
    // TODO: implement
  }

  async setupInsecureWs(wssUrl: string): Promise<void> {
    console.log("Setting up Insecure Ws!", wssUrl);

    this.insecureWs = new WebSocket(wssUrl, PROTOCOL_STRING);
    this.insecureWs.on("message", (msg) => {
      console.log("WS <", msg);
      this.received.push(msg);
    });
    await new Promise<void>((resolve) => {
      this.insecureWs.on("open", async () => {
        const authHeaders = await getAuthHeaders(
          this.resourceUrl,
          "GET",
          this.authFetcher
        );
        // await this.send(`auth ${authHeaders.Authorization}`);
        // await this.send(`dpop ${authHeaders.DPop}`);
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
    console.log("WS > ", str);
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
