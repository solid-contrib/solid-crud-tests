import { getAuthHeaders } from "./obtain-auth-headers";

const WebSocket = require('ws');
const rdf = require('rdflib');


function isContainer(url) {
  return (url.substr(-1) === '/');
}

export function getStore(authFetcher) {
  if (!authFetcher) {
    throw new Error('please pass authFetcher to getStore!');
  }
  var store = (module.exports = rdf.graph()) // Make a Quad store
  rdf.fetcher(store, { fetch: authFetcher.fetch.bind(authFetcher) }) // Attach a web I/O module, store.fetcher
  store.updater = new rdf.UpdateManager(store) // Add real-time live updates store.updater
  return store;
}
export async function getContainerMembers(containerUrl, authFetcher) {
  if (!authFetcher) {
    throw new Error('please pass authFetcher to getContainerMembers!');
  }
  const store = getStore(authFetcher);
  await store.fetcher.load(store.sym(containerUrl));
  return store.statementsMatching(store.sym(containerUrl), store.sym('http://www.w3.org/ns/ldp#contains')).map(st => st.object.value);
}

export async function recursiveDelete(url, authFetcher) {
  if (!authFetcher) {
    throw new Error('please pass authFetcher to recursiveDelete!');
  }
  if (isContainer(url)) {
    const containerMembers = await getContainerMembers(url, authFetcher);
    await Promise.all(containerMembers.map(url => recursiveDelete(url, authFetcher)));
  }
  return authFetcher.fetch(url, { method: 'DELETE' });
}

export class WPSClient {
  received: string[];
  sent: string[];
  resourceUrl: string;
  authFetcher;
  ws;
  constructor (resourceUrl: string, authFetcher) {
    this.received = [];
    this.sent = [];
    this.resourceUrl = resourceUrl;
    this.authFetcher = authFetcher;
  }
  async getReady() {
    const result = await this.authFetcher.fetch(this.resourceUrl, { method: 'HEAD' })
    const wssUrl = result.headers.get('updates-via');
    this.ws = new WebSocket(wssUrl, {
      perMessageDeflate: false
    });
    this.ws.on('message', (msg) => {
      // console.log('WS <', msg);
      this.received.push(msg);
    });  
    await new Promise((resolve) => {
      this.ws.on('open', async () => {
        const authHeaders = await getAuthHeaders(this.resourceUrl, 'GET', this.authFetcher);
        await this.send(`sub ${this.resourceUrl}`);
        await this.send(`auth ${authHeaders.Authorization}`);
        await this.send(`dpop ${authHeaders.DPop}`);
        resolve();
      });
    });
  }
  // NB: this will fail if you didn't await getReady first:
  send(str) {
    // console.log('WS > ', str);
    this.sent.push(str);
    return new Promise(resolve => this.ws.send(str, resolve));
  }
  disconnect() {
    if (this.ws) {
      this.ws.terminate();
      delete this.ws;
    }
  }
}

export function responseCodeGroup(code) {
  return `${Math.floor(code / 100)}xx`;
}