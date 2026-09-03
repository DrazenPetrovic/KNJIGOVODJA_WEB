import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookMarked,
  CalendarDays,
  CreditCard,
  Filter,
  Landmark,
  Loader2,
  Printer,
  Receipt,
  RefreshCcw,
  Search,
  Tags,
  TrendingUp,
} from "lucide-react";
import { PrintModal } from "./PrintModal";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3003";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

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

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);

const formatIznos = (v: number | null | undefined) =>
  `${formatCurrency(Number(v ?? 0))} KM`;

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

// dd.MM.yyyy — za prikaz preko polja "Datum od/do" (vrijednost polja ostaje
// yyyy-MM-dd, samo je vizuelno prekriven ovim formatom).
const formatDatumDMY = (v: string | undefined | null): string | null => {
  if (!v) return null;
  const d = new Date(`${v}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}.`;
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

const dateToInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Podrazumijevani period: prvi dan tekućeg mjeseca do danas — isto kao u
// KANCELARIJA_WEB (Kif.tsx: prviDanMjeseca() / danas()).
const prviDanMjeseca = () => {
  const d = new Date();
  return dateToInputValue(new Date(d.getFullYear(), d.getMonth(), 1));
};

const danas = () => dateToInputValue(new Date());

const getDefaultRange = () => ({ from: prviDanMjeseca(), to: danas() });

const DEFAULT_RANGE = getDefaultRange();

function StatTile({
  icon,
  vrijednost,
  naziv,
  boja,
  podnaslov,
  izracunato,
}: {
  icon: React.ReactNode;
  vrijednost: string;
  naziv: string;
  boja: string;
  podnaslov?: string;
  izracunato?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 bg-white rounded-2xl shadow-sm px-4 py-3 flex-1 min-w-[170px] ${
        izracunato ? "border-2 border-dashed" : "border border-gray-100"
      }`}
      style={izracunato ? { borderColor: boja } : undefined}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${boja}1f` }}
      >
        <div style={{ color: boja }}>{icon}</div>
      </div>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-tight text-gray-800">
          {vrijednost}
        </div>
        <div className="text-xs text-gray-400 truncate">{naziv}</div>
        {podnaslov && (
          <div
            className="text-[10px] font-semibold truncate"
            style={{ color: boja }}
          >
            {podnaslov}
          </div>
        )}
      </div>
    </div>
  );
}

// Windowing tabele — kod velikog broja redova drži se u DOM-u samo vidljivi
// opseg (+ overscan), a razlika u visini se nadoknađuje "spacer" red prije/
// poslije, umjesto da se cijela lista renderuje odjednom.
const GRID_COLS =
  "90px 150px 110px minmax(220px,1fr) 110px 100px 110px 90px 110px 90px";
const GRID_MIN_WIDTH = 1180;
const ROW_HEIGHT_PX = 76;
const OVERSCAN_REDOVA = 10;
const PRAG_VIRTUALIZACIJE = 150;

const rowBg = (vrsta: string): string => {
  const v = (vrsta || "").toUpperCase();
  if (v.startsWith("MP")) return `${PRIMARY}18`;
  if (v.startsWith("VP")) return `${ACCENT}22`;
  return "transparent";
};

function KifRowItem({ row }: { row: KifRow }) {
  const opt2 = isOption2(row);

  return (
    <div
      style={{
        height: ROW_HEIGHT_PX,
        gridTemplateColumns: GRID_COLS,
        background: rowBg(row.vrsta_racuna),
      }}
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

  // Callback ref umjesto useRef+useEffect — tabela se pri svakom novom
  // fetch-u (loading true/false) unmountuje i remountuje, pa bi obični
  // useRef ostavio scroll listener zakačen na stari, odvojeni DOM čvor
  // (jeVirtualizovano se ne mijenja pa se efekat ne bi ponovo pokrenuo).
  const scrollElRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [visinaKontejnera, setVisinaKontejnera] = useState(600);

  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    scrollElRef.current = node;
    if (node) {
      setVisinaKontejnera(node.clientHeight);
      setScrollTop(node.scrollTop);
    }
  }, []);

  const dayDateRef = useRef<HTMLInputElement>(null);
  const periodFromRef = useRef<HTMLInputElement>(null);
  const periodToRef = useRef<HTMLInputElement>(null);

  const otvoriPicker = (ref: React.RefObject<HTMLInputElement>) => {
    const input = ref.current;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
    } else {
      input.focus();
    }
  };

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

  const ukupnoOsnovica = useMemo(
    () => totals.option1.osnova + totals.option2.osnova,
    [totals],
  );
  const ukupnoPdv = useMemo(
    () => totals.option1.pdv + totals.option2.pdv,
    [totals],
  );
  // KIF nema direktno veleprodajnu vrednost (VPC prije rabata) — izvodi se iz
  // osnovice (VPC nakon rabata) i rabata, isto kao u KANCELARIJA_WEB Kif.tsx.
  const veleprodajnaVrednost = useMemo(
    () => ukupnoOsnovica + totals.rabat,
    [ukupnoOsnovica, totals.rabat],
  );

  const jeVirtualizovano = filteredRows.length > PRAG_VIRTUALIZACIJE;

  // Resize se prati globalno (jedan listener za život komponente) — scroll se
  // prati direktno preko onScroll na div-u, koji React vezuje/otkačinje sam
  // pri svakom mount/unmount ciklusu tabele, pa nema stale-node problema.
  useEffect(() => {
    const naResize = () => {
      if (scrollElRef.current) {
        setVisinaKontejnera(scrollElRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", naResize);
    return () => window.removeEventListener("resize", naResize);
  }, []);

  let startIndex = 0;
  let endIndex = filteredRows.length;
  if (jeVirtualizovano) {
    const prviVidljivi = Math.floor(scrollTop / ROW_HEIGHT_PX);
    const brojVidljivih = Math.ceil(visinaKontejnera / ROW_HEIGHT_PX);
    startIndex = Math.max(0, prviVidljivi - OVERSCAN_REDOVA);
    endIndex = Math.min(
      filteredRows.length,
      prviVidljivi + brojVidljivih + OVERSCAN_REDOVA,
    );
  }
  const vidljiviRedovi = jeVirtualizovano
    ? filteredRows.slice(startIndex, endIndex)
    : filteredRows;
  const visinaPrijeRedova = startIndex * ROW_HEIGHT_PX;
  const visinaPoslijeRedova = (filteredRows.length - endIndex) * ROW_HEIGHT_PX;

  return (
    <div className="space-y-4">
      {/* Naslov */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#ede8f5]">
          <BookMarked size={20} style={{ color: PRIMARY }} />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-gray-800">KIF</h2>
          <p className="text-xs text-gray-400">
            Knjiga izlaznih faktura za izabrani period
          </p>
        </div>
        {loading ? (
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
            <Loader2 size={13} className="animate-spin" />
            Učitavanje...
          </span>
        ) : (
          loadTimeMs !== null && (
            <span className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400">
              Učitano za{" "}
              {loadTimeMs < 1000
                ? `${Math.round(loadTimeMs)} ms`
                : `${(loadTimeMs / 1000).toFixed(2)} s`}
            </span>
          )
        )}
        <button
          type="button"
          onClick={() => setPrintOpen(true)}
          disabled={loading || filteredRows.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40"
          style={{ background: PRIMARY }}
        >
          <Printer size={15} />
          Štampaj
        </button>
      </div>

      {/* Filteri */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1">
            <button
              type="button"
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
              type="button"
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

          <div>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              {filterMode === "day" ? "Datum" : "Datum od / do"}
            </span>
            {filterMode === "day" ? (
              <div
                className="relative cursor-pointer"
                onClick={() => otvoriPicker(dayDateRef)}
              >
                <CalendarDays
                  size={14}
                  className="absolute left-2.5 top-2.5 text-gray-400 pointer-events-none"
                />
                <input
                  ref={dayDateRef}
                  type="date"
                  value={dayDate}
                  onChange={(e) => setDayDate(e.target.value)}
                  style={{ color: "transparent" }}
                  className="rounded-xl border border-gray-200 bg-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-[#785E9E] transition-colors cursor-pointer"
                />
                <div className="absolute inset-0 flex items-center pl-8 pr-3 text-sm text-gray-800 pointer-events-none">
                  {formatDatumDMY(dayDate) ?? "Izaberite datum"}
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <div
                  className="relative cursor-pointer"
                  onClick={() => otvoriPicker(periodFromRef)}
                >
                  <input
                    ref={periodFromRef}
                    type="date"
                    value={periodFrom}
                    onChange={(e) => setPeriodFrom(e.target.value)}
                    style={{ color: "transparent" }}
                    className="w-[140px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#785E9E] transition-colors cursor-pointer"
                  />
                  <div className="absolute inset-0 flex items-center px-3 text-sm text-gray-800 pointer-events-none">
                    {formatDatumDMY(periodFrom) ?? "Izaberite datum"}
                  </div>
                </div>
                <div
                  className="relative cursor-pointer"
                  onClick={() => otvoriPicker(periodToRef)}
                >
                  <input
                    ref={periodToRef}
                    type="date"
                    value={periodTo}
                    onChange={(e) => setPeriodTo(e.target.value)}
                    style={{ color: "transparent" }}
                    className="w-[140px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-[#785E9E] transition-colors cursor-pointer"
                  />
                  <div className="absolute inset-0 flex items-center px-3 text-sm text-gray-800 pointer-events-none">
                    {formatDatumDMY(periodTo) ?? "Izaberite datum"}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="min-w-[220px]">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">
              Pretraga
            </span>
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-2.5 text-gray-400"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Br fakture, vrsta, partner..."
                className="w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-[#785E9E] transition-colors"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={applyFilters}
            disabled={loading || filtersMissingDates}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
            style={{ background: PRIMARY }}
          >
            <Filter size={14} />
            Prikaži
            {!loading && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-bold">
                {filteredRows.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Statistika */}
      {!loading && !error && (
        <div className="flex flex-wrap gap-3">
          <StatTile
            icon={<TrendingUp size={16} />}
            vrijednost={formatIznos(totals.ukupno)}
            naziv="Ukupno"
            boja={ACCENT}
          />
          <StatTile
            icon={<Landmark size={16} />}
            vrijednost={formatIznos(veleprodajnaVrednost)}
            naziv="Veleprodajna vrijednost"
            boja={PRIMARY}
          />
          <StatTile
            icon={<CreditCard size={16} />}
            vrijednost={formatIznos(totals.rabat)}
            naziv="Rabat"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Receipt size={16} />}
            vrijednost={formatIznos(ukupnoOsnovica)}
            naziv="Osnovica"
            podnaslov={`Obveznici ${formatIznos(totals.option2.osnova)} · Neobveznici ${formatIznos(totals.option1.osnova)}`}
            boja={PRIMARY}
            izracunato
          />
          <StatTile
            icon={<Tags size={16} />}
            vrijednost={formatIznos(ukupnoPdv)}
            naziv="PDV"
            podnaslov={`Obveznici ${formatIznos(totals.option2.pdv)} · Neobveznici ${formatIznos(totals.option1.pdv)}`}
            boja={PRIMARY}
            izracunato
          />
        </div>
      )}

      {/* Tabela */}
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
          <div className="p-8 flex flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button
              type="button"
              onClick={() =>
                fetchData(
                  filterMode === "day" ? dayDate : periodFrom,
                  filterMode === "day" ? dayDate : periodTo,
                )
              }
              className="text-xs font-semibold px-3 py-1.5 rounded-lg"
              style={{ background: `${PRIMARY}1f`, color: PRIMARY }}
            >
              <RefreshCcw size={12} className="inline mr-1" />
              Pokušaj ponovo
            </button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 flex flex-col items-center justify-center gap-2 text-gray-300">
            <BookMarked size={28} />
            <p className="text-sm text-gray-400">
              Nema podataka za izabrane filtere.
            </p>
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

              <div
                ref={jeVirtualizovano ? scrollRef : undefined}
                onScroll={
                  jeVirtualizovano
                    ? (e) => setScrollTop(e.currentTarget.scrollTop)
                    : undefined
                }
                style={
                  jeVirtualizovano
                    ? { maxHeight: "70vh", overflowY: "auto" }
                    : undefined
                }
              >
                {jeVirtualizovano && visinaPrijeRedova > 0 && (
                  <div style={{ height: visinaPrijeRedova }} />
                )}
                {vidljiviRedovi.map((row) => (
                  <KifRowItem key={row.sifra_kif} row={row} />
                ))}
                {jeVirtualizovano && visinaPoslijeRedova > 0 && (
                  <div style={{ height: visinaPoslijeRedova }} />
                )}
              </div>
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
