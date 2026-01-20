declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>;
      };
    };
  }
}

import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "./components/ui/button";
import { Input } from "./components/ui/input";
import { LayoutGrid, Users, UserPlus, Trophy, Settings } from "lucide-react";
import { cn } from "./lib/utils";
import type { Session } from "../electron/utils";
import CustomerRegistration from "./pages/CustomerDirectory";
import UsersDirectory from "./pages/UserDirectory";
import ProfileSettings from "./pages/ProfileSettings";
import LeaderboardScreen from "./pages/Leaderboard";

type Page = "dashboard" | "participants" | "users" | "leaderboard" | "settings";

const navItems: {
  key: Page;
  label: string;
  icon: React.ElementType;
  requiresRole?: string[];
}[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { key: "participants", label: "Participants", icon: UserPlus },
  { key: "leaderboard", label: "Leaderboard", icon: Trophy },
  {
    key: "users",
    label: "Users",
    icon: Users,
    requiresRole: ["OWNER", "MANAGER"],
  },
  { key: "settings", label: "Settings", icon: Settings },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<Page>("dashboard");

  useEffect(() => {
    window.electron.ipcRenderer.invoke("session:read").then((res: any) => {
      if (!res?.error) setSession(res);
      setLoading(false);
    });
  }, []);

  const onLogin = async () => {
    setLoginError(null);
    const res = await window.electron.ipcRenderer.invoke(
      "auth:login",
      identifier,
      password,
    );
    if (res?.error) {
      setLoginError(res.error);
    } else {
      setSession(res);
    }
  };

  if (loading) return null;

  if (session) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] pb-24">
        <div className="p-8">
          {activePage === "dashboard" && (
            <h1 className="text-xl font-semibold">Dashboard</h1>
          )}
          {activePage === "participants" && <CustomerRegistration />}
          {activePage === "users" && <UsersDirectory />}
          {activePage === "leaderboard" && (
            <h1 className="text-xl font-semibold">
              <LeaderboardScreen />
            </h1>
          )}
          {activePage === "settings" && <ProfileSettings />}
        </div>

        <div className="fixed bottom-6 left-1/2 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white shadow-sm px-2 py-2">
            {navItems
              .filter((item) => {
                if (!item.requiresRole) return true;
                return item.requiresRole.includes(session.role);
              })
              .map(({ key, label, icon: Icon }) => {
                const active = activePage === key;

                return (
                  <button
                    key={key}
                    onClick={() => setActivePage(key)}
                    className={cn(
                      "relative flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-300",
                      active
                        ? "bg-[#E8F5EF] text-gray-900"
                        : "text-gray-500 hover:text-gray-900",
                    )}
                  >
                    <Icon
                      size={18}
                      className={cn(
                        "transition-all duration-300",
                        active ? "text-gray-900" : "text-gray-400",
                      )}
                    />

                    <span
                      className={cn(
                        "overflow-hidden whitespace-nowrap transition-all duration-300",
                        active
                          ? "max-w-[120px] opacity-100"
                          : "max-w-0 opacity-0",
                      )}
                    >
                      {label}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8F5EF] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-sm border border-gray-100 p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Obstacle Course
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>

        <div className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">
              Email or Username
            </label>
            <Input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-600">
              Password
            </label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••••••••"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {loginError && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {loginError}
            </div>
          )}

          <Button onClick={onLogin} className="w-full mt-2">
            Sign in
          </Button>
        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Obstacle Course
        </div>
      </div>
    </div>
  );
}
