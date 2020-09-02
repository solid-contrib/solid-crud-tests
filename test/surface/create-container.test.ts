import { generateTestFolder } from '../helpers/global';
import { getAuthFetcher } from '../helpers/obtain-auth-headers';
import { recursiveDelete, getContainerMembers, WPSClient, responseCodeGroup } from '../helpers/util';

// when the tests start, xists/exists.ttl exists in the test folder,
// and nothing else.

describe('Create container', () => {
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher();
  });

  // use `${testFolderUrl}exists/` as the existing folder:
  describe('in an existing container', () => {
    describe('using PUT with If-None-Match header', () => {
      const { testFolderUrl } = generateTestFolder();
      let websocketsPubsubClientContainer;
      let websocketsPubsubClientResource;
      const containerUrl = `${testFolderUrl}exists/`;
      const resourceUrl = `${containerUrl}new/`;

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
      });

      afterAll(() => {
        websocketsPubsubClientContainer.disconnect();
        websocketsPubsubClientResource.disconnect();
        recursiveDelete(testFolderUrl, authFetcher);
      });

      it('creates the container', async () => {
        const result = await authFetcher.fetch(resourceUrl);
        expect(responseCodeGroup(result.status)).toEqual('2xx');
        // FIXME: Check only RDF content here, not precise Turtle syntax:
        expect(await result.text()).toEqual('@prefix : <#>.\n\n:hello :linked :world.\n\n');
        expect(result.headers.get('Content-Type')).toEqual('text/turtle');        
      });
      it('adds the resource in the existing container listing', async () => {
        const containerListing = await getContainerMembers(containerUrl, authFetcher);
        expect(containerListing.sort()).toEqual([
          `${containerUrl}exists.ttl`,
          resourceUrl
        ].sort());
      });
      it('emits websockets-pubsub on the existing container', () => {
        expect(websocketsPubsubClientContainer.received).toEqual([
          `ack ${containerUrl}`,
          `pub ${containerUrl}`
        ]);
      });
      it('emits websockets-pubsub on the new container', () => {
        expect(websocketsPubsubClientResource.received).toEqual([
          `ack ${resourceUrl}`,
          `pub ${resourceUrl}`
        ]);
      });
      afterAll(() => recursiveDelete(location, authFetcher));
    });
  });
});