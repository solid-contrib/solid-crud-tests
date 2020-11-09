import { generateTestFolder, oidcIssuer, cookie, appOrigin } from '../helpers/env';
import { getAuthFetcher } from 'solid-auth-fetcher';
import { recursiveDelete, getContainerMembers, WPSClient, responseCodeGroup } from '../helpers/util';
import { getStore } from "../helpers/util";
const rdflib = require('rdflib');
const waittime = 1000;
// when the tests start, exists/exists.ttl exists in the test folder,
// and nothing else.

describe('Update', () => {
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher(oidcIssuer, cookie, appOrigin);
  });
  describe('Using PUT (same content type)', () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: 'PUT',
        body: '<#hello> <#linked> <#world> .',
        headers: {
          'Content-Type': 'text/turtle'
        }
      });
	  await new Promise(resolve => setTimeout(resolve, waittime));
      const getResult = await authFetcher.fetch(resourceUrl);
      const resourceETagInQuotes = getResult.headers.get('ETag');
      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(resourceUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/turtle',
          'If-Match': resourceETagInQuotes
        },
        body: '<#replaced> <#the> <#contents> .'
      });
	  await new Promise(resolve => setTimeout(resolve, waittime));
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it('updates the resource', async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual('2xx');

      let store1 = getStore(authFetcher);
      let store2 = getStore(authFetcher);

      rdflib.parse('<#replaced> <#the> <#contents> .', store1, resourceUrl, "text/turtle");
      rdflib.parse(await result.text(), store2, resourceUrl, "text/turtle");

      expect(store2.toString()).toEqual(store1.toString());
      expect(result.headers.get('Content-Type')).toContain('text/turtle');
    });
    it('emits websockets-pubsub on the resource', () => {
      expect(websocketsPubsubClientResource.received).toEqual([
        `ack ${resourceUrl}`,
        `pub ${resourceUrl}`
      ]);
    });
    afterAll(() => recursiveDelete(location, authFetcher));
  });

  describe('Using PUT (different content type)', () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.txt`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: 'PUT',
        body: '<#hello> <#linked> <#world> .',
        headers: {
          'Content-Type': 'text/turtle'
        }
      });
	  await new Promise(resolve => setTimeout(resolve, waittime));
      const getResult = await authFetcher.fetch(resourceUrl);
      const resourceETagInQuotes = getResult.headers.get('ETag');
      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(resourceUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'text/plain',
          'If-Match': resourceETagInQuotes
        },
        body: 'replaced'
      });
	  await new Promise(resolve => setTimeout(resolve, waittime));
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it('updates the resource', async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual('2xx');
      expect(await result.text()).toEqual('replaced');
      expect(result.headers.get('Content-Type')).toContain('text/plain');
    });
    it('emits websockets-pubsub on the resource', () => {
      expect(websocketsPubsubClientResource.received).toEqual([
        `ack ${resourceUrl}`,
        `pub ${resourceUrl}`
      ]);
    });
    afterAll(() => recursiveDelete(location, authFetcher));
  });

  describe('Using PATCH to add triple', () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: 'PUT',
        body: '<#hello> <#linked> <#world> .',
        headers: {
          'Content-Type': 'text/turtle'
        }
      });
	  await new Promise(resolve => setTimeout(resolve, waittime));

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(resourceUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/sparql-update'
        },
        body: 'INSERT DATA { <#that> a <#fact> . }'
      });
	  await new Promise(resolve => setTimeout(resolve, waittime));
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it('updates the resource', async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual('2xx');

      let store1 = getStore(authFetcher);
      let store2 = getStore(authFetcher);

      rdflib.parse('@prefix : <#>.\n\n:hello :linked :world.\n\n:that a :fact.\n\n', store1, resourceUrl, "text/turtle");
      rdflib.parse(await result.text(), store2, resourceUrl, "text/turtle");

      expect(store2.toString()).toEqual(store1.toString());
      expect(result.headers.get('Content-Type')).toContain('text/turtle');
    });
    it('emits websockets-pubsub on the resource', () => {
      expect(websocketsPubsubClientResource.received).toEqual([
        `ack ${resourceUrl}`,
        `pub ${resourceUrl}`
      ]);
    });
    afterAll(() => recursiveDelete(location, authFetcher));
  });
  describe('Using PATCH to replace triple (present)', () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: 'PUT',
        body: '<#hello> <#linked> <#world> .',
        headers: {
          'Content-Type': 'text/turtle'
        }
      });
	  await new Promise(resolve => setTimeout(resolve, waittime));

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(resourceUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/sparql-update'
        },
        body: 'DELETE DATA { <#hello> <#linked> <#world> . }\nINSERT DATA { <#that> a <#fact> . }'
      });
	  await new Promise(resolve => setTimeout(resolve, waittime));
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it('updates the resource', async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual('2xx');

      let store1 = getStore(authFetcher);
      let store2 = getStore(authFetcher);

      rdflib.parse('@prefix : <#>.\n\n:that a :fact.\n\n', store1, resourceUrl, "text/turtle");
      rdflib.parse(await result.text(), store2, resourceUrl, "text/turtle");

      expect(store2.toString()).toEqual(store1.toString());
      expect(result.headers.get('Content-Type')).toContain('text/turtle');
    });
    it('emits websockets-pubsub on the resource', () => {
      expect(websocketsPubsubClientResource.received).toEqual([
        `ack ${resourceUrl}`,
        `pub ${resourceUrl}`
      ]);
    });
    afterAll(() => recursiveDelete(location, authFetcher));
  });
  describe('Using PATCH to replace triple (not present)', () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: 'PUT',
        body: '<#hello> <#linked> <#world> .',
        headers: {
          'Content-Type': 'text/turtle'
        }
      });

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(resourceUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/sparql-update'
        },
        body: 'DELETE DATA { <#something> <#completely> <#different> . }\nINSERT DATA { <#that> a <#fact> . }'
      });
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it('does not update the resource', async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual('2xx');

      let store1 = getStore(authFetcher);
      let store2 = getStore(authFetcher);

      rdflib.parse('<#hello> <#linked> <#world> .', store1, resourceUrl, "text/turtle");
      rdflib.parse(await result.text(), store2, resourceUrl, "text/turtle");

      console.log(resourceUrl);
      expect(store2.toString()).toEqual(store1.toString());
      expect(result.headers.get('Content-Type')).toContain('text/turtle');
    });
    it('does not emit websockets-pubsub on the resource', () => {
      expect(websocketsPubsubClientResource.received).toEqual([
        `ack ${resourceUrl}`
      ]);
    });
    afterAll(() => recursiveDelete(location, authFetcher));
  });
  describe('Using PATCH to remove triple (present)', () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: 'PUT',
        body: '<#hello> <#linked> <#world> .',
        headers: {
          'Content-Type': 'text/turtle'
        }
      });

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(resourceUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/sparql-update'
        },
        body: 'DELETE DATA { <#hello> <#linked> <#world> . }'
      });
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it('updates the resource', async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual('2xx');
      let store1 = getStore(authFetcher);
      let store2 = getStore(authFetcher);

      rdflib.parse('@prefix : <#>.', store1, resourceUrl, "text/turtle");
      rdflib.parse(await result.text(), store2, resourceUrl, "text/turtle");

      expect(store2.toString()).toEqual(store1.toString());
      expect(result.headers.get('Content-Type')).toContain('text/turtle');
    });
    it('emits websockets-pubsub on the resource', () => {
      expect(websocketsPubsubClientResource.received).toEqual([
        `ack ${resourceUrl}`,
        `pub ${resourceUrl}`
      ]);
    });
    afterAll(() => recursiveDelete(location, authFetcher));
  });
  describe('Using PATCH to remove triple (not present)', () => {
    const { testFolderUrl } = generateTestFolder();
    let websocketsPubsubClientResource;
    const containerUrl = `${testFolderUrl}exists/`;
    const resourceUrl = `${containerUrl}exists.ttl`;

    beforeAll(async () => {
      // this already relies on the PUT to non-existing folder functionality
      // that will be one of the tested behaviours:
      await authFetcher.fetch(resourceUrl, {
        method: 'PUT',
        body: '<#hello> <#linked> <#world> .',
        headers: {
          'Content-Type': 'text/turtle'
        }
      });

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(resourceUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/sparql-update'
        },
        body: 'DELETE DATA { <#something> <#completely> <#different> . }'
      });
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it('does not update the resource', async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual('2xx');
      let store1 = getStore(authFetcher);
      let store2 = getStore(authFetcher);

      rdflib.parse('<#hello> <#linked> <#world> .', store1, resourceUrl, "text/turtle");
      rdflib.parse(await result.text(), store2, resourceUrl, "text/turtle");

      expect(store2.toString()).toEqual(store1.toString());
      expect(result.headers.get('Content-Type')).toContain('text/turtle');
    });
    it('does not emit websockets-pubsub on the resource', () => {
      expect(websocketsPubsubClientResource.received).toEqual([
        `ack ${resourceUrl}`
      ]);
    });
    afterAll(() => recursiveDelete(location, authFetcher));
  });
});
