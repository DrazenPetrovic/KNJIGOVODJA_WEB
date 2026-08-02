import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Filter,
  Loader2,
  Printer,
  Receipt,
  Search,
} from "lucide-react";
import { FixedSizeList, ListChildComponentProps } from "react-window";
import { PrintModal } from "./PrintModal"; // putanja prema tvom folderu

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3003";
const PRIMARY = "#785E9E";
const SECONDARY = "#8FC74A";

interface KifRow {
  sifra_kif: number;
  broj_racuna: string;
  vrsta_racuna: string;
  datum_racuna: string;
  sifra_partnera: number;
  naziv_partnera: string;
  adresa_partnera: string;
  naziv_grada: string;
  entitet: string;
  jib: string;
  pib: string;
  ukupno: number;
  rabat_km: number;
  osnova_za_obracun_pdv: number;
  pdv: number;
  vrednost: number;
  datum_unosa: string;
  vrsta_racuna_pod: string;
  el_kif_tip: string;
}

type DateFilterMode = "day" | "period";

// Grupiranje sa , i decimalni sa . (npr. 1,234.56)
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
};

// MP → blaga ljubičasta tinta (PRIMARY), VP → blaga zelena tinta (SECONDARY)
const rowStyle = (vrsta: string): React.CSSProperties => {
  const v = (vrsta || "").toUpperCase();
  if (v.startsWith("MP")) return { background: `${PRIMARY}18` }; // ~10% opacity
  if (v.startsWith("VP")) return { background: `${SECONDARY}22` }; // ~13% opacity
  return {};
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

const formatDuration = (ms: number) => {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
};

const toText = (value: unknown) => String(value ?? "").trim();

const hasTaxIdValue = (value: unknown) => {
  const v = toText(value);
  return v !== "" && !/^0+$/.test(v);
};

// PDV obveznici (DA): partner je u sistemu PDV (ima PIB) ili je ino partner (Entitet = "-")
const isOption2 = (row: Pick<KifRow, "pib" | "entitet">) => {
  const hasPib = hasTaxIdValue(row.pib);
  const isInoPartner = toText(row.entitet) === "-";
  return hasPib || isInoPartner;
};

// Podrazumijevani period: danas unazad 32 dana (operater ga po potrebi proširi kroz filter)
const dateToInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 32);
  return { from: dateToInputValue(from), to: dateToInputValue(to) };
};

const DEFAULT_RANGE = getDefaultRange();

// ─── Grid kolone (dijele header i virtualizovane redove) ─────────────────────
const GRID_COLS =
  "90px 150px 110px minmax(220px,1fr) 110px 100px 110px 90px 110px 90px";
const GRID_MIN_WIDTH = 1180;
const ROW_HEIGHT = 76;

function KifRowItem({
  index,
  style,
  data,
}: ListChildComponentProps<KifRow[]>) {
  const row = data[index];
  const opt2 = isOption2(row);

  return (
    <div
      style={{ ...style, ...rowStyle(row.vrsta_racuna), gridTemplateColumns: GRID_COLS }}
      className="grid border-b border-gray-100 transition-colors hover:brightness-95"
    >
      <div className="px-4 py-3 text-sm text-gray-700 truncate self-center">
        {row.sifra_kif}
      </div>
      <div className="px-4 py-3 text-sm font-semibold text-gray-800 truncate self-center">
        {[row.vrsta_racuna, row.broj_racuna].filter(Boolean).join(" - ") ||
          "-"}
      </div>
      <div className="px-4 py-3 text-sm text-gray-700 self-center">
        {displayDate(row.datum_racuna)}
      </div>
      <div className="px-4 py-3 text-sm text-gray-700 overflow-hidden self-center">
        <div className="font-medium text-gray-800 truncate">
          {row.naziv_partnera || "-"}
        </div>
        <div className="text-xs text-gray-500 truncate">
          {(row.adresa_partnera || "") +
            (row.naziv_grada ? `, ${row.naziv_grada}` : "")}
        </div>
        {(hasTaxIdValue(row.jib) || hasTaxIdValue(row.pib)) && (
          <div className="text-xs text-gray-500 mt-0.5 truncate">
            {hasTaxIdValue(row.jib) ? `JIB: ${row.jib}` : ""}
            {hasTaxIdValue(row.jib) && hasTaxIdValue(row.pib) ? " | " : ""}
            {hasTaxIdValue(row.pib) ? `PIB: ${row.pib}` : ""}
          </div>
        )}
      </div>
      <div className="px-4 py-3 text-sm text-right text-gray-700 self-center">
        {formatCurrency(Number(row.ukupno))}
      </div>
      <div className="px-4 py-3 text-sm text-right text-gray-700 self-center">
        {formatCurrency(Number(row.rabat_km))}
      </div>
      {opt2 ? (
        <>
          <div className="px-4 py-3 text-sm text-right text-gray-400 border-l border-gray-200 self-center">
            {formatCurrency(0)}
          </div>
          <div className="px-4 py-3 text-sm text-right text-gray-400 self-center">
            {formatCurrency(0)}
          </div>
          <div className="px-4 py-3 text-sm text-right text-gray-700 border-l border-gray-200 self-center">
            {formatCurrency(Number(row.osnova_za_obracun_pdv))}
          </div>
          <div className="px-4 py-3 text-sm text-right text-gray-700 self-center">
            {formatCurrency(Number(row.pdv))}
          </div>
        </>
      ) : (
        <>
          <div className="px-4 py-3 text-sm text-right text-gray-700 border-l border-gray-200 self-center">
            {formatCurrency(Number(row.osnova_za_obracun_pdv))}
          </div>
          <div className="px-4 py-3 text-sm text-right text-gray-700 self-center">
            {formatCurrency(Number(row.pdv))}
          </div>
          <div className="px-4 py-3 text-sm text-right text-gray-400 border-l border-gray-200 self-center">
            {formatCurrency(0)}
          </div>
          <div className="px-4 py-3 text-sm text-right text-gray-400 self-center">
            {formatCurrency(0)}
          </div>
        </>
      )}
    </div>
  );
}

export function PregledKif() {
  const [printOpen, setPrintOpen] = useState(false);

  const [rows, setRows] = useState<KifRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);

  const [filterMode, setFilterMode] = useState<DateFilterMode>("period");
  const [dayDate, setDayDate] = useState("");
  const [periodFrom, setPeriodFrom] = useState(DEFAULT_RANGE.from);
  const [periodTo, setPeriodTo] = useState(DEFAULT_RANGE.to);
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    mode: "period" as DateFilterMode,
    dayDate: "",
    periodFrom: DEFAULT_RANGE.from,
    periodTo: DEFAULT_RANGE.to,
    searchTerm: "",
  });

  // Procedura sad prima opseg datuma - server vraća samo taj period, ne cijelu istoriju
  const fetchData = async (datumOd: string, datumDo: string) => {
    const startedAt = performance.now();
    try {
      setLoading(true);
      setError(null);
      setLoadTimeMs(null);

      const params = new URLSearchParams({ datumOd, datumDo });
      const response = await fetch(
        `${API_URL}/api/pregledi/kif?${params.toString()}`,
        { credentials: "include" },
      );

      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.message || "Greška pri učitavanju KIF podataka.",
        );
      }

      setRows(Array.isArray(payload.data) ? payload.data : []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Neočekivana greška.";
      setError(message);
      setRows([]);
    } finally {
      setLoadTimeMs(performance.now() - startedAt);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData(DEFAULT_RANGE.from, DEFAULT_RANGE.to);
  }, []);

  const applyFilters = () => {
    const datumOd = filterMode === "day" ? dayDate : periodFrom;
    const datumDo = filterMode === "day" ? dayDate : periodTo;

    setAppliedFilters({
      mode: filterMode,
      dayDate,
      periodFrom,
      periodTo,
      searchTerm,
    });

    if (datumOd && datumDo) {
      fetchData(datumOd, datumDo);
    }
  };

  const filtersMissingDates =
    filterMode === "day" ? !dayDate : !periodFrom || !periodTo;

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

  // Datumski opseg se filtrira na serveru (procedura); ovdje ostaje samo tekstualna pretraga
  // preko već učitanog perioda.
  const filteredRows = useMemo(() => {
    const term = appliedFilters.searchTerm.trim().toLowerCase();
    if (!term) return rows;

    return rows.filter((row) => {
      const partner =
        `${row.naziv_partnera || ""} ${row.adresa_partnera || ""} ${row.naziv_grada || ""}`.toLowerCase();
      const doc =
        `${row.broj_racuna || ""} ${row.vrsta_racuna || ""}`.toLowerCase();
      return partner.includes(term) || doc.includes(term);
    });
  }, [rows, appliedFilters.searchTerm]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.ukupno += Number(row.ukupno) || 0;
        acc.rabat += Number(row.rabat_km) || 0;

        const osnova = Number(row.osnova_za_obracun_pdv) || 0;
        const pdv = Number(row.pdv) || 0;

        if (isOption2(row)) {
          acc.option2.count += 1;
          acc.option2.osnova += osnova;
          acc.option2.pdv += pdv;
        } else {
          acc.option1.count += 1;
          acc.option1.osnova += osnova;
          acc.option1.pdv += pdv;
        }

        return acc;
      },
      {
        ukupno: 0,
        rabat: 0,
        option1: { count: 0, osnova: 0, pdv: 0 },
        option2: { count: 0, osnova: 0, pdv: 0 },
      },
    );
  }, [filteredRows]);

  const listHeight = Math.min(
    640,
    Math.max(ROW_HEIGHT * 3, filteredRows.length * ROW_HEIGHT),
  );

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
                Knjiga izlaznih faktura
              </h2>
            </div>
          </div>
          <button
            onClick={() => setPrintOpen(true)}
            title="Štampaj"
            className="ml-2 flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 hover:border-[#785E9E] hover:text-[#785E9E] transition-colors"
          >
            <Printer size={14} />
            Štampaj
          </button>

          {loading ? (
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
              <Loader2 size={13} className="animate-spin" />
              Učitavanje...
            </span>
          ) : (
            loadTimeMs !== null && (
              <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
                Učitano za {formatDuration(loadTimeMs)}
              </span>
            )
          )}

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
                placeholder="Br fakture, vrsta, partner..."
                className="w-full rounded-lg border border-gray-300 bg-white pl-8 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#785E9E]/30 focus:border-[#785E9E]"
              />
            </div>

            <button
              onClick={applyFilters}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: PRIMARY, color: "#fff" }}
              disabled={loading || filtersMissingDates}
            >
              <Filter size={14} />
              Primijeni filtere
            </button>
          </div>
        </div>

        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
          <div className="flex flex-wrap items-center gap-0 divide-x divide-gray-100 bg-[#8FC74A22]">
            {[
              { label: "PDV obveznici", value: "" },
              { label: "Br. faktura", value: String(totals.option2.count) },
              {
                label: "Osnova PDV",
                value: formatCurrency(totals.option2.osnova) + " KM",
              },
              {
                label: "PDV",
                value: formatCurrency(totals.option2.pdv) + " KM",
              },
            ].map((s) => (
              <div
                key={`o2-${s.label}`}
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
              { label: "PDV neobveznici", value: "" },
              { label: "Br. faktura", value: String(totals.option1.count) },
              {
                label: "Osnova PDV",
                value: formatCurrency(totals.option1.osnova) + " KM",
              },
              {
                label: "PDV",
                value: formatCurrency(totals.option1.pdv) + " KM",
              },
            ].map((s) => (
              <div
                key={`o1-${s.label}`}
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
              { label: "Ukupno", value: formatCurrency(totals.ukupno) + " KM" },
              { label: "Rabat", value: formatCurrency(totals.rabat) + " KM" },
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
        {loading ? (
          <div className="p-8 flex flex-col items-center justify-center gap-2 text-gray-500">
            <Loader2
              size={24}
              className="animate-spin"
              style={{ color: PRIMARY }}
            />
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
            <div style={{ minWidth: GRID_MIN_WIDTH }}>
              <div
                className="grid bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500"
                style={{ gridTemplateColumns: GRID_COLS }}
              >
                <div className="text-left px-4 py-3">Šifra KIF</div>
                <div className="text-left px-4 py-3">Br fakture</div>
                <div className="text-left px-4 py-3">Datum</div>
                <div className="text-left px-4 py-3">Partner</div>
                <div className="text-right px-4 py-3">Ukupno</div>
                <div className="text-right px-4 py-3">Rabat</div>
                <div className="text-right px-4 py-3 border-l border-gray-200">
                  Osnova PDV (neobv.)
                </div>
                <div className="text-right px-4 py-3">PDV (neobv.)</div>
                <div className="text-right px-4 py-3 border-l border-gray-200">
                  Osnova PDV (obv.)
                </div>
                <div className="text-right px-4 py-3">PDV (obv.)</div>
              </div>

              <FixedSizeList
                height={listHeight}
                width="100%"
                itemCount={filteredRows.length}
                itemSize={ROW_HEIGHT}
                itemData={filteredRows}
                overscanCount={8}
              >
                {KifRowItem}
              </FixedSizeList>
            </div>
          </div>
        )}
      </div>

      <PrintModal
        open={printOpen}
        onClose={() => setPrintOpen(false)}
        rows={filteredRows}
        totals={totals}
        periodLabel={periodLabel}
      />
    </div>
  );
}
