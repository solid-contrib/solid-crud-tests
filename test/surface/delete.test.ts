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
  ifWps,
  responseCodeGroup,
} from "../helpers/util";
import { NotificationsClient } from "../helpers/NotificationsClient";

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
    let notificationsClientContainer;
    let notificationsClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
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
      notificationsClientResource = new NotificationsClient(resourceUrl, authFetcher);
      await notificationsClientResource.getReady();
      await authFetcher.fetch(resourceUrl, {
        method: "DELETE",
      });
    });

    afterAll(() => {
      notificationsClientContainer.disconnect();
      notificationsClientResource.disconnect();
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

  // use `${testFolderUrl}exists/` as the existing folder:
  describe("non-empty container", () => {
    const { testFolderUrl } = generateTestFolder();
    let notificationsClientContainer;
    let notificationsClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.txt`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        headers: {
          "content-type": "text/plain",
        },
        body: "Hello World",
      });

      notificationsClientContainer = new NotificationsClient(
        containerUrl,
        authFetcher
      );
      await notificationsClientContainer.getReady();
      notificationsClientResource = new NotificationsClient(resourceUrl, authFetcher);
      await notificationsClientResource.getReady();
      await authFetcher.fetch(containerUrl, {
        method: "DELETE",
      });
    });

    afterAll(() => {
      notificationsClientContainer.disconnect();
      notificationsClientResource.disconnect();
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
      expect(await result.text()).toEqual("Hello World");
      expect(result.headers.get("Content-Type")).toContain("text/plain");
    });

    ifWps("does not emit websockets-pubsub on the container", () => {
      expect(notificationsClientContainer.receivedInsecure).toEqual(
        expect.arrayContaining([`ack ${containerUrl}`])
      );
      expect(notificationsClientContainer.receivedInsecure).not.toEqual(
        expect.arrayContaining([`pub ${containerUrl}`])
      );
    });
    ifWps("does not emit websockets-pubsub on the resource", () => {
      expect(notificationsClientResource.receivedInsecure).toEqual(
        expect.arrayContaining([`ack ${resourceUrl}`])
      );
      expect(notificationsClientResource.receivedInsecure).not.toEqual(
        expect.arrayContaining([`pub ${resourceUrl}`])
      );
    });
  });

  // use `${testFolderUrl}exists/` as the existing folder:
  describe("empty container", () => {
    const { testFolderUrl } = generateTestFolder();
    let notificationsClientContainer;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // and on non-container delete:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        headers: {
          "content-type": "text/turtle",
        },
        body: "<#hello> <#linked> <#world> .",
      });
      await authFetcher.fetch(resourceUrl, {
        method: "DELETE",
      });

      notificationsClientContainer = new NotificationsClient(
        containerUrl,
        authFetcher
      );
      await notificationsClientContainer.getReady();
      await authFetcher.fetch(containerUrl, {
        method: "DELETE",
      });
    });

    afterAll(() => {
      notificationsClientContainer.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("deletes the container", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(result.status).toEqual(404);
    });

    ifWps("emits websockets-pubsub on the container", () => {
      expect(notificationsClientContainer.receivedInsecure).toEqual(
        expect.arrayContaining([`ack ${containerUrl}`, `pub ${containerUrl}`])
      );
    });
  });
});
