import { useEffect, useMemo, useState } from "react";
import { BarChart2, CalendarDays, Filter, Printer, Search } from "lucide-react";
import { PrintModalMjesecniPrihodi } from "./PrintModalMjesecniPrihodi";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3003";
const PRIMARY = "#785E9E";
const ACCENT = "#8FC74A";

type PrihodiRow = Record<string, unknown>;
type DateFilterMode = "day" | "period";
type VrstaCode = 1 | 2 | 3;
type RacunGroupCode = "Z" | "G" | "KO_Z" | "KO_G";

interface SumBucket {
	vpc: number;
	rabat: number;
	ukupno: number;
	pdv: number;
}

type GroupSummary = Record<RacunGroupCode, Record<VrstaCode, SumBucket>>;

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

const asNumber = (value: unknown) => {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const raw = value.replace(/\s+/g, "").trim();
		if (!raw) return 0;

		let normalized = raw;
		const hasComma = raw.includes(",");
		const hasDot = raw.includes(".");

		if (hasComma && hasDot) {
			const lastComma = raw.lastIndexOf(",");
			const lastDot = raw.lastIndexOf(".");

			if (lastDot > lastComma) {
				// Format like 91,626.00 -> commas are thousands separators.
				normalized = raw.replace(/,/g, "");
			} else {
				// Format like 91.626,00 -> dots are thousands separators.
				normalized = raw.replace(/\./g, "").replace(/,/g, ".");
			}
		} else if (hasComma) {
			const commaAsGrouping = /^[-+]?\d{1,3}(,\d{3})+$/.test(raw);
			normalized = commaAsGrouping ? raw.replace(/,/g, "") : raw.replace(/,/g, ".");
		} else if (hasDot) {
			const dotAsGrouping = /^[-+]?\d{1,3}(\.\d{3})+$/.test(raw);
			normalized = dotAsGrouping ? raw.replace(/\./g, "") : raw;
		}

		const parsed = Number(normalized);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
};

const getFirstValue = (row: PrihodiRow, keys: string[]) => {
	for (const key of keys) {
		if (key in row && row[key] !== null && row[key] !== undefined && row[key] !== "") {
			return row[key];
		}
	}
	return undefined;
};

const getRowDate = (row: PrihodiRow) => {
	const value = getFirstValue(row, ["datum_racuna", "Datum_racuna", "datumRacuna"]);
	return getDateOnly(value);
};

const normalizeRacunGroup = (value: unknown): RacunGroupCode | null => {
	const text = String(value ?? "")
		.toUpperCase()
		.replace(/Ž/g, "Z")
		.replace(/\s+/g, "")
		.trim();

	if (text === "Z") return "Z";
	if (text === "G") return "G";
	if (text === "KO-Z") return "KO_Z";
	if (text === "KO-G") return "KO_G";
	return null;
};

const normalizeVrsta = (value: unknown): VrstaCode | null => {
	const code = Number(value);
	if (code === 1 || code === 2 || code === 3) return code;
	return null;
};

const createEmptyBucket = (): SumBucket => ({
	vpc: 0,
	rabat: 0,
	ukupno: 0,
	pdv: 0,
});

const createEmptySummary = (): GroupSummary => ({
	Z: { 1: createEmptyBucket(), 2: createEmptyBucket(), 3: createEmptyBucket() },
	G: { 1: createEmptyBucket(), 2: createEmptyBucket(), 3: createEmptyBucket() },
	KO_Z: {
		1: createEmptyBucket(),
		2: createEmptyBucket(),
		3: createEmptyBucket(),
	},
	KO_G: {
		1: createEmptyBucket(),
		2: createEmptyBucket(),
		3: createEmptyBucket(),
	},
});

const getDateOnly = (value: unknown) => {
	if (value === null || value === undefined || value === "") return "";
	const dateString = String(value);
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

const formatValue = (value: unknown) => {
	if (value === null || value === undefined || value === "") {
		return "-";
	}

	if (typeof value === "number") {
		return new Intl.NumberFormat("en-US", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 4,
		}).format(value);
	}

	const text = String(value);

	if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
		const parsed = new Date(text);
		if (!Number.isNaN(parsed.getTime())) {
			return parsed.toLocaleDateString("sr-Latn-RS");
		}
	}

	return text;
};

const getTodayIsoDate = () => {
	const now = new Date();
	const year = now.getFullYear();
	const month = String(now.getMonth() + 1).padStart(2, "0");
	const day = String(now.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export function MjesecniPrihodi() {
	const initialDay = getTodayIsoDate();
	const [printOpen, setPrintOpen] = useState(false);

	const [rows, setRows] = useState<PrihodiRow[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [filterMode, setFilterMode] = useState<DateFilterMode>("day");
	const [dayDate, setDayDate] = useState(initialDay);
	const [periodFrom, setPeriodFrom] = useState("");
	const [periodTo, setPeriodTo] = useState("");
	const [searchTerm, setSearchTerm] = useState("");
	const [appliedFilters, setAppliedFilters] = useState({
		mode: "day" as DateFilterMode,
		dayDate: initialDay,
		periodFrom: "",
		periodTo: "",
		searchTerm: "",
	});

	const fetchData = async () => {
		try {
			setLoading(true);
			setError(null);

			const response = await fetch(`${API_URL}/api/pregledi/mjesecni-prihodi`, {
				credentials: "include",
			});
			const payload = await response.json();

			if (!response.ok || !payload?.success) {
				throw new Error(
					payload?.message || "Greška pri učitavanju mjesečnih prihoda.",
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

		return "Sve stavke";
	}, [appliedFilters]);

	const filteredRows = useMemo(() => {
		let temp = [...rows];

		if (appliedFilters.mode === "day" && appliedFilters.dayDate) {
			temp = temp.filter((row) => getRowDate(row) === appliedFilters.dayDate);
		}

		if (
			appliedFilters.mode === "period" &&
			appliedFilters.periodFrom &&
			appliedFilters.periodTo
		) {
			temp = temp.filter((row) => {
				const date = getRowDate(row);
				return (
					Boolean(date) &&
					date >= appliedFilters.periodFrom &&
					date <= appliedFilters.periodTo
				);
			});
		}

		const term = appliedFilters.searchTerm.trim().toLowerCase();
		if (!term) return temp;

		return temp.filter((row) => {
			const text = Object.values(row)
				.map((value) => String(value ?? ""))
				.join(" ")
				.toLowerCase();
			return text.includes(term);
		});
	}, [rows, appliedFilters]);

	const isAggregateVisible =
		(appliedFilters.mode === "day" && Boolean(appliedFilters.dayDate)) ||
		(appliedFilters.mode === "period" &&
			Boolean(appliedFilters.periodFrom) &&
			Boolean(appliedFilters.periodTo));

	const groupedSummary = useMemo(() => {
		const summary = createEmptySummary();

		filteredRows.forEach((row) => {
			const racunGroup = normalizeRacunGroup(
				getFirstValue(row, ["vrsta_racuna", "Vrsta_racuna", "vrstaRacuna"]),
			);
			const vrsta = normalizeVrsta(
				getFirstValue(row, ["vrsta", "Vrsta", "tip_vrste"]),
			);

			if (!racunGroup || !vrsta) return;

			const bucket = summary[racunGroup][vrsta];
			bucket.vpc += asNumber(getFirstValue(row, ["vpc_vrednost"]));
			bucket.rabat += asNumber(getFirstValue(row, ["rabat_km"]));
			bucket.ukupno += asNumber(getFirstValue(row, ["prodajna_vrednost"]));
			bucket.pdv += asNumber(getFirstValue(row, ["pdv"]));
		});

		return summary;
	}, [filteredRows]);

	const summaryTotals = useMemo(() => {
		const totals: Record<VrstaCode, SumBucket> = {
			1: createEmptyBucket(),
			2: createEmptyBucket(),
			3: createEmptyBucket(),
		};

		RACUN_ORDER.forEach((racun) => {
			VRSTA_ORDER.forEach((vrsta) => {
				totals[vrsta].vpc += groupedSummary[racun][vrsta].vpc;
				totals[vrsta].rabat += groupedSummary[racun][vrsta].rabat;
				totals[vrsta].ukupno += groupedSummary[racun][vrsta].ukupno;
				totals[vrsta].pdv += groupedSummary[racun][vrsta].pdv;
			});
		});

		return totals;
	}, [groupedSummary]);

	return (
		<div className="space-y-5">
			<div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
				<div className="flex flex-wrap items-end justify-between gap-2">
					<div className="min-w-[220px] flex items-center gap-2">
						<span
							className="w-8 h-8 rounded-lg flex items-center justify-center"
							style={{ background: "#ede8f5" }}
						>
							<BarChart2 size={16} style={{ color: PRIMARY }} />
						</span>
						<h2 className="text-base sm:text-lg font-bold text-gray-800">
							Mjesečni prihodi
						</h2>
					</div>

					<button
						onClick={() => setPrintOpen(true)}
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

						<div className="relative min-w-[240px]">
							<Search
								size={14}
								className="absolute left-2.5 top-2.5 text-gray-400"
							/>
							<input
								type="text"
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								placeholder="Pretraži podatke..."
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

				<div className="mt-3 rounded-xl border overflow-hidden" style={{ borderColor: "#e7dff1", background: "#fbfafe" }}>
					<div className="flex flex-wrap items-center gap-0 divide-x divide-gray-100">
						<div className="flex items-center gap-2 px-3 py-1.5">
							<span className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold whitespace-nowrap">
								Period
							</span>
							<span className="text-sm font-bold text-gray-800 whitespace-nowrap">
								{periodLabel}
							</span>
						</div>



					</div>
				</div>
			</div>

			{isAggregateVisible && (
				<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

					<div className="overflow-x-auto">
						<table className="w-full min-w-[1500px]">
							<thead>
								<tr className="border-b text-xs uppercase tracking-wider" style={{ background: "#f4f1f9", borderColor: "#e7dff1", color: PRIMARY }}>
									<th className="text-left px-4 py-3">Vrsta računa</th>
									{VRSTA_ORDER.map((vrsta) => (
										<th
											key={`group-${vrsta}`}
											className="text-center align-middle px-4 py-3"
											colSpan={4}
										>
											{VRSTA_LABELS[vrsta]}
										</th>
									))}
								</tr>
								<tr className="border-b text-xs uppercase tracking-wider" style={{ background: "#f9f6fc", borderColor: "#e7dff1", color: "#67507f" }}>
									<th className="text-left px-4 py-2"> </th>
									{VRSTA_ORDER.flatMap((vrsta) => [
										<th key={`${vrsta}-vpc`} className="text-right px-4 py-2">VPC</th>,
										<th key={`${vrsta}-rabat`} className="text-right px-4 py-2">Rabat</th>,
										<th key={`${vrsta}-ukupno`} className="text-right px-4 py-2">Ukupno</th>,
										<th
											key={`${vrsta}-pdv`}
											className="text-right px-4 py-2 border-r-2"
											style={{ borderColor: ACCENT }}
										>
											PDV
										</th>,
									])}
								</tr>
							</thead>
							<tbody>
								{RACUN_ORDER.map((racun) => (
									<tr key={racun} className="border-b border-gray-100 even:bg-[#785E9E10]">
										<td className="px-4 py-3 text-sm font-semibold text-gray-800 whitespace-nowrap">
											{RACUN_LABELS[racun]}
										</td>
										{VRSTA_ORDER.flatMap((vrsta) => {
											const bucket = groupedSummary[racun][vrsta];
											return [
												<td key={`${racun}-${vrsta}-vpc`} className="px-4 py-3 text-sm text-right text-gray-700">{formatValue(bucket.vpc)}</td>,
												<td key={`${racun}-${vrsta}-rabat`} className="px-4 py-3 text-sm text-right text-gray-700">{formatValue(bucket.rabat)}</td>,
												<td key={`${racun}-${vrsta}-ukupno`} className="px-4 py-3 text-sm text-right text-gray-700">{formatValue(bucket.ukupno)}</td>,
												<td key={`${racun}-${vrsta}-pdv`} className="px-4 py-3 text-sm text-right text-gray-700 border-r-2" style={{ borderColor: "#cfe4b1" }}>{formatValue(bucket.pdv)}</td>,
											];
										})}
									</tr>
								))}
								<tr style={{ background: "#f4f1f9" }}>
									<td className="px-4 py-3 text-sm font-bold text-gray-800 whitespace-nowrap">
										Ukupno
									</td>
									{VRSTA_ORDER.flatMap((vrsta) => [
										<td key={`total-${vrsta}-vpc`} className="px-4 py-3 text-sm text-right font-bold text-gray-800">{formatValue(summaryTotals[vrsta].vpc)}</td>,
										<td key={`total-${vrsta}-rabat`} className="px-4 py-3 text-sm text-right font-bold text-gray-800">{formatValue(summaryTotals[vrsta].rabat)}</td>,
										<td key={`total-${vrsta}-ukupno`} className="px-4 py-3 text-sm text-right font-bold text-gray-800">{formatValue(summaryTotals[vrsta].ukupno)}</td>,
										<td key={`total-${vrsta}-pdv`} className="px-4 py-3 text-sm text-right font-bold text-gray-800 border-r-2" style={{ borderColor: ACCENT }}>{formatValue(summaryTotals[vrsta].pdv)}</td>,
									])}
								</tr>
							</tbody>
						</table>
					</div>
				</div>
			)}

			{!loading && !error && filteredRows.length === 0 && (
				<div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
					<div className="p-8 text-center text-gray-500">Nema podataka za izabrane filtere.</div>
				</div>
			)}

			<PrintModalMjesecniPrihodi
				open={printOpen}
				onClose={() => setPrintOpen(false)}
				title="Mjesečni prihodi"
				periodLabel={periodLabel}
				groupedSummary={groupedSummary}
				summaryTotals={summaryTotals}
				itemCount={filteredRows.length}
			/>
		</div>
	);
}
