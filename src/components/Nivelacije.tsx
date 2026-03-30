import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Filter, Search, FileText, Printer } from "lucide-react";
import { PrintModalNivelacije } from "./PrintModalNivelacije";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3003";
const PRIMARY = "#785E9E";
const ACCENT = "#FFFFFF";

interface NivelacijaRow {
  sifra_nivelacije: number;
  datum_nivelacije: string;
  ukupno_staro: number;
  ukupno_novo: number;
  Ukupno: number;
  nivelacija_robe: number;
  sifra_knjizenja: number;
}

type DateFilterMode = "day" | "period";
type NivelacijaMode = "roba" | "proizvodi";

interface NivelacijeProps {
  mode: NivelacijaMode;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
};

const getDateOnly = (dateString: string) => {
  if (!dateString) return "";
  const normalized = dateString.includes("T")
    ? dateString
    : dateString.replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const displayDate = (dateString: string) => {
  const dateOnly = getDateOnly(dateString);
  if (!dateOnly) return "-";
  const parsed = new Date(`${dateOnly}T00:00:00`);
  return parsed.toLocaleDateString("sr-Latn-RS");
};

const rowStyle = (idx: number): React.CSSProperties => {
  return idx % 2 === 0
    ? { background: `${PRIMARY}18` }
    : { background: ACCENT };
};

export function Nivelacije({ mode }: NivelacijeProps) {
  const [printOpen, setPrintOpen] = useState(false);

  const [rows, setRows] = useState<NivelacijaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<DateFilterMode>("period");
  const [dayDate, setDayDate] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    mode: "period" as DateFilterMode,
    dayDate: "",
    periodFrom: "",
    periodTo: "",
    searchTerm: "",
  });

  const title = mode === "roba" ? "Nivelacija robe" : "Nivelacija proizvoda";

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_URL}/api/pregledi/nivelacija`, {
        credentials: "include",
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.message || "Greška pri učitavanju nivelacija.",
        );
      }

      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Neočekivana greška.";
      setError(message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const applyFilters = () => {
    setAppliedFilters({
      mode: filterMode,
      dayDate,
      periodFrom,
      periodTo,
      searchTerm,
    });
  };

  const modeFilteredRows = useMemo(() => {
    const expected = mode === "roba" ? 0 : 1;
    return rows.filter((row) => Number(row.nivelacija_robe) === expected);
  }, [rows, mode]);

  const filteredRows = useMemo(() => {
    let temp = [...modeFilteredRows];

    if (appliedFilters.mode === "day" && appliedFilters.dayDate) {
      temp = temp.filter(
        (row) => getDateOnly(row.datum_nivelacije) === appliedFilters.dayDate,
      );
    }

    if (
      appliedFilters.mode === "period" &&
      appliedFilters.periodFrom &&
      appliedFilters.periodTo
    ) {
      temp = temp.filter((row) => {
        const date = getDateOnly(row.datum_nivelacije);
        return (
          Boolean(date) &&
          date >= appliedFilters.periodFrom &&
          date <= appliedFilters.periodTo
        );
      });
    }

    const term = appliedFilters.searchTerm.trim().toLowerCase();
    if (term) {
      temp = temp.filter((row) => {
        const text = [
          row.sifra_nivelacije,
          row.sifra_knjizenja,
          row.ukupno_staro,
          row.ukupno_novo,
          row.Ukupno,
          displayDate(row.datum_nivelacije),
        ]
          .map((v) => String(v ?? ""))
          .join(" ")
          .toLowerCase();

        return text.includes(term);
      });
    }

    return temp;
  }, [modeFilteredRows, appliedFilters]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.ukupno_staro += Number(row.ukupno_staro) || 0;
        acc.ukupno_novo += Number(row.ukupno_novo) || 0;
        acc.ukupno += Number(row.Ukupno) || 0;
        return acc;
      },
      {
        ukupno_staro: 0,
        ukupno_novo: 0,
        ukupno: 0,
      },
    );
  }, [filteredRows]);

  const periodLabel = useMemo(() => {
    if (appliedFilters.mode === "day" && appliedFilters.dayDate) {
      return new Date(`${appliedFilters.dayDate}T00:00:00`).toLocaleDateString(
        "sr-Latn-RS",
      );
    }
    if (
      appliedFilters.mode === "period" &&
      appliedFilters.periodFrom &&
      appliedFilters.periodTo
    ) {
      const from = new Date(
        `${appliedFilters.periodFrom}T00:00:00`,
      ).toLocaleDateString("sr-Latn-RS");
      const to = new Date(
        `${appliedFilters.periodTo}T00:00:00`,
      ).toLocaleDateString("sr-Latn-RS");
      return `${from} – ${to}`;
    }
    return "Sve stavke";
  }, [appliedFilters]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-[220px] flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#ede8f5" }}
            >
              <FileText size={16} style={{ color: PRIMARY }} />
            </span>
            <h2 className="text-base sm:text-lg font-bold text-gray-800">
              {title}
            </h2>
          </div>

          <button
            onClick={() => setPrintOpen(true)}
            title="Štampaj"
            className="ml-2 flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#785E9E] hover:text-[#785E9E] transition-colors"
          >
            <Printer size={14} />
            Štampaj
          </button>

          <div className="flex flex-wrap items-end justify-end gap-2">
            <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                onClick={() => setFilterMode("day")}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                style={
                  filterMode === "day"
                    ? { background: PRIMARY, color: "#fff" }
                    : { color: "#4b5563" }
                }
              >
                Po danu
              </button>
              <button
                onClick={() => setFilterMode("period")}
                className="px-3 py-1.5 rounded-md text-xs font-semibold transition-colors"
                style={
                  filterMode === "period"
                    ? { background: PRIMARY, color: "#fff" }
                    : { color: "#4b5563" }
                }
              >
                Za period
              </button>
            </div>

            <div className="min-w-[160px]">
              {filterMode === "day" ? (
                <div className="relative">
                  <CalendarDays
                    size={14}
                    className="absolute left-2.5 top-2.5 text-gray-400"
                  />
                  <input
                    type="date"
                    value={dayDate}
                    onChange={(e) => setDayDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white pl-8 pr-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#785E9E]/30 focus:border-[#785E9E]"
                  />
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    className="w-[130px] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#785E9E]/30 focus:border-[#785E9E]"
                  />
                  <input
                    type="date"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    className="w-[130px] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#785E9E]/30 focus:border-[#785E9E]"
                  />
                </div>
              )}
            </div>

            <div className="relative min-w-[220px]">
              <Search
                size={14}
                className="absolute left-2.5 top-2.5 text-gray-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Šifra nivelacije, knjiženja..."
                className="w-full rounded-lg border border-gray-300 bg-white pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#785E9E]/30 focus:border-[#785E9E]"
              />
            </div>

            <button
              onClick={applyFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
              style={{ background: PRIMARY, color: "#fff" }}
              disabled={loading}
            >
              <Filter size={14} />
              Primijeni filtere
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-100 bg-white overflow-hidden">
          <div className="flex flex-wrap items-center gap-0 divide-x divide-gray-100">
            {[
              {
                label: "Ukupno staro",
                value: `${formatCurrency(totals.ukupno_staro)} KM`,
              },
              {
                label: "Ukupno novo",
                value: `${formatCurrency(totals.ukupno_novo)} KM`,
              },
              {
                label: "Razlika",
                value: `${formatCurrency(totals.ukupno)} KM`,
              },
              { label: "Period", value: periodLabel },
              { label: "Stavki", value: String(filteredRows.length) },
            ].map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-2 px-3 py-1.5"
              >
                <span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold whitespace-nowrap">
                  {s.label}
                </span>
                <span className="text-sm font-bold text-gray-800 whitespace-nowrap">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">
            Učitavanje podataka...
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nema podataka za izabrane filtere.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                  <th className="text-left px-4 py-3">Šifra nivelacije</th>
                  <th className="text-left px-4 py-3">Datum nivelacije</th>
                  <th className="text-right px-4 py-3">Ukupno staro</th>
                  <th className="text-right px-4 py-3">Ukupno novo</th>
                  <th className="text-right px-4 py-3">Ukupno</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, idx) => (
                  <tr
                    key={`${row.sifra_nivelacije}-${idx}`}
                    className="border-b border-gray-100 hover:bg-gray-50/60"
                    style={rowStyle(idx)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-800 font-semibold">
                      {row.sifra_nivelacije}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {displayDate(row.datum_nivelacije)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right font-medium">
                      {formatCurrency(Number(row.ukupno_staro) || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-right font-medium">
                      {formatCurrency(Number(row.ukupno_novo) || 0)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800 text-right font-bold">
                      {formatCurrency(Number(row.Ukupno) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PrintModalNivelacije
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        rows={filteredRows}
        totals={totals}
        periodLabel={periodLabel}
        title={title}
      />
    </div>
  );
}
