import { getAuthFetcher } from '../helpers/obtain-auth-headers';
import { recursiveDelete } from '../helpers/util';

const SERVER_ROOT = process.env.SERVER_ROOT || "https://localhost:8443";
const USERNAME = process.env.USERNAME || "alice";
const PASSWORD = process.env.PASSWORD || "123";
const TEST_FOLDER = `solid-crud-tests-${new Date().getTime()}`;

const testUrls = [
  'empty/', // exists but is empty
  'empty', // should apply the operation to empty/
  'empty/foo.ttl',
  'empty/foo/bar.ttl',
  'exists/', // exists and contains exists.ttl
  'exists',
  'exists/exists.ttl', // exists
  'exists/ExIsTs.ttl',
  'exists/exists.ttl/', // should error
  'exists/foo.ttl'
];
const testOperations = {
  post: {
    method: 'POST',
    headers: {
      'Content-Type': 'text/turtle'
    },
    body: '<#hello> <#linked> <#world> .',
    expectedWriteStatus: {
      'empty/': 404,
      'empty': 404,
      'empty/foo.ttl': 404,
      'empty/foo/bar.ttl': 404,
      'exists/': 201,
      'exists': 201, // applied to exists/ instead
      'exists/exists.ttl': 404, // see https://github.com/solid/specification/blob/c7fdf4977c6f9219bade7ca9857e23695711740d/main/resource-access.bs#L191-L192
      'exists/ExIsTs.ttl': 404,
      'exists/exists.ttl/': 404, // that container does not exist
      'exists/foo.ttl': 404
    },
    expectedReadStatus: {
      'empty/': 404,
      'empty': 404,
      'empty/foo.ttl': 404,
      'empty/foo/bar.ttl': 404,
      'exists/': 200,
      'exists': 200,
      'exists/exists.ttl': 200,
      'exists/ExIsTs.ttl': 404,
      'exists/exists.ttl/': 404,
      'exists/foo.ttl': 404
    },
    redirect: 'manual'
  },
  // patchIns: {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'text/turtle'
  //   },
  //   body: '<#hello> <#linked> <#world> .'
  // },
  // patchDel: {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'text/turtle'
  //   },
  //   body: '<#hello> <#linked> <#world> .'
  // },
  // patchInsDel: {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'text/turtle'
  //   },
  //   body: '<#hello> <#linked> <#world> .'
  // },
  // put: {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'text/turtle'
  //   },
  //   body: '<#hello> <#linked> <#world> .'
  // },
  // del: {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'text/turtle'
  //   },
  //   body: '<#hello> <#linked> <#world> .'
  // },
  // noop: {
  //   method: 'POST',
  //   headers: {
  //     'Content-Type': 'text/turtle'
  //   },
  //   body: '<#hello> <#linked> <#world> .'
  // }
};
// (async () => {
// const authFetcher = await getAuthFetcher(SERVER_ROOT, USERNAME, PASSWORD);
// console.log('get authFetcher', authFetcher);
// process.exit(1);
// })();

describe('Basic Sequences', () => {
  let authFetcher;
  beforeAll(async () => {
    authFetcher = await getAuthFetcher(SERVER_ROOT, USERNAME, PASSWORD);
    await authFetcher.fetch(`${SERVER_ROOT}/${TEST_FOLDER}/empty/`, {
      method: 'PUT',
      headers: {
        Link: '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"' // see https://github.com/solid/node-solid-server/issues/1465
      }
    });
    await authFetcher.fetch(`${SERVER_ROOT}/${TEST_FOLDER}/exists/exists.ttl`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/turtle',
      },
      body: '<#hello> <#linked> <#world> .'
    });
    const fetchBack = await authFetcher.fetch(`${SERVER_ROOT}/${TEST_FOLDER}/exists/`, { redirect: 'manual' })
    expect(fetchBack.status).toEqual(200);
    console.log(await fetchBack.text())
  });
  afterAll(() => recursiveDelete(`${SERVER_ROOT}/${TEST_FOLDER}/`, authFetcher));

  async function runTest(path, operation) {
    const url = `${SERVER_ROOT}/${TEST_FOLDER}/${path}`;
    const fetchOptions = testOperations[operation];
    const writeResult = await authFetcher.fetch(url, fetchOptions);
    expect(writeResult.status).toEqual(fetchOptions.expectedWriteStatus[path]);
    const getResult = await authFetcher.fetch(url);
    expect(getResult.status).toEqual(fetchOptions.expectedReadStatus[path]);
  }
  testUrls.forEach(testPath => {
    describe(testPath, () => {
      Object.keys(testOperations).forEach(operation => {
        describe(operation, () => {
          it('works', () => runTest(testPath, operation));
        });
      });
    });
  });
});

// describe('POST then GET', () => {
//   let authFetcher;
//   beforeAll(async () => {
//     authFetcher = await getAuthFetcher(SERVER_ROOT, USERNAME, PASSWORD);
//   });
//   afterAll(() => recursiveDelete(`${SERVER_ROOT}/${TEST_FOLDER}/`, authFetcher));

//   async function postThenGet(path) {
//     const url = `${SERVER_ROOT}/${TEST_FOLDER}/${path}`;
//     const patchResult = await authFetcher.fetch(url, {
//       method: 'PATCH',
//       headers: {
//         'Content-Type': 'application/sparql-update',
//       },
//       body: 'INSERT DATA { <#hello> <#linked> <#world> }'
//     });
//     expect(patchResult.status).toEqual(200);
//     const getResult = await authFetcher.fetch(url);
//     expect(getResult.status).toEqual(200);
//   }

//   it('creates foo/bar.ttl', () => patchThenGet('foo/bar.ttl'));
//   it('creates foo.ttl', () => patchThenGet('foo.ttl'));
//   test("PUT-GET-DELETE-GET", async () => {
//     const putResult = await authFetcher.fetch(`${SERVER_ROOT}/private/test.txt`, {
//       method: 'PUT',
//       body: 'some text',
//       headers: {
//         'Content-Type': 'text/plain'
//       }
//     });
//     expect(putResult.status).toEqual(201);
//     const getResult = await authFetcher.fetch(`${SERVER_ROOT}/private/test.txt`);
//     const getBody = await getResult.text();
//     expect(getBody).toEqual('some text');
//     const containerMembers = await getContainerMembers(`${SERVER_ROOT}/private/`);
//     expect(containerMembers).toEqual([ 'https://localhost:8443/private/test.txt' ]);

//     const deleteResult = await authFetcher.fetch(`${SERVER_ROOT}/private/test.txt`, {
//       method: 'DELETE'
//     });
//     expect(deleteResult.status).toEqual(200);
//     const getResult2 = await authFetcher.fetch(`${SERVER_ROOT}/private/test.txt`);
//     expect(getResult2.status).toEqual(404);
//   });

//   test("POST-GET-DELETE-GET", async () => {
//     const postResult = await authFetcher.fetch(`${SERVER_ROOT}/private/`, {
//       method: 'POST',
//       body: 'some text',
//       headers: {
//         'Content-Type': 'text/plain'
//       }
//     });
//     expect(postResult.status).toEqual(201);
//     const location = new URL(postResult.headers.get('location'), `${SERVER_ROOT}/private/`).toString();
//     expect(location.substring(0, `${SERVER_ROOT}/private/`.length)).toEqual(`${SERVER_ROOT}/private/`);
//     const getResult = await authFetcher.fetch(location);
//     const getBody = await getResult.text();
//     expect(getBody).toEqual('some text');
//     const containerMembers = await getContainerMembers(`${SERVER_ROOT}/private/`);
//     expect(containerMembers).toEqual([ location ]);

//     const deleteResult = await authFetcher.fetch(location, {
//       method: 'DELETE'
//     });
//     expect(deleteResult.status).toEqual(200);
//     const getResult2 = await authFetcher.fetch(location);
//     expect(getResult2.status).toEqual(404);

//   });

// });