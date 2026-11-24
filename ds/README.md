# Notareal Game Studio Developer Kit (first public test version)
Offline desktop program (Windows, Electron) for making ROM / PC / Xbox games from templates, scanned-game data and built-in testing. No internet needed.

## Run
Unzip `NotarealStudio_Desktop_Windows.zip` (release) and start the app. Developers: `python3 editor/build_editor.py` builds `dist/notareal_studio.html`; `launcher/build_desktop.sh` builds the Windows zip.

## Start here
1. Game > Templates, or Game > Make me a game (type what you want).
2. Use the Assistant box there to change settings in plain words.
3. Research Lab: scan your own ROMs to teach the studio (numbers only stay on your computer).
4. Export from the top bar.

## Test it
`node tests/test_kit.js`, `test_berea.js`, `test_kartparty.js`, `test_tools.js`; Playwright tests in `tests/*.py`.

See docs/STATUS_AND_REMAINING.md for what is and is not finished. Please report bugs as GitHub issues.
