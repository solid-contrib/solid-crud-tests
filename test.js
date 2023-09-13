const { Session } = require("@inrupt/solid-client-authn-node");
const { getPodUrlAll } = require("@inrupt/solid-client");

const SECRET = {
  app_name: 'solid-test-suite',
  clientId: 'b8a43a03-c9c0-4d93-8e65-8b3453e5c59f',
  clientSecret: 'c189fe84-0766-4a35-b21d-e03c2a9daa62',
  oidcIssuer: 'https://login.inrupt.com'
};

async function sendPatch(selectedPod, fetch) {
  const docUrl = `${selectedPod}getting-started/test.ttl`;
  const response = await fetch(docUrl, {
    method: "PATCH",
    headers: {
      "Content-Type": "text/n3",
    },
    body:
      "@prefix solid: <http://www.w3.org/ns/solid/terms#>.\n" +
      "<#patch> a solid:InsertDeletePatch;\n" +
      "  solid:inserts { <#hello> <#linked> <#world> .}.\n",
  });
  console.log(response.status, await response.text());
}

async function getProfileDoc(fetch, info) {
  const response = await fetch(info.webId);
  const text = await response.text();
  console.log(text);
}

async function runTest() {
  const session = new Session();
  await session.login(SECRET);
  if (session.info.isLoggedIn) {
    await getProfileDoc(session.fetch, session.info);
    console.log('getting pod url', session.info.webId);
    const mypods = await getPodUrlAll(session.info.webId, { fetch: session.fetch });
    console.log('pod urls', mypods);
    await sendPatch(mypods[0], session.fetch);
  }
  session.logout();
  console.log("done");
}
// ...
runTest();
