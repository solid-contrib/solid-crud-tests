import { customAuthFetcher } from "solid-auth-fetcher";
import {SERVER_ROOT, USERNAME, PASSWORD } from "./global";
import fetch from "node-fetch";

export async function getAuthFetcher() {
  const authFetcher = await customAuthFetcher();
  console.log('POSTing', `${SERVER_ROOT}/login/password`, `username=${USERNAME}&password=${PASSWORD}`);
  const serverLoginResult = await authFetcher.fetch(`${SERVER_ROOT}/login/password`, {
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: `username=${USERNAME}&password=${PASSWORD}`,
    method: "POST",
    redirect: "manual"
  });
  const cookie = serverLoginResult.headers.get('set-cookie');
  console.log({ cookie });
  const session = await authFetcher.login({
    oidcIssuer: SERVER_ROOT,
    redirect: "https://tester/redirect"
  });
  console.log('got session');
  let redirectedTo = (session.neededAction as any).redirectUrl;
  do {
    console.log({ redirectedTo });
    const result = await fetch(redirectedTo, {
      headers: { cookie },
      redirect: "manual"
    });
    redirectedTo = result.headers.get("location");
    if (redirectedTo === null) {
      throw new Error('Please add https://tester as a trusted app!');
    }
  } while(!redirectedTo?.startsWith("https://tester"));
  console.log('handling', redirectedTo);
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
