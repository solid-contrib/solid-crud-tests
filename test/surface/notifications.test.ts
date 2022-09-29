import {
  generateTestFolder,
  oidcIssuer,
  cookie,
  appOrigin,
} from "../helpers/env";
import { getAuthFetcher, getNodeSolidServerCookie } from "solid-auth-fetcher";
import { ifWps, recursiveDelete } from "../helpers/util";
import { NotificationsClient } from "../helpers/NotificationsClient";

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
  describe("When overwriting plain text with plain text using PUT", () => {
    const { testFolderUrl } = generateTestFolder();
    let notificationsClientResource;
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
      notificationsClientResource = new NotificationsClient(resourceUrl, authFetcher);
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

    afterAll(() => {
      notificationsClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });
    ifWps("emits websockets-pubsub on the resource", () => {
      expect(notificationsClientResource.received).toEqual(
        expect.arrayContaining([`ack ${resourceUrl}`, `pub ${resourceUrl}`])
      );
    });
  });
});