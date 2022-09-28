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
