import { generateTestFolder } from '../helpers/global';
import { getAuthFetcher } from '../helpers/obtain-auth-headers';
import { recursiveDelete, getContainerMembers, WPSClient, responseCodeGroup } from '../helpers/util';

// when the tests start, exists/exists.ttl exists in the test folder,
// and nothing else.

jest.setTimeout(60000);

describe('Create non-container', () => {
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher();
  });

  // use `${testFolderUrl}exists/` as the existing folder:
  describe('in an existing container', () => {
    describe('using POST', () => {
      const { testFolderUrl } = generateTestFolder();
      let resourceUrl;
      let websocketsPubsubClient;
      const containerUrl = `${testFolderUrl}exists/`;

      beforeAll(async () => {
        // this already relies on the PUT to non-existing folder functionality
        // that will be one of the tested behaviours:
        await authFetcher.fetch(`${containerUrl}exists.ttl`, {
          method: 'PUT',
          body: '<#hello> <#linked> <#world> .'
        });

        websocketsPubsubClient = new WPSClient(containerUrl, authFetcher);
        await websocketsPubsubClient.getReady();
        const result = await authFetcher.fetch(containerUrl, {
          method: 'POST',
          header: {
            'Content-Type': 'text/plain'
          },
          body: 'Hello World'
        });
        resourceUrl = new URL(result.headers.get('location'), containerUrl).toString();
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      afterAll(() => {
        websocketsPubsubClient.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it('creates the resource', async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual('2xx');
        expect(await result.text()).toEqual('Hello World');
        expect(result.headers.get('Content-Type')).toEqual('text/plain');
        
      });
      it('adds the resource in the container listing', async () => {
        const containerListing = await getContainerMembers(containerUrl, authFetcher);
        expect(containerListing.sort()).toEqual([
          `${containerUrl}exists.ttl`,
          resourceUrl
        ].sort());
      });
      it('emits websockets-pubsub on the container', () => {
        expect(websocketsPubsubClient.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`
        ]);
      });
    });
  
    describe('using PUT with If-None-Match header', () => {
      const { testFolderUrl } = generateTestFolder();
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const containerUrl = `${testFolderUrl}exists/`;
      const resourceUrl = `${containerUrl}new.ttl`;

      beforeAll(async () => {
        // this already relies on the PUT to non-existing folder functionality
        // that will be one of the tested behaviours:
        await authFetcher.fetch(`${containerUrl}exists.ttl`, {
          method: 'PUT',
          body: '<#hello> <#linked> <#world> .'
        });

        websocketsPubsubClientContainer = new WPSClient(containerUrl, authFetcher);
        await websocketsPubsubClientContainer.getReady();
        websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
        await websocketsPubsubClientResource.getReady();
        const result = await authFetcher.fetch(resourceUrl, {
          method: 'PUT',
          header: {
            'Content-Type': 'text/plain',
            'If-None-Match': '*'
          },
          body: 'Hello World'
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      afterAll(() => {
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it('creates the resource', async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual('2xx');
        expect(await result.text()).toEqual('Hello World');
        expect(result.headers.get('Content-Type')).toEqual('text/plain');
        
      });
      it('adds the resource in the container listing', async () => {
        const containerListing = await getContainerMembers(containerUrl, authFetcher);
        expect(containerListing.sort()).toEqual([
          `${containerUrl}exists.ttl`,
          resourceUrl
        ].sort());
      });
      it('emits websockets-pubsub on the container', () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`
        ]);
      });
      it('emits websockets-pubsub on the resource', () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`,
          `pub ${resourceUrl}`
        ]);
      });
    });
  
    describe('using PUT without If-None-Match header', () => {
      const { testFolderUrl } = generateTestFolder();
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const containerUrl = `${testFolderUrl}exists/`;
      const resourceUrl = `${containerUrl}new.ttl`;

      beforeAll(async () => {
        // this already relies on the PUT to non-existing folder functionality
        // that will be one of the tested behaviours:
        await authFetcher.fetch(`${containerUrl}exists.ttl`, {
          method: 'PUT',
          body: '<#hello> <#linked> <#world> .'
        });

        websocketsPubsubClientContainer = new WPSClient(containerUrl, authFetcher);
        await websocketsPubsubClientContainer.getReady();
        websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
        await websocketsPubsubClientResource.getReady();
        const result = await authFetcher.fetch(resourceUrl, {
          method: 'PUT',
          header: {
            'Content-Type': 'text/plain'
          },
          body: 'Hello World'
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      afterAll(() => {
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it('creates the resource', async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(result.status).toEqual(404);
      });
      it('does not add the resource in the container listing', async () => {
        const containerListing = await getContainerMembers(containerUrl, authFetcher);
        expect(containerListing.sort()).toEqual([
          `${containerUrl}exists.ttl`
        ].sort());
      });
      it('Does not emit websockets-pubsub on the container', () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`
        ]);
      });
      it('Does not emit websockets-pubsub on the resource', () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`
        ]);
      });
    });

    describe('using PATCH', () => {
      const { testFolderUrl } = generateTestFolder();
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const containerUrl = `${testFolderUrl}exists/`;
      const resourceUrl = `${containerUrl}new.ttl`;

      beforeAll(async () => {
        // this already relies on the PUT to non-existing folder functionality
        // that will be one of the tested behaviours:
        await authFetcher.fetch(`${containerUrl}exists.ttl`, {
          method: 'PUT',
          body: '<#hello> <#linked> <#world> .'
        });

        websocketsPubsubClientContainer = new WPSClient(containerUrl, authFetcher);
        await websocketsPubsubClientContainer.getReady();
        websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
        await websocketsPubsubClientResource.getReady();
        const result = await authFetcher.fetch(resourceUrl, {
          method: 'PATCH',
          body: 'INSERT DATA { <#hello> <#linked> <#world> . }',
          headers: {
            'Content-Type': 'application/sparql-update'
          }
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      afterAll(() => {
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it('creates the resource', async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual('2xx');
        // FIXME: Check only RDF content here, not precise Turtle syntax:
        expect(await result.text()).toEqual('@prefix : <#>.\n\n:hello :linked :world.\n\n');
        expect(result.headers.get('Content-Type')).toEqual('text/turtle');
        
      });
      it('adds the resource in the container listing', async () => {
        const containerListing = await getContainerMembers(containerUrl, authFetcher);
        expect(containerListing.sort()).toEqual([
          `${containerUrl}exists.ttl`,
          resourceUrl
        ].sort());
      });
      it('emits websockets-pubsub on the container', () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`
        ]);
      });
      it('emits websockets-pubsub on the resource', () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`,
          `pub ${resourceUrl}`
        ]);
      });
    });
  });

  describe('in an non-existing container', () => {
    describe('using PUT with If-None-Match header', () => {
      const { testFolderUrl } = generateTestFolder();
      const containerUrl = `${testFolderUrl}new/`;
      let websocketsPubsubClientParent;
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const resourceUrl = `${containerUrl}new.ttl`;

      beforeAll(async () => {
        websocketsPubsubClientParent = new WPSClient(testFolderUrl, authFetcher);
        await websocketsPubsubClientParent.getReady();
        websocketsPubsubClientContainer = new WPSClient(containerUrl, authFetcher);
        await websocketsPubsubClientContainer.getReady();
        websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
        await websocketsPubsubClientResource.getReady();
        const result = await authFetcher.fetch(resourceUrl, {
          method: 'PUT',
          header: {
            'Content-Type': 'text/plain',
            'If-None-Match': '*'
          },
          body: 'Hello World'
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      afterAll(() => {
        websocketsPubsubClientParent.disconnect();
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it('creates the resource', async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual('2xx');
        expect(await result.text()).toEqual('Hello World');
        expect(result.headers.get('Content-Type')).toEqual('text/plain');
        
      });
      it('adds the resource in the container listing', async () => {
        const containerListing = await getContainerMembers(containerUrl, authFetcher);
        expect(containerListing.sort()).toEqual([
          `${containerUrl}exists.ttl`,
          resourceUrl
        ].sort());
      });
      it('emits websockets-pubsub on the parent', () => {
        expect(websocketsPubsubClientParent.received).toEqual([
          `ack ${testFolderUrl}`,
          `pub ${testFolderUrl}`
        ]);
      });
      it('emits websockets-pubsub on the container', () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`
        ]);
      });
      it('emits websockets-pubsub on the resource', () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`,
          `pub ${resourceUrl}`
        ]);
      });
    });
  
    describe('using PUT without If-None-Match header', () => {
      const { testFolderUrl } = generateTestFolder();
      let websocketsPubsubClientParent;
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const containerUrl = `${testFolderUrl}new/`;
      const resourceUrl = `${containerUrl}new.ttl`;

      beforeAll(async () => {
        websocketsPubsubClientParent = new WPSClient(testFolderUrl, authFetcher);
        await websocketsPubsubClientParent.getReady();
        websocketsPubsubClientContainer = new WPSClient(containerUrl, authFetcher);
        await websocketsPubsubClientContainer.getReady();
        websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
        await websocketsPubsubClientResource.getReady();
        const result = await authFetcher.fetch(resourceUrl, {
          method: 'PUT',
          header: {
            'Content-Type': 'text/plain'
          },
          body: 'Hello World'
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      afterAll(() => {
        websocketsPubsubClientParent.disconnect();
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it('creates the resource', async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(result.status).toEqual(404);
      });
      it('does not add the resource in the container listing', async () => {
        const containerListing = await getContainerMembers(containerUrl, authFetcher);
        expect(containerListing.sort()).toEqual([
          `${containerUrl}exists.ttl`
        ].sort());
      });
      it('Does not emit websockets-pubsub on the parent', () => {
        expect(websocketsPubsubClientParent.received).toEqual([
          `ack ${testFolderUrl}`
        ]);
      });
      it('Does not emit websockets-pubsub on the container', () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`
        ]);
      });
      it('Does not emit websockets-pubsub on the resource', () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`
        ]);
      });
    });

    describe('using PATCH', () => {
      const { testFolderUrl } = generateTestFolder();
      let websocketsPubsubClientParent;
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const containerUrl = `${testFolderUrl}new/`;
      const resourceUrl = `${containerUrl}new.ttl`;

      beforeAll(async () => {
        websocketsPubsubClientParent = new WPSClient(testFolderUrl, authFetcher);
        await websocketsPubsubClientParent.getReady();
        websocketsPubsubClientContainer = new WPSClient(containerUrl, authFetcher);
        await websocketsPubsubClientContainer.getReady();
        websocketsPubsubClientResource = new WPSClient(resourceUrl, authFetcher);
        await websocketsPubsubClientResource.getReady();
        const result = await authFetcher.fetch(resourceUrl, {
          method: 'PATCH',
          body: 'INSERT DATA { <#hello> <#linked> <#world> . }',
          headers: {
            'Content-Type': 'application/sparql-update'
          }
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      afterAll(() => {
        websocketsPubsubClientParent.disconnect();
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it('creates the resource', async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual('2xx');
        // FIXME: Check only RDF content here, not precise Turtle syntax:
        expect(await result.text()).toEqual('@prefix : <#>.\n\n:hello :linked :world.\n\n');
        expect(result.headers.get('Content-Type')).toEqual('text/turtle');
      });
      it('adds the resource in the container listing', async () => {
        const containerListing = await getContainerMembers(containerUrl, authFetcher);
        expect(containerListing.sort()).toEqual([
          `${containerUrl}exists.ttl`,
          resourceUrl
        ].sort());
      });
      it('emits websockets-pubsub on the parent', () => {
        expect(websocketsPubsubClientParent.received).toEqual([
          `ack ${testFolderUrl}`,
          `pub ${testFolderUrl}`
        ]);
      });
      it('emits websockets-pubsub on the container', () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`
        ]);
      });
      it('emits websockets-pubsub on the resource', () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`,
          `pub ${resourceUrl}`
        ]);
      });
      afterAll(() => recursiveDelete(location, authFetcher));
    });
  });
});