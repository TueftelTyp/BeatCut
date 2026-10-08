const {
  contextBridge,
  ipcRenderer
} = require("electron");

contextBridge.exposeInMainWorld(
  "beatcutDesktop",
  {
    isDesktop: true,

    getAppInfo() {
      return ipcRenderer.invoke(
        "beatcut:get-app-info"
      );
    }
  }
);