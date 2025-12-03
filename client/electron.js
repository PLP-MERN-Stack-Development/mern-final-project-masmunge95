const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Optional: for secure IPC
    },
  });

  // Load the index.html of the app.
  // This points to the built React app in the 'dist' folder.
  mainWindow.loadFile(path.join(__dirname, 'dist', 'index.html'));

  // Open the DevTools (optional)
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});