#!/bin/bash
set -e

# npm ci

export CURL_RESULT=`curl -i https://solidcommunity.net/login/password -d"username=solid-crud-tests-example-1&password=123" | grep Set-Cookie`
export COOKIE=`expr "$CURL_RESULT" : '^Set-Cookie:\ \(.*\).'`
echo $COOKIE
export OIDC_ISSUER=https://solid-crud-tests-example-1.solidcommunity.net/
export STORAGE_ROOT=https://solid-tests.stage.graphmetrix.net
export ALICE_WEBID=https://solid-tests.stage.graphmetrix.net/i
export SKIP_WPS=1
export DEBUG=*
env
export INCLUDE_MAY=1
./node_modules/.bin/jest test/surface/
