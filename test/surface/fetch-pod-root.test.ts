import fetch from "node-fetch";
import { ldp, rdf, space, link } from "rdf-namespaces";
import { getStore } from "../helpers/util";
import { getAuthFetcher, getAuthHeaders } from "../helpers/obtain-auth-headers";

const ALICE_WEBID = process.env.ALICE_WEBID;

describe("Alice's storage root", () => {
  let podRoots;
  let authFetcher;

  beforeAll(async () => {
    authFetcher = await getAuthFetcher();
    const store = getStore(authFetcher);
    await store.fetcher.load(store.sym(ALICE_WEBID).doc());
    podRoots = store.statementsMatching(store.sym(ALICE_WEBID), store.sym(space.storage)).map(st => st.object.value);
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
