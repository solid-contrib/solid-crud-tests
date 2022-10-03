const fetch = require("node-fetch");
const { getAuthFetcher } = require("solid-auth-fetcher");

// curl -H'Content-Type:application/json' -ki -d'{"topic":"https://server/apps/solid/@alice/storage/foo/bar","target":"https://tester"}' --cookie "$COOKIE" https://server/apps/solid/webhook/register
//
const oidcIssuer = "https://server";
const origin = "https://tester";

async function run(url) {
  const cookie = process.env["COOKIE_ALICE"];
  console.log("Getting fetcher", { oidcIssuer, cookie, origin });
  const fetcher = await getAuthFetcher(oidcIssuer, cookie, origin);
  console.log("Fetching", { url });
  const result = await fetcher.fetch(
    "https://server/apps/solid/webhook/register",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: "https://server/apps/solid/@alice/storage/foo/bar",
        target: "https://tester",
      }),
    }
  );
  console.log(result.status, await result.text());
  for (let pair of result.headers.entries()) {
    console.log(`Response header: ${pair[0]}: ${pair[1]}`);
  }
}

// ...
run(process.argv[2]);
