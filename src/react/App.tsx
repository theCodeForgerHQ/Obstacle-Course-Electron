import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./components/ui/button";
import {
  Upload,
  Download,
  Settings as SettingsIcon,
  Eye,
  EyeOff,
  Unlock,
  Lock,
} from "lucide-react";

declare global {
  interface Window {
    api: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import { Input } from "./components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";

type Customer = {
  id: number;
  name: string;
  address?: string | null;
  created_at: string;
  dateOfBirth?: string | null;
  phone?: string | null;
  secondaryPhone?: string | null;
  bloodGroup?: string | null;
};

type ScoreRow = {
  id: number;
  customer_id: number;
  score: number;
  date: string;
  name: string;
};

type CustomerDraft = {
  name: string;
  address: string;
  dateOfBirth: string;
  phone: string;
  secondaryPhone: string;
  bloodGroup: string;
};

type SortKey = "created_at" | "name" | "id";
type SortDir = "asc" | "desc";

type TabKey = "customers" | "leaderboard";
type Preset = "today" | "week" | "month" | "year" | "all";

const emptyDraft: CustomerDraft = {
  name: "",
  address: "",
  dateOfBirth: "",
  phone: "",
  secondaryPhone: "",
  bloodGroup: "",
};

const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function App() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [tab, setTab] = useState<TabKey>("customers");
  const [preset, setPreset] = useState<Preset>("all");
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingScores, setLoadingScores] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [scoreError, setScoreError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [leaderboardSearch, setLeaderboardSearch] = useState("");
  const [bloodFilter, setBloodFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<CustomerDraft>(emptyDraft);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsEmail, setSettingsEmail] = useState<string | null>(null);

  const [pwOld, setPwOld] = useState("");
  const [pwNew, setPwNew] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [originalEmail, setOriginalEmail] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  useEffect(() => {
    refreshCustomers();
    refreshScores();
  }, []);

  async function refreshCustomers() {
    setLoadingCustomers(true);
    setCustomerError(null);
    try {
      const rows = (await window.api.invoke("customers:getAll")) as Customer[];
      setCustomers(rows);
    } catch (e) {
      const errorMsg =
        e instanceof Error ? e.message : "Unable to load customers";
      setCustomerError(errorMsg);
      console.error("Error loading customers:", e);
    } finally {
      setLoadingCustomers(false);
    }
  }

  async function refreshScores() {
    setLoadingScores(true);
    setScoreError(null);
    try {
      const rows = (await window.api.invoke("scores:getAll")) as ScoreRow[];
      setScores(rows);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unable to load scores";
      setScoreError(errorMsg);
      console.error("Error loading scores:", e);
    } finally {
      setLoadingScores(false);
    }
  }

  const leaderboard = useMemo(() => {
    const now = new Date();
    const from = new Date(now);

    if (preset === "today") from.setDate(now.getDate() - 1);
    if (preset === "week") from.setDate(now.getDate() - 7);
    if (preset === "month") from.setMonth(now.getMonth() - 1);
    if (preset === "year") from.setFullYear(now.getFullYear() - 1);
    if (preset === "all") from.setFullYear(2025);

    const totals = new Map<
      number,
      { customer_id: number; name: string; score: number }
    >();

    scores.forEach((s) => {
      if (new Date(s.date) >= from) {
        const prev = totals.get(s.customer_id);
        totals.set(s.customer_id, {
          customer_id: s.customer_id,
          name: s.name,
          score: (prev?.score ?? 0) + s.score,
        });
      }
    });

    return Array.from(totals.values())
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({
        ...r,
        rank: i + 1,
      }));
  }, [scores, preset]);

  const filtered = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    let rows = customers.filter((c) => {
      const haystack = [
        c.id,
        c.name,
        c.address ?? "",
        c.phone ?? "",
        c.secondaryPhone ?? "",
        c.bloodGroup ?? "",
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = term === "" || haystack.includes(term);
      const matchesBlood =
        bloodFilter === "all" ||
        (c.bloodGroup ?? "").toUpperCase() === bloodFilter;
      return matchesSearch && matchesBlood;
    });

    rows = rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "created_at") {
        const diff =
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return diff * dir;
      }
      const valA = (a[sortKey] ?? "").toString().toLowerCase();
      const valB = (b[sortKey] ?? "").toString().toLowerCase();
      if (valA < valB) return -1 * dir;
      if (valA > valB) return 1 * dir;
      return 0;
    });

    return rows;
  }, [bloodFilter, customers, customerSearch, sortDir, sortKey]);

  function openCreate() {
    setDraft(emptyDraft);
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(row: Customer) {
    setEditing(row);
    setDraft({
      name: row.name,
      address: row.address ?? "",
      dateOfBirth: row.dateOfBirth ?? "",
      phone: row.phone ?? "",
      secondaryPhone: row.secondaryPhone ?? "",
      bloodGroup: row.bloodGroup ?? "",
    });
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
      if (!draft.name.trim()) {
        setFormError("Participant Name is required.");
        setSubmitting(false);
        return;
      }

      if (!draft.phone.trim()) {
        setFormError("Phone is required.");
        setSubmitting(false);
        return;
      }

      if (!draft.secondaryPhone.trim()) {
        setFormError("Emergency contact is required.");
        setSubmitting(false);
        return;
      }

      if (!draft.bloodGroup.trim()) {
        setFormError("Blood group is required.");
        setSubmitting(false);
        return;
      }

      if (editing) {
        const updates = {
          name: draft.name.trim(),
          address: draft.address.trim() || undefined,
          dateOfBirth: draft.dateOfBirth.trim() || undefined,
          phone: draft.phone.trim(),
          secondaryPhone: draft.secondaryPhone.trim(),
          bloodGroup: draft.bloodGroup.trim(),
        };
        await window.api.invoke("customers:update", editing.id, updates);
      } else {
        const newCustomer = {
          name: draft.name.trim(),
          address: draft.address.trim() || undefined,
          dateOfBirth: draft.dateOfBirth.trim() || undefined,
          phone: draft.phone.trim(),
          secondaryPhone: draft.secondaryPhone.trim(),
          bloodGroup: draft.bloodGroup.trim(),
        };
        await window.api.invoke("customers:create", newCustomer);
      }

      await refreshCustomers();
      closeForm();
    } catch (err) {
      console.error(err);
      const errorMsg =
        err instanceof Error ? err.message : "Save failed. Please retry.";
      setFormError(errorMsg);
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    const confirmed = window.confirm("Delete this Participant?");
    if (!confirmed) return;
    setCustomerError(null);
    try {
      await window.api.invoke("customers:delete", id);
      await refreshCustomers();
      await refreshScores();
    } catch (err) {
      console.error(err);
      const errorMsg =
        err instanceof Error ? err.message : "Delete failed. Please retry.";
      setCustomerError(errorMsg);
    }
  }

  async function importCsv(kind: "customers" | "scores") {
    await window.api.invoke(`${kind}:importCsv`);
    if (kind === "customers") await refreshCustomers();
    if (kind === "scores") await refreshScores();
  }

  async function exportCsv(kind: "customers" | "scores") {
    await window.api.invoke(`${kind}:exportCsv`);
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

  return (
    <div className="min-h-screen p-8 max-w-[1400px] mx-auto">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <div className="flex gap-2">
          <Button
            variant={tab === "customers" ? "default" : "ghost"}
            onClick={() => setTab("customers")}
          >
            Participants
          </Button>
          <Button
            variant={tab === "leaderboard" ? "default" : "ghost"}
            onClick={() => setTab("leaderboard")}
          >
            Leaderboard
          </Button>
        </div>

        <div className="ml-auto flex gap-2">
          {tab === "customers" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportCsv("customers")}
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => importCsv("customers")}
              >
                <Upload className="w-4 h-4 mr-1" />
                Import
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsIcon className="w-4 h-4 mr-1" />
                Settings
              </Button>
            </>
          )}

          {tab === "leaderboard" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => exportCsv("scores")}
              >
                <Download className="w-4 h-4 mr-1" />
                Export
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => importCsv("scores")}
              >
                <Upload className="w-4 h-4 mr-1" />
                Import
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSettingsOpen(true)}
              >
                <SettingsIcon className="w-4 h-4 mr-1" />
                Settings
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog
        open={settingsOpen}
        onOpenChange={(open) => {
          setSettingsOpen(open);
          if (open) {
            window.api.invoke("settings:get").then((r: any) => {
              setSettingsEmail(r?.email ?? null);
              setOriginalEmail(r?.email ?? null);
            });
            setPwOld("");
            setPwNew("");
            setUnlocked(false);
            setShowCurrent(false);
            setShowNew(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Manage account email and password.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {settingsError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-800">
                {settingsError}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                Current Password
              </label>

              <div className="flex gap-2 items-center">
                <Input
                  type={showCurrent ? "text" : "password"}
                  placeholder="Enter current password"
                  value={pwOld}
                  onChange={(e) => {
                    setPwOld(e.target.value);
                    setUnlocked(false);
                  }}
                />

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowCurrent(!showCurrent)}
                >
                  {showCurrent ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    setSettingsError(null);
                    setUnlocked(false);

                    try {
                      const ok = (await window.api.invoke(
                        "settings:verifyPassword",
                        pwOld
                      )) as boolean;

                      if (!ok) {
                        setSettingsError("Current password is incorrect");
                        return;
                      }

                      setUnlocked(true);
                    } catch (e: any) {
                      setSettingsError(
                        e?.message ?? "Password verification failed"
                      );
                    }
                  }}
                >
                  {unlocked ? (
                    <Unlock className="w-4 h-4 text-green-600" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Email</label>
              <Input
                value={settingsEmail ?? ""}
                onChange={(e) => setSettingsEmail(e.target.value)}
                disabled={!unlocked}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">
                New Password
              </label>

              <div className="flex gap-2 items-center">
                <Input
                  type={showNew ? "text" : "password"}
                  placeholder="New password"
                  value={pwNew}
                  onChange={(e) => setPwNew(e.target.value)}
                  disabled={!unlocked}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowNew(!showNew)}
                >
                  {showNew ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-8" />
          <DialogFooter>
            <Button
              onClick={() => {
                setSettingsOpen(false);
                setPwOld("");
                setPwNew("");
                setUnlocked(false);
              }}
            >
              Close
            </Button>
            <Button
              onClick={async () => {
                setSettingsError(null);

                const emailChanged =
                  (settingsEmail ?? "") !== (originalEmail ?? "");
                const pwChanged = pwNew.trim() !== "";

                if (!emailChanged && !pwChanged) {
                  setSettingsOpen(false);
                  return;
                }

                if (!unlocked) {
                  setSettingsError(
                    "Please unlock settings using your current password"
                  );
                  return;
                }

                try {
                  if (emailChanged) {
                    await window.api.invoke(
                      "settings:updateEmail",
                      pwOld,
                      settingsEmail
                    );
                  }

                  if (pwChanged) {
                    await window.api.invoke(
                      "settings:changePassword",
                      pwOld,
                      pwNew
                    );
                  }

                  setSettingsOpen(false);
                  setSettingsError(null);
                  setPwOld("");
                  setPwNew("");
                  setUnlocked(false);
                } catch (e: any) {
                  setSettingsError(e?.message ?? "Failed to save settings");
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {tab === "customers" && (
        <>
          <header className="flex justify-between items-start gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">
                Obstacle Course Registrations
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage Participants, Emergency Contacts, and Medical Details.
              </p>
            </div>
            <Button onClick={openCreate}>Add Participant</Button>
          </header>
          <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-700">Search</label>
                <Input
                  type="search"
                  placeholder="Search by Name, ID, Phone, Address"
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
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
                      <SelectItem value="created_at">
                        Date Registered
                      </SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="id">ID</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setSortDir(sortDir === "asc" ? "desc" : "asc")
                    }
                    className="shrink-0"
                  >
                    {sortDir === "asc" ? "↑ Asc" : "↓ Desc"}
                  </Button>
                </div>
              </div>
            </div>
          </section>
          {customerError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-800">
              {customerError}
            </div>
          )}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {loadingCustomers ? (
              <div className="p-8 text-center text-gray-500">
                Loading Participants…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No Participants match the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px]">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        ID
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Name
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Address
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Registered On
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
                      <th className="text-right text-xs font-semibold text-gray-600 px-4 py-3">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, idx) => (
                      <tr
                        key={row.id}
                        className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                        onClick={() => openEdit(row)}
                      >
                        <td className="px-4 py-3">
                          <div className="font-mono text-sm">{row.id}</div>
                        </td>
                        <td className="px-4 py-3 font-medium text-sm whitespace-nowrap">
                          {row.name}
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="text-sm truncate">
                            {row.address || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {new Date(row.created_at)
                            .toLocaleDateString()
                            .replace(/\//g, "-")}
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          {row.dateOfBirth || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm">{row.phone || "—"}</span>
                            <span className="text-xs text-gray-400">
                              Primary
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm">
                              {row.secondaryPhone || "—"}
                            </span>
                            <span className="text-xs text-gray-400">
                              Emergency
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">{badge(row.bloodGroup)}</td>
                        <td className="px-4 py-3">
                          <div
                            className="flex gap-2 justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(row)}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(row.id)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}

      {tab === "leaderboard" && (
        <>
          <header className="flex justify-between mb-6">
            <div>
              <h1 className="text-3xl font-semibold">Leaderboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                Rankings based on total scores for the selected period.
              </p>
            </div>
            <Select
              value={preset}
              onValueChange={(v) => setPreset(v as Preset)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
                <SelectItem value="all">Since Start</SelectItem>
              </SelectContent>
            </Select>
          </header>
          <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex flex-row gap-3 justify-between items-center">
              <label className="text-sm text-gray-700 w-fit shrink-0">
                Search Participant
              </label>
              <Input
                type="search"
                placeholder="Search by name"
                value={leaderboardSearch}
                onChange={(e) => setLeaderboardSearch(e.target.value)}
              />
            </div>
          </section>
          {scoreError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-800">
              {scoreError}
            </div>
          )}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {loadingScores ? (
              <div className="p-8 text-center text-gray-500">
                Loading Rankings
              </div>
            ) : leaderboard.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No scores available for this period.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px]">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Rank
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        ID
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Name
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard
                      .filter((row) =>
                        row.name
                          .toLowerCase()
                          .includes(leaderboardSearch.toLowerCase())
                      )
                      .map((row, idx) => (
                        <tr
                          key={row.customer_id}
                          className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono text-sm">#{row.rank}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-sm">
                              {row.customer_id}
                            </div>
                          </td>
                          <td className="px-4 py-3 font-medium text-sm">
                            {row.name}
                          </td>
                          <td className="px-4 py-3 font-medium text-sm">
                            {row.score}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
      <Dialog open={showForm} onOpenChange={closeForm}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit Participant" : "New Participant"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update Participant Information below."
                : "Fill in the details to register a new Participant."}
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
              <label className="text-sm font-medium">Address</label>
              <Input
                type="text"
                value={draft.address}
                onChange={(e) =>
                  setDraft({ ...draft, address: e.target.value })
                }
                placeholder="Street, city"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Date of birth</label>
                <Input
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={
                    draft.dateOfBirth
                      ? draft.dateOfBirth.split("-").reverse().join("-")
                      : ""
                  }
                  onChange={(e) => {
                    const iso = e.target.value;
                    if (!iso) {
                      setDraft({ ...draft, dateOfBirth: "" });
                      return;
                    }

                    const todayIso = new Date().toISOString().split("T")[0];
                    if (iso > todayIso) return;

                    setDraft({
                      ...draft,
                      dateOfBirth: iso.split("-").reverse().join("-"),
                    });
                  }}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Blood group <span className="text-red-500">*</span>
                </label>
                <Select
                  value={draft.bloodGroup}
                  onValueChange={(v) => setDraft({ ...draft, bloodGroup: v })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Blood Group" />
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Phone <span className="text-red-500">*</span>
                </label>
                <Input
                  type="tel"
                  value={draft.phone}
                  onChange={(e) =>
                    setDraft({ ...draft, phone: e.target.value })
                  }
                  placeholder="Primary contact"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Emergency contact <span className="text-red-500">*</span>
                </label>
                <Input
                  type="tel"
                  value={draft.secondaryPhone}
                  onChange={(e) =>
                    setDraft({ ...draft, secondaryPhone: e.target.value })
                  }
                  placeholder="Secondary contact"
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto"
              >
                {submitting ? "Saving…" : editing ? "Save" : "Register"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
