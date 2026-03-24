import { useEffect, useRef, useState } from "react";
import { X, Printer, ChevronDown, FileText, Loader2 } from "lucide-react";

const PRIMARY = "#785E9E";
const SECONDARY = "#8FC74A";

// ─── Tipovi ───────────────────────────────────────────────────────────────────

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

const isOption2 = (row: Pick<KifRow, "PIB" | "Entitet">) =>
  hasTaxId(row.PIB) || String(row.Entitet ?? "").trim() === "-";

// ─── HTML izvještaja (ubacuje se u iframe) ────────────────────────────────────

function buildReportHTML(
  rows: KifRow[],
  totals: PrintTotals,
  periodLabel: string,
): string {
  const rowsHtml = rows
    .map((row) => {
      const opt2 = isOption2(row);
      const bg = row.vrsta_racuna?.toUpperCase().startsWith("MP")
        ? "#f3effe"
        : row.vrsta_racuna?.toUpperCase().startsWith("VP")
          ? "#f0f8e8"
          : "#fff";

      const o1Osnova = opt2 ? "" : fmt(Number(row.Osnova_za_obracun_pdv));
      const o1Pdv = opt2 ? "" : fmt(Number(row.PDV));
      const o2Osnova = opt2 ? fmt(Number(row.Osnova_za_obracun_pdv)) : "";
      const o2Pdv = opt2 ? fmt(Number(row.PDV)) : "";

      const partner = [
        row.naziv_partnera,
        [row.adresa_partnera, row.Naziv_grada].filter(Boolean).join(", "),
        [hasTaxId(row.JIB) ? `JIB: ${row.JIB}` : "", hasTaxId(row.PIB) ? `PIB: ${row.PIB}` : ""]
          .filter(Boolean)
          .join(" | "),
      ]
        .filter(Boolean)
        .join("<br/>");

      return `<tr style="background:${bg}">
        <td>${row.sifra_kif}</td>
        <td>${[row.vrsta_racuna, row.broj_racuna].filter(Boolean).join(" - ") || "-"}</td>
        <td>${displayDate(row.datum_racuna)}</td>
        <td>${partner}</td>
        <td class="num">${fmt(Number(row.ukupno))}</td>
        <td class="num">${fmt(Number(row.rabat_km))}</td>
        <td class="num bl">${o1Osnova}</td>
        <td class="num">${o1Pdv}</td>
        <td class="num bl">${o2Osnova}</td>
        <td class="num">${o2Pdv}</td>
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

  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8mm; }
  .header h1 { font-size: 14pt; font-weight: 700; color: ${PRIMARY}; }
  .header .period { font-size: 9pt; color: #555; margin-top: 2px; }
  .header .logo { font-size: 10pt; font-weight: 600; color: #333; text-align: right; }

  .summary { display: flex; gap: 6mm; margin-bottom: 6mm; flex-wrap: wrap; }
  .summary-box { border: 1px solid #ddd; border-radius: 4px; padding: 4px 8px; min-width: 120px; }
  .summary-box .label { font-size: 7pt; text-transform: uppercase; color: #888; letter-spacing: .04em; }
  .summary-box .value { font-size: 9pt; font-weight: 700; color: #1a1a1a; }
  .summary-box.opt2 { border-color: ${SECONDARY}; background: ${SECONDARY}18; }
  .summary-box.opt1 { border-color: ${PRIMARY}; background: ${PRIMARY}10; }

  table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  thead tr { background: #f5f5f5; }
  th { padding: 4px 5px; text-align: left; font-size: 7.5pt; text-transform: uppercase;
       letter-spacing: .04em; color: #555; border-bottom: 1.5px solid #ccc; white-space: nowrap; }
  td { padding: 3px 5px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:hover { filter: brightness(0.97); }

  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .bl { border-left: 1px solid #ccc; }

  tfoot td { font-weight: 700; border-top: 1.5px solid #aaa; background: #f9f9f9; padding: 4px 5px; }

  .footer { margin-top: 8mm; font-size: 8pt; color: #888; text-align: right; }

  @media print {
    body { padding: 8mm; }
    .no-print { display: none; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Knjiga izlaznih faktura (KIF)</h1>
      <div class="period">Period: ${periodLabel || "–"} &nbsp;|&nbsp; Ukupno faktura: ${rows.length}</div>
    </div>
    <div class="logo">Izvještaj<br/><span style="font-weight:400;font-size:8pt;color:#999">${new Date().toLocaleDateString("sr-Latn-RS")}</span></div>
  </div>

  <div class="summary">
    <div class="summary-box opt2">
      <div class="label">Opcija 2 — br. faktura</div>
      <div class="value">${totals.option2.count}</div>
    </div>
    <div class="summary-box opt2">
      <div class="label">Opcija 2 — osnova PDV</div>
      <div class="value">${fmt(totals.option2.osnova)} KM</div>
    </div>
    <div class="summary-box opt2">
      <div class="label">Opcija 2 — PDV</div>
      <div class="value">${fmt(totals.option2.pdv)} KM</div>
    </div>
    <div class="summary-box opt1">
      <div class="label">Opcija 1 — br. faktura</div>
      <div class="value">${totals.option1.count}</div>
    </div>
    <div class="summary-box opt1">
      <div class="label">Opcija 1 — osnova PDV</div>
      <div class="value">${fmt(totals.option1.osnova)} KM</div>
    </div>
    <div class="summary-box opt1">
      <div class="label">Opcija 1 — PDV</div>
      <div class="value">${fmt(totals.option1.pdv)} KM</div>
    </div>
    <div class="summary-box">
      <div class="label">Ukupno</div>
      <div class="value">${fmt(totals.ukupno)} KM</div>
    </div>
    <div class="summary-box">
      <div class="label">Rabat</div>
      <div class="value">${fmt(totals.rabat)} KM</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th rowspan="2">Šifra KIF</th>
        <th rowspan="2">Br. fakture</th>
        <th rowspan="2">Datum</th>
        <th rowspan="2">Partner</th>
        <th rowspan="2" class="num">Ukupno</th>
        <th rowspan="2" class="num">Rabat</th>
        <th colspan="2" class="bl" style="text-align:center">Opcija 1</th>
        <th colspan="2" class="bl" style="text-align:center">Opcija 2</th>
      </tr>
      <tr>
        <th class="num bl">Osnova PDV</th>
        <th class="num">PDV</th>
        <th class="num bl">Osnova PDV</th>
        <th class="num">PDV</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td colspan="4">UKUPNO — ${rows.length} faktura</td>
        <td class="num">${fmt(totals.ukupno)}</td>
        <td class="num">${fmt(totals.rabat)}</td>
        <td class="num bl">${fmt(totals.option1.osnova)}</td>
        <td class="num">${fmt(totals.option1.pdv)}</td>
        <td class="num bl">${fmt(totals.option2.osnova)}</td>
        <td class="num">${fmt(totals.option2.pdv)}</td>
      </tr>
    </tfoot>
  </table>

  <div class="footer">Generisano: ${new Date().toLocaleString("sr-Latn-RS")}</div>
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
