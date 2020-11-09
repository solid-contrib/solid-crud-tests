import fetch from "node-fetch";
import { ldp, rdf, space, link } from "rdf-namespaces";
import { getStore } from "../helpers/util";
import { aliceWebId, oidcIssuer, cookie, appOrigin } from "../helpers/env";
import { getAuthFetcher, getAuthHeaders } from "solid-auth-fetcher";

describe("Alice's storage root", () => {
  let podRoots;
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher(oidcIssuer, cookie, appOrigin);

    const store = getStore(authFetcher);
    await store.fetcher.load(store.sym(aliceWebId).doc());
    podRoots = store.statementsMatching(store.sym(aliceWebId), store.sym(space.storage)).map(st => st.object.value);
  });

  test("is an ldp BasicContainer", async () => {
    expect(podRoots.length).toEqual(1);
    const store = getStore({
      fetch: async (url, options) => {
        const headers = await getAuthHeaders(url, 'GET', authFetcher);

        (headers as any).Accept = 'text/turtle';
        const result = await fetch(url, {
          headers
        });
        // const text = await result.text();
        // console.log(text);
        return result;
      }
    });
    await store.fetcher.load(store.sym(podRoots[0]));
    const podRootTypes = store.statementsMatching(store.sym(podRoots[0]), store.sym(rdf.type)).map(st => st.object.value);
    expect(podRootTypes.sort()).toEqual([
      ldp.BasicContainer,
      ldp.Container,
      ldp.Resource,
      link.Document,
      link.RDFDocument,
      "http://www.w3.org/ns/iana/media-types/text/turtle#Resource",
    ].sort());
  });

});
