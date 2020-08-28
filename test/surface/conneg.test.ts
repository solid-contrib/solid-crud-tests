import { getAuthFetcher } from '../helpers/obtain-auth-headers';

const SERVER_ROOT = process.env.SERVER_ROOT || "https://localhost:8443";
const USERNAME = process.env.USERNAME || "alice";
const PASSWORD = process.env.PASSWORD || "123";

var rdf = require('rdflib')

describe('Alice\'s pod', () => {
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher(SERVER_ROOT, USERNAME, PASSWORD);
  });
  afterAll(async () => {
    const containerMembers = await getContainerMembers(`${SERVER_ROOT}/private/`);
    await Promise.all(containerMembers.map(url => authFetcher.fetch(url, { method: 'DELETE' })))
  });

  function getStore() {
    var store = (module.exports = rdf.graph()) // Make a Quad store
    rdf.fetcher(store, { fetch: authFetcher.fetch.bind(authFetcher) }) // Attach a web I/O module, store.fetcher
    store.updater = new rdf.UpdateManager(store) // Add real-time live updates store.updater
    return store;
  }
  async function getContainerMembers(containerUrl) {
    const store = getStore();
    await store.fetcher.load(store.sym(containerUrl));
    console.log('done!');
    // console.log(store.each());
    return store.statementsMatching(store.sym(containerUrl), store.sym('http://www.w3.org/ns/ldp#contains')).map(st => {
      // console.log('seeing', st);
      return st.object.value
    });
  }
  async function getAs(url, type) {
    const fetchResult = await authFetcher.fetch(url, { headers: {
      'Accept': type
    }});
    let text = await fetchResult.text();
    // Trying to get it working with JSON-LD:
    if (type === 'application/ld+json') {
      text = `
      {
        "@context": {
          "homepage": {
            "@id": "http://xmlns.com/foaf/0.1/homepage",
            "@type": "@id"
          }
        },
        "@id": "https://localhost:8443/private/.acl#owner",
        "homepage": "xyz"
      }`;
    }
    const store = getStore();
    console.log('Parsing!', text);
    await new Promise((resolve, reject) => {
      try {
        rdf.parse(text, store, url, type, resolve);
        if (type === 'application/ld+json') {
          console.log('parsed!', store.statements);
        }
      } catch (e) {
        reject(e);
      }
    });
    console.log("parsed", type, store.each())
    return store;
  }
  test.skip("GET /private/.acl as JSON-LD/Turtle", async () => {
    const asJson = await getAs(`${SERVER_ROOT}/private/.acl`, 'application/ld+json');
    const asTurtle = await getAs(`${SERVER_ROOT}/private/.acl`, 'text/turtle');
    expect(asJson.statements).toEqual(asTurtle.statements);
  });
});