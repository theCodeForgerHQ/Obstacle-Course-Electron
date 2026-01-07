import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./components/ui/button";

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
  uid: string;
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
  uid: string;
  score: number;
  date: string;
  name: string;
};

type LeaderboardRow = {
  uid: string;
  name: string;
  score: number;
  rank: number;
};

type CustomerDraft = {
  uid: string;
  name: string;
  address: string;
  dateOfBirth: string;
  phone: string;
  secondaryPhone: string;
  bloodGroup: string;
};

type SortKey = "created_at" | "name" | "uid";
type SortDir = "asc" | "desc";

type TabKey = "customers" | "leaderboard";
type Preset = "today" | "week" | "month" | "year" | "all";

const emptyDraft: CustomerDraft = {
  uid: "",
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
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [tab, setTab] = useState<TabKey>("customers");
  const [preset, setPreset] = useState<Preset>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [bloodFilter, setBloodFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<CustomerDraft>(emptyDraft);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshCustomers();
    refreshScores();
  }, []);

  useEffect(() => {
    computeLeaderboard();
  }, [scores, preset]);

  async function refreshCustomers() {
    setLoading(true);
    setError(null);
    try {
      const rows = (await window.api.invoke("customers:getAll")) as Customer[];
      setCustomers(rows);
    } catch (e) {
      const errorMsg =
        e instanceof Error ? e.message : "Unable to load customers";
      setError(errorMsg);
      console.error("Error loading customers:", e);
    } finally {
      setLoading(false);
    }
  }

  async function refreshScores() {
    setLoading(true);
    setError(null);
    try {
      const rows = (await window.api.invoke("scores:getAll")) as ScoreRow[];
      setScores(rows);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Unable to load scores";
      setError(errorMsg);
      console.error("Error loading scores:", e);
    } finally {
      setLoading(false);
    }
  }

  function computeLeaderboard() {
    const now = new Date();
    const from = new Date(now);

    if (preset === "today") from.setDate(now.getDate() - 1);
    if (preset === "week") from.setDate(now.getDate() - 7);
    if (preset === "month") from.setMonth(now.getMonth() - 1);
    if (preset === "year") from.setFullYear(now.getFullYear() - 1);
    if (preset === "all") from.setFullYear(1970);

    const totals = new Map<
      string,
      { uid: string; name: string; score: number }
    >();

    scores.forEach((s) => {
      if (new Date(s.date) >= from) {
        const prev = totals.get(s.uid);
        totals.set(s.uid, {
          uid: s.uid,
          name: s.name,
          score: (prev?.score ?? 0) + s.score,
        });
      }
    });

    const rows = Array.from(totals.values())
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({
        ...r,
        rank: i + 1,
      }));

    setLeaderboard(rows);
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    let rows = customers.filter((c) => {
      const haystack = [
        c.uid,
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
  }, [bloodFilter, customers, search, sortDir, sortKey]);

  function openCreate() {
    setDraft(emptyDraft);
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(row: Customer) {
    setEditing(row);
    setDraft({
      uid: row.uid,
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
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (!draft.uid.trim() || !draft.name.trim()) {
        setError("UID and name are required.");
        setSubmitting(false);
        return;
      }

      if (!draft.phone.trim()) {
        setError("Phone is required.");
        setSubmitting(false);
        return;
      }

      if (!draft.secondaryPhone.trim()) {
        setError("Emergency contact is required.");
        setSubmitting(false);
        return;
      }

      if (!draft.bloodGroup.trim()) {
        setError("Blood group is required.");
        setSubmitting(false);
        return;
      }

      if (!/^\d{10}$/.test(draft.uid.trim())) {
        setError("UID must be a 10-digit number");
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
        await window.api.invoke("customers:update", editing.uid, updates);
      } else {
        const newCustomer = {
          uid: draft.uid.trim(),
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
      setError(errorMsg);
      setSubmitting(false);
    }
  }

  async function handleDelete(uid: string) {
    const confirmed = window.confirm("Delete this customer?");
    if (!confirmed) return;
    setError(null);
    try {
      await window.api.invoke("customers:delete", uid);
      await refreshCustomers();
    } catch (err) {
      console.error(err);
      const errorMsg =
        err instanceof Error ? err.message : "Delete failed. Please retry.";
      setError(errorMsg);
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

  return (
    <div className="min-h-screen p-8 max-w-[1400px] mx-auto">
      <div className="flex gap-2 mb-6">
        <Button
          variant={tab === "customers" ? "default" : "ghost"}
          onClick={() => setTab("customers")}
        >
          Customers
        </Button>
        <Button
          variant={tab === "leaderboard" ? "default" : "ghost"}
          onClick={() => setTab("leaderboard")}
        >
          Leaderboard
        </Button>
      </div>

      {tab === "customers" && (
        <>
          <header className="flex justify-between items-start gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">
                Obstacle Course Registry
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Track entrants, emergency contacts, and blood groups.
              </p>
            </div>
            <Button onClick={openCreate}>Add customer</Button>
          </header>
          <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-700">Search</label>
                <Input
                  type="search"
                  placeholder="Search by name, UID, phone, address"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm text-gray-700">Blood group</label>
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
                      <SelectItem value="created_at">Joined</SelectItem>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="uid">UID</SelectItem>
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
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-800">
              {error}
            </div>
          )}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                Loading customers…
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No customers match your filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px]">
                  <thead className="border-b border-gray-200">
                    <tr>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        UID
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Name
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Address
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Joined
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        DOB
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Phone
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Emergency
                      </th>
                      <th className="text-left text-xs font-semibold text-gray-600 px-4 py-3">
                        Blood
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
                          <div className="font-mono text-sm">{row.uid}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-sm">
                              {row.name}
                            </span>
                            <span className="text-xs text-gray-400">
                              #{row.id}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="text-sm truncate">
                            {row.address || "—"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {new Date(row.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
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
                              onClick={() => handleDelete(row.uid)}
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
              <h1 className="text-3xl font-semibold">Players Leaderboard</h1>
              <p className="text-sm text-gray-600 mt-1">
                View top performers ranked by total score across selected time
                periods.
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
                <SelectItem value="today">Top Today</SelectItem>
                <SelectItem value="week">Top This Week</SelectItem>
                <SelectItem value="month">Top This Month</SelectItem>
                <SelectItem value="year">Top This Year</SelectItem>
                <SelectItem value="all">Top Since Start</SelectItem>
              </SelectContent>
            </Select>
          </header>
          <section className="bg-white border border-gray-200 rounded-xl p-4 mb-4 shadow-sm">
            <div className="flex flex-row gap-3 justify-between items-center">
              <label className="text-sm text-gray-700 w-fit shrink-0">
                Search Player
              </label>
              <Input
                type="search"
                placeholder="Search by name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </section>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-800">
              {error}
            </div>
          )}
          <section className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {loading ? (
              <div className="p-8 text-center text-gray-500">
                Loading customers…
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
                        UID
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
                        row.name.toLowerCase().includes(search.toLowerCase())
                      )
                      .map((row, idx) => (
                        <tr
                          key={row.uid}
                          className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-mono text-sm">#{row.rank}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-mono text-sm">{row.uid}</div>
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
              {editing ? "Edit customer" : "New customer"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update customer information below."
                : "Fill in the details to register a new customer."}
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                UID (RFID) <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={draft.uid}
                onChange={(e) => setDraft({ ...draft, uid: e.target.value })}
                placeholder="Scan or enter UID"
                disabled={!!editing}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Full name"
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
                  value={draft.dateOfBirth}
                  onChange={(e) =>
                    setDraft({ ...draft, dateOfBirth: e.target.value })
                  }
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
                    <SelectValue placeholder="Select blood group" />
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
                {submitting ? "Saving…" : editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
