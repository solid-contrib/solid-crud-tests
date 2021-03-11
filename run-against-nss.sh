#!/bin/bash
set -e

# npm ci

export OIDC_ISSUER_ALICE=https://localhost:8443
export STORAGE_ROOT=https://alice.localhost:8443
export ALICE_WEBID=${STORAGE_ROOT}/profile/card#me

export USERNAME_ALICE=alice
export PASSWORD_ALICE=123
export CURL_RESULT_ALICE=`curl -ki $OIDC_ISSUER_ALICE/login/password -d"username=$USERNAME_ALICE&password=$PASSWORD_ALICE" | grep Set-Cookie`
export COOKIE_ALICE=`expr "$CURL_RESULT_ALICE" : '^Set-Cookie:\ \(.*\).'`

export NODE_TLS_REJECT_UNAUTHORIZED=0

# npm run jest
export INCLUDE_MAY=1
./node_modules/.bin/jest test/surface/ --json --outputFile="../test-suite/NSS/crud-results.json"
