import {
  generateTestFolder,
  oidcIssuer,
  cookie,
  appOrigin,
} from "../helpers/env";
import { getAuthFetcher, getNodeSolidServerCookie } from "solid-auth-fetcher";
import {
  ifSecureWebsockets,
  ifWebhooks,
  ifWps,
  recursiveDelete,
} from "../helpers/util";
import {
  NotificationsClient,
  SECURE_WEBSOCKETS_TYPE,
  WEBHOOKS_TYPE,
} from "../helpers/NotificationsClient";

// note that these tests do one basic check of which types of notifications
// are discoverable and whether they emit a change event for basic PUT-to-update
// The more detailed test that also for instance test if a notification is triggered
// correctly for the update of containment triples when deleting a resource from
// a container are intertwined with the create-container, create-non-container, update,
// and delete tests, because there those actions are already being taken so that we can
// check their effect; the check for the notification is just an addition there.

const waittime = 1000;

// when the tests start, exists/exists[i].ttl exists in the test folder,
// and nothing else.

describe("Notifications", () => {
  let authFetcher;
  beforeAll(async () => {
    let newCookie = cookie;
    if (!cookie && process.env.WEBID_PROVIDER_GUI === "nss") {
      // console.log(
      //   "logging in to get IDP cookie",
      //   process.env.WEBID_PROVIDER,
      //   process.env.USERNAME,
      //   process.env.PASSWORD
      // );
      newCookie = await getNodeSolidServerCookie(
        process.env.WEBID_PROVIDER,
        process.env.USERNAME,
        process.env.PASSWORD
      );
      // console.log({ newCookie });
    }
    authFetcher = await getAuthFetcher(oidcIssuer, newCookie, appOrigin);
  });
  describe("When overwriting plain text with plain text using PUT", () => {
    const { testFolderUrl } = generateTestFolder();
    // console.log({ testFolderUrl });
    let notificationsClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists1.txt`;

    function checkDescription(typeStr: string) {
      let describedBy = notificationsClientResource.discoveryLinks.storageWide;
      if (
        typeof notificationsClientResource.discoveryLinks.resourceSpecific ===
        "string"
      ) {
        // resource specific has preference over storage-wide, see
        // https://github.com/solid/notifications/issues/58#issuecomment-1219511774
        // > it could (non-?)normatively state that when both relations are available,
        // > the client should use the resource specific one for channel information
        describedBy =
          notificationsClientResource.discoveryLinks.resourceSpecific;
      }

      // note that we interpret the spec as per
      // https://github.com/solid/notifications/issues/58#issuecomment-1265144088
      // so at least one of the two should be available.
      expect(typeof describedBy).toBe("string");
      expect(typeof notificationsClientResource.description[describedBy]).toBe(
        "object"
      );
      expect(
        notificationsClientResource.description[describedBy]["@context"]
      ).toEqual(["https://www.w3.org/ns/solid/notification/v1"]);
      expect(
        Array.isArray(
          notificationsClientResource.description[describedBy]
            .notificationChannel
        )
      );
      const arr: any[] =
        notificationsClientResource.description[describedBy]
          .notificationChannel;
      let found = 0;
      for (let i = 0; i < arr.length; i++) {
        // console.log("channel description", arr[i]);
        const types = arr[i].type;
        for (let j = 0; j < types.length; j++) {
          // console.log(types[j]);
          if (types[j] === typeStr) {
            found++;
          }
        }
      }
      expect(found).toEqual(1);
      // TODO: follow nose to that doc.
    }

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      // console.log("PUT hello world start...");
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
      notificationsClientResource = new NotificationsClient(
        resourceUrl,
        authFetcher
      );
      await notificationsClientResource.getReady();
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

    afterAll(async () => {
      await notificationsClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });
    ifWps(
      "insecure websockets-pubsub advertised using Updates-Via Link header",
      () => {
        expect(
          typeof notificationsClientResource.discoveryLinks.insecureWs
        ).toBe("string");
        expect(
          notificationsClientResource.discoveryLinks.insecureWs.startsWith(
            "http"
          )
        ).toBe(true);
      }
    );
    ifWps("emits insecure websockets-pubsub on the resource", () => {
      expect(notificationsClientResource.receivedInsecure).toEqual(
        expect.arrayContaining([`ack ${resourceUrl}`, `pub ${resourceUrl}`])
      );
    });
    ifSecureWebsockets(
      "secure websockets advertised using server-wide or resource-specific Link header",
      () => {
        checkDescription(SECURE_WEBSOCKETS_TYPE);
      }
    );
    ifSecureWebsockets(
      "emits secure websockets notification on the resource",
      () => {
        // FIXME: expect the new format!
        // expect(notificationsClientResource.receivedSecure).toEqual(
        //   expect.arrayContaining([`ack ${resourceUrl}`, `pub ${resourceUrl}`])
        // );
      }
    );
    ifWebhooks(
      "webhooks advertised using server-wide or resource-specific Link header",
      () => {
        checkDescription(WEBHOOKS_TYPE);
      }
    );
    ifWebhooks("emits webhook notification on the resource", () => {
      expect(notificationsClientResource.receivedHook.length).toEqual(1);
      const msgObj = JSON.parse(notificationsClientResource.receivedHook[0]);
      // console.log(msgObj);
      expect(Array.isArray(msgObj["@context"])).toEqual(true);
      expect(Array.isArray(msgObj["type"])).toEqual(true);
      expect(Array.isArray(msgObj["object"]["type"])).toEqual(true);
      expect(
        msgObj["@context"].indexOf(
          "https://www.w3.org/ns/solid/notification/v1"
        )
      ).not.toEqual(-1);
      expect(msgObj["type"][0]).toEqual("Update");
      expect(msgObj["object"]["id"]).toEqual(resourceUrl);
      expect(
        msgObj["object"]["type"].indexOf("http://www.w3.org/ns/ldp#Resource")
      ).not.toEqual(-1);
    });
  });
});
