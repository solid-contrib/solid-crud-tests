import { readFileSync } from 'fs';
import { testFolderUrl } from '../helpers/global';
import { getAuthFetcher } from '../helpers/obtain-auth-headers';

const example = {
  html: readFileSync('test/fixtures/example.html').toString(),
  turtle: readFileSync('test/fixtures/example.ttl').toString(),
  json: readFileSync('test/fixtures/example.json').toString(),
};

const triplesFromHtml = [
    [ '<_:b0>', '<http://www.w3.org/2000/01/rdf-schema#seeAlso>', '<http://dbpedia.org/resource/Adelaide>' ],
  [ '<_:b0>', '<http://www.w3.org/2000/10/swap/pim/contact#city>', 'Adelaide' ],
  [ `<${testFolderUrl}example.html>`, '<http://www.w3.org/1999/xhtml/vocab#alternate>', '<http://www.example.com/rss.xml>' ],
  [ `<${testFolderUrl}example.html>`, '<http://www.w3.org/1999/xhtml/vocab#icon>', `<${testFolderUrl}favicon.ico>` ],
  [ `<${testFolderUrl}example.html>`, '<http://www.w3.org/1999/xhtml/vocab#stylesheet>', `<${testFolderUrl}main.css>` ],
  [ `<${testFolderUrl}example.html>`, '<http://www.w3.org/2000/01/rdf-schema#seeAlso>', `<${testFolderUrl}about.htm>` ],
  [ `<${testFolderUrl}example.html>`, '<http://www.w3.org/2000/10/swap/pim/contact#address>', '<_:b0>' ],
  [ `<${testFolderUrl}example.html>`, '<http://xmlns.com/foaf/0.1/name>', 'Jerry Smith' ],
  [ `<${testFolderUrl}example.html>`, '<http://xmlns.com/foaf/0.1/phone>', '<tel:+6112345678>' ],
  [ `<${testFolderUrl}example.html>`, '<http://xmlns.com/foaf/0.1/primaryTopic>', '<http://www.example.com/metadata/foaf.rdf>' ],
];

const triplesFromTurtle = [
  [ `<${testFolderUrl}example.ttl#hello>`, `<${testFolderUrl}example.ttl#linked>`, `<${testFolderUrl}example.ttl#world>` ]
];

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
    // const containerMembers = await getContainerMembers(testFolderUrl);
    // await Promise.all(containerMembers.map(url => authFetcher.fetch(url, { method: 'DELETE' })))
    // await authFetcher.fetch(testFolderUrl, { method: 'DELETE' })
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
    return store.statementsMatching(store.sym(containerUrl), store.sym('http://www.w3.org/ns/ldp#contains')).map(st => st.object.value);
  }
  async function getAs(url, type) {
    const fetchResult = await authFetcher.fetch(url, { headers: {
      'Accept': type
    }});
    return fetchResult.text();
  }
  async function asTriples(text, url, type) {
    const store = getStore();
    await new Promise((resolve, reject) => {
      try {
        rdf.parse(text, store, url, type, resolve);
      } catch (e) {
        reject(e);
      }
    });
    function allBlanksAsZero(str) {
      if (str.startsWith('_:') || str.startsWith('<_:')) {
        return '<_:b0>'
      }
      return str;
    }
    return store.statements.map(st => [
      allBlanksAsZero(st.subject.toString()),
      allBlanksAsZero(st.predicate.toString()),
      allBlanksAsZero(st.object.toString()) 
    ]).sort();
  }
  describe('Get RDFa', () => {
    describe("As JSON-LD", () => {
      let jsonText
      beforeAll(async () => {
        jsonText = await getAs(`${testFolderUrl}example.html`, 'application/ld+json');    
      })
      test("JSON content", async () => {
        const obj = JSON.parse(jsonText);
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
      test("Triples", async () => {
        const triples = await asTriples(jsonText, `${testFolderUrl}example.html`, 'application/ld+json');    
        expect(triples).toEqual(triplesFromHtml);
      });
    });
    describe("As Turtle", () => {
      let text;
      beforeAll(async() => {
        text = await getAs(`${testFolderUrl}example.html`, 'text/turtle');
      });
      test("Turtle content", async () => {
        expect(text).toEqual(`@prefix : <#>.
@prefix voc: <http://www.w3.org/1999/xhtml/vocab#>.
@prefix rd: <http://www.w3.org/2000/01/rdf-schema#>.
@prefix cont: <http://www.w3.org/2000/10/swap/pim/contact#>.
@prefix res: <http://dbpedia.org/resource/>.
@prefix n0: <http://xmlns.com/foaf/0.1/>.

<>
    voc:alternate <http://www.example.com/rss.xml>;
    voc:icon <favicon.ico>;
    voc:stylesheet <main.css>;
    rd:seeAlso <about.htm>;
    cont:address [ rd:seeAlso res:Adelaide; cont:city "Adelaide"@en ];
    n0:name "Jerry Smith"@en;
    n0:phone <tel:+6112345678>;
    n0:primaryTopic <http://www.example.com/metadata/foaf.rdf>.
`);
      });
      test("Triples", async () => {
        const triples = await asTriples(text, `${testFolderUrl}example.html`, 'text/turtle');    
        expect(triples).toEqual(triplesFromHtml);
      });
    });
  });
  describe('GET Turtle', () => {
    describe("As JSON-LD", () => {
      let jsonText;
      beforeAll(async () => {
        jsonText = await getAs(`${testFolderUrl}example.ttl`, 'application/ld+json');
      });
      test("JSON content", async () => {
        const obj = JSON.parse(jsonText);
        expect(obj).toEqual([
          {
            "@id": `${testFolderUrl}example.ttl#hello`,
            [`${testFolderUrl}example.ttl#linked`]: [
              {
                "@id": `${testFolderUrl}example.ttl#world`,
              },
            ],
          },
        ]);
      });
      test("Triples", async () => {
        const triples = await asTriples(jsonText, `${testFolderUrl}example.ttl`, 'application/ld+json');    
        expect(triples).toEqual(triplesFromTurtle);
      });
    });
    describe("As Turtle", () => {
      let text;
      beforeAll(async () =>{
        text = await getAs(`${testFolderUrl}example.ttl`, 'text/turtle');    
      });
      test("Turtle content", async () => {
        expect(text).toEqual('<#hello> <#linked> <#world> .\n');
      });
      test("Triples", async () => {
        const triples = await asTriples(text, `${testFolderUrl}example.ttl`, 'text/turtle');    
        expect(triples).toEqual(triplesFromTurtle);
      });
    });
  });
  describe('GET JSON-LD', () => {
    describe("As JSON-LD", () => {
      let jsonText;
      beforeAll(async () => {
        jsonText = await getAs(`${testFolderUrl}example.json`, 'application/ld+json');
      });
      test("JSON content", async () => {
        console.log(jsonText);
        const obj = JSON.parse(jsonText);
        expect(obj).toEqual([
          {
            "@id": "http://store.example.com/",
            "@type": "Store",
            "name": "Links Bike Shop",
            "description": "The most \"linked\" bike store on earth!"
          },
        ]);
      });
      test("Triples", async () => {
        const triples = await asTriples(jsonText, `${testFolderUrl}example.json`, 'application/ld+json');    
        expect(triples).toEqual([]);
      });
    });
    describe("As Turtle", () => {
      let text;
      beforeAll(async () =>{
        text = await getAs(`${testFolderUrl}example.json`, 'text/turtle');    
      });
      test("Turtle content", async () => {
        console.log(text);
        expect(text).toEqual('<http://store.example.com/> a  <Store> .\n');
      });
      test("Triples", async () => {
        const triples = await asTriples(text, `${testFolderUrl}example.ttl`, 'text/turtle');    
        expect(triples).toEqual([]);
      });
    });
  });
});