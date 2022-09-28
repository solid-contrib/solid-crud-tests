import fetch from "node-fetch";
import { ldp, rdf, space, link } from "rdf-namespaces";
import { getStore } from "../helpers/util";
import { aliceWebId, oidcIssuer, cookie, appOrigin } from "../helpers/env";
import { getAuthFetcher, getAuthHeaders } from "solid-auth-fetcher";
import AuthFetcher from "solid-auth-fetcher/dist/AuthFetcher";
import ISolidSession from "solid-auth-fetcher/dist/solidSession/ISolidSession";

describe("Alice's storage root", () => {
  let podRoots;
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher(oidcIssuer, cookie, appOrigin);

    const store = getStore(authFetcher);
    await store.fetcher.load(store.sym(aliceWebId).doc());
    podRoots = store
      .statementsMatching(store.sym(aliceWebId), store.sym(space.storage))
      .map((st) => st.object.value);
  });

  test("is an ldp BasicContainer", async () => {
    expect(podRoots.length).toEqual(1);
    const mock = {
      fetch: async (url) => {
        const headers = await getAuthHeaders(url, "GET", authFetcher);

        (headers as any).Accept = "text/turtle";
        const result = await fetch(url, {
          headers,
        });
        // const text = await result.text();
        // console.log(text);
        return result;
      },
      redirectHandler: undefined,
      loginHandler: undefined,
      logoutHandler: undefined,
      sessionCreator: undefined,
      authenticatedFetcher: undefined,
      environmentDetector: undefined,
      globalUserName: undefined,
      loginHelper: undefined,
      login: function (): Promise<ISolidSession> {
        throw new Error("Function not implemented.");
      },
      logout: function (): Promise<void> {
        throw new Error("Function not implemented.");
      },
      getSession: function (): Promise<ISolidSession> {
        throw new Error("Function not implemented.");
      },
      uniqueLogin: function (): Promise<ISolidSession> {
        throw new Error("Function not implemented.");
      },
      onSession: function (): Promise<void> {
        throw new Error("Function not implemented.");
      },
      onLogout: function (): Promise<void> {
        throw new Error("Function not implemented.");
      },
      onRequest: function (): Promise<void> {
        throw new Error("Function not implemented.");
      },
      handleRedirect: function (): Promise<ISolidSession> {
        throw new Error("Function not implemented.");
      },
      automaticallyHandleRedirect: function (): Promise<void> {
        throw new Error("Function not implemented.");
      },
      customAuthFetcher: function (): unknown {
        throw new Error("Function not implemented.");
      },
      addListener: function (): AuthFetcher {
        throw new Error("Function not implemented.");
      },
      on: function (): AuthFetcher {
        throw new Error("Function not implemented.");
      },
      once: function (): AuthFetcher {
        throw new Error("Function not implemented.");
      },
      removeListener: function (): AuthFetcher {
        throw new Error("Function not implemented.");
      },
      off: function (): AuthFetcher {
        throw new Error("Function not implemented.");
      },
      removeAllListeners: function (): AuthFetcher {
        throw new Error("Function not implemented.");
      },
      setMaxListeners: function (): AuthFetcher {
        throw new Error("Function not implemented.");
      },
      getMaxListeners: function (): number {
        throw new Error("Function not implemented.");
      },
      listeners: function (): (() => any)[] {
        throw new Error("Function not implemented.");
      },
      rawListeners: function (): (() => any)[] {
        throw new Error("Function not implemented.");
      },
      emit: function (): boolean {
        throw new Error("Function not implemented.");
      },
      listenerCount: function (): number {
        throw new Error("Function not implemented.");
      },
      prependListener: function (): AuthFetcher {
        throw new Error("Function not implemented.");
      },
      prependOnceListener: function (): AuthFetcher {
        throw new Error("Function not implemented.");
      },
      eventNames: function (): (string | symbol)[] {
        throw new Error("Function not implemented.");
      },
    };
    const store = getStore(mock);

    await store.fetcher.load(store.sym(podRoots[0]));
    const podRootTypes = store
      .statementsMatching(store.sym(podRoots[0]), store.sym(rdf.type))
      .map((st) => st.object.value);
    expect(podRootTypes).toIncludeAllMembers([
      ldp.BasicContainer,
      ldp.Container,
      // ldp.Resource,
      link.Document,
      link.RDFDocument,
      "http://www.w3.org/ns/iana/media-types/text/turtle#Resource",
    ]);
  });
});
