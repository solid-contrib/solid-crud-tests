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
  function getStore() {
    const store = (module.exports = rdflib.graph()); // Make a Quad store
    rdflib.fetcher(store, { fetch: authFetcher.fetch.bind(authFetcher) }); // Attach a web I/O module, store.fetcher
    store.updater = new rdflib.UpdateManager(store); // Add real-time live updates store.updater
    return store;
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

  async function getAs(url, type) {
    const fetchResult = await authFetcher.fetch(url, {
      headers: {
        Accept: type,
      },
    });
    return fetchResult.text();
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
      test("Triples", async () => {
        const triples = await asTriples(
          jsonText,
          `${testFolderUrl}example.ttl`,
          "application/ld+json"
        );
        expect(triples).toEqual(expect.arrayContaining(triplesFromTurtle));
      });
    });
    describe("As Turtle", () => {
      let text;
      beforeAll(async () => {
        text = await getAs(`${testFolderUrl}example.ttl`, "text/turtle");
      });
      test("Triples", async () => {
        const triples = await asTriples(
          text,
          `${testFolderUrl}example.ttl`,
          "text/turtle"
        );
        expect(triples).toEqual(expect.arrayContaining(triplesFromTurtle));
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
      test("Triples", async () => {
        const triples = await asTriples(
          jsonText,
          `${testFolderUrl}example.html`,
          "application/ld+json"
        );
        expect(triples).toEqual(
          expect.arrayContaining([
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
          ])
        );
      });
    });
    describe("As Turtle", () => {
      let text;
      beforeAll(async () => {
        text = await getAs(`${testFolderUrl}example.json`, "text/turtle");
      });
      test("Triples", async () => {
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
          expect.arrayContaining([
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
          ])
        );
      });
    });
  });
});
