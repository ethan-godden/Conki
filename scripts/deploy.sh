#!/bin/sh
# Builds, then copies the scripts into the collection.media folder of the
# Anki profile "User 1". Restart Anki afterwards. Undone by clean.sh.
set -eu
cd "$(dirname "$0")/.."

media="$HOME/Library/Application Support/Anki2/User 1/collection.media"

npm run build
cp dist/media/*.min.js "$media/"
