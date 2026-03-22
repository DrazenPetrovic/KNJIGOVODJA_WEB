import * as PreglediService from "../services/pregledi.service.js";

export const getPregledRacuna = async (req, res) => {
  try {
    const result = await PreglediService.getPregledRacuna();

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        count: result.count,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju računa",
    });
  } catch (error) {
    console.error("getPregledRacuna error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};
