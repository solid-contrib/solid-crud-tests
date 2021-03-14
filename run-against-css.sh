#!/bin/bash
set -e

# npm ci

export SERVER_ROOT=http://localhost:3000
export ALICE_WEBID_DOC=${SERVER_ROOT}/profile.ttl
export ALICE_WEBID=$ALICE_WEBID_DOC#me
curl -X PUT $ALICE_WEBID_DOC -H 'Content-Type: text/turtle' -d "<$ALICE_WEBID> <http://www.w3.org/ns/pim/space#storage> </>."

mkdir -p ../test-suite/CSS
export INCLUDE_MAY=1
mkdir -p ../test-suite/CSS
./node_modules/.bin/jest test/surface/ --verbose --json --outputFile="../test-suite/CSS/crud-results.json"

