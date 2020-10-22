# storage-tests
Surface tests for CRUD and Websockets-pubsub functionality of a pod server

## Usage

There are two ways to run these tests:
* in a container where public read/write access is allowed
  - set SERVER_ROOT to the URL of this container
* in a container where some webid-oidc user has Read/Write access
  - set SERVER_ROOT to the URL of this container to the OIDC issuer for this user
  - set COOKIE to a cookie that will allow this user to silently authenticate

### Against production
Get a cookie that will allow this user to silently authenticate.
You can harvest the cookie using curl or your web browser's developer tools.
If you're testing against a node-solid-server instance, the curl command
would be a POST to /login/password, as follows:

```sh
npm install

export SERVER_ROOT=https://solid-auth-cli-test.solidcommunity.net
export USERNAME=solid-auth-cli-test-user
export PASSWORD=123
# This curl command is specific to node-solid-server:
export CURL_RESULT=`curl -i $SERVER_ROOT/login/password -d"username=$USERNAME&password=$PASSWORD" | grep Set-Cookie`
export COOKIE=`expr "$CURL_RESULT" : '^Set-Cookie:\ \(.*\).'`
echo Server root is $SERVER_ROOT
echo Cookie is $COOKIE
npm run jest
```


You should see:
```
Tests:       34 failed, 39 passed, 73 total
```

### In development
Start your server with a self-signed cert on port 443 of localhost and run with:
```sh
export NODE_TLS_REJECT_UNAUTHORIZED=0
export SERVER_ROOT=https://localhost
```

### Against NSS in mashlib-dev (no Docker required)
```sh
export NODE_TLS_REJECT_UNAUTHORIZED=0
export SERVER_ROOT=https://localhost:8443
export COOKIE=`USERNAME=alice PASSWORD=alice123 node ../node-solid-server/test/surface/docker/cookie/app/index.js`
echo Cookie is $COOKIE
npm run jest
```
(the add-crud-tests branch of NSS currently passes 48 out of 73 tests).
