import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import "./App.css";

declare global {
  interface Window {
    api: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
    };
  }
}

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

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const rows = await window.api.invoke("db-customers-get-all");
      setCustomers((rows as Customer[]) ?? []);
    } catch (e) {
      setError("Unable to load customers.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

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
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!draft.uid.trim() || !draft.name.trim()) {
        setError("UID and name are required.");
        setSubmitting(false);
        return;
      }

      if (editing) {
        const updates = {
          name: draft.name.trim(),
          address: draft.address.trim() || undefined,
          dateOfBirth: draft.dateOfBirth.trim() || undefined,
          phone: draft.phone.trim() || undefined,
          secondaryPhone: draft.secondaryPhone.trim() || undefined,
          bloodGroup: draft.bloodGroup.trim() || undefined,
        };
        await window.api.invoke("db-customers-update", editing.uid, updates);
      } else {
        await window.api.invoke("db-customers-create", {
          uid: draft.uid.trim(),
          name: draft.name.trim(),
          address: draft.address.trim() || undefined,
          dateOfBirth: draft.dateOfBirth.trim() || undefined,
          phone: draft.phone.trim() || undefined,
          secondaryPhone: draft.secondaryPhone.trim() || undefined,
          bloodGroup: draft.bloodGroup.trim() || undefined,
        });
      }

      await refresh();
      closeForm();
    } catch (err) {
      console.error(err);
      setError("Save failed. Please retry.");
      setSubmitting(false);
    }
  }

  async function handleDelete(uid: string) {
    const confirmed = window.confirm("Delete this customer?");
    if (!confirmed) return;
    try {
      await window.api.invoke("db-customers-delete", uid);
      await refresh();
    } catch (err) {
      console.error(err);
      setError("Delete failed. Please retry.");
    }
  }

  const badge = (value?: string | null) =>
    value ? (
      <span className="pill">{value}</span>
    ) : (
      <span className="pill pill-muted">NA</span>
    );

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">RFID customers</p>
          <h1>Obstacle Course Registry</h1>
          <p className="lede">
            Track entrants, emergency contacts, and blood groups for quick
            access on-site.
          </p>
        </div>
        <button className="button primary" onClick={openCreate}>
          Add customer
        </button>
      </header>

      <section className="panel">
        <div className="controls">
          <label className="control">
            <span>Search</span>
            <input
              type="search"
              placeholder="Search by name, UID, phone, address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="control">
            <span>Blood group</span>
            <select
              value={bloodFilter}
              onChange={(e) => setBloodFilter(e.target.value)}
            >
              <option value="all">All</option>
              {bloodGroups.map((bg) => (
                <option key={bg} value={bg}>
                  {bg}
                </option>
              ))}
            </select>
          </label>
          <label className="control">
            <span>Sort by</span>
            <div className="sort-row">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
              >
                <option value="created_at">Joined</option>
                <option value="name">Name</option>
                <option value="uid">UID</option>
              </select>
              <button
                className="button ghost"
                onClick={() => setSortDir(sortDir === "asc" ? "desc" : "asc")}
              >
                {sortDir === "asc" ? "Asc" : "Desc"}
              </button>
            </div>
          </label>
        </div>
      </section>

      <section className="panel table-panel">
        {error && <div className="alert">{error}</div>}
        {loading ? (
          <div className="empty">Loading customers…</div>
        ) : filtered.length === 0 ? (
          <div className="empty">No customers match your filters.</div>
        ) : (
          <div className="table-scroll">
            <table className="grid">
              <thead>
                <tr>
                  <th>UID</th>
                  <th>Name</th>
                  <th>Address</th>
                  <th>Joined</th>
                  <th>DOB</th>
                  <th>Phone</th>
                  <th>Emergency</th>
                  <th>Blood</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id} onClick={() => openEdit(row)}>
                    <td>
                      <div className="mono">{row.uid}</div>
                    </td>
                    <td>
                      <div className="stack">
                        <strong>{row.name}</strong>
                        <span className="muted">#{row.id}</span>
                      </div>
                    </td>
                    <td className="wide">{row.address || "—"}</td>
                    <td>{new Date(row.created_at).toLocaleDateString()}</td>
                    <td>{row.dateOfBirth ? row.dateOfBirth : "—"}</td>
                    <td>
                      <div className="stack">
                        <span>{row.phone || "—"}</span>
                        <span className="muted">Primary</span>
                      </div>
                    </td>
                    <td>
                      <div className="stack">
                        <span>{row.secondaryPhone || "—"}</span>
                        <span className="muted">Emergency</span>
                      </div>
                    </td>
                    <td>{badge(row.bloodGroup)}</td>
                    <td>
                      <div
                        className="row-actions"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          className="button ghost"
                          onClick={() => openEdit(row)}
                        >
                          Edit
                        </button>
                        <button
                          className="button ghost danger"
                          onClick={() => handleDelete(row.uid)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showForm && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-surface">
            <div className="modal-head">
              <div>
                <p className="eyebrow">
                  {editing ? "Edit" : "Create"} customer
                </p>
                <h2>{editing ? editing.name : "New customer"}</h2>
              </div>
              <button className="button ghost" onClick={closeForm}>
                Close
              </button>
            </div>
            <form className="form" onSubmit={handleSubmit}>
              <label>
                <span>UID (RFID)</span>
                <input
                  type="text"
                  value={draft.uid}
                  onChange={(e) => setDraft({ ...draft, uid: e.target.value })}
                  placeholder="Scan or enter UID"
                  disabled={!!editing}
                  required
                />
              </label>
              <label>
                <span>Name</span>
                <input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="Full name"
                  required
                />
              </label>
              <label>
                <span>Address</span>
                <input
                  type="text"
                  value={draft.address}
                  onChange={(e) =>
                    setDraft({ ...draft, address: e.target.value })
                  }
                  placeholder="Street, city"
                />
              </label>
              <div className="form-grid">
                <label>
                  <span>Date of birth</span>
                  <input
                    type="date"
                    value={draft.dateOfBirth}
                    onChange={(e) =>
                      setDraft({ ...draft, dateOfBirth: e.target.value })
                    }
                  />
                </label>
                <label>
                  <span>Blood group</span>
                  <select
                    value={draft.bloodGroup}
                    onChange={(e) =>
                      setDraft({ ...draft, bloodGroup: e.target.value })
                    }
                  >
                    <option value="">Select</option>
                    {bloodGroups.map((bg) => (
                      <option key={bg} value={bg}>
                        {bg}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="form-grid">
                <label>
                  <span>Phone</span>
                  <input
                    type="tel"
                    value={draft.phone}
                    onChange={(e) =>
                      setDraft({ ...draft, phone: e.target.value })
                    }
                    placeholder="Primary contact"
                  />
                </label>
                <label>
                  <span>Emergency contact</span>
                  <input
                    type="tel"
                    value={draft.secondaryPhone}
                    onChange={(e) =>
                      setDraft({ ...draft, secondaryPhone: e.target.value })
                    }
                    placeholder="Secondary contact"
                  />
                </label>
              </div>
              <div className="form-actions">
                <button
                  type="button"
                  className="button ghost"
                  onClick={closeForm}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button primary"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : editing ? "Save changes" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
