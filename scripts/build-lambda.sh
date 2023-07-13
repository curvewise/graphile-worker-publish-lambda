#!/bin/bash

set -eux -o pipefail

mkdir -p build/lambda-zip-contents lambdas

# Exclude .bin to avoid resolving symlinks in `.bin` which `npm prune` will
# complain about later.
rsync \
    -acL \
    --exclude ".bin" \
    --exclude "config/local*.yml" \
    package.json \
    package-lock.json \
    build/ \
    config \
    node_modules \
    build/lambda-zip-contents

cd build/lambda-zip-contents

npm prune --production
rm package.json package-lock.json .npmrc

zip -r ../../lambdas/graphile-worker-publish.zip .
