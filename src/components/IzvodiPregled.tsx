import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Landmark,
  Loader2,
  Printer,
  Receipt,
  RefreshCcw,
  Search,
  Wallet,
} from "lucide-react";
import {
  PrintModalIzvod,
  type IzvodZaStampu,
  type StavkaZaStampu,
} from "./PrintModalIzvod";

// Tolerancija za poređenje novčanih iznosa (zaokruživanje na 2 decimale).
const TOLERANCIJA_SALDA = 0.01;

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3003";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

// Boje ikonice banke — svaka banka dobija svoju, po redoslijedu iz erp.banke_pregled.
const BOJE_BANAKA = [
  "#785E9E",
  "#2563eb",
  "#ea580c",
  "#0d9488",
  "#db2777",
  "#ca8a04",
  "#dc2626",
  "#16a34a",
  "#0891b2",
  "#9333ea",
  "#65a30d",
  "#475569",
];

// Red iz erp.izvodi_pregled.
export interface IzvodRed {
  redni_broj: number;
  sifra_izvoda: number | string;
  sifra_banke: number | string;
  ukupno_uplata: number | string | null;
  ukupno_isplata: number | string | null;
  izvod_zatvoren: number | string | null;
  datum_izvoda: string | null;
  pocetno_stanje: number | string | null;
  krajnje_stanje: number | string | null;
  sifra_knjizenja: number | string | null;
  naziv_banke: string | null;
  vrsta_racuna: string | number | null;
  izvod_unos_otvoren: string | number | null;
  izvod_unos_zatvoren: string | number | null;
}

// Red iz erp.izvodi_uplate_pregled — sifra_blagajne se poklapa sa
// redni_broj iz izvodi_pregled.
export interface UplataRed {
  sifra_uplate: number;
  vrsta_uplate: string | number | null;
  sifra_partnera: number | string | null;
  naziv_partnera: string | null;
  datum_uplate: string | null;
  vreme_uplate: string | null;
  uplaceno: number | string | null;
  opis: string | null;
  napomena: string | null;
  sifra_radnika: number | string | null;
  Naziv_radnika: string | null;
  gotovinska_uplata: number | string | null;
  sifra_blagajne: number | string;
  // 'UPLATA' ili 'TRANSFER' (prenos između računa, ziralni.banka_prenos_sredstava).
  tip_stavke: string | null;
  // Samo za transfere: 'IZLAZ' (skidanje sa ovog izvoda) ili 'ULAZ' (prijem).
  smjer: string | null;
  sifra_transfera: number | string | null;
}

// Red iz erp.banke_pregled.
interface BankaRed {
  sifra_banke: number;
  naziv_banke: string;
  broj_racuna: string | null;
  vrsta_racuna: string | null;
}

// 1000 -> "1 000.00", 1000000 -> "1 000 000.00" — razmak kao separator hiljada.
function formatBroj(n: number) {
  const [cijeliDio, decimalniDio] = n.toFixed(2).split(".");
  const negativan = cijeliDio.startsWith("-");
  const cijeliBezZnaka = negativan ? cijeliDio.slice(1) : cijeliDio;
  const saSeparatorom = cijeliBezZnaka.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${negativan ? "-" : ""}${saSeparatorom}.${decimalniDio}`;
}

// Šifarnik vrsta_uplate — "uplata" = novac ulazi (zeleno), "isplata" = novac
// izlazi (crveno).
const VRSTA_UPLATE: Record<
  number,
  { naziv: string; tip: "uplata" | "isplata" }
> = {
  0: { naziv: "Dugovanja kupaca", tip: "uplata" }, // kupac uplaćuje ranija dugovanja
  1: { naziv: "Uplate kupaca", tip: "uplata" },
  2: { naziv: "Isplata dobavljačima (kalk)", tip: "isplata" },
  3: { naziv: "Isplata (KUF)", tip: "isplata" },
  4: { naziv: "Dugovanja (dobavljaču)", tip: "isplata" },
  5: { naziv: "Davanje pozajmice", tip: "isplata" },
  6: { naziv: "Vraćanje date pozajmice", tip: "uplata" },
  7: { naziv: "Primanje pozajmice", tip: "uplata" },
  8: { naziv: "Vraćanje primljene pozajmice", tip: "isplata" },
  9: { naziv: "Povrat pretplate dobavljaču", tip: "isplata" },
  10: { naziv: "Prijem pretplate (povrat od kupca)", tip: "uplata" },
  11: { naziv: "Prijem pretplate dobavljača", tip: "uplata" },
  12: { naziv: "Povrat pretplate kupcu", tip: "isplata" },
  13: { naziv: "Transfer ka banci", tip: "uplata" },
  14: { naziv: "Transfer od banke", tip: "isplata" },
};

function vrstaUplateInfo(v: string | number | null | undefined) {
  const kod = Number(v);
  return (
    VRSTA_UPLATE[kod] ?? {
      naziv: v === null || v === undefined || v === "" ? "–" : String(v),
      tip: "uplata" as const,
    }
  );
}

// Transfer ima vrsta_uplate = -1, pa se smjer novca čita iz `smjer`
// (ULAZ = uplata na ovaj izvod, IZLAZ = isplata sa ovog izvoda).
export function stavkaInfo(u: UplataRed) {
  if (String(u.tip_stavke ?? "").toUpperCase() === "TRANSFER") {
    const ulaz = String(u.smjer ?? "").toUpperCase() === "ULAZ";
    return {
      naziv: ulaz ? "Transfer – prijem" : "Transfer – skidanje",
      tip: ulaz ? ("uplata" as const) : ("isplata" as const),
      transfer: true,
    };
  }
  return { ...vrstaUplateInfo(u.vrsta_uplate), transfer: false };
}

// Redoslijed u tabeli: uplate, isplate, pa transferi (prijem, skidanje).
export function redoslijedStavke(u: UplataRed) {
  const s = stavkaInfo(u);
  return (s.transfer ? 2 : 0) + (s.tip === "isplata" ? 1 : 0);
}

export function formatKM(v: number | string | null | undefined) {
  if (v === null || v === undefined || v === "") return "–";
  const n = Number(v);
  if (Number.isNaN(n)) return "–";
  return `${formatBroj(n)} KM`;
}

export function formatDatum(v: string | null | undefined) {
  if (!v) return "–";
  const d = new Date(v);
  if (isNaN(d.getTime())) return v;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()}.`;
}

// izvod_unos_otvoren / izvod_unos_zatvoren — datum i vrijeme otvaranja/zatvaranja unosa.
export function formatDatumVrijeme(v: string | number | null | undefined) {
  if (v === null || v === undefined || v === "") return "–";
  const d = new Date(v as string);
  if (isNaN(d.getTime())) return String(v);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}.${mm}.${d.getFullYear()} ${hh}:${mi}:${ss}`;
}

function IzvodStatusBadge({ v }: { v: number | string | null }) {
  const zatvoren = Number(v) === 1;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={
        zatvoren
          ? { background: "#9ca3af26", color: "#6b7280" }
          : { background: `${ACCENT}26`, color: ACCENT }
      }
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: zatvoren ? "#6b7280" : ACCENT }}
      />
      {zatvoren ? "Zatvoren" : "Otvoren"}
    </span>
  );
}

function StatTile({
  icon,
  vrijednost,
  naziv,
  boja,
}: {
  icon: React.ReactNode;
  vrijednost: string | number;
  naziv: string;
  boja: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3">
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
      </div>
    </div>
  );
}

export function IzvodiPregled() {
  const [izvodi, setIzvodi] = useState<IzvodRed[]>([]);
  const [uplate, setUplate] = useState<UplataRed[]>([]);
  const [loading, setLoading] = useState(true);
  const [greska, setGreska] = useState<string | null>(null);

  const [pretraga, setPretraga] = useState("");
  const [prosireno, setProsireno] = useState<Set<number>>(new Set());
  const [banke, setBanke] = useState<BankaRed[]>([]);
  const [filterBanka, setFilterBanka] = useState<string>("");
  const [stampa, setStampa] = useState<{
    izvod: IzvodZaStampu;
    stavke: StavkaZaStampu[];
  } | null>(null);

  const ucitaj = () => {
    setLoading(true);
    setGreska(null);
    fetch(`${API_URL}/api/izvodi/pregled-sa-uplatama`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error("Greška pri učitavanju izvoda");
        return res.json();
      })
      .then((json) => {
        setIzvodi(json.izvodi ?? []);
        setUplate(json.uplate ?? []);
      })
      .catch((err) =>
        setGreska(err instanceof Error ? err.message : "Nepoznata greška"),
      )
      .finally(() => setLoading(false));
  };

  useEffect(ucitaj, []);

  useEffect(() => {
    fetch(`${API_URL}/api/izvodi/banke`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setBanke(json.data ?? []))
      .catch(() => setBanke([]));
  }, []);

  const nazivBanke = useMemo(() => {
    const map = new Map<string, string>();
    banke.forEach((b) => map.set(String(b.sifra_banke), b.naziv_banke));
    return map;
  }, [banke]);

  const bojaBanke = useMemo(() => {
    const map = new Map<string, string>();
    banke.forEach((b, i) =>
      map.set(String(b.sifra_banke), BOJE_BANAKA[i % BOJE_BANAKA.length]),
    );
    return map;
  }, [banke]);

  // Kod transfera procedura vraća "Prenos sredstava na/sa banke <sifra_banke>"
  // — šifra na kraju se zamjenjuje nazivom banke iz erp.banke_pregled.
  const nazivPartnera = (u: UplataRed) => {
    if (String(u.tip_stavke ?? "").toUpperCase() === "TRANSFER") {
      const sifra = String(u.naziv_partnera ?? "").match(/(\d+)\s*$/)?.[1];
      const naziv = sifra ? nazivBanke.get(sifra) : undefined;
      if (naziv) return naziv;
    }
    return u.naziv_partnera ?? `Partner #${u.sifra_partnera}`;
  };

  // Uplate grupisane po sifra_blagajne — poklapa se sa redni_broj izvoda.
  const uplatePoIzvodu = useMemo(() => {
    const map = new Map<string, UplataRed[]>();
    uplate.forEach((u) => {
      const kljuc = String(u.sifra_blagajne);
      const niz = map.get(kljuc) ?? [];
      niz.push(u);
      map.set(kljuc, niz);
    });
    // Uplate, isplate, prijem transfera, skidanje transfera — unutar svake
    // grupe od najvećeg iznosa ka najmanjem.
    map.forEach((niz) =>
      niz.sort((a, b) => {
        const tipA = redoslijedStavke(a);
        const tipB = redoslijedStavke(b);
        if (tipA !== tipB) return tipA - tipB;
        return (Number(b.uplaceno) || 0) - (Number(a.uplaceno) || 0);
      }),
    );
    return map;
  }, [uplate]);

  const filtrirani = useMemo(() => {
    const q = pretraga.trim().toLowerCase();
    return izvodi.filter((i) => {
      const odgovaraBanci =
        !filterBanka || String(i.sifra_banke) === filterBanka;
      if (!odgovaraBanci) return false;
      if (!q) return true;
      return (
        String(i.sifra_izvoda).includes(q) ||
        String(i.redni_broj).includes(q) ||
        (i.naziv_banke ?? "").toLowerCase().includes(q)
      );
    });
  }, [izvodi, pretraga, filterBanka]);

  const sortirani = useMemo(
    () => [...filtrirani].sort((a, b) => b.redni_broj - a.redni_broj),
    [filtrirani],
  );

  // Kontinuitet salda ima smisla samo unutar jedne banke (kad je filter po
  // banci aktivan) — krajnje stanje starijeg izvoda mora biti početno stanje
  // sljedećeg. Računa se nad SVIM izvodima te banke (ne dira ih tekstualna
  // pretraga), da poredak ostane ispravan bez obzira na trenutni upit.
  const neusaglasenKontinuitet = useMemo(() => {
    const skup = new Set<number>();
    if (!filterBanka) return skup;
    const izvodiBanke = izvodi.filter(
      (i) => String(i.sifra_banke) === filterBanka,
    );
    const hronoloski = [...izvodiBanke].sort(
      (a, b) => a.redni_broj - b.redni_broj,
    );
    for (let i = 1; i < hronoloski.length; i++) {
      const prethodnoKrajnje = Number(hronoloski[i - 1].krajnje_stanje) || 0;
      const trenutnoPocetno = Number(hronoloski[i].pocetno_stanje) || 0;
      if (Math.abs(prethodnoKrajnje - trenutnoPocetno) > TOLERANCIJA_SALDA) {
        skup.add(hronoloski[i].redni_broj);
      }
    }
    return skup;
  }, [izvodi, filterBanka]);

  // Rekapitulacija prati samo filter banke (ne tekstualnu pretragu) — bez
  // filtera prikazuje sve banke.
  const izvodiRekap = useMemo(
    () =>
      filterBanka
        ? izvodi.filter((i) => String(i.sifra_banke) === filterBanka)
        : izvodi,
    [izvodi, filterBanka],
  );
  const brojOtvorenih = useMemo(
    () => izvodiRekap.filter((i) => Number(i.izvod_zatvoren) !== 1).length,
    [izvodiRekap],
  );
  const sumaUplata = useMemo(
    () =>
      izvodiRekap.reduce((acc, i) => acc + (Number(i.ukupno_uplata) || 0), 0),
    [izvodiRekap],
  );
  const sumaIsplata = useMemo(
    () =>
      izvodiRekap.reduce((acc, i) => acc + (Number(i.ukupno_isplata) || 0), 0),
    [izvodiRekap],
  );

  // Rekapitulacija po banci — broj izvoda, zbir uplata/isplata i krajnje
  // stanje zadnjeg (najvećeg redni_broj) izvoda te banke.
  const rekapPoBanci = useMemo(() => {
    const map = new Map<
      string,
      {
        sifra: string;
        naziv: string;
        broj: number;
        uplate: number;
        isplate: number;
        zadnjiRb: number;
        stanje: number;
      }
    >();
    izvodi.forEach((i) => {
      const kljuc = String(i.sifra_banke);
      const r = map.get(kljuc) ?? {
        sifra: kljuc,
        naziv:
          nazivBanke.get(kljuc) ?? i.naziv_banke ?? `Banka #${i.sifra_banke}`,
        broj: 0,
        uplate: 0,
        isplate: 0,
        zadnjiRb: -Infinity,
        stanje: 0,
      };
      r.broj += 1;
      r.uplate += Number(i.ukupno_uplata) || 0;
      r.isplate += Number(i.ukupno_isplata) || 0;
      if (i.redni_broj > r.zadnjiRb) {
        r.zadnjiRb = i.redni_broj;
        r.stanje = Number(i.krajnje_stanje) || 0;
      }
      map.set(kljuc, r);
    });
    return [...map.values()].sort((a, b) => a.naziv.localeCompare(b.naziv));
  }, [izvodi, nazivBanke]);

  // Priprema izvoda i njegovih stavki za modal štampe/PDF — isti redoslijed
  // i nazivi kao u tabeli na ekranu.
  const otvoriStampu = (izvod: IzvodRed) => {
    const sifraBanke = String(izvod.sifra_banke);
    const stavke = (uplatePoIzvodu.get(String(izvod.redni_broj)) ?? []).map(
      (u): StavkaZaStampu => {
        const vrsta = stavkaInfo(u);
        const iznos = Number(u.uplaceno) || 0;
        return {
          partner: nazivPartnera(u),
          datum: formatDatum(u.datum_uplate ?? izvod.datum_izvoda),
          uplata: vrsta.tip === "uplata" ? iznos : null,
          isplata: vrsta.tip === "isplata" ? iznos : null,
          opis: u.opis ?? "",
          vrsta: vrsta.transfer
            ? `${vrsta.naziv} #${u.sifra_transfera}`
            : `${vrsta.naziv} (${u.vrsta_uplate})`,
          transfer: vrsta.transfer,
        };
      },
    );
    setStampa({
      izvod: {
        redniBroj: izvod.redni_broj,
        sifraIzvoda: String(izvod.sifra_izvoda),
        nazivBanke:
          izvod.naziv_banke ??
          nazivBanke.get(sifraBanke) ??
          `Banka #${sifraBanke}`,
        datumIzvoda: formatDatum(izvod.datum_izvoda),
        zatvoren: Number(izvod.izvod_zatvoren) === 1,
        pocetnoStanje: Number(izvod.pocetno_stanje) || 0,
        ukupnoUplata: Number(izvod.ukupno_uplata) || 0,
        ukupnoIsplata: Number(izvod.ukupno_isplata) || 0,
        krajnjeStanje: Number(izvod.krajnje_stanje) || 0,
        unosOtvoren: formatDatumVrijeme(izvod.izvod_unos_otvoren),
        unosZatvoren: formatDatumVrijeme(izvod.izvod_unos_zatvoren),
      },
      stavke,
    });
  };

  const prekidacProsirenja = (redniBroj: number) => {
    setProsireno((prev) => {
      const novi = new Set(prev);
      if (novi.has(redniBroj)) novi.delete(redniBroj);
      else novi.add(redniBroj);
      return novi;
    });
  };

  const prosiriSve = () =>
    setProsireno(new Set(sortirani.map((i) => i.redni_broj)));
  const skupiSve = () => setProsireno(new Set());
  const sveProsireno =
    sortirani.length > 0 && prosireno.size >= sortirani.length;

  return (
    <div className="space-y-4 w-[95%] mx-auto">
      <div className="flex flex-col lg:flex-row gap-4 items-start">
        {/* Rekapitulacija — lijeva kolona */}
        <aside className="w-full lg:w-72 flex-shrink-0 lg:sticky lg:top-4 space-y-3">
          <div
            className="px-1 text-xs font-bold tracking-widest uppercase"
            style={{ color: PRIMARY }}
          >
            Rekapitulacija
            {filterBanka && (
              <span className="ml-1 normal-case tracking-normal font-medium text-gray-400">
                — {nazivBanke.get(filterBanka) ?? `Banka #${filterBanka}`}
              </span>
            )}
          </div>
          {loading && (
            <div className="flex items-center justify-center py-10 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <Loader2
                size={18}
                className="animate-spin"
                style={{ color: PRIMARY }}
              />
            </div>
          )}
          {!loading && !greska && (
            <div className="flex flex-col gap-3">
              <StatTile
                icon={<Receipt size={16} />}
                vrijednost={izvodiRekap.length}
                naziv="Izvoda ukupno"
                boja={PRIMARY}
              />
              <StatTile
                icon={<Landmark size={16} />}
                vrijednost={brojOtvorenih}
                naziv="Otvorenih izvoda"
                boja={brojOtvorenih > 0 ? "#f59e0b" : "#9ca3af"}
              />
              <StatTile
                icon={<Wallet size={16} />}
                vrijednost={formatKM(sumaUplata)}
                naziv="Ukupno uplata"
                boja={ACCENT}
              />
              <StatTile
                icon={<Wallet size={16} />}
                vrijednost={formatKM(sumaIsplata)}
                naziv="Ukupno isplata"
                boja="#ef4444"
              />
              <StatTile
                icon={<Wallet size={16} />}
                vrijednost={formatKM(sumaUplata - sumaIsplata)}
                naziv="Saldo (uplate − isplate)"
                boja={sumaUplata - sumaIsplata < 0 ? "#ef4444" : PRIMARY}
              />

              {/* Po bankama */}
              {rekapPoBanci.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-gray-500 bg-[#f4f1f9]">
                    Po bankama
                  </div>
                  <div className="divide-y divide-gray-100">
                    {rekapPoBanci.map((b) => {
                      const aktivna = filterBanka === b.sifra;
                      const boja = bojaBanke.get(b.sifra) ?? PRIMARY;
                      return (
                        <button
                          key={b.sifra}
                          type="button"
                          onClick={() => setFilterBanka(aktivna ? "" : b.sifra)}
                          title={
                            aktivna
                              ? "Poništi filter banke"
                              : "Prikaži samo ovu banku"
                          }
                          className={`w-full text-left px-4 py-2.5 transition-colors ${
                            aktivna ? "bg-[#ede8f5]" : "hover:bg-purple-50/60"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full flex-shrink-0"
                              style={{ background: boja }}
                            />
                            <span className="text-sm font-semibold text-gray-800 truncate flex-1">
                              {b.naziv}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {b.broj} izv.
                            </span>
                          </div>
                          <div className="mt-1 pl-4 grid grid-cols-[auto_1fr] gap-x-2 text-[11px]">
                            <span className="text-gray-400">Uplate</span>
                            <span
                              className="text-right font-semibold"
                              style={{ color: ACCENT }}
                            >
                              {formatKM(b.uplate)}
                            </span>
                            <span className="text-gray-400">Isplate</span>
                            <span className="text-right font-semibold text-red-500">
                              {formatKM(b.isplate)}
                            </span>
                            <span className="text-gray-400">Stanje</span>
                            <span
                              className="text-right font-bold"
                              style={{ color: PRIMARY }}
                            >
                              {formatKM(b.stanje)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Desna kolona — filteri i lista */}
        <div className="flex-1 min-w-0 space-y-4 w-full">
          {/* Filteri */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative w-80">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Pretraga po šifri izvoda ili banci..."
                  value={pretraga}
                  onChange={(e) => setPretraga(e.target.value)}
                  className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl w-full focus:outline-none focus:border-[#785E9E] transition-colors bg-white text-gray-800 placeholder:text-gray-400"
                />
              </div>

              <select
                value={filterBanka}
                onChange={(e) => setFilterBanka(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#785E9E] transition-colors bg-white text-gray-800"
              >
                <option value="">Sve banke</option>
                {banke.map((b) => (
                  <option key={b.sifra_banke} value={String(b.sifra_banke)}>
                    {b.naziv_banke}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={sveProsireno ? skupiSve : prosiriSve}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all"
              >
                {sveProsireno ? (
                  <ChevronsDownUp size={14} />
                ) : (
                  <ChevronsUpDown size={14} />
                )}
                {sveProsireno ? "Skupi sve" : "Proširi sve"}
              </button>

              <button
                type="button"
                onClick={ucitaj}
                disabled={loading}
                title="Osvježi"
                className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-50"
              >
                <RefreshCcw
                  size={14}
                  className={loading ? "animate-spin" : ""}
                />
                Osvježi
              </button>
            </div>

            {!loading && !greska && (
              <p className="mt-3 text-xs text-gray-400">
                Prikazano {sortirani.length} / {izvodi.length} izvoda
              </p>
            )}
          </div>

          {/* Lista izvoda */}
          <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {loading && (
              <div className="flex items-center justify-center py-20 gap-3">
                <Loader2
                  size={22}
                  className="animate-spin"
                  style={{ color: PRIMARY }}
                />
                <span className="text-sm text-gray-500">Učitavanje...</span>
              </div>
            )}

            {greska && (
              <div className="flex flex-col items-center justify-center gap-2 py-20">
                <p className="text-sm text-red-500">{greska}</p>
                <button
                  type="button"
                  onClick={ucitaj}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: `${PRIMARY}1f`, color: PRIMARY }}
                >
                  Pokušaj ponovo
                </button>
              </div>
            )}

            {!loading && !greska && sortirani.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-20 text-gray-300">
                <Landmark size={28} />
                <p className="text-sm text-gray-400">
                  {pretraga.trim()
                    ? "Nema rezultata za tu pretragu."
                    : "Nema izvoda za prikaz."}
                </p>
              </div>
            )}

            {!loading &&
              !greska &&
              sortirani.map((izvod, i) => {
                const otvoreno = prosireno.has(izvod.redni_broj);
                const bojaIkonice =
                  bojaBanke.get(String(izvod.sifra_banke)) ?? PRIMARY;
                const uplateIzvoda =
                  uplatePoIzvodu.get(String(izvod.redni_broj)) ?? [];

                // (početno + uplate) - isplate mora dati krajnje stanje.
                const izracunatoKrajnje =
                  (Number(izvod.pocetno_stanje) || 0) +
                  (Number(izvod.ukupno_uplata) || 0) -
                  (Number(izvod.ukupno_isplata) || 0);
                const neslaganjeSalda =
                  Math.abs(
                    izracunatoKrajnje - (Number(izvod.krajnje_stanje) || 0),
                  ) > TOLERANCIJA_SALDA;
                const neslaganjeKontinuiteta = neusaglasenKontinuitet.has(
                  izvod.redni_broj,
                );

                return (
                  <div
                    key={izvod.redni_broj}
                    className={`border-b last:border-b-0 ${
                      otvoreno
                        ? "border-l-4 border-gray-100"
                        : `border-gray-100 ${i % 2 === 1 ? "bg-[#faf9fc]" : ""}`
                    }`}
                    style={otvoreno ? { borderLeftColor: PRIMARY } : undefined}
                  >
                    <button
                      type="button"
                      onClick={() => prekidacProsirenja(izvod.redni_broj)}
                      className={`relative w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                        otvoreno
                          ? "bg-[#e3d9f7] hover:bg-[#dbcdf3]"
                          : "hover:bg-purple-50/60"
                      }`}
                    >
                      <ChevronRight
                        size={14}
                        className="transition-transform duration-200 flex-shrink-0"
                        style={{
                          color: PRIMARY,
                          transform: otvoreno
                            ? "rotate(90deg)"
                            : "rotate(0deg)",
                        }}
                      />
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${bojaIkonice}2e` }}
                      >
                        <Landmark size={14} style={{ color: bojaIkonice }} />
                      </div>
                      <div className="min-w-0 w-48 flex-shrink-0">
                        <div className="font-semibold text-sm text-gray-800 truncate">
                          {izvod.naziv_banke ?? `Banka #${izvod.sifra_banke}`}
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {izvod.redni_broj}
                        </div>
                      </div>
                      <div className="hidden md:flex items-center gap-6 text-xs text-gray-500 flex-shrink-0">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 w-14">
                              Krajnje
                            </span>
                            <span
                              className="font-semibold"
                              style={{ color: PRIMARY }}
                            >
                              {formatKM(izvod.krajnje_stanje)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 w-14">
                              Početno
                            </span>
                            <span className="font-semibold text-red-500">
                              {formatKM(izvod.pocetno_stanje)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 w-12">
                              Uplata
                            </span>
                            <span
                              className="font-semibold"
                              style={{ color: ACCENT }}
                            >
                              {formatKM(izvod.ukupno_uplata)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 w-12">
                              Isplata
                            </span>
                            <span className="font-semibold text-red-500">
                              {formatKM(izvod.ukupno_isplata)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-1 flex justify-center items-center gap-4 pointer-events-none whitespace-nowrap">
                        <div className="flex flex-col items-center">
                          <div className="text-base font-bold text-gray-800">
                            Izvod #{izvod.sifra_izvoda}
                          </div>
                          <div className="text-xs text-gray-400">
                            {formatDatum(izvod.datum_izvoda)}
                          </div>
                        </div>
                        <div className="hidden md:flex flex-col items-center gap-1 pointer-events-auto">
                          <span
                            title={
                              neslaganjeSalda
                                ? "Početno + uplate - isplate ne odgovara krajnjem stanju"
                                : "Saldo se slaže: početno + uplate - isplate = krajnje stanje"
                            }
                          >
                            {neslaganjeSalda ? (
                              <AlertTriangle
                                size={16}
                                className="text-red-500"
                              />
                            ) : (
                              <CheckCircle2
                                size={16}
                                style={{ color: ACCENT }}
                              />
                            )}
                          </span>
                          {!!filterBanka && (
                            <span
                              title={
                                neslaganjeKontinuiteta
                                  ? "Početno stanje se ne poklapa sa krajnjim stanjem prethodnog izvoda ove banke"
                                  : "Kontinuitet salda sa prethodnim izvodom ove banke je ispravan"
                              }
                            >
                              {neslaganjeKontinuiteta ? (
                                <AlertTriangle
                                  size={16}
                                  className="text-red-500"
                                />
                              ) : (
                                <CheckCircle2
                                  size={16}
                                  style={{ color: ACCENT }}
                                />
                              )}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="ml-auto flex items-center gap-3 flex-shrink-0">
                        <div className="hidden lg:flex flex-col items-end leading-tight text-[10px]">
                          <span className="text-green-600">
                            Otvoren:{" "}
                            {formatDatumVrijeme(izvod.izvod_unos_otvoren)}
                          </span>
                          <span className="text-red-500">
                            Zatvoren:{" "}
                            {formatDatumVrijeme(izvod.izvod_unos_zatvoren)}
                          </span>
                        </div>
                        <span
                          className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#ede8f5]"
                          style={{ color: PRIMARY }}
                        >
                          {uplateIzvoda.length} uplata
                        </span>
                        <IzvodStatusBadge v={izvod.izvod_zatvoren} />
                      </div>
                    </button>

                    {otvoreno && (
                      <div className="px-4 pb-3">
                        <div className="flex justify-end py-2">
                          <button
                            type="button"
                            onClick={() => otvoriStampu(izvod)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white shadow-sm hover:brightness-110 transition-all"
                            style={{ background: PRIMARY }}
                            title="Štampa ili PDF ovog izvoda"
                          >
                            <Printer size={13} />
                            Štampa / PDF
                          </button>
                        </div>
                        {uplateIzvoda.length === 0 ? (
                          <div className="flex items-center justify-center gap-1.5 py-6 text-gray-400">
                            <Wallet size={16} className="text-gray-300" />
                            <span className="text-xs">
                              Nema uplata za ovaj izvod
                            </span>
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-gray-100 w-fit max-w-full mx-auto">
                            <table className="table-auto">
                              <thead>
                                <tr style={{ background: PRIMARY }}>
                                  <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-white">
                                    Partner
                                  </th>
                                  <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-white">
                                    Datum
                                  </th>
                                  <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-green-200">
                                    Uplate
                                  </th>
                                  <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-red-200">
                                    Isplate
                                  </th>
                                  <th className="text-left px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-white">
                                    Opis
                                  </th>
                                  <th className="text-right px-3 py-2 text-xs font-bold uppercase tracking-wide whitespace-nowrap text-white">
                                    Vrsta
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {uplateIzvoda.map((u, idx) => {
                                  const vrsta = stavkaInfo(u);
                                  const boja = vrsta.transfer
                                    ? "#2563eb"
                                    : vrsta.tip === "isplata"
                                      ? "#ef4444"
                                      : ACCENT;
                                  return (
                                    <tr
                                      key={
                                        vrsta.transfer
                                          ? `T-${u.sifra_transfera}-${u.smjer}`
                                          : `U-${u.sifra_uplate}`
                                      }
                                      className={`transition-colors ${
                                        vrsta.transfer
                                          ? idx % 2 === 1
                                            ? "bg-blue-100/70 hover:bg-blue-100"
                                            : "bg-blue-50 hover:bg-blue-100"
                                          : vrsta.tip === "isplata"
                                            ? idx % 2 === 1
                                              ? "bg-red-200/70 hover:bg-red-200"
                                              : "bg-red-100 hover:bg-red-200"
                                            : idx % 2 === 1
                                              ? "bg-green-100/70 hover:bg-green-100"
                                              : "bg-green-50 hover:bg-green-100"
                                      }`}
                                    >
                                      <td className="px-3 py-2 text-sm text-gray-700 border-t border-gray-50">
                                        {nazivPartnera(u)}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-500 border-t border-gray-50 whitespace-nowrap">
                                        {formatDatum(
                                          u.datum_uplate ?? izvod.datum_izvoda,
                                        )}
                                      </td>
                                      <td
                                        className="px-3 py-2 text-sm text-right font-semibold border-t border-gray-50"
                                        style={{ color: ACCENT }}
                                      >
                                        {vrsta.tip === "uplata"
                                          ? formatKM(u.uplaceno)
                                          : ""}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-right font-semibold text-red-500 border-t border-gray-50">
                                        {vrsta.tip === "isplata"
                                          ? formatKM(u.uplaceno)
                                          : ""}
                                      </td>
                                      <td className="px-3 py-2 text-sm text-gray-600 border-t border-gray-50">
                                        {u.opis || "–"}
                                      </td>
                                      <td
                                        className="px-3 py-2 text-sm text-right font-medium border-t border-gray-50 whitespace-nowrap"
                                        style={{ color: boja }}
                                      >
                                        {vrsta.transfer
                                          ? `${vrsta.naziv} #${u.sifra_transfera}`
                                          : `${vrsta.naziv} (${u.vrsta_uplate})`}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <PrintModalIzvod
        open={stampa !== null}
        onClose={() => setStampa(null)}
        izvod={stampa?.izvod ?? null}
        stavke={stampa?.stavke ?? []}
      />
    </div>
  );
}
