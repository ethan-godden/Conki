#!/bin/sh
# Deletes dist and node_modules, and the scripts deploy.sh copied into the
# collection.media folder of the Anki profile "User 1". Run npm install
# before building again.
#
# The scripts are named rather than matched with *.min.js, so other files in
# collection.media are left alone.
set -eu
cd "$(dirname "$0")/.."

media="$HOME/Library/Application Support/Anki2/User 1/collection.media"

rm -rf dist node_modules
rm -f "$media/_codemirror.min.js" "$media/_markdown-card.min.js" "$media/_code-card.min.js"
