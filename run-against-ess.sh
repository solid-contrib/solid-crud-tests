#!/bin/bash
set -e

# npm ci

export CURL_RESULT=`curl -i https://solidcommunity.net/login/password -d"username=solidtestsuite&password=Testing123" | grep Set-Cookie`
export COOKIE=`expr "$CURL_RESULT" : '^Set-Cookie:\ \(.*\).'`
echo $COOKIE
export SERVER_ROOT=https://solidcommunity.net
export STORAGE_ROOT=https://storage.inrupt.com/7bb20678-42c7-44fc-b71b-b0989332cde4/solidtestsuite
export ALICE_WEBID=https://solidtestsuite.solidcommunity.net/profile/card#me

export SKIP_WPS=1
mkdir -p ../test-suite/ESS
export DEBUG=*
env
./node_modules/.bin/jest test/surface/ --verbose --json --outputFile="../test-suite/ESS/crud-results.json"
