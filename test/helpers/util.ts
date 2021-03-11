import { getAuthHeaders } from "solid-auth-fetcher";

import WebSocket = require("ws");
import * as rdf from "rdflib";
import { IndexedFormula } from "rdflib";
import AuthFetcher from "solid-auth-fetcher/dist/AuthFetcher";

const PROTOCOL_STRING = "solid-0.1";

function isContainer(url) {
  return url.substr(-1) === "/";
}

export function getStore(authFetcher): IndexedFormula {
  if (!authFetcher) {
    throw new Error("please pass authFetcher to getStore!");
  }
  const store = (module.exports = rdf.graph()); // Make a Quad store
  rdf.fetcher(store, { fetch: authFetcher.fetch.bind(authFetcher) }); // Attach a web I/O module, store.fetcher
  store.updater = new rdf.UpdateManager(store); // Add real-time live updates store.updater
  return store;
}
export async function getContainerMembers(
  containerUrl: string,
  authFetcher: AuthFetcher | { fetch: () => any }
): Promise<string[]> {
  if (!authFetcher) {
    throw new Error("please pass authFetcher to getContainerMembers!");
  }
  const store = getStore(authFetcher);
  await store.fetcher.load(store.sym(containerUrl));
  return store
    .statementsMatching(
      store.sym(containerUrl),
      store.sym("http://www.w3.org/ns/ldp#contains")
    )
    .map((st) => st.object.value);
}

export async function recursiveDelete(url, authFetcher) {
  if (!authFetcher) {
    throw new Error("please pass authFetcher to recursiveDelete!");
  }
  if (isContainer(url)) {
    const containerMembers = await getContainerMembers(url, authFetcher);
    await Promise.all(
      containerMembers.map((url) => recursiveDelete(url, authFetcher))
    );
  }
  return authFetcher.fetch(url, { method: "DELETE" });
}

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

export function ifWps(name, runner) {
  let level = 'WPS'
  let id = ''
  if (process.env.SKIP_WPS) {
    return it.skip(`${level} ${id} ${name}`, runner);
  }
  return it(`${level} ${id} ${name}`, runner);
}

export function responseCodeGroup(code) {
  return `${Math.floor(code / 100)}xx`;
}

// env parameters are SKIP for MUST, SHOULD and INCLUDE for MAY
export function itIs(level ='', id = '') {
  switch (level) {
    case 'SKIP':
      return (name, runner) => { it.skip(`${level} ${id} ${name}`, runner); }
    case 'MUST':
      if (process.env.SKIP_MUST || process.env['SKIP_MUST_' + id]) {
          return (name, runner) => { it.skip(`${level} ${id} ${name}`, runner); }
      } else {
          return (name, runner) => { it(`${level} ${id} ${name}`, runner); }
      }
    case 'SHOULD':
      if (process.env.SKIP_SHOULD || process.env['SKIP_SHOULD_' + id]) {
        return (name, runner) => { it.skip(`${level} ${id} ${name}`, runner); }
      } else {
        return (name, runner) => { it(`${level} ${id} ${name}`, runner); }
      }
    case 'MAY':
      if (process.env.INCLUDE_MAY || process.env['INCLUDE_MAY_' + id]) {
        return (name, runner) => { it(`${level} ${id} ${name}`, runner); }
      } else {
        return (name, runner) => { it.skip(`${level} ${id} ${name}`, runner); }
      }
  }
  return (name, runner) => { it(`${level} ${id} ${name}`, runner); }
}
