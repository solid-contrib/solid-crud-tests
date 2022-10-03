import {
  generateTestFolder,
  oidcIssuer,
  cookie,
  appOrigin,
} from "../helpers/env";
import { getAuthFetcher } from "solid-auth-fetcher";
import {
  recursiveDelete,
  getContainerMembers,
  responseCodeGroup,
  ifWps,
  getStore,
} from "../helpers/util";
import { NotificationsClient } from "../helpers/NotificationsClient";
import * as rdflib from "rdflib";

const waittime = 2000;

if (process.env.SKIP_CONC) {
  console.log("Skipping concurrency tests because SKIP_CONC env var is set");
  describe("Check for SKIP_CONC env", () => {
    test("SKIP_CONC env var is set", () => {
      expect(true).toBe(true);
    });
  });
} else {
  // when the tests start, exists/exists.ttl exists in the test folder,
  // and nothing else.

  describe("Concurrency", () => {
    let authFetcher;
    beforeAll(async () => {
      authFetcher = await getAuthFetcher(oidcIssuer, cookie, appOrigin);
    });

    // use `${testFolderUrl}exists/` as the existing folder:
    describe("Try to create the same resource, using PUT 10 times", () => {
      const { testFolderUrl } = generateTestFolder();
      let notificationsClientContainer;
      let notificationsClientResource;
      let results;
      let bodyExpected = "who won?";
      const containerUrl = `${testFolderUrl}exists/`;
      const resourceUrl = `${containerUrl}new.txt`;

      beforeAll(async () => {
        // this already relies on the PUT to non-existing folder functionality
        // that will be one of the tested behaviours:
        await authFetcher.fetch(`${containerUrl}exists.ttl`, {
          method: "PUT",
          headers: {
            "Content-Type": "text/turtle",
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
        const promises = [];
        for (let i = 0; i < 10; i++) {
          const body = `${i} wins`;
          const promise = authFetcher.fetch(resourceUrl, {
            method: "PUT",
            headers: {
              "Content-Type": "text/plain",
              "If-None-Match": "*",
            },
            body,
          });
          promises.push(promise);
        }
        results = await Promise.all(promises);
        for (let i = 0; i < 10; i++) {
          if (responseCodeGroup(results[i].status) === "2xx") {
            bodyExpected = `${i} wins`;
          }
        }
        await new Promise((resolve) => setTimeout(resolve, waittime));
      });

      afterAll(() => {
        notificationsClientContainer.disconnect();
        notificationsClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it("succeeds exactly once", () => {
        expect(
          results.filter((result) => responseCodeGroup(result.status) === "2xx")
            .length
        ).toEqual(1);
      });
      it("creates the resource", async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual("2xx");
        expect(result.headers.get("Content-Type")).toContain("text/plain");
      });
      it("body was set by the successful request", async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual("2xx");
        expect(await result.text()).toEqual(bodyExpected);
        expect(result.headers.get("Content-Type")).toContain("text/plain");
      });
      it("adds the resource in the container listing exactly once", async () => {
        const containerListing = await getContainerMembers(
          containerUrl,
          authFetcher
        );
        expect(
          containerListing.filter((x) => x === resourceUrl).length
        ).toEqual(1);
      });
      ifWps("emits websockets-pubsub on the container exactly once", () => {
        expect(
          notificationsClientContainer.receivedInsecure.filter(
            (x) => x === `pub ${containerUrl}`
          ).length
        ).toEqual(1);
      });
      ifWps("emits websockets-pubsub on the resource exactly once", () => {
        expect(
          notificationsClientResource.receivedInsecure.filter(
            (x) => x === `pub ${resourceUrl}`
          ).length
        ).toEqual(1);
      });
    });
    describe("Use PATCH 10 times to add triple to the same resource", () => {
      const { testFolderUrl } = generateTestFolder();
      let notificationsClientResource;
      let results;
      let expectedRdf = "";
      const containerUrl = `${testFolderUrl}exists/`;
      const resourceUrl = `${containerUrl}resource.ttl`;

      beforeAll(async () => {
        // this already relies on the PUT to non-existing folder functionality
        // that will be one of the tested behaviours:
        await authFetcher.fetch(resourceUrl, {
          method: "PUT",
          body: " ",
          headers: {
            "Content-Type": "text/turtle",
          },
        });
        await new Promise((resolve) => setTimeout(resolve, waittime));

        notificationsClientResource = new NotificationsClient(
          resourceUrl,
          authFetcher
        );
        await notificationsClientResource.getReady();
        const promises = [];
        for (let i = 0; i < 10; i++) {
          const triple = `<#triple-${i}> <#added> <#successfully> .`;
          const promise = authFetcher.fetch(resourceUrl, {
            method: "PATCH",
            headers: {
              "Content-Type": "text/n3",
            },
            body:
              "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
              "<#patch> a solid:InsertDeletePatch;\n" +
              `  solid:inserts { ${triple} .}.\n`,
          });
          expectedRdf += `${triple}\n`;
          promises.push(promise);
        }
        results = await Promise.all(promises);
        await new Promise((resolve) => setTimeout(resolve, waittime));
      });

      afterAll(() => {
        notificationsClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it("succeeds 10 times", async () => {
        expect(
          results.filter((x) => responseCodeGroup(x.status) === "2xx").length
        ).toEqual(10);
      });

      it("updates the resource", async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual("2xx");

        const store1 = getStore(authFetcher);
        const store2 = getStore(authFetcher);
        rdflib.parse(expectedRdf, store1, resourceUrl, "text/turtle");
        rdflib.parse(await result.text(), store2, resourceUrl, "text/turtle");

        expect(store2.statements).toEqual(
          expect.arrayContaining(store1.statements)
        );
        expect(result.headers.get("Content-Type")).toContain("text/turtle");
      });
      ifWps("emits websockets-pubsub on the resource 10 times", () => {
        expect(
          notificationsClientResource.receivedInsecure.filter(
            (x) => x === `pub ${resourceUrl}`
          ).length
        ).toEqual(10);
      });
    });
  });
}
