import { useEffect, useRef, useState } from "react";
import { ChevronDown, FileText, Loader2, Printer, X } from "lucide-react";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3003";
const PRIMARY = "#785E9E";

type VrstaCode = 1 | 2 | 3;
type RacunGroupCode = "Z" | "G" | "KO_Z" | "KO_G";

interface SumBucket {
	vpc: number;
	rabat: number;
	ukupno: number;
	pdv: number;
}

type GroupSummary = Record<RacunGroupCode, Record<VrstaCode, SumBucket>>;

interface PrintModalMjesecniPrihodiProps {
	open: boolean;
	onClose: () => void;
	title: string;
	periodLabel: string;
	groupedSummary: GroupSummary;
	summaryTotals: Record<VrstaCode, SumBucket>;
	itemCount: number;
}

const RACUN_ORDER: RacunGroupCode[] = ["Z", "G", "KO_Z", "KO_G"];
const VRSTA_ORDER: VrstaCode[] = [1, 2, 3];

const RACUN_LABELS: Record<RacunGroupCode, string> = {
	Z: "Žiralni računi",
	G: "Gotovinski računi",
	KO_Z: "Storno žiralnog",
	KO_G: "Storno gotovinskog",
};

const VRSTA_LABELS: Record<VrstaCode, string> = {
	1: "Proizvodi",
	2: "Roba",
	3: "Usluga",
};

const fmt = (v: number) =>
	new Intl.NumberFormat("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	}).format(Number.isFinite(v) ? v : 0);

function buildReportHTML(
	title: string,
	periodLabel: string,
	itemCount: number,
	groupedSummary: GroupSummary,
	summaryTotals: Record<VrstaCode, SumBucket>,
): string {
	const rowsHtml = RACUN_ORDER.map((racun, rowIndex) => {
		const bg = rowIndex % 2 === 0 ? "#f7f3fc" : "#ffffff";
		const cells = VRSTA_ORDER.flatMap((vrsta) => {
			const b = groupedSummary[racun][vrsta];
			return [
				`<td class="num">${fmt(b.vpc)}</td>`,
				`<td class="num">${fmt(b.rabat)}</td>`,
				`<td class="num">${fmt(b.ukupno)}</td>`,
				`<td class="num sep">${fmt(b.pdv)}</td>`,
			].join("");
		}).join("");

		return `<tr style="background:${bg}"><td class="left">${RACUN_LABELS[racun]}</td>${cells}</tr>`;
	}).join("");

	const totalCells = VRSTA_ORDER.flatMap((vrsta) => {
		const b = summaryTotals[vrsta];
		return [
			`<td class="num"><strong>${fmt(b.vpc)}</strong></td>`,
			`<td class="num"><strong>${fmt(b.rabat)}</strong></td>`,
			`<td class="num"><strong>${fmt(b.ukupno)}</strong></td>`,
			`<td class="num sep"><strong>${fmt(b.pdv)}</strong></td>`,
		].join("");
	}).join("");

	const groupHeader = VRSTA_ORDER.map(
		(v) => `<th class="group" colspan="4">${VRSTA_LABELS[v]}</th>`,
	).join("");

	const subHeader = VRSTA_ORDER.map(
		() => `<th class="num">VPC</th><th class="num">Rabat</th><th class="num">Ukupno</th><th class="num sep">PDV</th>`,
	).join("");

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
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  thead tr.top { background: #f4f1f9; }
  thead tr.sub { background: #f9f6fc; }
  th { padding: 5px 6px; text-align: left; border-bottom: 1.5px solid #d8cde8; color: #5c4676; text-transform: uppercase; font-size: 7.5pt; letter-spacing: .04em; }
  th.group { text-align: center; color: ${PRIMARY}; }
  td { padding: 4px 6px; border-bottom: 1px solid #ddd; }
  td.left { font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sep { border-right: 2px solid #8FC74A; }
  tfoot td { background: #f4f1f9; border-top: 1.5px solid #d8cde8; }
  .footer { margin-top: 8mm; font-size: 8pt; color: #888; text-align: right; }
  @media print {
    body { padding: 8mm; }
    thead { display: table-header-group; }
    tfoot { display: table-footer-group; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${title}</h1>
      <div class="period">Period: ${periodLabel || "–"} &nbsp;|&nbsp; Broj stavki: ${itemCount}</div>
    </div>
    <div class="logo">Izvjestaj<br/><span style="font-weight:400;font-size:8pt;color:#999">${new Date().toLocaleDateString("sr-Latn-RS")}</span></div>
  </div>

  <table>
    <thead>
      <tr class="top">
        <th>Vrsta računa</th>
        ${groupHeader}
      </tr>
      <tr class="sub">
        <th></th>
        ${subHeader}
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
    <tfoot>
      <tr>
        <td><strong>Ukupno</strong></td>
        ${totalCells}
      </tr>
    </tfoot>
  </table>

  <div class="footer">Generisano: ${new Date().toLocaleString("sr-Latn-RS")}</div>
</body>
</html>`;
}

export function PrintModalMjesecniPrihodi({
	open,
	onClose,
	title,
	periodLabel,
	groupedSummary,
	summaryTotals,
	itemCount,
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
			itemCount,
			groupedSummary,
			summaryTotals,
		);
		doc.open();
		doc.write(html);
		doc.close();
	}, [open, title, periodLabel, itemCount, groupedSummary, summaryTotals]);

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
