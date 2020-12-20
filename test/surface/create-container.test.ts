import { generateTestFolder } from "../helpers/env";
import { ldp, rdf, space, link } from "rdf-namespaces";
import { getAuthFetcher } from "solid-auth-fetcher";
import { getStore } from "../helpers/util";
import { oidcIssuer, cookie, appOrigin } from "../helpers/env";
import {
  recursiveDelete,
  getContainerMembers,
  WPSClient,
  responseCodeGroup,
} from "../helpers/util";

// when the tests start, xists/exists.ttl exists in the test folder,
// and nothing else.

describe("Create container", () => {
  let authFetcher;
  let store;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher(oidcIssuer, cookie, appOrigin);
    store = getStore(authFetcher);
  });

  // use `${testFolderUrl}exists/` as the existing folder:
  describe("in an existing container", () => {
    describe("using PUT", () => {
      const { testFolderUrl } = generateTestFolder();
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const containerUrl = `${testFolderUrl}exists/`;
      const resourceUrl = `${containerUrl}new/`;

      beforeAll(async () => {
        // this already relies on the PUT to non-existing folder functionality
        // that will be one of the tested behaviours:
        await authFetcher.fetch(`${containerUrl}exists.ttl`, {
          method: "PUT",
          headers: {
            "content-type": "text/turtle"
          },
          body: "<#hello> <#linked> <#world> .",
        });

        websocketsPubsubClientContainer = new WPSClient(
          containerUrl,
          authFetcher
        );
        await websocketsPubsubClientContainer.getReady();
        websocketsPubsubClientResource = new WPSClient(
          resourceUrl,
          authFetcher
        );
        await websocketsPubsubClientResource.getReady();
        const result = await authFetcher.fetch(resourceUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "text/turtle",
            "If-None-Match": "*",
            Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"', // See https://github.com/solid/node-solid-server/issues/1465
          },
        });
      });

      afterAll(() => {
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it.skip("creates the container", async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual("2xx");

        await store.fetcher.load(store.sym(resourceUrl));
        const containerTypes = store
          .statementsMatching(store.sym(resourceUrl), store.sym(rdf.type))
          .map((st) => st.object.value);
        expect(containerTypes.indexOf(ldp.BasicContainer) > -1).toEqual(true);
        expect(containerTypes.indexOf(ldp.Container) > -1).toEqual(true);
        expect(
          containerTypes.indexOf(
            "http://www.w3.org/ns/iana/media-types/text/turtle#Resource"
          ) > -1
        ).toEqual(true);
        expect(result.headers.get("Content-Type")).toContain("text/turtle"); // use contain because it can also be text/turtle;charset=UTF-8
      });
      it.skip("adds the resource in the existing container listing", async () => {
        const containerListing = await getContainerMembers(
          containerUrl,
          authFetcher
        );
        expect(containerListing.sort()).toEqual(
          [`${containerUrl}exists.ttl`, resourceUrl].sort()
        );
      });

      it.skip("emits websockets-pubsub on the existing container", () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`,
        ]);
      });
      it.skip("emits websockets-pubsub on the new container", () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`,
          `pub ${resourceUrl}`,
        ]);
      });
    });
  });
});
