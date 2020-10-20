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
SERVER_ROOT=https://solid.community ALICE_WEBID=https://michielbdejong.solid.community/profile/card#me npm run jest
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