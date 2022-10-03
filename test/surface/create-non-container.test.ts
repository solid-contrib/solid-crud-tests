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
  getStore,
  responseCodeGroup,
  ifWps,
} from "../helpers/util";
import { NotificationsClient } from "../helpers/NotificationsClient";
import * as rdflib from "rdflib";

const waittime = 2000;

// when the tests start, exists/exists.ttl exists in the test folder,
// and nothing else.

describe("Create non-container", () => {
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher(oidcIssuer, cookie, appOrigin);
  });

  // use `${testFolderUrl}exists/` as the existing folder:
  describe("in an existing container", () => {
    describe.only("using POST", () => {
      const { testFolderUrl } = generateTestFolder();
      let resourceUrl;
      let notificationsClient;
      const containerUrl = `${testFolderUrl}exists/`;

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

        notificationsClient = new NotificationsClient(containerUrl, authFetcher);
        await notificationsClient.getReady();
        const result = await authFetcher.fetch(containerUrl, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain",
          },
          body: "Hello World",
        });
        resourceUrl = new URL(
          result.headers.get("location"),
          containerUrl
        ).toString();
        await new Promise((resolve) => setTimeout(resolve, waittime));
      });

      afterAll(() => {
        notificationsClient.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it("creates the resource", async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual("2xx");
        expect(await result.text()).toEqual("Hello World");
        expect(result.headers.get("Content-Type")).toContain("text/plain");
      });
      it("adds the resource in the container listing", async () => {
        const containerListing = await getContainerMembers(
          containerUrl,
          authFetcher
        );
        expect(containerListing.sort()).toEqual(
          [`${containerUrl}exists.ttl`, resourceUrl].sort()
        );
      });
      ifWps("emits websockets-pubsub on the container", () => {
        expect(notificationsClient.received).toEqual(
          expect.arrayContaining([`ack ${containerUrl}`, `pub ${containerUrl}`])
        );
      });
    });

    describe("using PUT", () => {
      const { testFolderUrl } = generateTestFolder();
      let notificationsClientContainer;
      let notificationsClientResource;
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
        await authFetcher.fetch(resourceUrl, {
          method: "PUT",
          headers: {
            "Content-Type": "text/plain",
            "If-None-Match": "*",
          },
          body: "Hello World",
        });
        await new Promise((resolve) => setTimeout(resolve, waittime));
      });

      afterAll(() => {
        notificationsClientContainer.disconnect();
        notificationsClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it("creates the resource", async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual("2xx");
        expect(await result.text()).toEqual("Hello World");
        expect(result.headers.get("Content-Type")).toContain("text/plain");
      });
      it("adds the resource in the container listing", async () => {
        const containerListing = await getContainerMembers(
          containerUrl,
          authFetcher
        );
        expect(containerListing.sort()).toEqual(
          [`${containerUrl}exists.ttl`, resourceUrl].sort()
        );
      });
      ifWps("emits websockets-pubsub on the container", () => {
        expect(notificationsClientContainer.receivedInsecure).toEqual(
          expect.arrayContaining([`ack ${containerUrl}`, `pub ${containerUrl}`])
        );
      });
      ifWps("emits websockets-pubsub on the resource", () => {
        expect(notificationsClientResource.receivedInsecure).toEqual(
          expect.arrayContaining([`ack ${resourceUrl}`, `pub ${resourceUrl}`])
        );
      });
    });

    describe("using PATCH", () => {
      const { testFolderUrl } = generateTestFolder();
      let notificationsClientContainer;
      let notificationsClientResource;
      const containerUrl = `${testFolderUrl}exists/`;
      const resourceUrl = `${containerUrl}new.ttl`;

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
        await authFetcher.fetch(resourceUrl, {
          method: "PATCH",
          headers: {
            "Content-Type": "text/n3",
          },
          body:
            "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
            "<#patch> a solid:InsertDeletePatch;\n" +
            "  solid:inserts { <#hello> <#linked> <#world> .}.\n",
        });
        //		console.log(result);
        await new Promise((resolve) => setTimeout(resolve, waittime));
      });

      afterAll(() => {
        notificationsClientContainer.disconnect();
        notificationsClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it("creates the resource", async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual("2xx");

        const store1 = getStore(authFetcher);
        const store2 = getStore(authFetcher);

        rdflib.parse(
          "<#hello> <#linked> <#world> . ",
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
      it("adds the resource in the container listing", async () => {
        const containerListing = await getContainerMembers(
          containerUrl,
          authFetcher
        );
        expect(containerListing.sort()).toEqual(
          [`${containerUrl}exists.ttl`, resourceUrl].sort()
        );
      });
      ifWps("emits websockets-pubsub on the container", () => {
        expect(notificationsClientContainer.receivedInsecure).toEqual(
          expect.arrayContaining([`ack ${containerUrl}`, `pub ${containerUrl}`])
        );
      });
      ifWps("emits websockets-pubsub on the resource", () => {
        expect(notificationsClientResource.receivedInsecure).toEqual(
          expect.arrayContaining([`ack ${resourceUrl}`, `pub ${resourceUrl}`])
        );
      });
    });
  });

  describe("in a non-existing container", () => {
    describe("using PUT", () => {
      const { testFolderUrl } = generateTestFolder();
      const containerUrl = `${testFolderUrl}new/`;
      let notificationsClientParent;
      let notificationsClientContainer;
      let notificationsClientResource;
      const resourceUrl = `${containerUrl}new.txt`;

      beforeAll(async () => {
        notificationsClientParent = new NotificationsClient(
          testFolderUrl,
          authFetcher
        );
        await notificationsClientParent.getReady();
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
            "Content-Type": "text/plain",
            "If-None-Match": "*",
          },
          body: "Hello World",
        });
        await new Promise((resolve) => setTimeout(resolve, waittime));
      });

      afterAll(() => {
        notificationsClientParent.disconnect();
        notificationsClientContainer.disconnect();
        notificationsClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it("creates the resource", async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual("2xx");
        expect(await result.text()).toEqual("Hello World");
        expect(result.headers.get("Content-Type")).toContain("text/plain");
      });
      it("adds the resource in the container listing", async () => {
        const containerListing = await getContainerMembers(
          containerUrl,
          authFetcher
        );
        expect(containerListing.sort()).toEqual([resourceUrl].sort());
      });
      ifWps("emits websockets-pubsub on the parent", () => {
        expect(notificationsClientParent.received).toEqual(
          expect.arrayContaining([
            `ack ${testFolderUrl}`,
            `pub ${testFolderUrl}`,
          ])
        );
      });
      ifWps("emits websockets-pubsub on the container", () => {
        expect(notificationsClientContainer.receivedInsecure).toEqual(
          expect.arrayContaining([`ack ${containerUrl}`, `pub ${containerUrl}`])
        );
      });
      ifWps("emits websockets-pubsub on the resource", () => {
        expect(notificationsClientResource.receivedInsecure).toEqual(
          expect.arrayContaining([`ack ${resourceUrl}`, `pub ${resourceUrl}`])
        );
      });
    });

    describe("using PATCH", () => {
      const { testFolderUrl } = generateTestFolder();
      let notificationsClientParent;
      let notificationsClientContainer;
      let notificationsClientResource;
      const containerUrl = `${testFolderUrl}new/`;
      const resourceUrl = `${containerUrl}new.ttl`;

      beforeAll(async () => {
        notificationsClientParent = new NotificationsClient(
          testFolderUrl,
          authFetcher
        );
        await notificationsClientParent.getReady();
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
          method: "PATCH",
          headers: {
            "Content-Type": "text/n3",
          },
          body:
            "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
            "<#patch> a solid:InsertDeletePatch;\n" +
            "  solid:inserts { <#hello> <#linked> <#world> .}.\n",
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      });

      afterAll(() => {
        notificationsClientParent.disconnect();
        notificationsClientContainer.disconnect();
        notificationsClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it("creates the resource", async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual("2xx");

        const store1 = getStore(authFetcher);
        const store2 = getStore(authFetcher);

        rdflib.parse(
          "<#hello> <#linked> <#world> . ",
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
      it("adds the resource in the container listing", async () => {
        const containerListing = await getContainerMembers(
          containerUrl,
          authFetcher
        );
        expect(containerListing.sort()).toEqual([resourceUrl].sort());
      });
      ifWps("emits websockets-pubsub on the parent", () => {
        expect(notificationsClientParent.received).toEqual(
          expect.arrayContaining([
            `ack ${testFolderUrl}`,
            `pub ${testFolderUrl}`,
          ])
        );
      });
      ifWps("emits websockets-pubsub on the container", () => {
        expect(notificationsClientContainer.receivedInsecure).toEqual(
          expect.arrayContaining([`ack ${containerUrl}`, `pub ${containerUrl}`])
        );
      });
      ifWps("emits websockets-pubsub on the resource", () => {
        expect(notificationsClientResource.receivedInsecure).toEqual(
          expect.arrayContaining([`ack ${resourceUrl}`, `pub ${resourceUrl}`])
        );
      });
    });
  });
});
