import { login } from "solid-auth-fetcher";
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
  const session = await login({
    oidcIssuer: "https://localhost:8443",
    redirect: "https://mysite.com/redirect"
  });
  const result1 = await fetch((session.neededAction as any).redirectUrl, {
    headers: {
      cookie
    },
    redirect: "manual"
  });
  const result2 = await fetch(result1.headers.get('location'), {
    headers: {
      cookie
    },
    redirect: "manual"
  });
  const result3 = await fetch(result2.headers.get('location'), {
    headers: {
      cookie
    },
    redirect: "manual"
  });
  const harvest = new URL(result3.headers.get('location')).searchParams;
  console.log({
    code: harvest.get('code'),
    idToken: harvest.get('id_token')
  });
}
getAuthHeaders();