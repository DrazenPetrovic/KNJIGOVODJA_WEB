import { useMemo } from "react";
import { PrintPreviewModal } from "./PrintPreviewModal";

const PRIMARY = "#785E9E";

// Zaglavlje izvoda koji se štampa.
export interface IzvodZaStampu {
  redniBroj: number;
  sifraIzvoda: string;
  nazivBanke: string;
  datumIzvoda: string;
  zatvoren: boolean;
  pocetnoStanje: number;
  ukupnoUplata: number;
  ukupnoIsplata: number;
  krajnjeStanje: number;
  unosOtvoren: string;
  unosZatvoren: string;
}

// Stavka izvoda — već pripremljena za prikaz (naziv partnera, vrsta, smjer).
export interface StavkaZaStampu {
  partner: string;
  datum: string;
  uplata: number | null;
  isplata: number | null;
  opis: string;
  vrsta: string;
  transfer: boolean;
}

interface PrintModalIzvodProps {
  open: boolean;
  onClose: () => void;
  izvod: IzvodZaStampu | null;
  stavke: StavkaZaStampu[];
}

const TOLERANCIJA_SALDA = 0.01;

// 1000 -> "1 000.00" — razmak kao separator hiljada.
const fmt = (v: number | null | undefined) => {
  const n = Number(v);
  if (v === null || v === undefined || Number.isNaN(n)) return "";
  const [cijeli, dec] = n.toFixed(2).split(".");
  const neg = cijeli.startsWith("-");
  const bez = neg ? cijeli.slice(1) : cijeli;
  return `${neg ? "-" : ""}${bez.replace(/\B(?=(\d{3})+(?!\d))/g, " ")}.${dec}`;
};

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Naziv fajla za PDF — "Izvod 193-2026 NLB banka".
const nazivDokumenta = (izvod: IzvodZaStampu) =>
  `Izvod ${izvod.sifraIzvoda} ${izvod.nazivBanke}`
    .replace(/[\\/:*?"<>|]+/g, "-")
    .trim();

function buildIzvodHTML(izvod: IzvodZaStampu, stavke: StavkaZaStampu[]) {
  const zbirUplata = stavke.reduce((a, s) => a + (s.uplata ?? 0), 0);
  const zbirIsplata = stavke.reduce((a, s) => a + (s.isplata ?? 0), 0);
  const izracunatoKrajnje =
    izvod.pocetnoStanje + izvod.ukupnoUplata - izvod.ukupnoIsplata;
  const saldoOk =
    Math.abs(izracunatoKrajnje - izvod.krajnjeStanje) <= TOLERANCIJA_SALDA;

  const rowsHtml = stavke
    .map((s, i) => {
      const bg = s.transfer
        ? "#eff6ff"
        : s.isplata !== null
          ? "#fef2f2"
          : i % 2 === 0
            ? "#f7f3fc"
            : "#ffffff";
      return `<tr style="background:${bg}">
        <td class="c">${i + 1}</td>
        <td>${esc(s.partner)}</td>
        <td class="nw">${esc(s.datum)}</td>
        <td class="num up">${s.uplata !== null ? fmt(s.uplata) : ""}</td>
        <td class="num is">${s.isplata !== null ? fmt(s.isplata) : ""}</td>
        <td>${esc(s.opis || "–")}</td>
        <td class="nw">${esc(s.vrsta)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8"/>
<title>${esc(nazivDokumenta(izvod))}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #1a1a1a; padding: 12mm; }

  .header { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 3px solid ${PRIMARY}; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { font-size: 14pt; font-weight: 700; color: ${PRIMARY}; text-transform: uppercase; }
  .header .banka { font-size: 11pt; font-weight: 700; margin-top: 3px; }
  .header .sub { font-size: 9pt; color: #444; margin-top: 2px; }
  .header .meta { font-size: 8pt; color: #888; text-align: right; line-height: 1.5; }
  .status { display: inline-block; padding: 1px 8px; border-radius: 10px; font-size: 8pt; font-weight: 700; }
  .status.otv { background: #ecf7e0; color: #4d7c0f; }
  .status.zat { background: #e5e7eb; color: #4b5563; }

  .rekap-wrap { display: flex; justify-content: center; margin-bottom: 14px; }
  .rekap { width: 110mm; }
  .rekap-naslov { text-align: center; font-size: 11pt; font-weight: 700; letter-spacing: .06em; margin-bottom: 6px; }
  .rekap table { width: 100%; border-collapse: collapse; }
  .rekap td.label { border: 1px solid #999; padding: 4px 10px; font-size: 10pt; font-weight: 700; }
  .rekap td.value { border: 1px solid #999; padding: 4px 10px; font-size: 10pt; font-weight: 700;
                    text-align: right; background: #eeeeee; font-variant-numeric: tabular-nums; }
  .rekap tr.krajnje td { background: #e3d9f7; }
  .provjera { text-align: center; font-size: 8pt; margin-top: 4px; }
  .provjera.ok { color: #4d7c0f; }
  .provjera.err { color: #dc2626; font-weight: 700; }

  table.main { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  thead tr { background: ${PRIMARY}; }
  th { padding: 5px; text-align: left; font-size: 7.5pt; text-transform: uppercase; color: #fff;
       letter-spacing: .03em; white-space: nowrap; }
  th.num { text-align: right; }
  td { padding: 4px 5px; border-bottom: 1px solid #ddd; vertical-align: top; }
  td.c { text-align: center; color: #888; }
  .nw { white-space: nowrap; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .up { color: #4d7c0f; font-weight: 700; }
  .is { color: #dc2626; font-weight: 700; }
  tfoot td { font-weight: 700; border-top: 2px solid ${PRIMARY}; border-bottom: none; background: #f4f1f9; }

  .footer { margin-top: 8mm; font-size: 8pt; color: #aaa; display: flex; justify-content: space-between;
            border-top: 1px solid #e5e7eb; padding-top: 6px; }

  @media print {
    body { padding: 0; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    thead { display: table-header-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>Izvod br. ${esc(izvod.sifraIzvoda)}</h1>
      <div class="banka">${esc(izvod.nazivBanke)}</div>
      <div class="sub">Datum izvoda: <b>${esc(izvod.datumIzvoda)}</b> &nbsp;|&nbsp; Redni broj: ${izvod.redniBroj}
        &nbsp; <span class="status ${izvod.zatvoren ? "zat" : "otv"}">${izvod.zatvoren ? "ZATVOREN" : "OTVOREN"}</span></div>
    </div>
    <div class="meta">
      Datum štampe: ${new Date().toLocaleDateString("sr-Latn-RS")}<br/>
      Unos otvoren: ${esc(izvod.unosOtvoren)}<br/>
      Unos zatvoren: ${esc(izvod.unosZatvoren)}<br/>
      Broj stavki: ${stavke.length}
    </div>
  </div>

  <div class="rekap-wrap">
    <div class="rekap">
      <div class="rekap-naslov">REKAPITULACIJA</div>
      <table>
        <tr><td class="label">Početno stanje:</td><td class="value">${fmt(izvod.pocetnoStanje)} KM</td></tr>
        <tr><td class="label">Ukupno uplata:</td><td class="value">${fmt(izvod.ukupnoUplata)} KM</td></tr>
        <tr><td class="label">Ukupno isplata:</td><td class="value">${fmt(izvod.ukupnoIsplata)} KM</td></tr>
        <tr class="krajnje"><td class="label">Krajnje stanje:</td><td class="value">${fmt(izvod.krajnjeStanje)} KM</td></tr>
      </table>
      <div class="provjera ${saldoOk ? "ok" : "err"}">${
        saldoOk
          ? "✔ Početno + uplate − isplate = krajnje stanje"
          : `✘ Saldo se ne slaže — izračunato krajnje stanje: ${fmt(izracunatoKrajnje)} KM`
      }</div>
    </div>
  </div>

  <table class="main">
    <thead>
      <tr>
        <th style="text-align:center">RB</th>
        <th>Partner</th>
        <th>Datum</th>
        <th class="num">Uplate</th>
        <th class="num">Isplate</th>
        <th>Opis</th>
        <th>Vrsta</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="7" style="text-align:center;color:#aaa;padding:30px;">Nema stavki na ovom izvodu.</td></tr>`}
    </tbody>
    ${
      stavke.length > 0
        ? `<tfoot><tr>
        <td></td><td colspan="2">UKUPNO</td>
        <td class="num up">${fmt(zbirUplata)}</td>
        <td class="num is">${fmt(zbirIsplata)}</td>
        <td colspan="2"></td>
      </tr></tfoot>`
        : ""
    }
  </table>

  <div class="footer">
    <span>Izvod ${esc(izvod.sifraIzvoda)} — ${esc(izvod.nazivBanke)}</span>
    <span>Generisano: ${new Date().toLocaleString("sr-Latn-RS")}</span>
  </div>
</body>
</html>`;
}

export function PrintModalIzvod({
  open,
  onClose,
  izvod,
  stavke,
}: PrintModalIzvodProps) {
  const html = useMemo(
    () => (izvod ? buildIzvodHTML(izvod, stavke) : ""),
    [izvod, stavke],
  );
  if (!izvod) return null;
  return (
    <PrintPreviewModal
      open={open}
      onClose={onClose}
      html={html}
      naslov={`Izvod #${izvod.sifraIzvoda} — ${izvod.nazivBanke}`}
      podnaslov={`${izvod.datumIzvoda}  |  ${stavke.length} stavki`}
      nazivFajla={nazivDokumenta(izvod)}
      pocetnaOrijentacija="portrait"
    />
  );
}
