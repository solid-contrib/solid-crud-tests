#!/bin/bash
set -e

# The SERVER_ROOT will be used both for webid-oidc discovery and as the base container to run the tests against.
# To use a different base container set STORAGE_ROOT.

export SERVER_ROOT=https://server
export USERNAME=alice
export PASSWORD=123
export RESULTS_PATH=../NSS-crud-results.json

export ALICE_WEBID=$SERVER_ROOT/profile/card#me

# This curl command is specific to node-solid-server:
export CURL_RESULT=`curl -ki $SERVER_ROOT/login/password -d"username=$USERNAME&password=$PASSWORD" | grep Set-Cookie`
# The COOKIE will be used when going through the webid-oidc flow:
export COOKIE=`expr "$CURL_RESULT" : '^Set-Cookie:\ \(.*\).'`

echo Server root is $SERVER_ROOT
echo Cookie is $COOKIE

# npm run jest "$@"
npm run jest -- --json --outputFile="$RESULTS_PATH" "$@"
