/* Notareal Game Studio - native desktop window (Electron). No browser, no internet.
 * Runs the same local engine (launcher.cjs) on 127.0.0.1 inside the app and shows the studio in its own window. */
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
process.env.NR_NO_BROWSER = '1';
process.env.NR_HOME = process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath);
const launcher = require('./launcher.cjs');
if (!app.requestSingleInstanceLock()) app.quit();
let win;
function open(port) {
    Menu.setApplicationMenu(null);
    win = new BrowserWindow({ width: 1400, height: 900, minWidth: 900, minHeight: 600, backgroundColor: '#111', title: 'Notareal Game Studio', icon: path.join(__dirname, 'icon.png'), autoHideMenuBar: true,
        webPreferences: { contextIsolation: true, nodeIntegration: false, spellcheck: false } });
    win.webContents.setWindowOpenHandler(() => ({ action: 'allow' })); // game previews / exports open in their own windows
    win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('http://127.0.0.1:' + port)) { e.preventDefault(); } });
    win.webContents.session.on('will-download', (e, item) => { /* save dialog is shown by Electron by default */ });
    win.loadURL('http://127.0.0.1:' + port + '/');
}
app.whenReady().then(() => {
    const srv = launcher.start(0);
    const go = () => open(srv.address().port);
    if (srv.listening) go(); else srv.on('listening', go);
}).catch(e => { dialog.showErrorBox('Notareal Game Studio', String(e && e.stack || e)); app.quit(); });
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
