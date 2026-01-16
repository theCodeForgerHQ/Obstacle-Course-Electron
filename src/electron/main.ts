import { dialog } from "electron";
import fs from "fs";
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import {
  isDev,
  initDb,
  getCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getScores,
} from "./utils.js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.setName("Obstacle Course");

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 1000,
    minWidth: 1000,
    minHeight: 800,
    title: "Obstacle Course",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      devTools: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (process.env.NODE_ENV === "development") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }

  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), "dist-react/index.html"));
  }
}

app.whenReady().then(() => {
  initDb();

  ipcMain.handle("customers:getAll", () => getCustomers());
  ipcMain.handle("customers:create", (_, input) => createCustomer(input));
  ipcMain.handle("customers:update", (_, id, updates) =>
    updateCustomer(id, updates)
  );
  ipcMain.handle("customers:delete", (_, id) => deleteCustomer(id));
  ipcMain.handle("scores:getAll", () => getScores());

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
