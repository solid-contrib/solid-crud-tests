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
  WPSClient,
  responseCodeGroup,
} from "../helpers/util";
import { getStore } from "../helpers/util";
import { ldp, rdf, space, link } from "rdf-namespaces";
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
    describe("using POST", () => {
      const { testFolderUrl } = generateTestFolder();
      let resourceUrl;
      let websocketsPubsubClient;
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

        websocketsPubsubClient = new WPSClient(containerUrl, authFetcher);
        await websocketsPubsubClient.getReady();
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
        websocketsPubsubClient.disconnect();
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
      it("emits websockets-pubsub on the container", () => {
        expect(websocketsPubsubClient.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`,
        ]);
      });
    });

    describe("using PUT", () => {
      const { testFolderUrl } = generateTestFolder();
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const containerUrl = `${testFolderUrl}exists/`;
      const resourceUrl = `${containerUrl}new.txt`;

      beforeAll(async () => {
        // this already relies on the PUT to non-existing folder functionality
        // that will be one of the tested behaviours:
        await authFetcher.fetch(`${containerUrl}exists.ttl`, {
          method: "PUT",
          headers: {
            "Content-Type": "text/turtle"
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
            "Content-Type": "text/plain",
            "If-None-Match": "*",
          },
          body: "Hello World",
        });
        await new Promise((resolve) => setTimeout(resolve, waittime));
      });

      afterAll(() => {
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
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
      it("emits websockets-pubsub on the container", () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`,
        ]);
      });
      it("emits websockets-pubsub on the resource", () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`,
          `pub ${resourceUrl}`,
        ]);
      });
    });

    describe("using PATCH", () => {
      const { testFolderUrl } = generateTestFolder();
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const containerUrl = `${testFolderUrl}exists/`;
      const resourceUrl = `${containerUrl}new.ttl`;

      beforeAll(async () => {
        // this already relies on the PUT to non-existing folder functionality
        // that will be one of the tested behaviours:
        await authFetcher.fetch(`${containerUrl}exists.ttl`, {
          method: "PUT",
          headers: {
            "Content-Type": "text/turtle"
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
          method: "PATCH",
          body: "INSERT DATA { <#hello> <#linked> <#world> . }",
          headers: {
            "Content-Type": "application/sparql-update",
          },
        });
        //		console.log(result);
        await new Promise((resolve) => setTimeout(resolve, waittime));
      });

      afterAll(() => {
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
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

        expect(store2.toString()).toEqual(store1.toString());
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
      it("emits websockets-pubsub on the container", () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`,
        ]);
      });
      it("emits websockets-pubsub on the resource", () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`,
          `pub ${resourceUrl}`,
        ]);
      });
    });
  });

  describe("in a non-existing container", () => {
    describe("using PUT", () => {
      const { testFolderUrl } = generateTestFolder();
      const containerUrl = `${testFolderUrl}new/`;
      let websocketsPubsubClientParent;
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const resourceUrl = `${containerUrl}new.txt`;

      beforeAll(async () => {
        websocketsPubsubClientParent = new WPSClient(
          testFolderUrl,
          authFetcher
        );
        await websocketsPubsubClientParent.getReady();
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
            "Content-Type": "text/plain",
            "If-None-Match": "*",
          },
          body: "Hello World",
        });
        await new Promise((resolve) => setTimeout(resolve, waittime));
      });

      afterAll(() => {
        websocketsPubsubClientParent.disconnect();
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
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
      it("emits websockets-pubsub on the parent", () => {
        expect(websocketsPubsubClientParent.received).toEqual([
          `ack ${testFolderUrl}`,
          `pub ${testFolderUrl}`,
        ]);
      });
      it("emits websockets-pubsub on the container", () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`,
        ]);
      });
      it("emits websockets-pubsub on the resource", () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`,
          `pub ${resourceUrl}`,
        ]);
      });
    });

    describe("using PATCH", () => {
      const { testFolderUrl } = generateTestFolder();
      let websocketsPubsubClientParent;
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const containerUrl = `${testFolderUrl}new/`;
      const resourceUrl = `${containerUrl}new.ttl`;

      beforeAll(async () => {
        websocketsPubsubClientParent = new WPSClient(
          testFolderUrl,
          authFetcher
        );
        await websocketsPubsubClientParent.getReady();
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
          method: "PATCH",
          body: "INSERT DATA { <#hello> <#linked> <#world> . }",
          headers: {
            "Content-Type": "application/sparql-update",
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 2000));
      });

      afterAll(() => {
        websocketsPubsubClientParent.disconnect();
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
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

        // console.log(resourceUrl);
        expect(store2.toString()).toEqual(store1.toString());
        expect(result.headers.get("Content-Type")).toContain("text/turtle");
      });
      it("adds the resource in the container listing", async () => {
        const containerListing = await getContainerMembers(
          containerUrl,
          authFetcher
        );
        expect(containerListing.sort()).toEqual([resourceUrl].sort());
      });
      it("emits websockets-pubsub on the parent", () => {
        expect(websocketsPubsubClientParent.received).toEqual([
          `ack ${testFolderUrl}`,
          `pub ${testFolderUrl}`,
        ]);
      });
      it("emits websockets-pubsub on the container", () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`,
        ]);
      });
      it("emits websockets-pubsub on the resource", () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`,
          `pub ${resourceUrl}`,
        ]);
      });
    });
  });
});
