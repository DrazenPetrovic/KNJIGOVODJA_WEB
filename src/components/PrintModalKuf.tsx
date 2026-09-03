import { useEffect, useRef, useState } from "react";
import { X, Printer, ChevronDown, FileText, Loader2 } from "lucide-react";

const PRIMARY = "#785E9E";

// Red vraćen sa erp.kuf_pregled().
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

interface KufTotals {
  ukupnoBezPdv: number;
  iskazaniPdv: number;
  ulazniPdv: number;
  ulazniPdvUvozni: number;
  domaceFakture: { count: number; osnovica: number; pdv: number };
  importFakture: { count: number; osnovica: number; pdv: number };
}

interface PrintModalKufProps {
  open: boolean;
  onClose: () => void;
  rows: KufRow[];
  totals: KufTotals;
  periodLabel?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(v) ? v : 0);

const getDateOnly = (s: string) => {
  if (!s) return "";
  const n = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
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

function buildReportHTML(
  rows: KufRow[],
  totals: KufTotals,
  periodLabel: string,
): string {
  const ukupno = totals.ukupnoBezPdv + totals.iskazaniPdv;

  const rowsHtml = rows
    .map((row, index) => {
      const bg = index % 2 === 0 ? "#f7f3fc" : "#ffffff";
      const partner = [
        row.naziv_partnera,
        [row.adresa_partnera, row.grad_partnera, row.entitet_partnera]
          .filter(Boolean)
          .join(", "),
        row.drzava_partnera,
        [
          hasTaxId(row.JIB) ? `JIB: ${row.JIB}` : "",
          hasTaxId(row.PIB) ? `PIB: ${row.PIB}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      ]
        .filter(Boolean)
        .join("<br/>");

      return `<tr style="background:${bg}">
        <td>${row.sifra}</td>
        <td>${[row.tip_dokumenta, row.broj_dokumenta].filter(Boolean).join(" - ") || "-"}<div class="sub">${displayDate(row.datum_ulaza_dokumenta)}</div></td>
        <td>${partner}</td>
        <td>${row.opis || "-"}</td>
        <td class="num">${fmt(Number(row.vrednost_bez_pdv))}</td>
        <td class="num">${fmt(Number(row.iskazani_pdv))}</td>
        <td class="num">${fmt(Number(row.ulazni_pdv))}</td>
        <td class="num">${fmt(Number(row.ulazni_pdv_uvoz))}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8"/>
<title>Knjiga ulaznih faktura</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #1a1a1a; padding: 12mm; }

  .header { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 3px solid ${PRIMARY}; padding-bottom: 8px; margin-bottom: 10px; }
  .header h1 { font-size: 13pt; font-weight: 700; color: ${PRIMARY}; text-transform: uppercase; }
  .header .period { font-size: 9pt; color: #444; margin-top: 2px; }
  .header .meta { font-size: 8pt; color: #999; margin-top: 4px; text-align: right; }

  .rekap-wrap { display: flex; justify-content: center; margin-bottom: 12px; }
  .rekap { width: 130mm; }
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
  td { padding: 3px 5px; border-bottom: 1px solid #ddd; vertical-align: top; }
  .sub { font-size: 7pt; color: #888; margin-top: 1px; }

  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .footer { margin-top: 8mm; font-size: 8pt; color: #aaa; display: flex; justify-content: space-between;
            border-top: 1px solid #e5e7eb; padding-top: 6px; }

  @media print {
    body { padding: 8mm; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Knjiga ulaznih faktura</h1>
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
        <tr><td class="label">Ukupno:</td><td class="value">${fmt(ukupno)}</td></tr>
        <tr><td class="label">Vrijednost bez PDV:</td><td class="value">${fmt(totals.ukupnoBezPdv)}</td></tr>
        <tr><td class="label">Iskazani PDV:</td><td class="value">${fmt(totals.iskazaniPdv)}</td></tr>
        <tr><td class="label">Ulazni PDV:</td><td class="value">${fmt(totals.ulazniPdv)}</td></tr>
        <tr><td class="label">Ulazni PDV (uvoz):</td><td class="value">${fmt(totals.ulazniPdvUvozni)}</td></tr>
      </table>

      <div class="rekap-group-title">DOMAĆE FAKTURE</div>
      <div class="rekap-row"><span>Broj faktura:</span><span>${totals.domaceFakture.count}</span></div>
      <div class="rekap-row"><span>Osnovica:</span><span>${fmt(totals.domaceFakture.osnovica)}</span></div>
      <div class="rekap-row"><span>PDV:</span><span>${fmt(totals.domaceFakture.pdv)}</span></div>

      <div class="rekap-group-title">UVOZNE FAKTURE</div>
      <div class="rekap-row"><span>Broj faktura:</span><span>${totals.importFakture.count}</span></div>
      <div class="rekap-row"><span>Osnovica:</span><span>${fmt(totals.importFakture.osnovica)}</span></div>
      <div class="rekap-row"><span>PDV (uvozni):</span><span>${fmt(totals.importFakture.pdv)}</span></div>
    </div>
  </div>

  <table class="main">
    <thead>
      <tr>
        <th>RB</th>
        <th>Dokument</th>
        <th>Partner</th>
        <th>Opis</th>
        <th class="num">Osnovica</th>
        <th class="num">Iskaz. PDV</th>
        <th class="num">Ulazni PDV</th>
        <th class="num">Ulazni PDV (uvoz)</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="8" style="text-align:center;color:#aaa;padding:30px;">Nema podataka za izabrani period.</td></tr>`}
    </tbody>
  </table>

  <div class="footer">
    <span>KUF — knjiga ulaznih faktura</span>
    <span>Generisano: ${new Date().toLocaleString("sr-Latn-RS")}</span>
  </div>
</body>
</html>`;
}

export function PrintModalKuf({
  open,
  onClose,
  rows,
  totals,
  periodLabel = "",
}: PrintModalKufProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [printers, setPrinters] = useState<string[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<string>("");
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    "landscape",
  );
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

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
        setPrinters([]);
      })
      .finally(() => setLoadingPrinters(false));
  }, [open]);

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

    const styleId = "print-orientation";
    const doc = iframe.contentDocument!;
    let styleEl = doc.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = styleId;
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = `@page { size: A4 ${orientation}; margin: 10mm; }`;

    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    setTimeout(() => setPrinting(false), 1000);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="flex flex-col bg-white rounded-2xl shadow-2xl overflow-hidden"
        style={{ width: "min(96vw, 1100px)", height: "min(92vh, 820px)" }}
      >
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
                Preview — Knjiga ulaznih faktura
              </h2>
              <p className="text-xs text-gray-500">
                {rows.length} faktura &nbsp;|&nbsp;{" "}
                {periodLabel || "Sve fakture"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-gray-200 p-4 overflow-hidden">
          <iframe
            ref={iframeRef}
            title="KUF Preview"
            className="w-full h-full rounded-lg bg-white shadow-md border border-gray-200"
            style={{ display: "block" }}
          />
        </div>
      </div>
    </div>
  );
}
