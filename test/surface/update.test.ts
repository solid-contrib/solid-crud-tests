import {
  generateTestFolder,
  oidcIssuer,
  cookie,
  appOrigin,
} from "../helpers/env";
import { getAuthFetcher, getNodeSolidServerCookie } from "solid-auth-fetcher";
import { getStore, ifWps, responseCodeGroup } from "../helpers/util";
import { NotificationsClient } from "../helpers/NotificationsClient";
import * as rdflib from "rdflib";

const waittime = 1000;
// when the tests start, exists/exists[i].ttl exists in the test folder,
// and nothing else.

describe("Update", () => {
  let authFetcher;
  beforeAll(async () => {
    let newCookie = cookie;
    if (!cookie && process.env.WEBID_PROVIDER_GUI === "nss") {
      console.log(
        "logging in to get IDP cookie",
        process.env.WEBID_PROVIDER,
        process.env.USERNAME,
        process.env.PASSWORD
      );
      newCookie = await getNodeSolidServerCookie(
        process.env.WEBID_PROVIDER,
        process.env.USERNAME,
        process.env.PASSWORD
      );
      console.log({ newCookie });
    }
    authFetcher = await getAuthFetcher(oidcIssuer, newCookie, appOrigin);
  });

  describe("Using PATCH to replace triple (present)", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists4.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      const res = await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
        headers: {
          "Content-Type": "text/turtle",
        },
      });
      console.log(res.status);
      console.log(res.headers.get("Location"));
      await new Promise((resolve) => setTimeout(resolve, waittime));

      websocketsPubsubClientResource = new NotificationsClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      await authFetcher.fetch(resourceUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "text/n3",
        },
        body:
          "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
          "<#patch> a solid:InsertDeletePatch;\n" +
          "  solid:deletes { <#hello> <#linked> <#world> .};\n" +
          "  solid:inserts { <#that> a <#fact> .}.\n",
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      //  recursiveDelete(testFolderUrl, authFetcher);
    });

    it.only("updates the resource", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual("2xx");

      const store1 = getStore(authFetcher);
      const store2 = getStore(authFetcher);

      rdflib.parse(
        "@prefix : <#>.\n\n:that a :fact.\n\n",
        store1,
        resourceUrl,
        "text/turtle"
      );
      rdflib.parse(await result.text(), store2, resourceUrl, "text/turtle");

      expect(store2.statements).toEqual(
        expect.arrayContaining(store1.statements)
      );
      expect(result.headers.get("Content-Type")).toContain("text/turtle");
    });
    ifWps("emits websockets-pubsub on the resource", () => {
      expect(websocketsPubsubClientResource.received).toEqual(
        expect.arrayContaining([`ack ${resourceUrl}`, `pub ${resourceUrl}`])
      );
    });
  });
});
