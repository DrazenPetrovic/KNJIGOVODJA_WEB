import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Loader2, Printer, X } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3003";
const PRIMARY = "#785E9E";

interface PrihodRed {
	kategorija: string;
	nacin_placanja: string;
	storno: number;
	ukupno: number;
	pdv: number;
	rabat: number;
	veleprodajna_vrednost: number;
}

interface GrupaPlacanja {
	naziv: string;
	stavke: PrihodRed[];
	ukupno: number;
	storno: number;
	pdv: number;
	rabat: number;
	veleprodajnaVrednost: number;
}

interface IzvozInfo {
	broj_racuna: number;
	osnovica: number;
	ukupno: number;
}

interface CelijaVrijednosti {
	ukupno: number;
	pdv: number;
	rabat: number;
	vpc: number;
}

const praznaCelija: CelijaVrijednosti = { ukupno: 0, pdv: 0, rabat: 0, vpc: 0 };

const jeStorno = (v: number) => Number(v) === 1;
const jeProizvod = (kategorija: string) =>
	kategorija.toLowerCase().includes("proizv");
const jeRoba = (kategorija: string) => kategorija.toLowerCase().includes("rob");

const pronadjiCeliju = (
	stavke: PrihodRed[],
	test: (kategorija: string) => boolean,
	storno: boolean,
): CelijaVrijednosti => {
	const red = stavke.find(
		(r) => test(r.kategorija) && jeStorno(r.storno) === storno,
	);
	if (!red) return praznaCelija;
	return {
		ukupno: Number(red.ukupno || 0),
		pdv: Number(red.pdv || 0),
		rabat: Number(red.rabat || 0),
		vpc: Number(red.veleprodajna_vrednost || 0),
	};
};

const fmt = (v: number) =>
	Number(v ?? 0).toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	});

interface PrintModalMjesecniPrihodiProps {
	open: boolean;
	onClose: () => void;
	title: string;
	periodLabel: string;
	grupe: GrupaPlacanja[];
	ukupnoNeto: number;
	vpNeto: number;
	rabatNeto: number;
	osnovicaNeto: number;
	osnovicaPdv17: number;
	pdvNeto: number;
	izvoz: IzvozInfo | null;
}

function buildReportHTML(
	title: string,
	periodLabel: string,
	grupe: GrupaPlacanja[],
	ukupnoNeto: number,
	vpNeto: number,
	rabatNeto: number,
	osnovicaNeto: number,
	osnovicaPdv17: number,
	pdvNeto: number,
	izvoz: IzvozInfo | null,
): string {
	const rekapRows = [
		{ label: "Ukupno:", vrijednost: ukupnoNeto },
		{ label: "Veleprodajna vrijednost:", vrijednost: vpNeto },
		{ label: "Rabat:", vrijednost: rabatNeto },
		{
			label: `Osnovica (17% = ${fmt(osnovicaPdv17)}):`,
			vrijednost: osnovicaNeto,
		},
		{ label: "PDV:", vrijednost: pdvNeto },
	]
		.map(
			(r) =>
				`<tr><td class="rekap-label">${r.label}</td><td class="rekap-vrijednost">${fmt(r.vrijednost)}</td></tr>`,
		)
		.join("");

	const izvozHtml =
		izvoz && izvoz.broj_racuna > 0
			? `<div class="izvoz-napomena">Napomena: u periodu ima ${izvoz.broj_racuna} izvozn${izvoz.broj_racuna === 1 ? "a" : "ih"} računa (0% PDV) u iznosu od ${fmt(izvoz.osnovica)} — ušli su u Veleprodajnu vrijednost i Osnovicu, ali ne i u PDV, zato Osnovica × 17% ne odgovara stvarnom PDV-u za ovaj period.</div>`
			: "";

	const grupeHtml = grupe
		.map((g) => {
			const proizvodNormal = pronadjiCeliju(g.stavke, jeProizvod, false);
			const robaNormal = pronadjiCeliju(g.stavke, jeRoba, false);
			const proizvodStorno = pronadjiCeliju(g.stavke, jeProizvod, true);
			const robaStorno = pronadjiCeliju(g.stavke, jeRoba, true);

			const celije = (v: CelijaVrijednosti, storno?: boolean) =>
				`<td class="num${storno ? " storno" : ""}">${fmt(v.ukupno)}</td><td class="num${storno ? " storno" : ""}">${fmt(v.vpc)}</td><td class="num${storno ? " storno" : ""}">${fmt(v.rabat)}</td><td class="num${storno ? " storno" : ""}">${fmt(v.pdv)}</td>`;

			return `<div class="grupa">
  <div class="grupa-naslov">${g.naziv}</div>
  <table>
    <thead>
      <tr>
        <th class="col-label"></th>
        <th class="num">Ukupno</th><th class="num">VP</th><th class="num">Rabat</th><th class="num">PDV</th>
        <th class="col-label"></th>
        <th class="num">Ukupno</th><th class="num">VP</th><th class="num">Rabat</th><th class="num">PDV</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="left"><strong>Proizvod</strong></td>${celije(proizvodNormal)}
        <td class="left"><strong>Roba</strong></td>${celije(robaNormal)}
      </tr>
      <tr>
        <td class="left storno"><strong>Proizvod — storno</strong></td>${celije(proizvodStorno, true)}
        <td class="left storno"><strong>Roba — storno</strong></td>${celije(robaStorno, true)}
      </tr>
    </tbody>
  </table>
</div>`;
		})
		.join("");

	return `<!DOCTYPE html>
<html lang="sr">
<head>
<meta charset="UTF-8"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 9pt; color: #1a1a1a; padding: 12mm; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8mm; }
  .header h1 { font-size: 14pt; font-weight: 700; color: ${PRIMARY}; }
  .header .period { font-size: 9pt; color: #555; margin-top: 2px; }
  .header .logo { font-size: 10pt; font-weight: 600; color: #333; text-align: right; }

  .rekap-wrap { display: flex; justify-content: center; margin-bottom: 8mm; }
  .rekap { width: 140mm; }
  .rekap-naslov { text-align: center; font-size: 11pt; font-weight: 700; letter-spacing: .05em; margin-bottom: 6px; }
  .rekap table { width: 100%; border-collapse: collapse; }
  .rekap-label { border: 1px solid #999; padding: 4px 10px; font-size: 9.5pt; font-weight: 700; text-align: left; background: #fff; }
  .rekap-vrijednost { border: 1px solid #999; padding: 4px 10px; font-size: 9.5pt; font-weight: 700; text-align: center; background: #e5e0ee; }
  .izvoz-napomena { margin-top: 8px; border: 1px solid ${PRIMARY}; padding: 5px 8px; font-size: 8pt; color: #333; line-height: 1.4; }

  .grupa { margin-bottom: 6mm; page-break-inside: avoid; }
  .grupa-naslov { font-size: 10.5pt; font-weight: 700; text-transform: uppercase; border-bottom: 1.5px solid ${PRIMARY}; padding-bottom: 3px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  th { padding: 5px 6px; text-align: right; border-bottom: 1.5px solid #d8cde8; background: #f4f1f9; color: #5c4676; text-transform: uppercase; font-size: 7.5pt; letter-spacing: .04em; }
  th.col-label { width: 8%; }
  td { padding: 4px 6px; border-bottom: 1px solid #ddd; }
  td.left { text-align: left; }
  td.left.storno { color: #92620a; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.num.storno { color: #92620a; }

  .footer { margin-top: 8mm; font-size: 8pt; color: #888; text-align: right; }
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
      <h1>${title}</h1>
      <div class="period">Period: ${periodLabel || "–"}</div>
    </div>
    <div class="logo">Izvjestaj<br/><span style="font-weight:400;font-size:8pt;color:#999">${new Date().toLocaleDateString("sr-Latn-RS")}</span></div>
  </div>

  <div class="rekap-wrap">
    <div class="rekap">
      <div class="rekap-naslov">REKAPITULACIJA</div>
      <table>${rekapRows}</table>
      ${izvozHtml}
    </div>
  </div>

  ${grupeHtml || `<div style="text-align:center;color:#aaa;padding:30px;font-size:11pt;">Nema podataka za izabrani period.</div>`}

  <div class="footer">Generisano: ${new Date().toLocaleString("sr-Latn-RS")}</div>
</body>
</html>`;
}

export function PrintModalMjesecniPrihodi({
	open,
	onClose,
	title,
	periodLabel,
	grupe,
	ukupnoNeto,
	vpNeto,
	rabatNeto,
	osnovicaNeto,
	osnovicaPdv17,
	pdvNeto,
	izvoz,
}: PrintModalMjesecniPrihodiProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [printers, setPrinters] = useState<string[]>([]);
	const [selectedPrinter, setSelectedPrinter] = useState("");
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

		fetch(`${API_URL}/api/printers`, { credentials: "include" })
			.then((r) => r.json())
			.then((data) => {
				const list: string[] = Array.isArray(data?.printers) ? data.printers : [];
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
		const html = buildReportHTML(
			title,
			periodLabel,
			grupe,
			ukupnoNeto,
			vpNeto,
			rabatNeto,
			osnovicaNeto,
			osnovicaPdv17,
			pdvNeto,
			izvoz,
		);
		doc.open();
		doc.write(html);
		doc.close();
	}, [
		open,
		title,
		periodLabel,
		grupe,
		ukupnoNeto,
		vpNeto,
		rabatNeto,
		osnovicaNeto,
		osnovicaPdv17,
		pdvNeto,
		izvoz,
	]);

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

	const itemCount = grupe.reduce((s, g) => s + g.stavke.length, 0);

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
								Preview — {title}
							</h2>
							<p className="text-xs text-gray-500">
								{itemCount} stavki &nbsp;|&nbsp; {periodLabel || "Sve stavke"}
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
						title={`${title} Preview`}
						className="w-full h-full rounded-lg bg-white shadow-md border border-gray-200"
						style={{ display: "block" }}
					/>
				</div>
			</div>
		</div>
	);
}
