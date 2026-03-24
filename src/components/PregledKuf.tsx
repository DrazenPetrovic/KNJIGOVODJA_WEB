import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Filter, Printer, Receipt, Search } from "lucide-react";
import { PrintModalKuf } from "./PrintModalKuf";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3003";
const PRIMARY = "#785E9E";

interface KufRow {
  redni_broj: number;
  broj_racuna: string;
  datum_dokumenta: string;
  naziv_partnera: string;
  adresa_partnera: string;
  pib: string;
  opis_dokumenta: string;
  ukupno_bez_pdv: number;
  iskazani_pdv: number;
  ulazni_pdv: number;
  ulazni_pdv_uvozni: number;
  sifra_drzave: number;
  vreme_unosa: string;
  naziv_grada: string;
  naziv_drzave: string;
  entitet: string;
  jib: string;
  tip_dokumenta_el_kuf: string;
}

type DateFilterMode = "day" | "period";

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
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
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

const hasTaxIdValue = (value: unknown) => {
  const v = String(value ?? "").trim();
  return v !== "" && !/^0+$/.test(v);
};

const isImportRow = (
  row: Pick<KufRow, "ulazni_pdv_uvozni" | "naziv_drzave" | "sifra_drzave">,
) => {
  const uvozniPdv = Number(row.ulazni_pdv_uvozni) || 0;
  if (uvozniPdv > 0) return true;

  const drzavaRaw = String(row.naziv_drzave || "")
    .trim()
    .toLowerCase();
  const domaceNazivi = new Set([
    "",
    "bih",
    "ba",
    "bosna i hercegovina",
    "bosna i hercegovina (bih)",
    "bosna i hercegovina bih",
  ]);

  if (domaceNazivi.has(drzavaRaw)) return false;

  const sifraDrzave = Number(row.sifra_drzave);
  const domaceSifre = new Set([0, 1]);
  if (Number.isFinite(sifraDrzave) && domaceSifre.has(sifraDrzave)) {
    return false;
  }

  return drzavaRaw !== "";
};

const rowStyle = (index: number): React.CSSProperties => {
  return {
    background: index % 2 === 0 ? `${PRIMARY}14` : "#ffffff",
  };
};

export function PregledKuf() {
  const [printOpen, setPrintOpen] = useState(false);

  const [rows, setRows] = useState<KufRow[]>([]);
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

      const response = await fetch(`${API_URL}/api/pregledi/kuf`, {
        credentials: "include",
      });

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.message || "Greška pri učitavanju KUF podataka.",
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
    return "Sve fakture";
  }, [appliedFilters]);

  const filteredRows = useMemo(() => {
    let temp = [...rows];

    if (appliedFilters.mode === "day" && appliedFilters.dayDate) {
      temp = temp.filter(
        (row) => getDateOnly(row.datum_dokumenta) === appliedFilters.dayDate,
      );
    }

    if (
      appliedFilters.mode === "period" &&
      appliedFilters.periodFrom &&
      appliedFilters.periodTo
    ) {
      temp = temp.filter((row) => {
        const date = getDateOnly(row.datum_dokumenta);
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
        const partner =
          `${row.naziv_partnera || ""} ${row.adresa_partnera || ""} ${row.naziv_grada || ""} ${row.naziv_drzave || ""}`.toLowerCase();
        const doc =
          `${row.broj_racuna || ""} ${row.opis_dokumenta || ""} ${row.tip_dokumenta_el_kuf || ""}`.toLowerCase();
        const ids = `${row.pib || ""} ${row.jib || ""}`.toLowerCase();
        return (
          partner.includes(term) || doc.includes(term) || ids.includes(term)
        );
      });
    }

    return temp;
  }, [rows, appliedFilters]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        const ukupnoBezPdv = Number(row.ukupno_bez_pdv) || 0;
        const iskazaniPdv = Number(row.iskazani_pdv) || 0;
        const ulazniPdv = Number(row.ulazni_pdv) || 0;
        const ulazniPdvUvozni = Number(row.ulazni_pdv_uvozni) || 0;
        const importRow = isImportRow(row);

        acc.ukupnoBezPdv += ukupnoBezPdv;
        acc.iskazaniPdv += iskazaniPdv;
        acc.ulazniPdv += ulazniPdv;
        acc.ulazniPdvUvozni += ulazniPdvUvozni;

        if (importRow) {
          acc.importFakture.count += 1;
          acc.importFakture.osnovica += ukupnoBezPdv;
          acc.importFakture.pdv += ulazniPdvUvozni;
        } else {
          acc.domaceFakture.count += 1;
          acc.domaceFakture.osnovica += ukupnoBezPdv;
          acc.domaceFakture.pdv += ulazniPdv;
        }

        return acc;
      },
      {
        ukupnoBezPdv: 0,
        iskazaniPdv: 0,
        ulazniPdv: 0,
        ulazniPdvUvozni: 0,
        domaceFakture: { count: 0, osnovica: 0, pdv: 0 },
        importFakture: { count: 0, osnovica: 0, pdv: 0 },
      },
    );
  }, [filteredRows]);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-[220px] flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#ede8f5" }}
              >
                <Receipt size={16} style={{ color: PRIMARY }} />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-gray-800">
                Knjiga ulaznih faktura
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
          </div>

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
                placeholder="Br fakture, opis, partner..."
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

        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
          <div className="flex flex-wrap items-center gap-0 divide-x divide-gray-100 bg-[#8FC74A22]">
            {[
              { label: "Uvozne fakture", value: "" },
              {
                label: "Br. faktura",
                value: String(totals.importFakture.count),
              },
              {
                label: "Osnovica",
                value: formatCurrency(totals.importFakture.osnovica) + " KM",
              },
              {
                label: "Ulazni PDV uvozni",
                value: formatCurrency(totals.importFakture.pdv) + " KM",
              },
            ].map((s) => (
              <div
                key={`import-${s.label}`}
                className="flex items-center gap-2 px-3 py-1.5"
              >
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold whitespace-nowrap">
                  {s.label}
                </span>
                <span className="text-sm font-bold text-gray-800 whitespace-nowrap">
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-0 divide-x divide-gray-100 border-t border-gray-200 bg-[#785E9E18]">
            {[
              { label: "Domaće fakture", value: "" },
              {
                label: "Br. faktura",
                value: String(totals.domaceFakture.count),
              },
              {
                label: "Osnovica",
                value: formatCurrency(totals.domaceFakture.osnovica) + " KM",
              },
              {
                label: "Ulazni PDV",
                value: formatCurrency(totals.domaceFakture.pdv) + " KM",
              },
            ].map((s) => (
              <div
                key={`domace-${s.label}`}
                className="flex items-center gap-2 px-3 py-1.5"
              >
                <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold whitespace-nowrap">
                  {s.label}
                </span>
                <span className="text-sm font-bold text-gray-800 whitespace-nowrap">
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-0 divide-x divide-gray-100 border-t border-gray-200 bg-white">
            {[
              {
                label: "Ukupno bez PDV",
                value: formatCurrency(totals.ukupnoBezPdv) + " KM",
              },
              {
                label: "Iskazani PDV",
                value: formatCurrency(totals.iskazaniPdv) + " KM",
              },
              {
                label: "Ulazni PDV",
                value: formatCurrency(totals.ulazniPdv) + " KM",
              },
              {
                label: "Ulazni PDV uvozni",
                value: formatCurrency(totals.ulazniPdvUvozni) + " KM",
              },
              { label: "Sve fakture", value: String(filteredRows.length) },
            ].map((s) => (
              <div
                key={`all-${s.label}`}
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
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-600">
          Period:{" "}
          <span className="font-semibold text-gray-700">{periodLabel}</span>
        </div>

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
            <table className="w-full min-w-[1220px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                  <th className="text-left px-4 py-3">R.br</th>
                  <th className="text-left px-4 py-3">Br fakture</th>
                  <th className="text-left px-4 py-3">Datum dokumenta</th>
                  <th className="text-left px-4 py-3">Partner</th>
                  <th className="text-left px-4 py-3">Opis</th>
                  <th className="text-right px-4 py-3">Ukupno bez PDV</th>
                  <th className="text-right px-4 py-3">Iskazani PDV</th>
                  <th className="text-right px-4 py-3">Ulazni PDV</th>
                  <th className="text-right px-4 py-3">Ulazni PDV uvozni</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row, index) => (
                  <tr
                    key={`${row.redni_broj}-${row.broj_racuna}`}
                    className="border-b border-black/30 transition-colors hover:brightness-95"
                    style={rowStyle(index)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.redni_broj}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                      {[row.tip_dokumenta_el_kuf, row.broj_racuna]
                        .filter(Boolean)
                        .join(" - ") || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {displayDate(row.datum_dokumenta)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-800">
                        {row.naziv_partnera || "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(row.adresa_partnera || "") +
                          (row.naziv_grada ? `, ${row.naziv_grada}` : "") +
                          (row.entitet ? `, ${row.entitet}` : "")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.naziv_drzave || "-"}
                      </div>
                      {(hasTaxIdValue(row.jib) || hasTaxIdValue(row.pib)) && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {hasTaxIdValue(row.jib) ? `JIB: ${row.jib}` : ""}
                          {hasTaxIdValue(row.jib) && hasTaxIdValue(row.pib)
                            ? " | "
                            : ""}
                          {hasTaxIdValue(row.pib) ? `PIB: ${row.pib}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.opis_dokumenta || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.ukupno_bez_pdv))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.iskazani_pdv))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.ulazni_pdv))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.ulazni_pdv_uvozni))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PrintModalKuf
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        rows={filteredRows}
        totals={totals}
        periodLabel={periodLabel}
      />
    </div>
  );
}
