import { generateTestFolder } from '../helpers/global';
import { getAuthFetcher } from '../helpers/obtain-auth-headers';
import { recursiveDelete, getContainerMembers, WPSClient, responseCodeGroup } from '../helpers/util';

// when the tests start, exists/exists.ttl exists in the test folder,
// and nothing else.

jest.setTimeout(parseInt(process.env.JEST_TIMEOUT, 10) || 5000);

describe('Update', () => {
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher();
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
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it('updates the resource', async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual('2xx');
      // FIXME: use rdflib to check just the semantics, not the syntax here:
      expect(await result.text()).toEqual('<#replaced> <#the> <#contents> .');
      expect(result.headers.get('Content-Type')).toEqual('text/turtle');
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
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it('updates the resource', async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual('2xx');
      // FIXME: use rdflib to check just the semantics, not the syntax here:
      expect(await result.text()).toEqual('replaced');
      expect(result.headers.get('Content-Type')).toEqual('text/plain');
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

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(resourceUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/sparql-update'
        },
        body: 'INSERT DATA { <#that> a <#fact> . }'
      });
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it('updates the resource', async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual('2xx');
      // FIXME: use rdflib to check just the semantics, not the syntax here:
      expect(await result.text()).toEqual('@prefix : <#>.\n\n:hello :linked :world.\n\n:that a :fact.\n\n');
      expect(result.headers.get('Content-Type')).toEqual('text/turtle');
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

      websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
      await websocketsPubsubClientResource.getReady();
      const result = await authFetcher.fetch(resourceUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/sparql-update'
        },
        body: 'DELETE DATA { <#hello> <#linked> <#world> . }\nINSERT DATA { <#that> a <#fact> . }'
      });
    });

    afterAll(() => {
      websocketsPubsubClientResource.disconnect();
      recursiveDelete(testFolderUrl, authFetcher);
    });

    it('updates the resource', async () => {
      const result = await authFetcher.fetch(resourceUrl);
      expect(responseCodeGroup(result.status)).toEqual('2xx');
      // FIXME: use rdflib to check just the semantics, not the syntax here:
      expect(await result.text()).toEqual('@prefix : <#>.\n\n:that a :fact.\n\n');
      expect(result.headers.get('Content-Type')).toEqual('text/turtle');
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
      // FIXME: use rdflib to check just the semantics, not the syntax here:
      expect(await result.text()).toEqual('<#hello> <#linked> <#world> .');
      expect(result.headers.get('Content-Type')).toEqual('text/turtle');
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
      // FIXME: use rdflib to check just the semantics, not the syntax here:
      expect(await result.text()).toEqual('@prefix : <#>.\n\n');
      expect(result.headers.get('Content-Type')).toEqual('text/turtle');
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
      // FIXME: use rdflib to check just the semantics, not the syntax here:
      expect(await result.text()).toEqual('<#hello> <#linked> <#world> .');
      expect(result.headers.get('Content-Type')).toEqual('text/turtle');
    });
    it('does not emit websockets-pubsub on the resource', () => {
      expect(websocketsPubsubClientResource.received).toEqual([
        `ack ${resourceUrl}`
      ]);
    });
    afterAll(() => recursiveDelete(location, authFetcher));
  });
});
