import { customAuthFetcher } from "solid-auth-fetcher";
import {SERVER_ROOT, USERNAME, PASSWORD } from "./global";
import fetch from "node-fetch";

export async function getAuthFetcher() {
  const authFetcher = await customAuthFetcher();
  const serverLoginResult = await authFetcher.fetch(`${SERVER_ROOT}/login/password`, {
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: `username=${USERNAME}&password=${PASSWORD}`,
    method: "POST",
    redirect: "manual"
  });
  const cookie = serverLoginResult.headers.get('set-cookie');

  const session = await authFetcher.login({
    oidcIssuer: SERVER_ROOT,
    redirect: "https://tester/redirect"
  });
  let redirectedTo = (session.neededAction as any).redirectUrl;
  do {
    const result = await fetch(redirectedTo, {
      headers: { cookie },
      redirect: "manual"
    });
    redirectedTo = result.headers.get("location");
    if (redirectedTo === null) {
      throw new Error('Please add https://tester as a trusted app!');
    }
  } while(!redirectedTo?.startsWith("https://tester"));

  await authFetcher.handleRedirect(redirectedTo);
  return authFetcher;
}

// FIXME: This is a total hack, obviously, second-guessing the
// DI architecture of solid-auth-fetcher:
export async function getAuthHeaders(urlStr: string, method: string, authFetcher) {
  return {
    Authorization: JSON.parse(authFetcher.authenticatedFetcher.tokenRefresher.storageUtility.storage.map['solidAuthFetcherUser:global']).accessToken,
    DPop: await authFetcher.authenticatedFetcher.tokenRefresher.tokenRequester.dpopHeaderCreator.createHeaderToken(new URL(urlStr), method)
  };
}
