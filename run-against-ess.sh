#!/bin/bash
set -e

# npm ci

export CURL_RESULT=`curl -i https://solidcommunity.net/login/password -d"username=solidtestsuite&password=Testing123" | grep Set-Cookie`
export COOKIE=`expr "$CURL_RESULT" : '^Set-Cookie:\ \(.*\).'`
echo $COOKIE
export SERVER_ROOT=https://solidcommunity.net
export STORAGE_ROOT=https://pod-compat.inrupt.com/solidtestsuite/solidtestsuite
export ALICE_WEBID=https://solidtestsuite.solidcommunity.net/profile/card#me
export SKIP_WPS=1
export DEBUG=*
env
./node_modules/.bin/jest test/surface/concurrency.test.ts
