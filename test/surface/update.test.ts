import {
  generateTestFolder,
  oidcIssuer,
  cookie,
  appOrigin,
} from "../helpers/env";
import { getAuthFetcher, getNodeSolidServerCookie } from "solid-auth-fetcher";
import {
  recursiveDelete,
  getContainerMembers,
  WPSClient,
  ifWps,
  responseCodeGroup,
} from "../helpers/util";
import { getStore } from "../helpers/util";
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
  describe("Using PUT, overwriting plain text with plain text", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists1.txt`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "Hello World",
        headers: {
          "Content-Type": "text/plain",
        },
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));
      const getResult = await authFetcher.fetch(resourceUrl);
      const resourceETagInQuotes = getResult.headers.get("ETag");
      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const headers = {
        "Content-Type": "text/plain",
      };
      if (resourceETagInQuotes) {
        headers["If-Match"] = resourceETagInQuotes;
      }
      const result = await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        headers,
        body: "Replaced the contents.",
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("updates the resource", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual("2xx");
      expect(await result.text()).toEqual("Replaced the contents.");
      expect(result.headers.get("Content-Type")).toContain("text/plain");
    });
    ifWps("emits websockets-pubsub on the resource", () => {
      expect(websocketsPubsubClientResource.received).toEqual(
        expect.arrayContaining([`ack ${resourceUrl}`, `pub ${resourceUrl}`])
      );
    });
  });

  describe("Using PUT, overwriting Turtle with Turtle", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists1.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
        headers: {
          "Content-Type": "text/turtle",
        },
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));
      const getResult = await authFetcher.fetch(resourceUrl);
      const resourceETagInQuotes = getResult.headers.get("ETag");
      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const headers = {
        "Content-Type": "text/turtle",
      };
      if (resourceETagInQuotes) {
        headers["If-Match"] = resourceETagInQuotes;
      }
      const result = await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        headers,
        body: "<#replaced> <#the> <#contents> .",
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("updates the resource", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual("2xx");

      const store1 = getStore(authFetcher);
      const store2 = getStore(authFetcher);

      rdflib.parse(
        "<#replaced> <#the> <#contents> .",
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

  describe("Using PUT (same Turtle content)", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists1.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
        headers: {
          "Content-Type": "text/turtle",
        },
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));
      const getResult = await authFetcher.fetch(resourceUrl);
      const resourceETagInQuotes = getResult.headers.get("ETag");
      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const headers = {
        "Content-Type": "text/turtle",
      };
      if (resourceETagInQuotes) {
        headers["If-Match"] = resourceETagInQuotes;
      }
      const result = await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        headers,
        body: "<#hello> <#linked> <#world> .",
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("updates the resource", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual("2xx");

      const store1 = getStore(authFetcher);
      const store2 = getStore(authFetcher);

      rdflib.parse(
        "<#hello> <#linked> <#world> .",
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

  describe("Using PATCH to add triple", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists3.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
        headers: {
          "Content-Type": "text/turtle",
        },
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      await authFetcher.fetch(resourceUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "text/n3",
        },
        body:
          "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
          "<#patch> a solid:InsertDeletePatch;\n" +
          "  solid:inserts { <#that> a <#fact> . }.\n",
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("updates the resource", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual("2xx");

      const store1 = getStore(authFetcher);
      const store2 = getStore(authFetcher);

      rdflib.parse(
        "@prefix : <#>.\n\n:hello :linked :world.\n\n:that a :fact.\n\n",
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

  describe("Using PATCH to replace triple (same content)", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists4.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
        headers: {
          "Content-Type": "text/turtle",
        },
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(resourceUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "text/n3",
        },
        body:
          "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
          "<#patch> a solid:InsertDeletePatch;\n" +
          "  solid:deletes { <#hello> <#linked> <#world> .}.\n" +
          "  solid:inserts { <#hello> <#linked> <#world> .}.\n",
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("updates the resource", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual("2xx");

      const store1 = getStore(authFetcher);
      const store2 = getStore(authFetcher);

      rdflib.parse(
        "@prefix : <#>.\n\n:hello :linked :world.\n\n",
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

  describe("Using PATCH to replace triple (present)", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists4.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
        headers: {
          "Content-Type": "text/turtle",
        },
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      await authFetcher.fetch(resourceUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "text/n3",
        },
        body:
          "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
          "<#patch> a solid:InsertDeletePatch;\n" +
          "  solid:deletes { <#hello> <#linked> <#world> .}.\n" +
          "  solid:inserts { <#that> a <#fact> .}.\n",
      });
      await new Promise((resolve) => setTimeout(resolve, waittime));
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("updates the resource", async () => {
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

  // DISPUTED: https://github.com/solid/specification/issues/139#issuecomment-797338177
  describe.skip("Using PATCH to replace triple (not present)", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists5.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
        headers: {
          "Content-Type": "text/turtle",
        },
      });

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      await authFetcher.fetch(resourceUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "text/n3",
        },
        body:
          "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
          "<#patch> a solid:InsertDeletePatch;\n" +
          "  solid:deletes { <#something> <#completely> <#different> .}.\n" +
          "  solid:inserts { <#that> a <#fact> .}.\n",
      });
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("does not update the resource", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual("2xx");

      const store1 = getStore(authFetcher);
      const store2 = getStore(authFetcher);

      rdflib.parse(
        "<#hello> <#linked> <#world> .",
        store1,
        resourceUrl,
        "text/turtle"
      );
      rdflib.parse(await result.text(), store2, resourceUrl, "text/turtle");

      // console.log(resourceUrl);
      expect(store2.statements).toEqual(
        expect.arrayContaining(store1.statements)
      );
      expect(result.headers.get("Content-Type")).toContain("text/turtle");
    });
    ifWps("does not emit websockets-pubsub on the resource", () => {
      expect(websocketsPubsubClientResource.received).toEqual(
        expect.arrayContaining([`ack ${resourceUrl}`])
      );
      expect(websocketsPubsubClientResource.received).not.toEqual(
        expect.arrayContaining([`pub ${resourceUrl}`])
      );
    });
  });

  describe("Using PATCH to remove triple (present)", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists6.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
        headers: {
          "Content-Type": "text/turtle",
        },
      });

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      await authFetcher.fetch(resourceUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "text/n3",
        },
        body:
          "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
          "<#patch> a solid:InsertDeletePatch;\n" +
          "  solid:deletes { <#hello> <#linked> <#world> .}.\n",
      });
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("updates the resource", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual("2xx");
      const store1 = getStore(authFetcher);
      const store2 = getStore(authFetcher);

      rdflib.parse("@prefix : <#>.", store1, resourceUrl, "text/turtle");
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

  describe("Using PATCH to remove triple (not present)", () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists7.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: "PUT",
        body: "<#hello> <#linked> <#world> .",
        headers: {
          "Content-Type": "text/turtle",
        },
      });

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      await authFetcher.fetch(resourceUrl, {
        method: "PATCH",
        headers: {
          "Content-Type": "text/n3",
        },
        body:
          "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
          "<#patch> a solid:InsertDeletePatch;\n" +
          "  solid:deletes { <#something> <#completely> <#different> .}.\n",
      });
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it("does not update the resource", async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual("2xx");
      const store1 = getStore(authFetcher);
      const store2 = getStore(authFetcher);

      rdflib.parse(
        "<#hello> <#linked> <#world> .",
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
    ifWps("does not emit websockets-pubsub on the resource", () => {
      // Should see ack but not pub
      expect(websocketsPubsubClientResource.received).toEqual(
        expect.arrayContaining([`ack ${resourceUrl}`])
      );
      // FIXME: https://github.com/michielbdejong/community-server/issues/9#issuecomment-776595324
      // expect(websocketsPubsubClientResource.received).not.toEqual(
      //   expect.arrayContaining([`pub ${resourceUrl}`])
      // );
    });
  });
});
