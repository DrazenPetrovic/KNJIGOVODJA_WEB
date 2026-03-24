import { Router } from "express";
import * as PreglediController from "../controllers/pregledi.controller.js";

const router = Router();

// Pregled svih računa
router.get("/kif", PreglediController.getPregledKIF);
router.get("/kuf", PreglediController.getPregledKUF);
export default router;
