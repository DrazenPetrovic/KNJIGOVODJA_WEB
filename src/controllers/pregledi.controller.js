import * as PreglediService from "../services/pregledi.service.js";

export const getPregledKIF = async (req, res) => {
  try {
    const result = await PreglediService.getPregledKIF();

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        count: result.count,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju KIF-a",
    });
  } catch (error) {
    console.error("getPregledKIF error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};

export const getPregledKUF = async (req, res) => {
  try {
    const result = await PreglediService.getPregledKUF();

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        count: result.count,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju KUF-a",
    });
  } catch (error) {
    console.error("getPregledKUF error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};

export const getPregledTrgovackeKnjigeMaloprodaje = async (req, res) => {
  try {
    const result = await PreglediService.getPregledTrgovackeKnjigeMaloprodaje();

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        count: result.count,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju trgovacke knjige maloprodaje",
    });
  } catch (error) {
    console.error("getPregledTrgovackeKnjigeMaloprodaje error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};

export const getPregledKalkulacijaSirovine = async (req, res) => {
  try {
    const result = await PreglediService.getPregledKalkulacijaSirovine();

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        count: result.count,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju kalkulacija sirovine",
    });
  } catch (error) {
    console.error("getPregledKalkulacijaSirovine error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};

export const getPregledKalkulacijaRobe = async (req, res) => {
  try {
    const result = await PreglediService.getPregledKalkulacijaRobe();

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        count: result.count,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju kalkulacija robe",
    });
  } catch (error) {
    console.error("getPregledKalkulacijaRobe error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};


export const getPregledMjesecniPrihodi = async (req, res) => {
  try {
    const result = await PreglediService.getPregledMjesecniPrihodi();

    if (result.success) {
      return res.json({
        success: true,
        data: result.data,
        count: result.count,
      });
    }

    return res.status(500).json({
      success: false,
      message: "Greška pri preuzimanju mesečnih prihoda",
    });
  } catch (error) {
    console.error("getPregledMjesecniPrihodi error:", error);
    return res.status(500).json({
      success: false,
      message: "Greška pri obradi zahteva",
    });
  }
};
