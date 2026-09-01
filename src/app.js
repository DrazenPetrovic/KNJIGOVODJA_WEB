import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";

import healthRoutes from "./routes/health.routes.js";
import authRoutes from "./routes/auth.routes.js";
import preglediRoutes from "./routes/pregledi.routes.js";
import printersRoutes from "./routes/printers.route.js";
import mjesecniPrihodiRoutes from "./routes/mjesecniPrihodi.routes.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const createApp = () => {
  const app = express();

  if (env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }

  app.use(
    cors({
      origin:
        env.NODE_ENV === "production"
          ? env.FRONTEND_URL
          : (origin, callback) => {
              if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
                return callback(null, true);
              }
              callback(new Error("Not allowed by CORS"));
            },
      credentials: true,
    }),
  );
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/printers", printersRoutes);
  app.use("/api", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/pregledi", preglediRoutes);
  app.use("/api/mjesecni-prihodi", mjesecniPrihodiRoutes);

  // Serviranje frontenda u produkciji
  if (env.NODE_ENV === "production") {
    const distPath = path.join(__dirname, "../dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
};
