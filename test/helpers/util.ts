const rdf = require('rdflib');

function isContainer(url) {
  return (url.substr(-1) === '/');
}

function getStore(authFetcher) {
  var store = (module.exports = rdf.graph()) // Make a Quad store
  rdf.fetcher(store, { fetch: authFetcher.fetch.bind(authFetcher) }) // Attach a web I/O module, store.fetcher
  store.updater = new rdf.UpdateManager(store) // Add real-time live updates store.updater
  return store;
}
async function getContainerMembers(containerUrl, authFetcher) {
  const store = getStore(authFetcher);
  await store.fetcher.load(store.sym(containerUrl));
  console.log('done!');
  // console.log(store.each());
  return store.statementsMatching(store.sym(containerUrl), store.sym('http://www.w3.org/ns/ldp#contains')).map(st => {
    // console.log('seeing', st);
    return st.object.value
  });
}

export async function recursiveDelete(url, authFetcher) {
  if (isContainer(url)) {
    const containerMembers = await getContainerMembers(url, authFetcher);
    await Promise.all(containerMembers.map(recursiveDelete));
  }
  return authFetcher.fetch(url, { method: 'DELETE' });
}

