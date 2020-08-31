import { readFileSync } from 'fs';
import { testFolderUrl } from '../helpers/global';
import { getAuthFetcher } from '../helpers/obtain-auth-headers';

const example = {
  html: readFileSync('test/fixtures/example.html'),
  turtle: readFileSync('test/fixtures/example.ttl'),
  json: readFileSync('test/fixtures/example.json'),
};

var rdf = require('rdflib')

describe('Alice\'s pod', () => {
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher();
    await authFetcher.fetch(`${testFolderUrl}example.ttl`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/turtle',
      },
      body: example.turtle
    });
    await authFetcher.fetch(`${testFolderUrl}example.json`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json+;d',
      },
      body: example.json
    });
    await authFetcher.fetch(`${testFolderUrl}example.html`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/xhtml+xml; charset=utf-8',
      },
      body: example.html
    });
  });
  afterAll(async () => {
    const containerMembers = await getContainerMembers(testFolderUrl);
    await Promise.all(containerMembers.map(url => authFetcher.fetch(url, { method: 'DELETE' })))
    await authFetcher.fetch(testFolderUrl, { method: 'DELETE' })
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
    return fetchResult.text();
    // let text = await fetchResult.text();
    // // Trying to get it working with JSON-LD:
    // if (type === 'application/ld+json') {
    //   text = `
    //   {
    //     {
    //       "@id": {
    //         "termType": "NamedNode",
    //         "value": "#owner"
    //       },
    //       "[object Object]": {
    //         "termType": "NamedNode",
    //         "value": "http://www.w3.org/ns/auth/acl#Authorization"
    //       }
    //     }
    //     ,
    //     {
    //       "@id": {
    //         "termType": "NamedNode",
    //         "value": "#owner"
    //       },
    //       "[object Object]": {
    //         "termType": "NamedNode",
    //         "value": "https://localhost:8443/profile/card#me"
    //       }
    //     }
    //     ,
    //     {
    //       "@id": {
    //         "termType": "NamedNode",
    //         "value": "#owner"
    //       },
    //       "[object Object]": {
    //         "termType": "NamedNode",
    //         "value": "/"
    //       }
    //     }
    //     ,
    //     {
    //       "@id": {
    //         "termType": "NamedNode",
    //         "value": "#owner"
    //       },
    //       "[object Object]": {
    //         "termType": "NamedNode",
    //         "value": "/"
    //       }
    //     }
    //     ,
    //     {
    //       "@id": {
    //         "termType": "NamedNode",
    //         "value": "#owner"
    //       },
    //       "[object Object]": {
    //         "termType": "NamedNode",
    //         "value": "http://www.w3.org/ns/auth/acl#Read"
    //       }
    //     }
    //     ,
    //     {
    //       "@id": {
    //         "termType": "NamedNode",
    //         "value": "#owner"
    //       },
    //       "[object Object]": {
    //         "termType": "NamedNode",
    //         "value": "http://www.w3.org/ns/auth/acl#Write"
    //       }
    //     }
    //     ,
    //     {
    //       "@id": {
    //         "termType": "NamedNode",
    //         "value": "#owner"
    //       },
    //       "[object Object]": {
    //         "termType": "NamedNode",
    //         "value": "http://www.w3.org/ns/auth/acl#Control"
    //       }
    //     }
    //     }`;
    // }
    // const store = getStore();
    // console.log('Parsing!', text);
    // await new Promise((resolve, reject) => {
    //   try {
    //     rdf.parse(text, store, url, type, resolve);
    //     if (type === 'application/ld+json') {
    //       console.log('parsed!', store.statements);
    //     }
    //   } catch (e) {
    //     reject(e);
    //   }
    // });
    // console.log("parsed", type, store.each())
    // return store;
  }
  test("GET Turtle as JSON-LD/Turtle", async () => {
    const asJson = await getAs(`${testFolderUrl}example.html`, 'application/ld+json');    
    const obj = JSON.parse(asJson);
    expect(obj).toEqual([
      {
        "@id": obj[0]['@id'],
        "http://www.w3.org/2000/01/rdf-schema#seeAlso": [
          {
            "@id": "http://dbpedia.org/resource/Adelaide"
          }
        ],
        "http://www.w3.org/2000/10/swap/pim/contact#city": [
          {
            "@value": "Adelaide",
            "@language": "en"
          }
        ]
      },
      {
        "@id": `${testFolderUrl}example.html`,
        "http://www.w3.org/1999/xhtml/vocab#alternate": [
          {
            "@id": "http://www.example.com/rss.xml"
          }
        ],
        "http://www.w3.org/1999/xhtml/vocab#icon": [
          {
            "@id": `${testFolderUrl}favicon.ico`
          }
        ],
        "http://www.w3.org/1999/xhtml/vocab#stylesheet": [
          {
            "@id": `${testFolderUrl}main.css`
          }
        ],
        "http://www.w3.org/2000/01/rdf-schema#seeAlso": [
          {
            "@id": `${testFolderUrl}about.htm`
          }
        ],
        "http://www.w3.org/2000/10/swap/pim/contact#address": [
          {
            "@id": obj[0]['@id']
          }
        ],
        "http://xmlns.com/foaf/0.1/name": [
          {
            "@value": "Jerry Smith",
            "@language": "en"
          }
        ],
        "http://xmlns.com/foaf/0.1/phone": [
          {
            "@id": "tel:+6112345678"
          }
        ],
        "http://xmlns.com/foaf/0.1/primaryTopic": [
          {
            "@id": "http://www.example.com/metadata/foaf.rdf"
          }
        ]
      }
    ]);
  });
});