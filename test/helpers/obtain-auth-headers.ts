import { customAuthFetcher } from "solid-auth-fetcher";
import fetch, { Response } from "node-fetch";

const SERVER_ROOT = "https://localhost:8443";
const USERNAME = "alice";
const PASSWORD = "123";



async function getAuthHeaders() {
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
    oidcIssuer: "https://localhost:8443",
    redirect: "https://mysite.com/redirect"
  });
  let redirectedTo = (session.neededAction as any).redirectUrl;
  do {
    const result = await fetch(redirectedTo, {
      headers: { cookie },
      redirect: "manual"
    });
    redirectedTo = result.headers.get("location");
    console.log("Redirected to", redirectedTo);
  } while(!redirectedTo?.startsWith("https://mysite.com"));

  await authFetcher.handleRedirect(redirectedTo);
  const result = await authFetcher.fetch("https://localhost:8443/private/");
  console.log(result.status);
  console.log(await result.text());
}
getAuthHeaders();