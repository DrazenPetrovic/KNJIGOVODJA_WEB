import { useEffect, useRef, useState } from "react";
import { X, Printer, ChevronDown, FileText, Loader2 } from "lucide-react";

const PRIMARY = "#785E9E";

// ─── Tipovi ───────────────────────────────────────────────────────────────────

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

interface PrintTotals {
  ukupno: number;
  rabat: number;
  option1: { count: number; osnova: number; pdv: number };
  option2: { count: number; osnova: number; pdv: number };
}

interface PrintModalProps {
  open: boolean;
  onClose: () => void;
  rows: KifRow[];
  totals: PrintTotals;
  periodLabel?: string; // npr. "01.01.2025 – 31.03.2025"
}

// ─── Helperi (isti kao u PregledKif) ─────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);

const getDateOnly = (s: string) => {
  if (!s) return "";
  const n = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(n);
  if (isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const displayDate = (s: string) => {
  const d = getDateOnly(s);
  if (!d) return "-";
  return new Date(`${d}T00:00:00`).toLocaleDateString("sr-Latn-RS");
};

const hasTaxId = (v: unknown) => {
  const s = String(v ?? "").trim();
  return s !== "" && !/^0+$/.test(s);
};

const isOption2 = (row: Pick<KifRow, "pib" | "entitet">) =>
  hasTaxId(row.pib) || String(row.entitet ?? "").trim() === "-";

// ─── HTML izvještaja (ubacuje se u iframe) ────────────────────────────────────

function buildReportHTML(
  rows: KifRow[],
  totals: PrintTotals,
  periodLabel: string,
): string {
  // RS pdv unutar PDV neobveznika — isti obrazac kao rsPdv u KANCELARIJA_WEB
  // KifPregledTemplate: neobveznik čiji je entitet RS.
  const rsPdv = rows.reduce((s, row) => {
    if (isOption2(row)) return s;
    return row.entitet === "RS" ? s + (Number(row.pdv) || 0) : s;
  }, 0);
  const fbihPdv = rows.reduce((s, row) => {
    if (isOption2(row)) return s;
    return row.entitet === "FBiH" ? s + (Number(row.pdv) || 0) : s;
  }, 0);

  const rowsHtml = rows
    .map((row) => {
      const opt2 = isOption2(row);
      const bg = row.vrsta_racuna?.toUpperCase().startsWith("MP")
        ? "#f3effe"
        : row.vrsta_racuna?.toUpperCase().startsWith("VP")
          ? "#f0f8e8"
          : "#fff";

      const partner = [
        `${row.sifra_partnera ?? ""} — ${row.naziv_partnera || "-"}`,
        [row.adresa_partnera, row.naziv_grada].filter(Boolean).join(", "),
        [
          hasTaxId(row.jib) ? `JIB: ${row.jib}` : "",
          hasTaxId(row.pib) ? `PIB: ${row.pib}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      ]
        .filter(Boolean)
        .join("<br/>");

      return `<tr style="background:${bg}">
        <td>${row.sifra_kif}</td>
        <td>${[row.vrsta_racuna, row.broj_racuna].filter(Boolean).join(" - ") || "-"}<div class="sub">${displayDate(row.datum_racuna)}</div></td>
        <td>${partner}</td>
        <td class="num">${fmt(Number(row.ukupno))}</td>
        <td class="num bl">${opt2 ? fmt(Number(row.osnova_za_obracun_pdv)) : "0.00"}</td>
        <td class="num br">${opt2 ? fmt(Number(row.pdv)) : "0.00"}</td>
        <td class="num bl">${!opt2 ? fmt(Number(row.osnova_za_obracun_pdv)) : "0.00"}</td>
        <td class="num">${!opt2 ? fmt(Number(row.pdv)) : "0.00"}</td>
        <td class="num">${!opt2 && row.entitet === "RS" ? fmt(Number(row.pdv)) : "0.00"}</td>
        <td class="num br">${!opt2 && row.entitet === "FBiH" ? fmt(Number(row.pdv)) : "0.00"}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8"/>
<title>Knjiga izlaznih faktura</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #1a1a1a; padding: 12mm; }

  .header { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 3px solid ${PRIMARY}; padding-bottom: 8px; margin-bottom: 10px; }
  .header h1 { font-size: 13pt; font-weight: 700; color: ${PRIMARY}; text-transform: uppercase; }
  .header .period { font-size: 9pt; color: #444; margin-top: 2px; }
  .header .meta { font-size: 8pt; color: #999; margin-top: 4px; text-align: right; }

  .rekap-wrap { display: flex; justify-content: center; margin-bottom: 12px; }
  .rekap { width: 140mm; }
  .rekap-naslov { text-align: center; font-size: 12pt; font-weight: 700; letter-spacing: .06em; margin-bottom: 6px; }
  .rekap table { width: 100%; border-collapse: collapse; }
  .rekap td.label { border: 1px solid #999; padding: 4px 10px; font-size: 10pt; font-weight: 700; background: #fff; }
  .rekap td.value { border: 1px solid #999; padding: 4px 10px; font-size: 10pt; font-weight: 700; text-align: center; background: #d9d9d9; }
  .rekap-group-title { text-align: center; font-size: 10pt; font-weight: 700; margin-top: 8px; margin-bottom: 3px; }
  .rekap-row { display: flex; justify-content: space-between; font-size: 10pt; color: #333; padding: 2px 0; }

  table.main { width: 100%; border-collapse: collapse; font-size: 8pt; }
  thead tr { background: ${PRIMARY}; }
  th { padding: 4px 5px; text-align: left; font-size: 7.5pt; text-transform: uppercase; color: #fff;
       letter-spacing: .03em; white-space: nowrap; }
  th.num { text-align: right; }
  th.center { text-align: center; }
  td { padding: 3px 5px; border-bottom: 1px solid #ddd; vertical-align: top; }
  .sub { font-size: 7pt; color: #888; margin-top: 1px; }

  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bl { border-left: 1.5px solid #000; }
  .br { border-right: 1.5px solid #000; }
  thead .bl { border-left: 1.5px solid #fff; }
  thead .br { border-right: 1.5px solid #fff; }

  .footer { margin-top: 8mm; font-size: 8pt; color: #aaa; display: flex; justify-content: space-between;
            border-top: 1px solid #e5e7eb; padding-top: 6px; }

  @media print {
    body { padding: 8mm; }
    .no-print { display: none; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Knjiga izlaznih faktura</h1>
      <div class="period">za period: ${periodLabel || "–"}</div>
    </div>
    <div class="meta">
      Datum štampe: ${new Date().toLocaleDateString("sr-Latn-RS")}<br/>
      Broj zapisa: ${rows.length}
    </div>
  </div>

  <div class="rekap-wrap">
    <div class="rekap">
      <div class="rekap-naslov">REKAPITULACIJA</div>
      <table>
        <tr><td class="label">Ukupno fakturisano:</td><td class="value">${fmt(totals.ukupno)}</td></tr>
        <tr><td class="label">Osnovica (obveznici + neobveznici):</td><td class="value">${fmt(totals.option1.osnova + totals.option2.osnova)}</td></tr>
        <tr><td class="label">PDV (obveznici + neobveznici):</td><td class="value">${fmt(totals.option1.pdv + totals.option2.pdv)}</td></tr>
        <tr><td class="label">Rabat:</td><td class="value">${fmt(totals.rabat)}</td></tr>
      </table>

      <div class="rekap-group-title">PDV OBVEZNICI</div>
      <div class="rekap-row"><span>Osnovica:</span><span>${fmt(totals.option2.osnova)}</span></div>
      <div class="rekap-row"><span>PDV:</span><span>${fmt(totals.option2.pdv)}</span></div>

      <div class="rekap-group-title">PDV NEOBVEZNICI</div>
      <div class="rekap-row"><span>Osnovica:</span><span>${fmt(totals.option1.osnova)}</span></div>
      <div class="rekap-row"><span>PDV:</span><span>${fmt(totals.option1.pdv)}</span></div>
      <div class="rekap-row"><span>RS:</span><span>${fmt(rsPdv)}</span></div>
      <div class="rekap-row"><span>FBiH:</span><span>${fmt(fbihPdv)}</span></div>
    </div>
  </div>

  <table class="main">
    <thead>
      <tr>
        <th rowspan="2">RB</th>
        <th rowspan="2">Faktura</th>
        <th rowspan="2">Partner</th>
        <th rowspan="2" class="num">Ukupno</th>
        <th colspan="2" class="center bl br">PDV obveznici</th>
        <th colspan="4" class="center bl br">PDV neobveznici</th>
      </tr>
      <tr>
        <th class="num bl">Osnova</th>
        <th class="num br">PDV</th>
        <th class="num bl">Osnova</th>
        <th class="num">PDV</th>
        <th class="center">RS</th>
        <th class="center br">FBiH</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="10" style="text-align:center;color:#aaa;padding:30px;">Nema podataka za izabrani period.</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    <span>KIF — knjiga izlaznih faktura</span>
    <span>Generisano: ${new Date().toLocaleString("sr-Latn-RS")}</span>
  </div>
</body>
</html>`;
}

// ─── Glavni modal ─────────────────────────────────────────────────────────────

export function PrintModal({
  open,
  onClose,
  rows,
  totals,
  periodLabel = "",
}: PrintModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    "landscape",
  );
  const [printing, setPrinting] = useState(false);

  // Zatvori na Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Zabrani scroll na body dok je modal otvoren
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Dohvati dostupne printere sa Express backenda
  useEffect(() => {
    if (!open) return;
    setLoadingPrinters(true);

    const API_URL =
      (import.meta as unknown as { env: Record<string, string> }).env
        ?.VITE_API_URL || "http://localhost:3003";

    fetch(`${API_URL}/api/printers`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        const list: string[] = Array.isArray(data?.printers)
          ? data.printers
          : [];
        setPrinters(list);
        if (list.length > 0) setSelectedPrinter(list[0]);
      })
      .catch(() => {
        // fallback ako endpoint ne postoji
        setPrinters([]);
      })
      .finally(() => setLoadingPrinters(false));
  }, [open]);

  // Refresh iframe sadržaja kad se otvori modal ili promijene podaci
  useEffect(() => {
    if (!open || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    const html = buildReportHTML(rows, totals, periodLabel);
    doc.open();
    doc.write(html);
    doc.close();
  }, [open, rows, totals, periodLabel]);

  const handlePrint = () => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    setPrinting(true);

    // Postavi @page orijentaciju u iframe
    const styleId = "print-orientation";
    const doc = iframe.contentDocument!;
    let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = styleId;
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = `@page { size: A4 ${orientation}; margin: 10mm; }`;

    // Browser print dijalog — korisnik može izabrati printer
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => setPrinting(false), 1000);
  };

  if (!open) return null;

  return (
    // Overlay
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Modal panel */}
      <div
        className="flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: "min(96vw, 1100px)", height: "min(92vh, 820px)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-gray-100"
          style={{ background: `${PRIMARY}0d` }}
        >
          <div className="flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: `${PRIMARY}20` }}
            >
              <FileText size={16} style={{ color: PRIMARY }} />
            </span>
            <div>
              <h2 className="text-sm font-bold text-gray-800">
                Preview — Knjiga izlaznih faktura
              </h2>
              <p className="text-xs text-gray-500">
                {rows.length} faktura &nbsp;|&nbsp;{" "}
                {periodLabel || "Sve fakture"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Orijentacija */}
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {(["landscape", "portrait"] as const).map((o) => (
                <button
                  key={o}
                  onClick={() => setOrientation(o)}
                  className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
                  style={
                    orientation === o
                      ? { background: PRIMARY, color: "#fff" }
                      : { color: "#6b7280" }
                  }
                >
                  {o === "landscape" ? "Horizontalno" : "Vertikalno"}
                </button>
              ))}
            </div>

            {/* Izbor printera */}
            <div className="relative">
              {loadingPrinters ? (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-500">
                  <Loader2 size={13} className="animate-spin" />
                  Printeri...
                </div>
              ) : printers.length > 0 ? (
                <div className="relative inline-flex items-center">
                  <Printer
                    size={13}
                    className="absolute left-2.5 text-gray-400 pointer-events-none"
                  />
                  <select
                    value={selectedPrinter}
                    onChange={(e) => setSelectedPrinter(e.target.value)}
                    className="pl-8 pr-7 py-1.5 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 appearance-none cursor-pointer"
                    style={
                      {
                        "--tw-ring-color": `${PRIMARY}40`,
                      } as React.CSSProperties
                    }
                  >
                    {printers.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={13}
                    className="absolute right-2 text-gray-400 pointer-events-none"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400">
                  <Printer size={13} />
                  Sistemski printer
                </div>
              )}
            </div>

            {/* Dugme Štampaj */}
            <button
              onClick={handlePrint}
              disabled={printing}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: PRIMARY, color: "#fff" }}
            >
              {printing ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Printer size={14} />
              )}
              Štampaj
            </button>

            {/* Zatvori */}
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Preview iframe */}
        <div className="flex-1 bg-gray-200 p-4 overflow-hidden">
          <iframe
            ref={iframeRef}
            title="KIF Preview"
            className="w-full h-full rounded-lg bg-white shadow-md border border-gray-200"
            style={{ display: "block" }}
          />
        </div>
      </div>
    </div>
  );
}
