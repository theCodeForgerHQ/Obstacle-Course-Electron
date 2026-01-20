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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import type { Customer, Score } from "../../electron/utils";

type TimeFilter = "today" | "week" | "month" | "year" | "all";

function calculateAge(dob: string) {
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function withinRange(date: string, filter: TimeFilter) {
  if (filter === "all") return true;
  const d = new Date(date);
  const now = new Date();

  if (filter === "today") return d.toDateString() === now.toDateString();

  if (filter === "week") {
    const start = new Date();
    start.setDate(now.getDate() - 7);
    return d >= start;
  }

  if (filter === "month")
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );

  if (filter === "year") return d.getFullYear() === now.getFullYear();

  return true;
}

export default function Leaderboard() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [ageFrom, setAgeFrom] = useState("");
  const [ageTo, setAgeTo] = useState("");
  const [gender, setGender] = useState("all");
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [showFilter, setShowFilter] = useState(false);

  useEffect(() => {
    Promise.all([
      window.electron.ipcRenderer.invoke("customer:list"),
      window.electron.ipcRenderer.invoke("scores:list"),
    ])
      .then(([c, s]) => {
        if (c?.error) throw new Error(c.error);
        if (s?.error) throw new Error(s.error);
        setCustomers(c);
        setScores(s);
      })
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load leaderboard"),
      )
      .finally(() => setLoading(false));
  }, []);

  const ranked = useMemo(() => {
    const scoreMap: Record<number, number> = {};

    scores.forEach((s) => {
      if (!withinRange(s.date, timeFilter)) return;
      scoreMap[s.customer_id] = (scoreMap[s.customer_id] ?? 0) + s.score;
    });

    return customers
      .filter((c) => {
        if (gender !== "all" && c.gender !== gender) return false;
        const age = calculateAge(c.date_of_birth);
        if (ageFrom && age < Number(ageFrom)) return false;
        if (ageTo && age > Number(ageTo)) return false;
        return true;
      })
      .map((c) => ({
        customer: c,
        score: scoreMap[c.id ?? 0] ?? 0,
      }))
      .sort((a, b) => b.score - a.score)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [customers, scores, ageFrom, ageTo, gender, timeFilter]);

  const topThree = ranked.slice(0, 3);

  if (loading)
    return (
      <div className="p-8 text-center text-gray-500">Loading Leaderboard…</div>
    );

  return (
    <div className="min-h-screen p-8 max-w-[1400px] mx-auto">
      <header className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-semibold">Leaderboard</h1>
          <p className="text-sm text-gray-600 mt-1">
            Top participants ranked by score
          </p>
        </div>
        <Button onClick={() => setShowFilter(true)}>Filter</Button>
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-6 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="grid grid-cols-3 gap-6 mb-8 items-end">
        {[2, 1, 3].map((pos) => {
          const entry = topThree.find((t) => t.rank === pos);
          const rankImages: Record<number, string> = {
            1: "/src/react/assets/rank_1.png",
            2: "/src/react/assets/rank_2.png",
            3: "/src/react/assets/rank_3.png",
          };
          return (
            <div
              key={pos}
              className={`rounded-2xl p-6 text-center text-white flex flex-col justify-center items-center min-h-fit  ${
                pos === 1
                  ? "bg-gradient-to-b from-yellow-500 to-yellow-700"
                  : pos === 2
                    ? "bg-gradient-to-b from-indigo-500 to-indigo-700"
                    : "bg-gradient-to-b from-purple-500 to-purple-700"
              }`}
            >
              <img
                src={rankImages[pos]}
                alt={`Rank ${pos}`}
                className="w-[40%] mb-3"
              />
              <div className="text-4xl font-semibold mb-2">
                {entry?.customer.name ?? "-"}
              </div>
              <div className="text-2xl font-mono">{entry?.score ?? "-"}</div>
            </div>
          );
        })}
      </section>

      <section
        className={
          "bg-white" +
          (ranked.length > 3 &&
            " border border-gray-200 rounded-xl shadow-sm overflow-hidden")
        }
      >
        {ranked.length > 3 && (
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold">
                  Age
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold">
                  Gender
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.splice(3).map((r) => (
                <tr key={r.customer.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono">#{r.rank}</td>
                  <td className="px-4 py-3 font-medium">{r.customer.name}</td>
                  <td className="px-4 py-3">
                    {calculateAge(r.customer.date_of_birth)}
                  </td>
                  <td className="px-4 py-3">
                    {r.customer.gender === "M"
                      ? "Male"
                      : r.customer.gender === "F"
                        ? "Female"
                        : "Other"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Dialog open={showFilter} onOpenChange={setShowFilter}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Filter Leaderboard</DialogTitle>
            <DialogDescription>Adjust ranking criteria</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder="Age from"
                value={ageFrom}
                onChange={(e) => setAgeFrom(e.target.value)}
              />
              <Input
                type="number"
                placeholder="Age to"
                value={ageTo}
                onChange={(e) => setAgeTo(e.target.value)}
              />
            </div>

            <Select value={gender} onValueChange={setGender}>
              <SelectTrigger>
                <SelectValue placeholder="Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="M">Male</SelectItem>
                <SelectItem value="F">Female</SelectItem>
                <SelectItem value="O">Other</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={timeFilter}
              onValueChange={(v) => setTimeFilter(v as TimeFilter)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">This week</SelectItem>
                <SelectItem value="month">This month</SelectItem>
                <SelectItem value="year">This year</SelectItem>
                <SelectItem value="all">Since start</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button onClick={() => setShowFilter(false)}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
