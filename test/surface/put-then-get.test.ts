import { getAuthFetcher } from '../helpers/obtain-auth-headers';
const { ldp } = require('solid-namespace')();

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
  test("GET /private/.acl", async () => {
    const store = getStore();
    await store.fetcher.load(store.sym(`${SERVER_ROOT}/private/.acl`));
    console.log('done!');
    console.log(store.each());

  });
  test("PUT-GET-DELETE-GET", async () => {
    const putResult = await authFetcher.fetch(`${SERVER_ROOT}/private/test.txt`, {
      method: 'PUT',
      body: 'some text',
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    expect(putResult.status).toEqual(201);
    const getResult = await authFetcher.fetch(`${SERVER_ROOT}/private/test.txt`);
    const getBody = await getResult.text();
    expect(getBody).toEqual('some text');
    const containerMembers = await getContainerMembers(`${SERVER_ROOT}/private/`);
    expect(containerMembers).toEqual([ 'https://localhost:8443/private/test.txt' ]);

    const deleteResult = await authFetcher.fetch(`${SERVER_ROOT}/private/test.txt`, {
      method: 'DELETE'
    });
    expect(deleteResult.status).toEqual(200);
    const getResult2 = await authFetcher.fetch(`${SERVER_ROOT}/private/test.txt`);
    expect(getResult2.status).toEqual(404);
  });

  test("POST-GET-DELETE-GET", async () => {
    const postResult = await authFetcher.fetch(`${SERVER_ROOT}/private/`, {
      method: 'POST',
      body: 'some text',
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    expect(postResult.status).toEqual(201);
    const location = new URL(postResult.headers.get('location'), `${SERVER_ROOT}/private/`).toString();
    expect(location.substring(0, `${SERVER_ROOT}/private/`.length)).toEqual(`${SERVER_ROOT}/private/`);
    const getResult = await authFetcher.fetch(location);
    const getBody = await getResult.text();
    expect(getBody).toEqual('some text');
    const containerMembers = await getContainerMembers(`${SERVER_ROOT}/private/`);
    expect(containerMembers).toEqual([ location ]);

    const deleteResult = await authFetcher.fetch(location, {
      method: 'DELETE'
    });
    expect(deleteResult.status).toEqual(200);
    const getResult2 = await authFetcher.fetch(location);
    expect(getResult2.status).toEqual(404);

  });
});
