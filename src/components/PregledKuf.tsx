import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BookMarked,
  CalendarDays,
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
import { PrintModalKuf } from "./PrintModalKuf";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3003";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Red vraćen sa erp.kuf_pregled() (bez parametara — vraća sve stavke).
interface KufRow {
  sifra: number;
  broj_dokumenta: string;
  datum_dokumenta: string;
  datum_ulaza_dokumenta: string;
  naziv_partnera: string;
  adresa_partnera: string;
  PIB: string;
  opis: string;
  vrednost_bez_pdv: number;
  iskazani_pdv: number;
  ulazni_pdv: number;
  ulazni_pdv_uvoz: number;
  sif_drzave: number;
  grad_partnera: string;
  drzava_partnera: string;
  entitet_partnera: string;
  JIB: string;
  tip_dokumenta: string;
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

const hasTaxIdValue = (value: unknown) => {
  const v = String(value ?? "").trim();
  return v !== "" && !/^0+$/.test(v);
};

const isImportRow = (
  row: Pick<KufRow, "ulazni_pdv_uvoz" | "drzava_partnera" | "sif_drzave">,
) => {
  const uvozniPdv = Number(row.ulazni_pdv_uvoz) || 0;
  if (uvozniPdv > 0) return true;

  const drzavaRaw = String(row.drzava_partnera || "")
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

  const sifraDrzave = Number(row.sif_drzave);
  const domaceSifre = new Set([0, 1]);
  if (Number.isFinite(sifraDrzave) && domaceSifre.has(sifraDrzave)) {
    return false;
  }

  return drzavaRaw !== "";
};

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
// opseg (+ overscan), a razlika u visini se nadoknađuje "spacer" <tr> prije/
// poslije, isti pristup kao u PregledKif.tsx.
const ROW_HEIGHT_PX = 76;
const OVERSCAN_REDOVA = 10;
const PRAG_VIRTUALIZACIJE = 150;
const BROJ_KOLONA = 9;

const rowBg = (index: number) => (index % 2 === 0 ? `${PRIMARY}14` : "#ffffff");

const dateToInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// Podrazumijevani period: prvi dan tekućeg mjeseca do danas — isto kao u
// KANCELARIJA_WEB (Kuf.tsx: prviDanMjeseca() / danas()).
const prviDanMjeseca = () => {
  const d = new Date();
  return dateToInputValue(new Date(d.getFullYear(), d.getMonth(), 1));
};

const danas = () => dateToInputValue(new Date());

export function PregledKuf() {
  const [printOpen, setPrintOpen] = useState(false);

  const [rows, setRows] = useState<KufRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filterMode, setFilterMode] = useState<DateFilterMode>("period");
  const [dayDate, setDayDate] = useState("");
  const [periodFrom, setPeriodFrom] = useState(prviDanMjeseca());
  const [periodTo, setPeriodTo] = useState(danas());
  const [searchTerm, setSearchTerm] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    mode: "period" as DateFilterMode,
    dayDate: "",
    periodFrom: prviDanMjeseca(),
    periodTo: danas(),
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

  // Kao u KANCELARIJA_WEB (Kuf.tsx): erp.kuf_pregled() ne prima parametre
  // (vraća sve stavke) — datum se filtrira ovdje po datumu ulaza dokumenta
  // (datum_ulaza_dokumenta), a rezultat se sortira od najnovijeg ka najstarijem.
  const filteredRows = useMemo(() => {
    let temp = [...rows];

    if (appliedFilters.mode === "day" && appliedFilters.dayDate) {
      temp = temp.filter(
        (row) =>
          getDateOnly(row.datum_ulaza_dokumenta) === appliedFilters.dayDate,
      );
    }

    if (
      appliedFilters.mode === "period" &&
      appliedFilters.periodFrom &&
      appliedFilters.periodTo
    ) {
      temp = temp.filter((row) => {
        const date = getDateOnly(row.datum_ulaza_dokumenta);
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
          `${row.naziv_partnera || ""} ${row.adresa_partnera || ""} ${row.grad_partnera || ""} ${row.drzava_partnera || ""}`.toLowerCase();
        const doc =
          `${row.broj_dokumenta || ""} ${row.opis || ""} ${row.tip_dokumenta || ""}`.toLowerCase();
        const ids = `${row.PIB || ""} ${row.JIB || ""}`.toLowerCase();
        return (
          partner.includes(term) || doc.includes(term) || ids.includes(term)
        );
      });
    }

    temp.sort(
      (a, b) =>
        new Date(b.datum_ulaza_dokumenta).getTime() -
        new Date(a.datum_ulaza_dokumenta).getTime(),
    );

    return temp;
  }, [rows, appliedFilters]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        const ukupnoBezPdv = Number(row.vrednost_bez_pdv) || 0;
        const iskazaniPdv = Number(row.iskazani_pdv) || 0;
        const ulazniPdv = Number(row.ulazni_pdv) || 0;
        const ulazniPdvUvozni = Number(row.ulazni_pdv_uvoz) || 0;
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

  // KUF ne vraća gotov "ukupno" — izvodi se kao osnovica + iskazani PDV, isti
  // obrazac kao ukupno=osnovica+pdv u PregledKif.tsx.
  const ukupno = totals.ukupnoBezPdv + totals.iskazaniPdv;

  const jeVirtualizovano = filteredRows.length > PRAG_VIRTUALIZACIJE;

  // Resize se prati globalno (jedan listener za život komponente) — scroll se
  // prati direktno preko onScroll na tabeli, koji React vezuje/otkačinje sam
  // pri svakom mount/unmount ciklusu (npr. pri svakom novom fetch-u), pa nema
  // stale-node problema.
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
          <h2 className="text-xl font-bold text-gray-800">KUF</h2>
          <p className="text-xs text-gray-400">
            Knjiga ulaznih faktura za izabrani period
          </p>
        </div>
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
                placeholder="Br fakture, opis, partner..."
                className="w-full rounded-xl border border-gray-200 bg-white pl-8 pr-3 py-2 text-sm focus:outline-none focus:border-[#785E9E] transition-colors"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={applyFilters}
            disabled={loading}
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
            vrijednost={formatIznos(ukupno)}
            naziv="Ukupno"
            boja={ACCENT}
            izracunato
          />
          <StatTile
            icon={<Receipt size={16} />}
            vrijednost={formatIznos(totals.ukupnoBezPdv)}
            naziv="Vrijednost bez PDV"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Tags size={16} />}
            vrijednost={formatIznos(totals.iskazaniPdv)}
            naziv="Iskazani PDV"
            boja={PRIMARY}
          />
          <StatTile
            icon={<Landmark size={16} />}
            vrijednost={formatIznos(totals.domaceFakture.pdv)}
            naziv="Ulazni PDV (domaće)"
            podnaslov={`${totals.domaceFakture.count} faktura`}
            boja={PRIMARY}
          />
          <StatTile
            icon={<Tags size={16} />}
            vrijednost={formatIznos(totals.importFakture.pdv)}
            naziv="Ulazni PDV (uvoz)"
            podnaslov={`${totals.importFakture.count} faktura`}
            boja={PRIMARY}
          />
        </div>
      )}

      {/* Tabela */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 bg-gray-50 text-xs text-gray-600">
          Period:{" "}
          <span className="font-semibold text-gray-700">{periodLabel}</span>
        </div>

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
              onClick={fetchData}
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
          <div
            ref={jeVirtualizovano ? scrollRef : undefined}
            onScroll={
              jeVirtualizovano
                ? (e) => setScrollTop(e.currentTarget.scrollTop)
                : undefined
            }
            className="overflow-x-auto"
            style={
              jeVirtualizovano
                ? { maxHeight: "70vh", overflowY: "auto" }
                : undefined
            }
          >
            <table className="w-full min-w-[1220px]">
              <thead>
                <tr
                  className={`bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 ${jeVirtualizovano ? "sticky top-0 z-10" : ""}`}
                >
                  <th className="text-left px-4 py-3">R.br</th>
                  <th className="text-left px-4 py-3">Br fakture</th>
                  <th className="text-left px-4 py-3">Datum ulaza</th>
                  <th className="text-left px-4 py-3">Partner</th>
                  <th className="text-left px-4 py-3">Opis</th>
                  <th className="text-right px-4 py-3">Ukupno bez PDV</th>
                  <th className="text-right px-4 py-3">Iskazani PDV</th>
                  <th className="text-right px-4 py-3">Ulazni PDV</th>
                  <th className="text-right px-4 py-3">Ulazni PDV uvozni</th>
                </tr>
              </thead>
              <tbody>
                {jeVirtualizovano && visinaPrijeRedova > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={BROJ_KOLONA}
                      style={{
                        height: visinaPrijeRedova,
                        padding: 0,
                        border: "none",
                      }}
                    />
                  </tr>
                )}
                {vidljiviRedovi.map((row, i) => (
                  <tr
                    key={`${row.sifra}-${row.broj_dokumenta}`}
                    style={{
                      height: ROW_HEIGHT_PX,
                      background: rowBg(startIndex + i),
                    }}
                    className="border-b border-gray-100 transition-colors hover:brightness-95"
                  >
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.sifra}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                      {[row.tip_dokumenta, row.broj_dokumenta]
                        .filter(Boolean)
                        .join(" - ") || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <span
                        title={
                          row.datum_dokumenta
                            ? `Datum dokumenta: ${displayDate(row.datum_dokumenta)}`
                            : undefined
                        }
                      >
                        {displayDate(row.datum_ulaza_dokumenta)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-800">
                        {row.naziv_partnera || "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(row.adresa_partnera || "") +
                          (row.grad_partnera ? `, ${row.grad_partnera}` : "") +
                          (row.entitet_partnera
                            ? `, ${row.entitet_partnera}`
                            : "")}
                      </div>
                      <div className="text-xs text-gray-500">
                        {row.drzava_partnera || "-"}
                      </div>
                      {(hasTaxIdValue(row.JIB) || hasTaxIdValue(row.PIB)) && (
                        <div className="text-xs text-gray-500 mt-0.5">
                          {hasTaxIdValue(row.JIB) ? `JIB: ${row.JIB}` : ""}
                          {hasTaxIdValue(row.JIB) && hasTaxIdValue(row.PIB)
                            ? " | "
                            : ""}
                          {hasTaxIdValue(row.PIB) ? `PIB: ${row.PIB}` : ""}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.opis || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.vrednost_bez_pdv))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.iskazani_pdv))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.ulazni_pdv))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.ulazni_pdv_uvoz))}
                    </td>
                  </tr>
                ))}
                {jeVirtualizovano && visinaPoslijeRedova > 0 && (
                  <tr aria-hidden="true">
                    <td
                      colSpan={BROJ_KOLONA}
                      style={{
                        height: visinaPoslijeRedova,
                        padding: 0,
                        border: "none",
                      }}
                    />
                  </tr>
                )}
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
