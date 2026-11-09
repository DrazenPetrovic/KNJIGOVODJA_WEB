import * as IzvodiService from "../services/izvodi.service.js";

export const getIzvodiPreglediSaUplatama = async (_req, res) => {
  try {
    const { izvodi, uplate } =
      await IzvodiService.getIzvodiPreglediSaUplatama();
    return res.json({
      success: true,
      izvodi,
      uplate,
      count: izvodi.length,
    });
  } catch (error) {
    console.error("Pregled izvoda error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju pregleda izvoda" });
  }
};

export const getBankePregled = async (_req, res) => {
  try {
    const data = await IzvodiService.getBankePregled();
    return res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error("Pregled banaka error:", error);
    return res
      .status(500)
      .json({ success: false, error: "Greška pri učitavanju banaka" });
  }
};
