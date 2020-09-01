import { generateTestFolder } from '../helpers/global';
import { getAuthFetcher } from '../helpers/obtain-auth-headers';
import { recursiveDelete, getContainerMembers, subscribeTo, responseCodeGroup } from '../helpers/util';

// when the tests start, xists/exists.ttl exists in the test folder,
// and nothing else.

describe('Create non-container', () => {
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher();
  });

  // use `${testFolderUrl}exists/` as the existing folder:
  describe('in an existing container', () => {
    describe('using POST', () => {
      const { testFolderUrl } = generateTestFolder();
      let location;
      let websocketsPubsubClient;
      const containerUrl = `${testFolderUrl}exists/`;

      beforeAll(async () => {
        // this already relies on the PUT to non-existing folder functionality
        // that will be one of the tested behaviours:
        await authFetcher.fetch(`${testFolderUrl}exists/exists.ttl`, {
          method: 'PUT',
          body: '<#hello> <#linked> <#world> .'
        });

        websocketsPubsubClient = await subscribeTo(containerUrl, authFetcher);
        const result = await authFetcher.fetch(containerUrl, {
          method: 'POST',
          header: {
            'Content-Type': 'text/plain'
          },
          body: 'Hello World'
        });
        location = new URL(result.headers.get('location'), `${testFolderUrl}exists/`).toString();
        const updatesVia = new URL(result.headers.get('updates-via'), `${testFolderUrl}exists/`).toString();
      });

      afterAll(() => recursiveDelete(testFolderUrl, authFetcher));

      it('creates the resource', async () => {
        const result = await authFetcher.fetch(location);
        expect(responseCodeGroup(result.status)).toEqual('2xx');
        expect(await result.text()).toEqual('Hello World');
        expect(result.headers.get('Content-Type')).toEqual('text/plain');
        
      });
      it('adds the resource in the container listing', async () => {
        const containerListing = await getContainerMembers(`${testFolderUrl}exists/`, authFetcher);
        expect(containerListing.sort()).toEqual([
          `${testFolderUrl}exists/exists.ttl`,
          location
        ].sort());
      });
      it('emits websockets-pubsub on the container', () => {
        expect(websocketsPubsubClient)
      });
      afterAll(() => recursiveDelete(location, authFetcher));
    });
  });
});