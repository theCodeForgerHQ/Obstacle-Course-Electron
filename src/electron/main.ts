import { app, BrowserWindow } from "electron";
import path from "path";
import {
  isDev,
  initDb,
  createCustomer,
  getCustomer,
  getCustomers,
  updateCustomer,
  deleteCustomer,
  getScores,
} from "./utils.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { ipcMain } from "electron";
ipcMain.handle("db-customers-create", (event, customer) => {
  return createCustomer(customer);
});

ipcMain.handle("db-customers-get", (event, uid: string) => {
  return getCustomer(uid);
});

ipcMain.handle("db-customers-get-all", () => {
  return getCustomers();
});

ipcMain.handle("db-customers-update", (event, uid: string, updates) => {
  return updateCustomer(uid, updates);
});

ipcMain.handle("db-customers-delete", (event, uid: string) => {
  return deleteCustomer(uid);
});

ipcMain.handle("db-get-scores", () => {
  return getScores();
});

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "dist-react/index.html"));
  }
}

app.whenReady().then(() => {
  initDb();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
