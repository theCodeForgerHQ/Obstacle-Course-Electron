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

type Session = {
  userId: number;
  username: string;
  role: string;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.electron.ipcRenderer.invoke("session:read").then((res: any) => {
      if (!res?.error) setSession(res);
      setLoading(false);
    });
  }, []);

  const onLogin = async () => {
    setError(null);
    const res = await window.electron.ipcRenderer.invoke(
      "auth:login",
      identifier,
      password
    );
    if (res?.error) {
      setError(res.error);
    } else {
      setSession(res);
    }
  };

  if (loading) return null;

  if (session) {
    return (
      <div className="min-h-screen bg-[#E8F5EF] flex items-center justify-center">
        <div className="text-gray-700 text-sm">
          Logged in as <span className="font-medium">{session.username}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E8F5EF] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-sm border border-gray-100 p-8">
        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">
            Obstacle Course
          </h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>

        {/* Form */}
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

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">
              {error}
            </div>
          )}

          <Button onClick={onLogin} className="w-full mt-2">
            Sign in
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Obstacle Course
        </div>
      </div>
    </div>
  );
}
