#!/bin/bash
# Builds the native-window program: dist/NotarealStudio_Desktop_Windows/ (+ .zip). Needs electron zips in $ELEC (see below) and esbuild in $TOOLS.
# ELEC dir holds electron-v<ver>-win32-x64.zip and (optional, for testing) electron-v<ver>-linux-x64.zip from github.com/electron/electron/releases
set -e
cd "$(dirname "$0")"; TOOLS=${TOOLS:-/tmp/ntools}; ELEC=${ELEC:-/tmp/elec}; VER=${EVER:-45.4.1}
mkdir -p build ../dist; cp ../dist/notareal_studio.html studio.html
$TOOLS/node_modules/.bin/esbuild server.js --bundle --platform=node --target=node22 --loader:.html=text --outfile=desktop/launcher.cjs --log-level=warning
pack() { # $1=platform zip, $2=exe name, $3=out dir
  rm -rf "$3"; mkdir -p "$3"; unzip -q "$ELEC/electron-v$VER-$1.zip" -d "$3"
  mv "$3/$2" "$3/$4"; rm -f "$3/resources/default_app.asar" "$3/LICENSES.chromium.html"
  mkdir -p "$3/resources/app"; cp desktop/main.js desktop/package.json desktop/launcher.cjs desktop/icon.png "$3/resources/app/"
  cp HOW_TO_USE_DESKTOP.txt "$3/HOW_TO_USE.txt"
}
pack win32-x64 electron.exe ../dist/NotarealStudio_Desktop_Windows NotarealStudio.exe
TOOLS=$TOOLS node set_icon.cjs ../dist/NotarealStudio_Desktop_Windows/NotarealStudio.exe desktop/icon.ico   # the .exe, the taskbar and the window all show the NOTAREAL logo
(cd ../dist && rm -f NotarealStudio_Desktop_Windows.zip && zip -q -r -9 NotarealStudio_Desktop_Windows.zip NotarealStudio_Desktop_Windows)
[ -f "$ELEC/electron-v$VER-linux-x64.zip" ] && pack linux-x64 electron ../dist/nr_desktop_linux notareal-studio
ls -la ../dist/NotarealStudio_Desktop_Windows.zip
