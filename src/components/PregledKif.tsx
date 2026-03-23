import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Filter, Printer, Receipt, Search } from "lucide-react";

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
  Naziv_grada: string;
  Entitet: string;
  JIB: string;
  PIB: string;
  ukupno: number;
  rabat_km: number;
  Osnova_za_obracun_pdv: number;
  PDV: number;
  vrednost: number;
  datum_unosa: string;
  vrsta_racuna_pod: string;
  El_Kif_tip: string;
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

const toText = (value: unknown) => String(value ?? "").trim();

const hasTaxIdValue = (value: unknown) => {
  const v = toText(value);
  return v !== "" && !/^0+$/.test(v);
};

// Opcija 2 (DA): partner je u sistemu PDV (ima PIB) ili je ino partner (Entitet = "-")
const isOption2 = (row: Pick<KifRow, "PIB" | "Entitet">) => {
  const hasPib = hasTaxIdValue(row.PIB);
  const isInoPartner = toText(row.Entitet) === "-";
  return hasPib || isInoPartner;
};

export function PregledKif() {
  const [rows, setRows] = useState<KifRow[]>([]);
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

      const response = await fetch(`${API_URL}/api/pregledi/kif`, {
        credentials: "include",
      });

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
        (row) => getDateOnly(row.datum_racuna) === appliedFilters.dayDate,
      );
    }

    if (
      appliedFilters.mode === "period" &&
      appliedFilters.periodFrom &&
      appliedFilters.periodTo
    ) {
      temp = temp.filter((row) => {
        const date = getDateOnly(row.datum_racuna);
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
          `${row.naziv_partnera || ""} ${row.adresa_partnera || ""} ${row.Naziv_grada || ""}`.toLowerCase();
        const doc =
          `${row.broj_racuna || ""} ${row.vrsta_racuna || ""}`.toLowerCase();
        return partner.includes(term) || doc.includes(term);
      });
    }

    return temp;
  }, [rows, appliedFilters]);

  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, row) => {
        acc.ukupno += Number(row.ukupno) || 0;
        acc.rabat += Number(row.rabat_km) || 0;

        const osnova = Number(row.Osnova_za_obracun_pdv) || 0;
        const pdv = Number(row.PDV) || 0;

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
            onClick={() =>
              alert(
                "Pokrenuto je štampanje Knjige izlaznih faktura.\nBroj stavki: " +
                  filteredRows.length,
              )
            }
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
                placeholder="Br fakture, vrsta, partner..."
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
              { label: "OPCIJA 2", value: "" },
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
              { label: "OPCIJA 1", value: "" },
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
            <table className="w-full min-w-[960px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                  <th className="text-left px-4 py-3" rowSpan={2}>
                    Šifra KIF
                  </th>
                  <th className="text-left px-4 py-3" rowSpan={2}>
                    Br fakture
                  </th>
                  <th className="text-left px-4 py-3" rowSpan={2}>
                    Datum
                  </th>
                  <th className="text-left px-4 py-3" rowSpan={2}>
                    Partner
                  </th>
                  <th className="text-right px-4 py-3" rowSpan={2}>
                    Ukupno
                  </th>
                  <th className="text-right px-4 py-3" rowSpan={2}>
                    Rabat
                  </th>
                  <th
                    className="text-center px-4 py-2 border-l border-gray-200"
                    colSpan={2}
                  >
                    Opcija 1
                  </th>
                  <th
                    className="text-center px-4 py-2 border-l border-gray-200"
                    colSpan={2}
                  >
                    Opcija 2
                  </th>
                </tr>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500">
                  <th className="text-right px-4 py-2 border-l border-gray-200">
                    Osnova PDV
                  </th>
                  <th className="text-right px-4 py-2">PDV</th>
                  <th className="text-right px-4 py-2 border-l border-gray-200">
                    Osnova PDV
                  </th>
                  <th className="text-right px-4 py-2">PDV</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={`${row.sifra_kif}-${row.broj_racuna}`}
                    className="border-b border-gray-100 transition-colors hover:brightness-95"
                    style={rowStyle(row.vrsta_racuna)}
                  >
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {row.sifra_kif}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                      {[row.vrsta_racuna, row.broj_racuna]
                        .filter(Boolean)
                        .join(" - ") || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {displayDate(row.datum_racuna)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="font-medium text-gray-800">
                        {row.naziv_partnera || "-"}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(row.adresa_partnera || "") +
                          (row.Naziv_grada ? `, ${row.Naziv_grada}` : "")}
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
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.ukupno))}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">
                      {formatCurrency(Number(row.rabat_km))}
                    </td>
                    {isOption2(row) ? (
                      <>
                        <td className="px-4 py-3 text-sm text-right text-gray-400 border-l border-gray-200">
                          {formatCurrency(0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-400">
                          {formatCurrency(0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 border-l border-gray-200">
                          {formatCurrency(Number(row.Osnova_za_obracun_pdv))}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {formatCurrency(Number(row.PDV))}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 border-l border-gray-200">
                          {formatCurrency(Number(row.Osnova_za_obracun_pdv))}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700">
                          {formatCurrency(Number(row.PDV))}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-400 border-l border-gray-200">
                          {formatCurrency(0)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-400">
                          {formatCurrency(0)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
