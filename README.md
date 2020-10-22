# storage-tests
Surface tests for CRUD and Websockets-pubsub functionality of a pod server

## Usage

There are two ways to run these tests:
* in a container where public read/write access is allowed
  - set SERVER_ROOT to the URL of this container
* in a container where some webid-oidc user has Read/Write access
  - set SERVER_ROOT to the URL of this container to the OIDC issuer for this user
  - set COOKIE to a cookie that will allow this user to silently authenticate

### In development
Start your server with a self-signed cert on port 443 of localhost and run:
```sh
NODE_TLS_REJECT_UNAUTHORIZED=0 SERVER_ROOT=https://localhost ALICE_WEBID=https://localhost/profile/card#me npm run jest
```

### Against production
```sh
npm install
cd node_modules/rdflib ; npm install ; npm run build ; cd ../..
SERVER_ROOT=https://solid-auth-cli-test-user.solidcommunity.net ALICE_WEBID=https://solid-auth-cli-test-user.solidcommunity.net/profile/card#me USERNAME=solid-auth-cli-test-user PASSWORD=123 npm run jest
```

You should see:
```
Tests:       34 failed, 39 passed, 73 total
```

### Against NSS in mashlib-dev (no Docker required)
```sh
export NODE_TLS_REJECT_UNAUTHORIZED=0
export SERVER_ROOT=https://localhost:8443
export COOKIE=`node ../node-solid-server/test/surface/docker/cookie/app/index.js`
echo Cookie is $COOKIE
npm run jest
```
(the add-crud-tests branch of NSS currently passes 48 out of 73 tests).
