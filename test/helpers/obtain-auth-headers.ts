import { login, customAuthFetcher } from "solid-auth-fetcher";
import fetch, { Response } from "node-fetch";

const SERVER_ROOT = "https://localhost:8443";

async function getCookie() {
  const result = await fetch(`${SERVER_ROOT}/login/password`, {
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    body: "username=alice&password=123",
    method: "POST",
    redirect: "manual"
  });
  return result.headers.get('set-cookie');
}


async function getAuthHeaders() {
  const cookie = await getCookie();
  const authFetcher = await customAuthFetcher();

  const session = await authFetcher.login({
    oidcIssuer: "https://localhost:8443",
    redirect: "https://mysite.com/redirect"
  });
  let redirectedTo = (session.neededAction as any).redirectUrl;
  do {
    const result = await fetch(redirectedTo, {
      headers: {
        cookie
      },
      redirect: "manual"
    });
    redirectedTo = result.headers.get("location");
    console.log("Redirected to", redirectedTo);
  } while(!redirectedTo?.startsWith("https://mysite.com"));

  await authFetcher.handleRedirect(redirectedTo);
  await authFetcher.fetch("https://localhost:8443/private/");
}
getAuthHeaders();