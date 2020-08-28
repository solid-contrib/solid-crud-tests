import { customAuthFetcher } from "solid-auth-fetcher";
import fetch from "node-fetch";

export async function getAuthFetcher(idpRoot, username, password) {
  const authFetcher = await customAuthFetcher();
  const serverLoginResult = await authFetcher.fetch(`${idpRoot}/login/password`, {
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: `username=${username}&password=${password}`,
    method: "POST",
    redirect: "manual"
  });
  const cookie = serverLoginResult.headers.get('set-cookie');

  const session = await authFetcher.login({
    oidcIssuer: idpRoot,
    redirect: "https://tester/redirect"
  });
  let redirectedTo = (session.neededAction as any).redirectUrl;
  do {
    const result = await fetch(redirectedTo, {
      headers: { cookie },
      redirect: "manual"
    });
    redirectedTo = result.headers.get("location");
  } while(!redirectedTo?.startsWith("https://tester"));

  await authFetcher.handleRedirect(redirectedTo);
  return authFetcher;
}
