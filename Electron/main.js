const {
  app,
  BrowserWindow,
  Menu,
  shell,
  ipcMain
} = require("electron");

const path = require("path");

let mainWindow = null;

function isExternalUrl(url) {
  return /^https?:\/\//i.test(url);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: "BeatCut Studio",
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#090a0e",
    show: false,
    autoHideMenuBar: true,

    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      spellcheck: false,
      backgroundThrottling: false
    }
  });

  Menu.setApplicationMenu(null);

  mainWindow.loadFile("index.html");

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalUrl(url)) {
      shell.openExternal(url);
    }

    return {
      action: "deny"
    };
  });

  mainWindow.webContents.on(
    "before-input-event",
    (event, input) => {
      if (
        input.type === "keyDown" &&
        input.key === "F12"
      ) {
        event.preventDefault();

        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools({
            mode: "detach"
          });
        }
      }
    }
  );

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("beatcut:get-app-info", () => {
  return {
    desktop: true,
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    name: app.getName()
  };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});