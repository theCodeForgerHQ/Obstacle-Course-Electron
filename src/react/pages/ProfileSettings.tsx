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
import type { FormEvent } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

type Gender = "M" | "F" | "O";

const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

type ProfileDraft = {
  name: string;
  email: string;
  phone: string;
  emergency_contact: string;
  address: string;
  date_of_birth: string;
  gender: Gender;
  blood_group: string;
};

const emptyProfile: ProfileDraft = {
  name: "",
  email: "",
  phone: "",
  emergency_contact: "",
  address: "",
  date_of_birth: "",
  gender: "M",
  blood_group: "",
};

function ProfileSettings() {
  const [profile, setProfile] = useState<ProfileDraft>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const res = await window.electron.ipcRenderer.invoke("user:current");
        if (!res) throw new Error("Unable to load profile.");
        setProfile({
          name: res.name ?? "",
          email: res.email ?? "",
          phone: res.phone ?? "",
          emergency_contact: res.emergency_contact ?? "",
          address: res.address ?? "",
          date_of_birth: res.date_of_birth ?? "",
          gender: res.gender ?? "M",
          blood_group: res.blood_group ?? "",
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleLogout() {
    await window.electron.ipcRenderer.invoke("session:erase");
    window.location.reload();
  }

  async function submitProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);

    const required: (keyof ProfileDraft)[] = [
      "name",
      "email",
      "phone",
      "emergency_contact",
      "address",
      "date_of_birth",
      "gender",
      "blood_group",
    ];

    for (const key of required) {
      const value = profile[key];
      if (!value || (typeof value === "string" && !value.trim())) {
        setError(`${key.replace(/_/g, " ")} is required.`);
        setSavingProfile(false);
        return;
      }
    }

    try {
      const res = await window.electron.ipcRenderer.invoke(
        "user:updateProfile",
        profile,
      );
      if (res === 0) throw new Error("No changes were saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    setSavingPassword(true);
    setError(null);

    if (!oldPassword || !newPassword) {
      setError("Both password fields are required.");
      setSavingPassword(false);
      return;
    }

    try {
      await window.electron.ipcRenderer.invoke(
        "user:updatePassword",
        oldPassword,
        newPassword,
      );
      setOldPassword("");
      setNewPassword("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password update failed.");
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen p-8 max-w-[900px] mx-auto text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-[900px] mx-auto space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Profile ProfileSettings
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            Manage your personal information and security.
          </p>
        </div>
        <Button variant="destructive" onClick={handleLogout}>
          Logout
        </Button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Profile Information</h2>

        <form onSubmit={submitProfile} className="space-y-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={profile.email}
              onChange={(e) =>
                setProfile({ ...profile, email: e.target.value })
              }
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Address</label>
            <Input
              value={profile.address}
              onChange={(e) =>
                setProfile({ ...profile, address: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Date of birth</label>
              <Input
                type="date"
                max={new Date().toISOString().split("T")[0]}
                value={profile.date_of_birth}
                onChange={(e) =>
                  setProfile({ ...profile, date_of_birth: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Blood group</label>
              <Select
                value={profile.blood_group}
                onValueChange={(v) =>
                  setProfile({ ...profile, blood_group: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bloodGroups.map((bg) => (
                    <SelectItem key={bg} value={bg}>
                      {bg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Gender</label>
              <Select
                value={profile.gender}
                onValueChange={(v) =>
                  setProfile({ ...profile, gender: v as Gender })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Male</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                  <SelectItem value="O">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Phone</label>
              <Input
                value={profile.phone}
                onChange={(e) =>
                  setProfile({ ...profile, phone: e.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Emergency contact</label>
              <Input
                value={profile.emergency_contact}
                onChange={(e) =>
                  setProfile({
                    ...profile,
                    emergency_contact: e.target.value,
                  })
                }
              />
            </div>
          </div>

          <Button type="submit" disabled={savingProfile}>
            {savingProfile ? "Saving…" : "Save Changes"}
          </Button>
        </form>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold mb-4">Update Password</h2>

        <form onSubmit={submitPassword} className="space-y-4 max-w-md">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">Old password</label>
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium">New password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>

          <Button type="submit" disabled={savingPassword}>
            {savingPassword ? "Updating…" : "Update Password"}
          </Button>
        </form>
      </section>
    </div>
  );
}

export default ProfileSettings;
