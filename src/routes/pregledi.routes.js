import { Router } from "express";
import * as PreglediController from "../controllers/pregledi.controller.js";

const router = Router();

// Pregled svih računa
router.get("/kif", PreglediController.getPregledKIF);
router.get("/kuf", PreglediController.getPregledKUF);
router.get(
  "/trgovacka-knjiga-maloprodaje",
  PreglediController.getPregledTrgovackeKnjigeMaloprodaje,
);
router.get(
  "/kalkulacija-sirovine",
  PreglediController.getPregledKalkulacijaSirovine,
);
router.get("/kalkulacija-robe", PreglediController.getPregledKalkulacijaRobe);

export default router;
