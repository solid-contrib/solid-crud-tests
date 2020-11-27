#!/bin/bash
set -e

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