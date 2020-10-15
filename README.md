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
cd node_modules/rdflib ; npm install ; npm run build ; cd ../..
SERVER_ROOT=https://solid-auth-cli-test-user.solidcommunity.net ALICE_WEBID=https://solid-auth-cli-test-user.solidcommunity.net/profile/card#me USERNAME=solid-auth-cli-test-user PASSWORD=123 npm run jest
```
