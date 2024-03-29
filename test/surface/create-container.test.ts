import { generateTestFolder } from "../helpers/env";
import { ldp, rdf } from "rdf-namespaces";
import { getAuthFetcher } from "solid-auth-fetcher";
import { getStore } from "../helpers/util";
import { oidcIssuer, cookie, appOrigin } from "../helpers/env";
import {
  recursiveDelete,
  getContainerMembers,
  ifWps,
  responseCodeGroup,
} from "../helpers/util";
import { NotificationsClient } from "../helpers/NotificationsClient";

const MAX_WPS_DELAY = 1000;

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
      let notificationsClientContainer;
      let notificationsClientResource;
      const containerUrl = `${testFolderUrl}exists/`;
      const resourceUrl = `${containerUrl}new/`;

      beforeAll(async () => {
        // this already relies on the PUT to non-existing folder functionality
        // that will be one of the tested behaviours:
        await authFetcher.fetch(`${containerUrl}exists.ttl`, {
          method: "PUT",
          headers: {
            "content-type": "text/turtle",
          },
          body: "<#hello> <#linked> <#world> .",
        });
        notificationsClientContainer = new NotificationsClient(
          containerUrl,
          authFetcher
        );
        await notificationsClientContainer.getReady();
        notificationsClientResource = new NotificationsClient(
          resourceUrl,
          authFetcher
        );
        await notificationsClientResource.getReady();
        await authFetcher.fetch(resourceUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "text/turtle",
            "If-None-Match": "*",
            Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"', // See https://github.com/solid/node-solid-server/issues/1465
          },
          body: " ", // work around https://github.com/michielbdejong/community-server/issues/4#issuecomment-776222863
        });
      });

      afterAll(() => {
        notificationsClientContainer.disconnect();
        notificationsClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it("creates the container", async () => {
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
      it("adds the resource in the existing container listing", async () => {
        const containerListing = await getContainerMembers(
          containerUrl,
          authFetcher
        );
        expect(containerListing.sort()).toEqual(
          [`${containerUrl}exists.ttl`, resourceUrl].sort()
        );
      });

      ifWps("emits websockets-pubsub on the existing container", async () => {
        await new Promise((resolve) => setTimeout(resolve, MAX_WPS_DELAY));
        expect(notificationsClientContainer.receivedInsecure).toEqual(
          expect.arrayContaining([`ack ${containerUrl}`, `pub ${containerUrl}`])
        );
      });
      ifWps("emits websockets-pubsub on the new container", () => {
        expect(notificationsClientResource.receivedInsecure).toEqual(
          expect.arrayContaining([`ack ${resourceUrl}`, `pub ${resourceUrl}`])
        );
      });
    });
  });
});
