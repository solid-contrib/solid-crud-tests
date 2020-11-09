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

// when the tests start, exists/exists.ttl exists in the test folder,
// and nothing else.

describe("Delete", () => {
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher(oidcIssuer, cookie, appOrigin);
  });

  // use `${testFolderUrl}exists/` as the existing folder:
  describe("non-container", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientContainer;
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
      });

      websocketsPubsubClientContainer = new WPSClient(
        containerUrl,
        authFetcher
      );
      await websocketsPubsubClientContainer.getReady();
      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(resourceUrl, {
        method: "DELETE",
      });
    });

    afterAll(() => {
      websocketsPubsubClientContainer.disconnect();
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("deletes the resource", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(result.status).toEqual(404);
    });
    it("removes the resource from the container listing", async () => {
      const containerListing = await getContainerMembers(
        containerUrl,
        authFetcher
      );
      expect(containerListing.sort()).toEqual([]);
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

  // use `${testFolderUrl}exists/` as the existing folder:
  describe("non-empty container", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientContainer;
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
      });

      websocketsPubsubClientContainer = new WPSClient(
        containerUrl,
        authFetcher
      );
      await websocketsPubsubClientContainer.getReady();
      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(containerUrl, {
        method: "DELETE",
      });
    });

    afterAll(() => {
      websocketsPubsubClientContainer.disconnect();
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("leaves the container with the resource in it", async () => {
      const containerListing = await getContainerMembers(
        containerUrl,
        authFetcher
      );
      expect(containerListing.sort()).toEqual([resourceUrl]);
    });

    it("leaves the resource", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual("2xx");
      expect(await result.text()).toEqual("<#hello> <#linked> <#world> .");
      expect(result.headers.get("Content-Type")).toContain("text/turtle");
    });

    it("does not emit websockets-pubsub on the container", () => {
      expect(websocketsPubsubClientContainer.received).toEqual([
        `ack ${containerUrl}`,
      ]);
    });
    it("does not emit websockets-pubsub on the resource", () => {
      expect(websocketsPubsubClientResource.received).toEqual([
        `ack ${resourceUrl}`,
      ]);
    });
  });

  // use `${testFolderUrl}exists/` as the existing folder:
  describe("empty container", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientContainer;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // and on non-container delete:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
      });
      await authFetcher.fetch(resourceUrl, {
        method: "DELETE",
      });

      websocketsPubsubClientContainer = new WPSClient(
        containerUrl,
        authFetcher
      );
      await websocketsPubsubClientContainer.getReady();
      await authFetcher.fetch(containerUrl, {
        method: "DELETE",
      });
    });

    afterAll(() => {
      websocketsPubsubClientContainer.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("deletes the container", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(result.status).toEqual(404);
    });

    it("emits websockets-pubsub on the container", () => {
      expect(websocketsPubsubClientContainer.received).toEqual([
        `ack ${containerUrl}`,
        `pub ${containerUrl}`,
      ]);
    });
  });
});
