# storage-tests
Surface tests for CRUD and Websockets-pubsub functionality of a pod server

## Usage
### In development
Start your server with a self-signed cert on port 443 of localhost and run:
```sh
NODE_TLS_REJECT_UNAUTHORIZED=0 SERVER_ROOT=https://localhost ALICE_WEBID=https://localhost/profile/card#me npm run jest
```

### Against production
```sh
npm install
export SERVER_ROOT=https://solid-auth-cli-test-user.solidcommunity.net
export ALICE_WEBID=https://solid-auth-cli-test-user.solidcommunity.net/profile/card#me
export USERNAME=solid-auth-cli-test-user
export PASSWORD=123
export JEST_TIMEOUT=60000
npm run jest
```

You should see:
```
Tests:       34 failed, 39 passed, 73 total
```

### Against NSS in mashlib-dev (no Docker required)
```sh
export NODE_TLS_REJECT_UNAUTHORIZED=0
export SERVER_ROOT=https://localhost:8443
export ALICE_WEBID=https://localhost:8443/profile/card#me
export USERNAME=alice
export PASSWORD=123
export COOKIE=`node ../node-solid-server/test/surface/docker/cookie/app/index.js`
echo Cookie is $COOKIE
npm run jest
```
(the add-crud-tests branch of NSS currently passes 48 out of 73 tests).
