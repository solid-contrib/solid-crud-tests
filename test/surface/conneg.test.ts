import { readFileSync } from "fs";
import {
  generateTestFolder,
  oidcIssuer,
  cookie,
  appOrigin,
} from "../helpers/env";
import { getAuthFetcher } from "solid-auth-fetcher";
import { recursiveDelete } from "../helpers/util";
import * as rdflib from "rdflib";

const example = {
  html: readFileSync("test/fixtures/example.html").toString(),
  turtle: readFileSync("test/fixtures/example.ttl").toString(),
  json: readFileSync("test/fixtures/example.json").toString(),
};

const { testFolderUrl } = generateTestFolder();

const triplesFromHtml = [
  [
    "<_:b0>",
    "<http://www.w3.org/2000/01/rdf-schema#seeAlso>",
    "<http://dbpedia.org/resource/Adelaide>",
  ],
  ["<_:b0>", "<http://www.w3.org/2000/10/swap/pim/contact#city>", "Adelaide"],
  [
    `<${testFolderUrl}example.html>`,
    "<http://www.w3.org/2000/01/rdf-schema#seeAlso>",
    `<${testFolderUrl}about.htm>`,
  ],
  [
    `<${testFolderUrl}example.html>`,
    "<http://www.w3.org/2000/10/swap/pim/contact#address>",
    "<_:b0>",
  ],
  [
    `<${testFolderUrl}example.html>`,
    "<http://xmlns.com/foaf/0.1/name>",
    "Jerry Smith",
  ],
  [
    `<${testFolderUrl}example.html>`,
    "<http://xmlns.com/foaf/0.1/phone>",
    "<tel:+6112345678>",
  ],
  [
    `<${testFolderUrl}example.html>`,
    "<http://xmlns.com/foaf/0.1/primaryTopic>",
    "<http://www.example.com/metadata/foaf.rdf>",
  ],
];

const triplesFromTurtle = [
  [
    `<${testFolderUrl}example.ttl#hello>`,
    `<${testFolderUrl}example.ttl#linked>`,
    `<${testFolderUrl}example.ttl#world>`,
  ],
];

describe("Alice's pod", () => {
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher(oidcIssuer, cookie, appOrigin);
    await authFetcher.fetch(`${testFolderUrl}example.ttl`, {
      method: "PUT",
      headers: {
        "Content-Type": "text/turtle",
      },
      body: example.turtle,
    });
    await authFetcher.fetch(`${testFolderUrl}example.json`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/ld+json",
      },
      body: example.json,
    });
    await authFetcher.fetch(`${testFolderUrl}example.html`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/xhtml+xml; charset=utf-8",
      },
      body: example.html,
    });
  });
  afterAll(() => recursiveDelete(testFolderUrl, authFetcher));

  function getStore() {
    const store = (module.exports = rdflib.graph()); // Make a Quad store
    rdflib.fetcher(store, { fetch: authFetcher.fetch.bind(authFetcher) }); // Attach a web I/O module, store.fetcher
    store.updater = new rdflib.UpdateManager(store); // Add real-time live updates store.updater
    return store;
  }
  async function getAs(url, type) {
    const fetchResult = await authFetcher.fetch(url, {
      headers: {
        Accept: type,
      },
    });
    return fetchResult.text();
  }
  async function asTriples(text, url, type) {
    const store = getStore();
    await new Promise((resolve, reject) => {
      try {
        rdflib.parse(text, store, url, type, resolve);
      } catch (e) {
        reject(e);
      }
    });
    function allBlanksAsZero(str) {
      if (str.startsWith("_:") || str.startsWith("<_:")) {
        return "<_:b0>";
      }
      return str;
    }
    return store.statements
      .map((st) => [
        allBlanksAsZero(st.subject.toString()),
        allBlanksAsZero(st.predicate.toString()),
        allBlanksAsZero(st.object.toString()),
      ])
      .sort();
  }
  describe("Get RDFa", () => {
    describe("As JSON-LD", () => {
      let jsonText;
      beforeAll(async () => {
        jsonText = await getAs(
          `${testFolderUrl}example.html`,
          "application/ld+json"
        );
      });
      test("JSON content", async () => {
        const obj = JSON.parse(jsonText);
        expect(obj).toHaveLength(2);
        const address = obj.find((item) => item["@id"] !== `${testFolderUrl}example.html`);
        const example = obj.find((item) => item["@id"] === `${testFolderUrl}example.html`);
        expect(address).toEqual({
          "@id": obj[0]["@id"],
          "http://www.w3.org/2000/01/rdf-schema#seeAlso": [
            {
              "@id": "http://dbpedia.org/resource/Adelaide",
            },
          ],
          "http://www.w3.org/2000/10/swap/pim/contact#city": [
            {
              "@value": "Adelaide",
              "@language": "en",
            },
          ],
        });

        expect(example).toContainEntries(
          Object.entries({
            "@id": `${testFolderUrl}example.html`,
            "http://www.w3.org/2000/01/rdf-schema#seeAlso": [
              {
                "@id": `${testFolderUrl}about.htm`,
              },
            ],
            "http://www.w3.org/2000/10/swap/pim/contact#address": [
              {
                "@id": obj[0]["@id"],
              },
            ],
            "http://xmlns.com/foaf/0.1/name": [
              {
                "@value": "Jerry Smith",
                "@language": "en",
              },
            ],
            "http://xmlns.com/foaf/0.1/phone": [
              {
                "@id": "tel:+6112345678",
              },
            ],
            "http://xmlns.com/foaf/0.1/primaryTopic": [
              {
                "@id": "http://www.example.com/metadata/foaf.rdf",
              },
            ],
          })
        );
      });
      test("Triples", async () => {
        const triples = await asTriples(
          jsonText,
          `${testFolderUrl}example.html`,
          "application/ld+json"
        );
        expect(triples).toIncludeAllMembers(triplesFromHtml);
      });
    });
    describe("As Turtle", () => {
      let text;
      beforeAll(async () => {
        text = await getAs(`${testFolderUrl}example.html`, "text/turtle");
      });
      test("Turtle content", async () => {
        const store1 = getStore();
        const store2 = getStore();

        rdflib.parse(
          `@prefix : <#>.
		@prefix rd: <http://www.w3.org/2000/01/rdf-schema#>.
		@prefix cont: <http://www.w3.org/2000/10/swap/pim/contact#>.
		@prefix res: <http://dbpedia.org/resource/>.
		@prefix n0: <http://xmlns.com/foaf/0.1/>.

		<>
		n0:primaryTopic <http://www.example.com/metadata/foaf.rdf>;
		n0:name "Jerry Smith"@en;
		rd:seeAlso <about.htm>;
		cont:address [ rd:seeAlso res:Adelaide; cont:city "Adelaide"@en ];
		n0:phone <tel:+6112345678>.
		`,
          store1,
          `${testFolderUrl}example.html`,
          "text/turtle"
        );
        rdflib.parse(
          text,
          store2,
          `${testFolderUrl}example.html`,
          "text/turtle"
        );
        const store1Array = store1
          .statementsMatching()
          .map((item) => item.toString().replace(/_:_g_L[^\s]+/g, "_:g_Lxxxx"));
        const store2Array = store2
          .statementsMatching()
          .map((item) => item.toString().replace(/_:_g_L[^\s]+/g, "_:g_Lxxxx"));
        expect(store2Array).toIncludeAllMembers(store1Array);
      });
      test("Triples", async () => {
        const triples = await asTriples(
          text,
          `${testFolderUrl}example.html`,
          "text/turtle"
        );
        expect(triples).toIncludeAllMembers(triplesFromHtml);
      });
    });
  });
  describe("GET Turtle", () => {
    describe("As JSON-LD", () => {
      let jsonText;
      beforeAll(async () => {
        jsonText = await getAs(
          `${testFolderUrl}example.ttl`,
          "application/ld+json"
        );
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
        const triples = await asTriples(
          jsonText,
          `${testFolderUrl}example.ttl`,
          "application/ld+json"
        );
        expect(triples).toEqual(triplesFromTurtle);
      });
    });
    describe("As Turtle", () => {
      let text;
      beforeAll(async () => {
        text = await getAs(`${testFolderUrl}example.ttl`, "text/turtle");
      });
      test("Turtle content", async () => {
        expect(text).toEqual("<#hello> <#linked> <#world> .\n");
      });
      test("Triples", async () => {
        const triples = await asTriples(
          text,
          `${testFolderUrl}example.ttl`,
          "text/turtle"
        );
        expect(triples).toEqual(triplesFromTurtle);
      });
    });
  });
  describe("GET JSON-LD", () => {
    describe("As JSON-LD", () => {
      let jsonText;
      beforeAll(async () => {
        jsonText = await getAs(
          `${testFolderUrl}example.json`,
          "application/ld+json"
        );
      });
      test("JSON content", async () => {
        const obj = JSON.parse(jsonText);
        expect(obj).toEqual({
          "@context": {
            Store: "http://store.example.com/Store",
            description: "http://store.example.com/description",
            name: "http://store.example.com/name",
          },
          "@id": "http://store.example.com/",
          "@type": "Store",
          name: "Links Bike Shop",
          description: 'The most "linked" bike store on earth!',
        });
      });
      // FIXME: the asTriples function doesn't handle the jsonLD with context properly, so this test is removed for now.
      /*
      test("Triples", async () => {
		// let contextRemoved = JSON.parse(jsonText);
		// delete contextRemoved["@context"];
		// jsonText = JSON.stringify(contextRemoved);
		const triples = await asTriples(jsonText, `${testFolderUrl}example.json`, 'application/ld+json');

        expect(triples).toEqual([
          [ '<http://store.example.com/>', '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>', 'Store' ],
          [ '<http://store.example.com/>', `<${testFolderUrl}description>`, 'The most \"linked\" bike store on earth!' ],
          [ '<http://store.example.com/>', `<${testFolderUrl}name>`, 'Links Bike Shop' ],
        ]);
      });
	  */
    });
    describe("As Turtle", () => {
      let text;
      beforeAll(async () => {
        text = await getAs(`${testFolderUrl}example.json`, "text/turtle");
      });
      it.skip("Turtle content", async () => {
        const store1 = getStore();
        const store2 = getStore();

        // FIXME: this test fails because of 2 things:
        // 1. the blank node (cont:address) will get a different number in both parses;
        // 2. The ordering of the nodes is different, which makes the string result different as well.
        const expected = `
@prefix : <#>.
@prefix sto: <http://store.example.com/>.

sto:
    a sto:Store;
    sto:description
        """The most "linked" bike store on earth!""";
    sto:name "Links Bike Shop".
`;
        rdflib.parse(
          expected,
          store1,
          `${testFolderUrl}example.json`,
          "text/turtle"
        );
        rdflib.parse(
          text,
          store2,
          `${testFolderUrl}example.json`,
          "text/turtle"
        );

        const store1String = store1
          .toString()
          .replace(/_:_g_L[^\s]+/g, "_:g_Lxxxx");
        const store2String = store2
          .toString()
          .replace(/_:_g_L[^\s]+/g, "_:g_Lxxxx");
        expect(store2String).toEqual(store1String);
      });
      it.skip("Triples", async () => {
        const triples = await asTriples(
          text,
          `${testFolderUrl}example.ttl`,
          "text/turtle"
        );
        const sortByProperty = function (a, b) {
          if (a[1] > b[1]) {
            return 1;
          } else if (a[1] < b[1]) {
            return -1;
          } else {
            return 0;
          }
        };
        const sortedTriples = JSON.parse(JSON.stringify(triples)).sort(
          sortByProperty
        );
        expect(sortedTriples).toEqual(
          [
            [
              "<http://store.example.com/>",
              "<http://store.example.com/name>",
              "Links Bike Shop",
            ],
            [
              "<http://store.example.com/>",
              "<http://store.example.com/description>",
              'The most "linked" bike store on earth!',
            ],
            [
              "<http://store.example.com/>",
              "<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>",
              "<http://store.example.com/Store>",
            ],
          ].sort(sortByProperty)
        );
      });
    });
  });
});
