#!/bin/bash
set -e

npm ci

export SERVER_ROOT=http://localhost:3000
export ALICE_WEBID_DOC=${SERVER_ROOT}/profile.ttl
export ALICE_WEBID=$ALICE_WEBID_DOC#me
curl -X PUT $ALICE_WEBID_DOC -H 'Content-Type: text/turtle' -d "<$ALICE_WEBID> <http://www.w3.org/ns/pim/space#storage> </>."

npm run jest
