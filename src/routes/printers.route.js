/**
 * routes/printers.route.js
 *
 * GET /api/printers
 * Vraća listu dostupnih printera sa računara gdje radi Node/Express server.
 */

import { execSync } from "child_process";
import express from "express";

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Opcija A: npm install printer  (cross-platform, preporučeno)
// ─────────────────────────────────────────────────────────────────────────────
async function getPrintersNative() {
  try {
    const printerLib = await import("printer").catch(() => null);
    if (!printerLib) return null;
    const list = printerLib.getPrinters();
    return list.map((p) => p.name);
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Opcija B: Čita printere iz OS-a putem child_process (fallback, bez libraryja)
// ─────────────────────────────────────────────────────────────────────────────
function getPrintersOS() {
  try {
    const platform = process.platform;

    if (platform === "win32") {
      const out = execSync("wmic printer get name /format:list 2>nul", {
        timeout: 5000,
      }).toString();
      return out
        .split("\n")
        .map((l) => l.replace(/^Name=/, "").trim())
        .filter((l) => l.length > 0);
    }

    if (platform === "linux") {
      const out = execSync("lpstat -a 2>/dev/null", {
        timeout: 5000,
      }).toString();
      return out
        .split("\n")
        .map((l) => l.split(" ")[0].trim())
        .filter((l) => l.length > 0);
    }

    if (platform === "darwin") {
      const out = execSync("lpstat -p 2>/dev/null", {
        timeout: 5000,
      }).toString();
      return out
        .split("\n")
        .filter((l) => l.startsWith("printer "))
        .map((l) => l.split(" ")[1].trim())
        .filter((l) => l.length > 0);
    }

    return [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  const printers = (await getPrintersNative()) ?? getPrintersOS();
  res.json({ success: true, printers, count: printers.length });
});

export default router;

// ─────────────────────────────────────────────────────────────────────────────
// Registracija u app.js:
//
//   import printersRoutes from "./routes/printers.route.js";
//   app.use("/api/printers", printersRoutes);
//
// ─────────────────────────────────────────────────────────────────────────────
