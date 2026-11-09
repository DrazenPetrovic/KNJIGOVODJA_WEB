import { useEffect, useRef, useState } from "react";
import { Download, FileText, Loader2, Printer, X } from "lucide-react";

const PRIMARY = "#785E9E";

export type Orijentacija = "portrait" | "landscape";

interface PrintPreviewModalProps {
  open: boolean;
  onClose: () => void;
  // Gotov HTML dokument koji se prikazuje u iframe-u i štampa.
  html: string;
  naslov: string;
  podnaslov?: string;
  // Predloženi naziv PDF fajla (bez ekstenzije).
  nazivFajla: string;
  pocetnaOrijentacija?: Orijentacija;
}

// Zajednički modal za pregled prije štampe. Isti sistemski dijalog služi i
// za štampu i za PDF ("Sačuvaj kao PDF" / "Microsoft Print to PDF") — tako
// naša slova (č, ć, đ, š, ž) ostaju ispravna, što jsPDF sa ugrađenim
// fontovima ne podržava.
export function PrintPreviewModal({
  open,
  onClose,
  html,
  naslov,
  podnaslov,
  nazivFajla,
  pocetnaOrijentacija = "portrait",
}: PrintPreviewModalProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [orientation, setOrientation] =
    useState<Orijentacija>(pocetnaOrijentacija);
  const [radi, setRadi] = useState<"print" | "pdf" | null>(null);

  useEffect(() => {
    if (open) setOrientation(pocetnaOrijentacija);
  }, [open, pocetnaOrijentacija]);

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
    if (!open || !iframeRef.current) return;
    const doc = iframeRef.current.contentDocument;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [open, html]);

  // Naslov glavnog dokumenta se privremeno mijenja jer ga preglednik nudi
  // kao naziv PDF fajla.
  const pokreni = (nacin: "print" | "pdf") => {
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow) return;
    const doc = iframe.contentDocument!;
    let styleEl = doc.getElementById(
      "print-orientation",
    ) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = doc.createElement("style");
      styleEl.id = "print-orientation";
      doc.head.appendChild(styleEl);
    }
    styleEl.textContent = `@page { size: A4 ${orientation}; margin: 10mm; }`;

    setRadi(nacin);
    const stariNaslov = document.title;
    const cistNaziv = nazivFajla.replace(/[\\/:*?"<>|]+/g, "-").trim();
    document.title = cistNaziv;
    doc.title = cistNaziv;
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    document.title = stariNaslov;
    setTimeout(() => setRadi(null), 800);
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
        style={{ width: "min(96vw, 1100px)", height: "min(92vh, 900px)" }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-b border-gray-100"
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
              <h2 className="text-sm font-bold text-gray-800">{naslov}</h2>
              {podnaslov && (
                <p className="text-xs text-gray-500">{podnaslov}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-0.5">
              {(["portrait", "landscape"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  onClick={() => setOrientation(o)}
                  className="px-3 py-1 rounded-md text-xs font-semibold transition-colors"
                  style={
                    orientation === o
                      ? { background: PRIMARY, color: "#fff" }
                      : { color: "#6b7280" }
                  }
                >
                  {o === "portrait" ? "Vertikalno" : "Horizontalno"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => pokreni("pdf")}
              disabled={radi !== null}
              title='U dijalogu izaberite "Sačuvaj kao PDF" / "Microsoft Print to PDF"'
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold border transition-opacity disabled:opacity-60"
              style={{ borderColor: PRIMARY, color: PRIMARY }}
            >
              {radi === "pdf" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Sačuvaj PDF
            </button>

            <button
              type="button"
              onClick={() => pokreni("print")}
              disabled={radi !== null}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-opacity disabled:opacity-60"
              style={{ background: PRIMARY, color: "#fff" }}
            >
              {radi === "print" ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Printer size={14} />
              )}
              Štampaj
            </button>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600 hover:border-gray-300 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="px-5 py-1.5 text-[11px] text-gray-500 bg-gray-50 border-b border-gray-100">
          Za PDF: u dijalogu za štampu kao odredište izaberite{" "}
          <b>„Sačuvaj kao PDF"</b> ili <b>„Microsoft Print to PDF"</b>.
        </div>

        <div className="flex-1 bg-gray-200 p-4 overflow-hidden">
          <iframe
            ref={iframeRef}
            title="Pregled za štampu"
            className="w-full h-full rounded-lg bg-white shadow-md border border-gray-200"
            style={{ display: "block" }}
          />
        </div>
      </div>
    </div>
  );
}
