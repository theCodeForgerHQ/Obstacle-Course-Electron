import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from "electron";
import path from "path";
import {
  initDb,
  eraseSession,
  readSession,
  createUser,
  getCurrentUser,
  getAllUsers,
  deleteUser,
  promoteUserToManager,
  demoteUserToOperator,
  updatePassword,
  updateUserProfile,
  loginUser,
  createCustomer,
  getCustomers,
  updateCustomerProfile,
  deleteCustomer,
  getScores,
  isDev,
} from "./utils.js";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function safeHandler<Args extends any[] = any[], Return = any>(
  fn: (...args: Args) => Return | Promise<Return>,
) {
  return async (
    _event: IpcMainInvokeEvent,
    ...args: Args
  ): Promise<Return | { error: string }> => {
    try {
      return await fn(...args);
    } catch (err) {
      const message =
        err instanceof Error &&
        "code" in err &&
        String(err.message).includes("UNIQUE")
          ? "Duplicate value."
          : err instanceof Error
            ? err.message
            : String(err);

      return { error: message };
    }
  };
}
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
      devTools: isDev(),
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
  eraseSession();

  ipcMain.handle("session:erase", safeHandler(eraseSession));
  ipcMain.handle("session:read", safeHandler(readSession));

  ipcMain.handle("user:create", safeHandler(createUser));
  ipcMain.handle("user:current", safeHandler(getCurrentUser));
  ipcMain.handle("user:list", safeHandler(getAllUsers));
  ipcMain.handle("user:delete", safeHandler(deleteUser));
  ipcMain.handle("user:promoteToManager", safeHandler(promoteUserToManager));
  ipcMain.handle("user:demoteToOperator", safeHandler(demoteUserToOperator));

  ipcMain.handle("auth:login", safeHandler(loginUser));
  ipcMain.handle("user:updatePassword", safeHandler(updatePassword));
  ipcMain.handle("user:updateProfile", safeHandler(updateUserProfile));

  ipcMain.handle("customer:create", safeHandler(createCustomer));
  ipcMain.handle("customer:list", safeHandler(getCustomers));
  ipcMain.handle("customer:update", safeHandler(updateCustomerProfile));
  ipcMain.handle("customer:delete", safeHandler(deleteCustomer));

  ipcMain.handle("scores:list", safeHandler(getScores));

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  eraseSession();
  if (process.platform !== "darwin") app.quit();
});
