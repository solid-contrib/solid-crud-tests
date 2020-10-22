# storage-tests
Surface tests for CRUD and Websockets-pubsub functionality of a pod server

## Usage

There are two ways to run these tests:

### With some webid-oidc user
First, add 'https://tester' as a trusted app.
Assuming the server has Solid OS as its web interface, the steps are as follows:
* using your browser, log in to the pod
* top right menu
* Preferences
* Preferences
* Manage your trusted applications (may require a page refresh before it displays properly),
* Tick Read + Write,
* Click Add


Now, get a cookie that will allow this user to silently authenticate.
You can use a curl command, for instance for node-solid-server it would
POST 'username' and 'password' to /login/password and run the tests, as follows:

```sh
npm install

export SERVER_ROOT=https://solid-crud-tests-example-1.solidcommunity.net
export USERNAME=solid-crud-tests-example-1
export PASSWORD=123
# This curl command is specific to node-solid-server:
export CURL_RESULT=`curl -i $SERVER_ROOT/login/password -d"username=$USERNAME&password=$PASSWORD" | grep Set-Cookie`
# The COOKIE will be used when going through the webid-oidc flow:
export COOKIE=`expr "$CURL_RESULT" : '^Set-Cookie:\ \(.*\).'`
# The SERVER_ROOT will be used both for webid-oidc discovery and as the base container to run the tests against:
echo Server root is $SERVER_ROOT
echo Cookie is $COOKIE
npm run jest
```

You should see something like:
```
Tests:       13 failed, 49 passed, 62 total
```

You can also harvest the cookie using your web browser's developer tools instead of curl.
Or for instance for programmatically getting a cookie for Nextcloud, our test suites [use Puppeteer](https://github.com/solid/test-suite/blob/665824a/helpers/cookie/app/index.js#L8).
Set it into the COOKIE env var, set the SERVER_ROOT, and run `npm run jest`.

### With public access
If you run against a container with public read/write access, then it's not
necessary to add https://tester as a trusted app. Instead (assuming the server
has Solid OS as its web interface):
* using your browser, log in to the pod
* click the folder icon
* click the green +
* click the folder icon
* pick a folder name
* click the triangle before the name of the newly created container
* click the padlock icon
* Set specific sharing for this folder
* Click the green +
* Click the globe icon
* If you don't see the globe icon appear next to 'Viewers', refresh the page
* Drag the globe icon from 'Viewers' to 'Editors'

Now you can run without a COOKIE environment variable:
```sh
npm install
export SERVER_ROOT=https://solid-crud-tests-example-2.solidcommunity.net/test-folder/
npm run jest
```

### In development
Start your server with a self-signed cert on port 443 of localhost and run with:
```sh
export NODE_TLS_REJECT_UNAUTHORIZED=0
export SERVER_ROOT=https://localhost
```
