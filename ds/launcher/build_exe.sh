#!/bin/bash
# Builds the standalone programs: dist/NotarealStudio.exe (Windows) and dist/notareal-studio-linux.
# Needs: node 22, esbuild + postject (npm), and the Windows node binary (npm i node-win-x64@<same node version> --force --os=win32 --cpu=x64).
set -e
cd "$(dirname "$0")"; TOOLS=${TOOLS:-/tmp/ntools}; WINNODE=${WINNODE:-/tmp/nodewin/node_modules/node-win-x64/bin/node.exe}
mkdir -p build ../dist
[ -f ../dist/notareal_studio.html ] && cp ../dist/notareal_studio.html studio.html
$TOOLS/node_modules/.bin/esbuild server.js --bundle --platform=node --target=node22 --loader:.html=text --outfile=build/launcher.cjs --log-level=warning
echo '{"main":"build/launcher.cjs","output":"build/sea.blob","disableExperimentalSEAWarning":true}' > build/sea.json
node --experimental-sea-config build/sea.json
FUSE=NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2
cp "$(command -v node)" ../dist/notareal-studio-linux; $TOOLS/node_modules/.bin/postject ../dist/notareal-studio-linux NODE_SEA_BLOB build/sea.blob --sentinel-fuse $FUSE >/dev/null
if [ -f "$WINNODE" ]; then cp "$WINNODE" ../dist/NotarealStudio.exe; $TOOLS/node_modules/.bin/postject ../dist/NotarealStudio.exe NODE_SEA_BLOB build/sea.blob --sentinel-fuse $FUSE >/dev/null; fi
ls -la ../dist/NotarealStudio.exe ../dist/notareal-studio-linux 2>/dev/null
