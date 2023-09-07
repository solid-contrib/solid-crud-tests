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
import AuthFetcher from "solid-auth-fetcher/dist/AuthFetcher";

const waittime = 2000;

// when the tests start, exists/exists.ttl exists in the test folder,
// and nothing else.

describe("Hello World", () => {
  it("can post a file into a folder", async () => {
    let authFetcher = await getAuthFetcher(oidcIssuer, cookie, appOrigin);
    const { testFolderUrl } = generateTestFolder();
    let resourceUrl;
    const containerUrl = testFolderUrl;
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
    expect(result.status).toBe(201);
    recursiveDelete(testFolderUrl, authFetcher as AuthFetcher);
  });
});
