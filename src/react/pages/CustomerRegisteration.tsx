declare global {
  interface Window {
    electron: {
      ipcRenderer: {
        invoke(channel: string, ...args: any[]): Promise<any>;
      };
    };
  }
}

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import type { Customer } from "../../electron/utils";

type SortKey = "created_at" | "name" | "id";
type SortDir = "asc" | "desc";

const emptyDraft: Customer = {
  name: "",
  email: "",
  address: "",
  date_of_birth: "",
  phone: "",
  emergency_contact: "",
  blood_group: "",
  gender: "M",
};

const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];

function CustomerRegistration() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [bloodFilter, setBloodFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState<Customer>(emptyDraft);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    refreshCustomers();
  }, []);

  async function refreshCustomers() {
    setLoadingCustomers(true);
    setCustomerError(null);
    try {
      const result = await window.electron.ipcRenderer.invoke("customer:list");
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(result.error as string);
      }
      setCustomers(result as Customer[]);
    } catch (e) {
      const errorMsg =
        e instanceof Error ? e.message : "Unable to load participants.";
      setCustomerError(errorMsg);
      console.error("Error loading participants:", e);
    } finally {
      setLoadingCustomers(false);
    }
  }

  const filtered = useMemo(() => {
    const term = customerSearch.trim().toLowerCase();
    let rows = customers.filter((c) => {
      const haystack = [
        c.id,
        c.name,
        c.email,
        c.address,
        c.phone,
        c.emergency_contact,
        c.blood_group,
      ]
        .join(" ")
        .toLowerCase();
      const matchesSearch = term === "" || haystack.includes(term);
      const matchesBlood =
        bloodFilter === "all" ||
        (c.blood_group ?? "").toUpperCase() === bloodFilter;
      return matchesSearch && matchesBlood;
    });

    rows = rows.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      if (sortKey === "created_at") {
        const dateA = new Date(a.created_at ?? 0).getTime();
        const dateB = new Date(b.created_at ?? 0).getTime();
        return (dateA - dateB) * dir;
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
      email: row.email,
      address: row.address,
      date_of_birth: row.date_of_birth,
      phone: row.phone,
      emergency_contact: row.emergency_contact,
      blood_group: row.blood_group,
      gender: row.gender,
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
      const requiredFields: (keyof Customer)[] = [
        "name",
        "email",
        "phone",
        "emergency_contact",
        "address",
        "date_of_birth",
        "gender",
        "blood_group",
      ];

      for (const field of requiredFields) {
        const value = draft[field];
        if (!value || (typeof value === "string" && !value.trim())) {
          const fieldName = field
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          setFormError(`${fieldName} is required.`);
          setSubmitting(false);
          return;
        }
      }

      if (editing) {
        const updates = {
          name: draft.name.trim(),
          email: draft.email.trim(),
          address: draft.address?.trim(),
          date_of_birth: draft.date_of_birth?.trim(),
          phone: draft.phone.trim(),
          emergency_contact: draft.emergency_contact.trim(),
          blood_group: draft.blood_group.trim(),
          gender: draft.gender,
        };
        const result = await window.electron.ipcRenderer.invoke(
          "customer:update",
          editing.id,
          updates,
        );
        if (result && typeof result === "object" && "error" in result) {
          throw new Error(result.error as string);
        }
      } else {
        const newCustomer = {
          name: draft.name.trim(),
          email: draft.email.trim(),
          address: draft.address?.trim(),
          date_of_birth: draft.date_of_birth?.trim(),
          phone: draft.phone.trim(),
          emergency_contact: draft.emergency_contact.trim(),
          blood_group: draft.blood_group.trim(),
          gender: draft.gender,
        };
        const result = await window.electron.ipcRenderer.invoke(
          "customer:create",
          newCustomer,
        );
        if (result && typeof result === "object" && "error" in result) {
          throw new Error(result.error as string);
        }
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
      const result = await window.electron.ipcRenderer.invoke(
        "customer:delete",
        id,
      );
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(result.error as string);
      }
      await refreshCustomers();
    } catch (err) {
      console.error(err);
      const errorMsg =
        err instanceof Error ? err.message : "Delete failed. Please retry.";
      setCustomerError(errorMsg);
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
      <header className="flex justify-between items-start gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">
            Participants Registrations
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
                  <SelectItem value="created_at">Date Registered</SelectItem>
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
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${
                      idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                    }`}
                    onClick={() => openEdit(row)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-mono text-sm">
                        {"P" + row.id?.toString().padStart(3, "0")}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-sm whitespace-nowrap">
                      {row.name}
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
                          onClick={() => row.id && handleDelete(row.id)}
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
                <label className="text-sm font-medium">
                  Date of birth <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  value={draft.date_of_birth || ""}
                  onChange={(e) => {
                    const iso = e.target.value;
                    if (!iso) {
                      setDraft({ ...draft, date_of_birth: "" });
                      return;
                    }

                    const todayIso = new Date().toISOString().split("T")[0];
                    if (iso > todayIso) return;

                    setDraft({
                      ...draft,
                      date_of_birth: iso,
                    });
                  }}
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Blood group <span className="text-red-500">*</span>
                </label>
                <Select
                  value={draft.blood_group}
                  onValueChange={(v) => setDraft({ ...draft, blood_group: v })}
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
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">
                  Gender <span className="text-red-500">*</span>
                </label>
                <Select
                  value={draft.gender}
                  onValueChange={(v) =>
                    setDraft({ ...draft, gender: v as "M" | "F" | "O" })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Gender" />
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
                <label className="text-sm font-medium">
                  Phone <span className="text-red-500">*</span>
                </label>
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
                <label className="text-sm font-medium">
                  Emergency contact <span className="text-red-500">*</span>
                </label>
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

export default CustomerRegistration;
