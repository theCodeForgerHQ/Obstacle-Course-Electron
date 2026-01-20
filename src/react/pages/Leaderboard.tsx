import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Input } from "../components/ui/input";
import type { Customer, Score } from "../../electron/utils";

type TimeRange = "day" | "week" | "month" | "year" | "all";

type PanelConfig = {
  id: string;
  title: string;
  range: TimeRange;
  gender: "all" | "M" | "F" | "O";
  minAge?: number;
  maxAge?: number;
};

export default function LeaderboardScreen() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [customerScoreMap, setCustomerScoreMap] = useState<
    Record<number, number>
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [rows, setRows] = useState(1);
  const [cols, setCols] = useState(2);
  const [editMode, setEditMode] = useState(false);

  const [panels, setPanels] = useState<PanelConfig[]>([
    {
      id: crypto.randomUUID(),
      title: "Top Today",
      range: "day",
      gender: "all",
    },
    {
      id: crypto.randomUUID(),
      title: "Top This Week",
      range: "week",
      gender: "all",
    },
  ]);

  useEffect(() => {
    Promise.all([refreshCustomers(), refreshScores()])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function refreshCustomers() {
    try {
      const result = await window.electron.ipcRenderer.invoke("customer:list");
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(result.error);
      }
      setCustomers(result as Customer[]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load customers";
      setError(msg);
    }
  }

  async function refreshScores() {
    try {
      const result = await window.electron.ipcRenderer.invoke("scores:list");
      if (result && typeof result === "object" && "error" in result) {
        throw new Error(result.error);
      }
      setScores(result as Score[]);

      const map: Record<number, number> = {};
      (result as Score[]).forEach((s) => {
        map[s.customerId] = (map[s.customerId] || 0) + s.score;
      });
      setCustomerScoreMap(map);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load scores";
      setError(msg);
    }
  }

  function addRow() {
    setRows((r) => r + 1);
  }

  function addCol() {
    setCols((c) => c + 1);
  }

  function addPanel() {
    setPanels((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        title: "New Leaderboard",
        range: "all",
        gender: "all",
      },
    ]);
  }

  function scoresForRange(range: TimeRange) {
    const now = new Date();
    return scores.filter((s) => {
      const d = new Date(s.date);
      if (range === "day") return d.toDateString() === now.toDateString();
      if (range === "week")
        return d >= new Date(now.setDate(now.getDate() - 7));
      if (range === "month")
        return d >= new Date(now.setMonth(now.getMonth() - 1));
      if (range === "year")
        return d >= new Date(now.setFullYear(now.getFullYear() - 1));
      return true;
    });
  }

  function topTen(panel: PanelConfig) {
    const relevantScores = scoresForRange(panel.range);
    const map: Record<number, number> = {};

    relevantScores.forEach((s) => {
      map[s.customerId] = (map[s.customerId] || 0) + s.score;
    });

    return customers
      .filter((c) => {
        if (panel.gender !== "all" && c.gender !== panel.gender) return false;
        if (panel.minAge || panel.maxAge) {
          const age =
            new Date().getFullYear() - new Date(c.date_of_birth).getFullYear();
          if (panel.minAge && age < panel.minAge) return false;
          if (panel.maxAge && age > panel.maxAge) return false;
        }
        return true;
      })
      .map((c) => ({ ...c, total: map[c.id as number] || 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }

  if (loading) {
    return <div className="min-h-screen p-8 text-gray-500">Loading…</div>;
  }

  if (error) {
    return (
      <div className="min-h-screen p-8 text-red-700 bg-red-50 border border-red-200 rounded-xl">
        {error}
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 max-w-[1400px] mx-auto space-y-6">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Leaderboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Configure and display ranking panels
          </p>
        </div>
        <Button onClick={() => setEditMode((e) => !e)}>
          {editMode ? "Finish Editing" : "Edit Layout"}
        </Button>
      </header>

      {editMode && (
        <div className="flex gap-3">
          <Button variant="ghost" onClick={addRow}>
            Add Row
          </Button>
          <Button variant="ghost" onClick={addCol}>
            Add Column
          </Button>
          <Button onClick={addPanel}>Add Panel</Button>
        </div>
      )}

      <div
        className="grid gap-4"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {panels.slice(0, rows * cols).map((panel) => (
          <div
            key={panel.id}
            className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
          >
            {editMode ? (
              <div className="space-y-3">
                <Input
                  value={panel.title}
                  onChange={(e) =>
                    setPanels((p) =>
                      p.map((x) =>
                        x.id === panel.id ? { ...x, title: e.target.value } : x,
                      ),
                    )
                  }
                />

                <Select
                  value={panel.range}
                  onValueChange={(v) =>
                    setPanels((p) =>
                      p.map((x) =>
                        x.id === panel.id ? { ...x, range: v as TimeRange } : x,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Top Today</SelectItem>
                    <SelectItem value="week">Top This Week</SelectItem>
                    <SelectItem value="month">Top This Month</SelectItem>
                    <SelectItem value="year">Top This Year</SelectItem>
                    <SelectItem value="all">Top Since Start</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={panel.gender}
                  onValueChange={(v) =>
                    setPanels((p) =>
                      p.map((x) =>
                        x.id === panel.id ? { ...x, gender: v as any } : x,
                      ),
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Genders</SelectItem>
                    <SelectItem value="M">Male</SelectItem>
                    <SelectItem value="F">Female</SelectItem>
                    <SelectItem value="O">Other</SelectItem>
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  <Input
                    placeholder="Min Age"
                    type="number"
                    value={panel.minAge ?? ""}
                    onChange={(e) =>
                      setPanels((p) =>
                        p.map((x) =>
                          x.id === panel.id
                            ? {
                                ...x,
                                minAge: Number(e.target.value) || undefined,
                              }
                            : x,
                        ),
                      )
                    }
                  />
                  <Input
                    placeholder="Max Age"
                    type="number"
                    value={panel.maxAge ?? ""}
                    onChange={(e) =>
                      setPanels((p) =>
                        p.map((x) =>
                          x.id === panel.id
                            ? {
                                ...x,
                                maxAge: Number(e.target.value) || undefined,
                              }
                            : x,
                        ),
                      )
                    }
                  />
                </div>
              </div>
            ) : (
              <>
                <h3 className="font-semibold text-gray-900 mb-3">
                  {panel.title}
                </h3>
                <ol className="space-y-1 text-sm">
                  {topTen(panel).map((c, i) => (
                    <li key={c.id} className="flex justify-between">
                      <span>
                        {i + 1}. {c.name}
                      </span>
                      <span className="font-medium">{c.total}</span>
                    </li>
                  ))}
                </ol>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
