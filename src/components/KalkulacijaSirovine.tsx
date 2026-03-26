import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Filter, Search, FileText, Printer } from "lucide-react";
import { PrintModalKalkulacija } from "./PrintModalKalkulacija";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3003";
const PRIMARY = "#785E9E";

interface KalkulacijaRow {
  rb: number;
  sifra_kalkulacije: number;
  datum_kalkulacije: string;
  naziv_partnera: string;
  broj_racuna: string;
  ukupno_km: number;
  duzi_se_za_iznos: number;
  PDV: number;
  VP: number;
  ZT: number;
  datum_unosa_kalkulacije: string;
}

type DateFilterMode = "day" | "period";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
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

export function KalkulacijaSirovine() {
  const [printOpen, setPrintOpen] = useState(false);

  const [rows, setRows] = useState<KalkulacijaRow[]>([]);
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

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/pregledi/kalkulacija-sirovine`,
        {
          credentials: "include",
        },
      );

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.message || "Greška pri učitavanju kalkulacije sirovina.",
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

  const filteredRows = useMemo(() => {
    let temp = [...rows];

    if (appliedFilters.mode === "day" && appliedFilters.dayDate) {
      temp = temp.filter(
        (row) =>
          getDateOnly(row.datum_unosa_kalkulacije) === appliedFilters.dayDate,
      );
    }

    if (
      appliedFilters.mode === "period" &&
      appliedFilters.periodFrom &&
      appliedFilters.periodTo
    ) {
      temp = temp.filter((row) => {
        const date = getDateOnly(row.datum_unosa_kalkulacije);
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
          row.sifra_kalkulacije,
          row.naziv_partnera,
          row.broj_racuna,
          row.rb,
        ]
          .map((v) => String(v ?? ""))
          .join(" ")
          .toLowerCase();
        return text.includes(term);
      });
    }

    return temp;
  }, [rows, appliedFilters]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.ukupno_km += Number(row.ukupno_km) || 0;
        acc.duzi_se_za_iznos += Number(row.duzi_se_za_iznos) || 0;
        acc.PDV += Number(row.PDV) || 0;
        acc.VP += Number(row.VP) || 0;
        acc.ZT += Number(row.ZT) || 0;
        return acc;
      },
      {
        ukupno_km: 0,
        duzi_se_za_iznos: 0,
        PDV: 0,
        VP: 0,
        ZT: 0,
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
              Kalkulacija sirovina
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
                placeholder="Šifra, partner, broj računa..."
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
                label: "Ukupno KM",
                value: `${formatCurrency(totals.ukupno_km)} KM`,
              },
              {
                label: "Duži se",
                value: `${formatCurrency(totals.duzi_se_za_iznos)} KM`,
              },
              { label: "PDV", value: `${formatCurrency(totals.PDV)} KM` },
              { label: "VP", value: `${formatCurrency(totals.VP)} KM` },
              { label: "ZT", value: `${formatCurrency(totals.ZT)} KM` },
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
            <table className="w-full min-w-[1400px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                  <th className="text-left px-4 py-3">RB</th>
                  <th className="text-left px-4 py-3">Šifra kalk.</th>
                  <th className="text-left px-4 py-3">Datum kalk.</th>
                  <th className="text-left px-4 py-3">Partner</th>
                  <th className="text-left px-4 py-3">Broj računa</th>
                  <th className="text-right px-4 py-3">Ukupno KM</th>
                  <th className="text-right px-4 py-3">Duži se</th>
                  <th className="text-right px-4 py-3">PDV</th>
                  <th className="text-right px-4 py-3">VP</th>
                  <th className="text-right px-4 py-3">ZT</th>
                  <th className="text-left px-4 py-3">Datum unosa</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.rb}
                    className="border-b border-gray-100 even:bg-[#785E9E10] hover:brightness-95"
                  >
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.rb}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.sifra_kalkulacije ?? "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {displayDate(row.datum_kalkulacije)}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-800">
                      {row.naziv_partnera || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.broj_racuna || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.ukupno_km))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.duzi_se_za_iznos))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.PDV))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.VP))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.ZT))}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {displayDate(row.datum_unosa_kalkulacije)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PrintModalKalkulacija
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        rows={filteredRows}
        totals={totals}
        periodLabel={periodLabel}
        title="Kalkulacija sirovina"
      />
    </div>
  );
}
