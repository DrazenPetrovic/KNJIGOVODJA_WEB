import { useMemo } from "react";
import { PrintPreviewModal } from "./PrintPreviewModal";

const PRIMARY = "#785E9E";
const TOLERANCIJA_SALDA = 0.01;

// Zaglavlje naloga blagajne koji se štampa.
export interface NalogZaStampu {
  sifra: number;
  datumOtvaranja: string;
  otvoren: string;
  zatvoren: string;
  nalogZatvoren: boolean;
  pocetnoStanje: number;
  ukupnoUplata: number;
  ukupnoIsplata: number;
  krajnjeStanje: number;
}

// Transakcija naloga — uplata ili isplata dobavljaču, već pripremljena za prikaz.
export interface TransakcijaZaStampu {
  sifraPartnera: string;
  partner: string;
  datum: string;
  brojRacuna: string;
  uplata: number | null;
  isplata: number | null;
  pdvIskazani: number | null;
  pdvUlazni: number | null;
  napomena: string;
  vrsta: string;
}

interface PrintModalBlagajnaProps {
  open: boolean;
  onClose: () => void;
  nalog: NalogZaStampu | null;
  transakcije: TransakcijaZaStampu[];
}

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

function buildBlagajnaHTML(
  nalog: NalogZaStampu,
  transakcije: TransakcijaZaStampu[],
) {
  const zbirUplata = transakcije.reduce((a, t) => a + (t.uplata ?? 0), 0);
  const zbirIsplata = transakcije.reduce((a, t) => a + (t.isplata ?? 0), 0);
  const zbirIskazani = transakcije.reduce(
    (a, t) => a + (t.pdvIskazani ?? 0),
    0,
  );
  const zbirUlazni = transakcije.reduce((a, t) => a + (t.pdvUlazni ?? 0), 0);
  const imaPdv = transakcije.some((t) => t.pdvIskazani !== null);

  const izracunatoKrajnje =
    nalog.pocetnoStanje + nalog.ukupnoUplata - nalog.ukupnoIsplata;
  const saldoOk =
    Math.abs(izracunatoKrajnje - nalog.krajnjeStanje) <= TOLERANCIJA_SALDA;

  const rowsHtml = transakcije
    .map((t, i) => {
      const bg =
        t.isplata !== null
          ? i % 2 === 0
            ? "#fef2f2"
            : "#fde8e8"
          : i % 2 === 0
            ? "#f3faea"
            : "#ffffff";
      const pdv =
        t.pdvIskazani !== null
          ? `Isk: ${fmt(t.pdvIskazani)}<br/>Ul: ${fmt(t.pdvUlazni)}`
          : "";
      return `<tr style="background:${bg}">
        <td class="c">${i + 1}</td>
        <td class="num">${esc(t.sifraPartnera || "–")}</td>
        <td>${esc(t.partner)}</td>
        <td class="nw">${esc(t.datum)}</td>
        <td class="nw">${esc(t.brojRacuna)}</td>
        <td class="num up">${t.uplata !== null ? fmt(t.uplata) : ""}</td>
        <td class="num is">${t.isplata !== null ? fmt(t.isplata) : ""}</td>
        <td class="num pdv">${pdv}</td>
        <td>${esc(t.napomena)}</td>
        <td class="nw">${esc(t.vrsta)}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8"/>
<title>Blagajna ${nalog.sifra}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #1a1a1a; padding: 12mm; }

  .header { display: flex; justify-content: space-between; align-items: flex-start;
            border-bottom: 3px solid ${PRIMARY}; padding-bottom: 8px; margin-bottom: 12px; }
  .header h1 { font-size: 14pt; font-weight: 700; color: ${PRIMARY}; text-transform: uppercase; }
  .header .sub { font-size: 9pt; color: #444; margin-top: 3px; }
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
  .pdv { font-size: 7.5pt; color: #555; }
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
      <h1>Blagajna — nalog br. ${nalog.sifra}</h1>
      <div class="sub">Datum: <b>${esc(nalog.datumOtvaranja)}</b>
        &nbsp; <span class="status ${nalog.nalogZatvoren ? "zat" : "otv"}">${nalog.nalogZatvoren ? "ZATVOREN" : "OTVOREN"}</span></div>
    </div>
    <div class="meta">
      Datum štampe: ${new Date().toLocaleDateString("sr-Latn-RS")}<br/>
      Otvoren: ${esc(nalog.otvoren)}<br/>
      Zatvoren: ${esc(nalog.zatvoren)}<br/>
      Broj transakcija: ${transakcije.length}
    </div>
  </div>

  <div class="rekap-wrap">
    <div class="rekap">
      <div class="rekap-naslov">REKAPITULACIJA</div>
      <table>
        <tr><td class="label">Početno stanje:</td><td class="value">${fmt(nalog.pocetnoStanje)} KM</td></tr>
        <tr><td class="label">Ukupno uplata:</td><td class="value">${fmt(nalog.ukupnoUplata)} KM</td></tr>
        <tr><td class="label">Ukupno isplata:</td><td class="value">${fmt(nalog.ukupnoIsplata)} KM</td></tr>
        <tr class="krajnje"><td class="label">Krajnje stanje:</td><td class="value">${fmt(nalog.krajnjeStanje)} KM</td></tr>
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
        <th class="num">Šifra</th>
        <th>Partner</th>
        <th>Datum</th>
        <th>Broj računa</th>
        <th class="num">Uplate</th>
        <th class="num">Isplate</th>
        <th class="num">PDV</th>
        <th>Napomena</th>
        <th>Vrsta</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || `<tr><td colspan="10" style="text-align:center;color:#aaa;padding:30px;">Nema transakcija na ovom nalogu.</td></tr>`}
    </tbody>
    ${
      transakcije.length > 0
        ? `<tfoot><tr>
        <td></td><td colspan="4">UKUPNO</td>
        <td class="num up">${fmt(zbirUplata)}</td>
        <td class="num is">${fmt(zbirIsplata)}</td>
        <td class="num pdv">${imaPdv ? `Isk: ${fmt(zbirIskazani)}<br/>Ul: ${fmt(zbirUlazni)}` : ""}</td>
        <td colspan="2"></td>
      </tr></tfoot>`
        : ""
    }
  </table>

  <div class="footer">
    <span>Blagajna — nalog ${nalog.sifra}</span>
    <span>Generisano: ${new Date().toLocaleString("sr-Latn-RS")}</span>
  </div>
</body>
</html>`;
}

export function PrintModalBlagajna({
  open,
  onClose,
  nalog,
  transakcije,
}: PrintModalBlagajnaProps) {
  const html = useMemo(
    () => (nalog ? buildBlagajnaHTML(nalog, transakcije) : ""),
    [nalog, transakcije],
  );
  if (!nalog) return null;
  return (
    <PrintPreviewModal
      open={open}
      onClose={onClose}
      html={html}
      naslov={`Blagajna — nalog #${nalog.sifra}`}
      podnaslov={`${nalog.datumOtvaranja}  |  ${transakcije.length} transakcija`}
      nazivFajla={`Blagajna nalog ${nalog.sifra} ${nalog.datumOtvaranja}`}
      pocetnaOrijentacija="landscape"
    />
  );
}
