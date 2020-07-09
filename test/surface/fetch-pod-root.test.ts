import fetch from "node-fetch";
import { fetchDocument } from "tripledoc";
import { ldp, foaf, rdf, schema, vcard, solid, space } from "rdf-namespaces";

const ALICE_WEBID = process.env.ALICE_WEBID;
const SERVER_ROOT = process.env.SERVER_ROOT || "https://server";

describe("Alice's storage root", () => {
  let podRootDoc;
  let podRootSub;

  beforeAll(async () => {
    const profileDoc = await fetchDocument(ALICE_WEBID);
    // console.log(ALICE_WEBID);
    const subAlice = profileDoc.getSubject(ALICE_WEBID);
    const podRootUrl = subAlice.getRef(space.storage);
    podRootDoc = await fetchDocument(podRootUrl);
    podRootSub = podRootDoc.getSubject(podRootUrl);
  });

  test("is an ldp BasicContainer", async () => {
    const podRootTypes = podRootSub.getAllRefs(rdf.type);
    expect(podRootTypes.sort()).toEqual([
      ldp.BasicContainer,
      ldp.Container,
    ].sort());
  });

});
