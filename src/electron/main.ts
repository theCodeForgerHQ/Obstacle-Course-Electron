import { dialog } from "electron";
import fs from "fs";
import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import {
  isDev,
  initDb,
  getCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getScores,
  getSettings,
  updateEmail,
  changePassword,
  exportCustomersCsv,
  verifyPassword,
  importCustomersCsv,
  exportScoresCsv,
  importScoresCsv,
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
  ipcMain.handle("customers:get", (_, id) => getCustomer(id));
  ipcMain.handle("customers:create", (_, input) => createCustomer(input));
  ipcMain.handle("customers:update", (_, id, updates) =>
    updateCustomer(id, updates)
  );
  ipcMain.handle("customers:delete", (_, id) => deleteCustomer(id));
  ipcMain.handle("scores:getAll", () => getScores());

  ipcMain.handle("settings:get", () => getSettings());
  ipcMain.handle("settings:verifyPassword", async (_, password: string) => {
    return verifyPassword(password);
  });
  ipcMain.handle(
    "settings:updateEmail",
    async (_, oldPassword: string | null, email: string) => {
      return updateEmail(oldPassword, email);
    }
  );
  ipcMain.handle(
    "settings:changePassword",
    async (_, oldPassword: string | null, newPassword: string) => {
      return changePassword(oldPassword, newPassword);
    }
  );

  ipcMain.handle("customers:exportCsv", async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export Participants",
      defaultPath: "participants.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (canceled || !filePath) return;

    const csv = exportCustomersCsv();
    fs.writeFileSync(filePath, csv, "utf8");
  });

  ipcMain.handle("scores:exportCsv", async () => {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: "Export Scores",
      defaultPath: "scores.csv",
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });

    if (canceled || !filePath) return;

    const csv = exportScoresCsv();
    fs.writeFileSync(filePath, csv, "utf8");
  });

  ipcMain.handle("customers:importCsv", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Import Participants",
      filters: [{ name: "CSV", extensions: ["csv"] }],
      properties: ["openFile"],
    });

    if (canceled || filePaths.length === 0) return;

    const csv = fs.readFileSync(filePaths[0], "utf8");
    importCustomersCsv(csv);
  });

  ipcMain.handle("scores:importCsv", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: "Import Scores",
      filters: [{ name: "CSV", extensions: ["csv"] }],
      properties: ["openFile"],
    });

    if (canceled || filePaths.length === 0) return;

    const csv = fs.readFileSync(filePaths[0], "utf8");
    importScoresCsv(csv);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
