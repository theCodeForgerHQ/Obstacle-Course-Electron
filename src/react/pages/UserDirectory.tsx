declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>;
      };
    };
  }
}

import { useEffect, useMemo, useState } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import type { Session, User } from "../../electron/utils";

type SortKey = "name" | "id";
type SortDir = "asc" | "desc";

const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const genders = ["M", "F", "O"];
const genderLabels: Record<string, string> = {
  M: "Male",
  F: "Female",
  O: "Other",
};
const roles = ["OPERATOR", "MANAGER"] as const;

const emptyDraft: Omit<User, "id" | "role"> = {
  name: "",
  email: "",
  address: "",
  date_of_birth: "",
  phone: "",
  emergency_contact: "",
  blood_group: "",
  gender: "M",
  password: "",
};

function UsersDirectory() {
  const [session, setSession] = useState<Session | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [bloodFilter, setBloodFilter] = useState<string>("all");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const s = await window.electron.ipcRenderer.invoke("session:read");
      if (!s?.error) setSession(s as Session | null);

      if (s?.role === "OPERATOR") {
        setLoadingUsers(false);
        return;
      }
      await refreshUsers();
    }
    init();
  }, []);

  async function refreshUsers() {
    setLoadingUsers(true);
    setError(null);
    try {
      const result = await window.electron.ipcRenderer.invoke("user:list");
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(result.error as string);
      }
      setUsers(result as User[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unable to load users.";
      setError(msg);
      console.error("Error loading users:", e);
    } finally {
      setLoadingUsers(false);
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = users.filter((u) => {
      const haystack = [
        u.id,
        u.name,
        u.email,
        u.address,
        u.phone,
        u.emergency_contact,
        u.blood_group,
        u.role,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = term === "" || haystack.includes(term);
      const matchesBlood =
        bloodFilter === "all" ||
        (u.blood_group ?? "").toUpperCase() === bloodFilter;
      const matchesGender = genderFilter === "all" || u.gender === genderFilter;
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesBlood && matchesGender && matchesRole;
    });

    rows = rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const valA = (a[sortKey] ?? "").toString().toLowerCase();
      const valB = (b[sortKey] ?? "").toString().toLowerCase();
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });

    return rows;
  }, [users, search, bloodFilter, genderFilter, roleFilter, sortKey, sortDir]);

  function openCreate() {
    setDraft(emptyDraft);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setSubmitting(false);
    setFormError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);

    try {
      const required: (keyof typeof emptyDraft)[] = [
        "name",
        "email",
        "phone",
        "emergency_contact",
        "address",
        "date_of_birth",
        "gender",
        "blood_group",
        "password",
      ];
      for (const field of required) {
        const value = draft[field as keyof typeof draft] as any;
        if (!value || (typeof value === "string" && !value.trim())) {
          const label = field
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          setFormError(`${label} is required.`);
          setSubmitting(false);
          return;
        }
      }

      const newUser: User = {
        name: draft.name.trim(),
        email: draft.email.trim(),
        address: draft.address?.trim(),
        date_of_birth: draft.date_of_birth?.trim(),
        phone: draft.phone.trim(),
        emergency_contact: draft.emergency_contact.trim(),
        blood_group: draft.blood_group.trim(),
        gender: draft.gender,
        password: draft.password,
        role: "OPERATOR",
      } as User;

      const res = await window.electron.ipcRenderer.invoke(
        "user:create",
        newUser,
      );
      if (res && typeof res === "object" && "error" in res) {
        throw new Error(res.error as string);
      }

      await refreshUsers();
      closeForm();
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error ? err.message : "Save failed. Please retry.";
      setFormError(msg);
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm("Delete this user?");
    if (!confirmed) return;
    setError(null);
    try {
      const res = await window.electron.ipcRenderer.invoke("user:delete", id);
      if (res && typeof res === "object" && "error" in res) {
        throw new Error(res.error as string);
      }
      await refreshUsers();
    } catch (err) {
      console.error(err);
      const msg =
        err instanceof Error ? err.message : "Delete failed. Please retry.";
      setError(msg);
    }
  }

  async function handlePromote(id: number) {
    try {
      const res = await window.electron.ipcRenderer.invoke(
        "user:promoteToManager",
        id,
      );
      if (res && typeof res === "object" && "error" in res) {
        throw new Error(res.error as string);
      }
      await refreshUsers();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Promotion failed.");
    }
  }

  async function handleDemote(id: number) {
    try {
      const res = await window.electron.ipcRenderer.invoke(
        "user:demoteToOperator",
        id,
      );
      if (res && typeof res === "object" && "error" in res) {
        throw new Error(res.error as string);
      }
      await refreshUsers();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Demotion failed.");
    }
  }

  const badge = (value?: string | null) =>
    value ? (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
        {value}
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-400">
        NA
      </span>
    );

  if (session?.role === "OPERATOR") {
    return (
      <div className="min-h-screen p-8 max-w-[1400px] mx-auto">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          You do not have permission to view user management.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-[1400px] mx-auto">
      <header className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Users Directory
          </h1>
          <p className="text-sm text-gray-600 mt-1">Manage Users and Roles.</p>
        </div>
        <Button onClick={openCreate}>Add User</Button>
      </header>

      <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">Search</label>
            <Input
              type="search"
              placeholder="Search by Name, ID, Phone, Address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">Blood Group</label>
            <Select value={bloodFilter} onValueChange={setBloodFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {bloodGroups.map((bg) => (
                  <SelectItem key={bg} value={bg}>
                    {bg}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">Gender</label>
            <Select value={genderFilter} onValueChange={setGenderFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {genders.map((g) => (
                  <SelectItem key={g} value={g}>
                    {genderLabels[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">Role</label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {roles.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r[0] + r.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-gray-700">Sort by</label>
            <div className="flex gap-2">
              <Select
                value={sortKey}
                onValueChange={(v) => setSortKey(v as SortKey)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="id">ID</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
                className="shrink-0"
              >
                {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
              </Button>
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        {loadingUsers ? (
          <div className="p-8 text-center text-gray-500">Loading Users…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No Users match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="border-b border-gray-200">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    ID
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    Name
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    Role
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    Email
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    Address
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    Gender
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    DOB
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    Phone
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    Emergency Contact
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    Blood Group
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                    Registered On
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 px-4 py-3">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => (
                  <tr
                    key={row.id}
                    className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm">
                        {"U" + row.id?.toString().padStart(3, "0")}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-sm whitespace-nowrap">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.role[0] + row.role.slice(1).toLowerCase()}
                    </td>
                    <td className="px-4 py-3 text-sm">{row.email}</td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="text-sm truncate">{row.address}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {row.gender === "M"
                        ? "Male"
                        : row.gender === "F"
                          ? "Female"
                          : "Other"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {row.date_of_birth
                        ? new Date(row.date_of_birth + "T00:00:00")
                            .toLocaleDateString("en-GB")
                            .replace(/\//g, "-")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm">{row.phone}</td>
                    <td className="px-4 py-3 text-sm">
                      {row.emergency_contact}
                    </td>
                    <td className="px-4 py-3">{badge(row.blood_group)}</td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {row.created_at
                        ? new Date(row.created_at)
                            .toLocaleDateString()
                            .replace(/\//g, "-")
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        {session?.role === "MANAGER" &&
                          row.role === "OPERATOR" && (
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => row.id && handleDelete(row.id)}
                            >
                              Delete
                            </Button>
                          )}
                        {session?.role === "OWNER" && (
                          <>
                            {row.role === "OPERATOR" && (
                              <Button
                                size="sm"
                                onClick={() => row.id && handlePromote(row.id!)}
                              >
                                Promote
                              </Button>
                            )}
                            {row.role === "MANAGER" && (
                              <Button
                                size="sm"
                                onClick={() => row.id && handleDemote(row.id!)}
                              >
                                Demote
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => row.id && handleDelete(row.id)}
                            >
                              Delete
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New User</DialogTitle>
            <DialogDescription>
              Fill in the details to register a new User.
            </DialogDescription>
          </DialogHeader>

          {formError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {formError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Full Name"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Email <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                placeholder="email@example.com"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Address <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={draft.address}
                onChange={(e) =>
                  setDraft({ ...draft, address: e.target.value })
                }
                placeholder="Street, City"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Date of birth</label>
                <Input
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={draft.date_of_birth || ""}
                  onChange={(e) => {
                    const iso = e.target.value;
                    setDraft({ ...draft, date_of_birth: iso });
                  }}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Blood group</label>
                <Select
                  value={draft.blood_group}
                  onValueChange={(v) => setDraft({ ...draft, blood_group: v })}
                  required
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
                  value={draft.gender}
                  onValueChange={(v) =>
                    setDraft({ ...draft, gender: v as "M" | "F" | "O" })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {genders.map((g) => (
                      <SelectItem key={g} value={g}>
                        {genderLabels[g]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Phone</label>
                <Input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                  placeholder="Primary Contact"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Emergency contact</label>
                <Input
                  type="tel"
                  value={draft.emergency_contact}
                  onChange={(e) =>
                    setDraft({ ...draft, emergency_contact: e.target.value })
                  }
                  placeholder="Secondary Contact"
                  required
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Password</label>
              <Input
                type="password"
                value={draft.password}
                onChange={(e) =>
                  setDraft({ ...draft, password: e.target.value })
                }
                placeholder="Strong password"
                required
              />
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? "Saving…" : "Register"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default UsersDirectory;
