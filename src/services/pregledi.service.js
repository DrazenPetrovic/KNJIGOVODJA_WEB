import { withConnection } from "./db.service.js";

/**
 * Pregled svih računa sa detaljima
 * @returns {Promise} Niz objekata sa podacima o računima
 */
export const getPregledKIF = async (datumOd, datumDo) => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL sp_knjiga_izlaznih_faktura_pregled_filter(?, ?)",
      [datumOd, datumDo],
    );

    const racuni = rows?.[0] || [];

    return {
      success: true,
      data: racuni,
      count: racuni.length,
    };
  });
};

export const getPregledKUF = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL sp_pregled_knjige_ulaznih_faktura()",
    );

    const racuni = rows?.[0] || [];

    return {
      success: true,
      data: racuni,
      count: racuni.length,
    };
  });
};

export const getPregledTrgovackeKnjigeMaloprodaje = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL sp_pregled_trgovacke_knjige_maloprodaje()",
    );

    const racuni = rows?.[0] || [];

    return {
      success: true,
      data: racuni,
      count: racuni.length,
    };
  });
};

export const getPregledKalkulacijaSirovine = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL sp_pregled_kalkulacija_sirovine()",
    );

    const racuni = rows?.[0] || [];

    return {
      success: true,
      data: racuni,
      count: racuni.length,
    };
  });
};

export const getPregledKalkulacijaRobe = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL sp_pregled_kalkulacija_robe()",
    );

    const racuni = rows?.[0] || [];

    return {
      success: true,
      data: racuni,
      count: racuni.length,
    };
  });
};

export const getPregledNivelacija = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute("CALL sp_pregled_nivelacije()");

    const racuni = rows?.[0] || [];

    return {
      success: true,
      data: racuni,
      count: racuni.length,
    };
  });
};

export const getPregledUtroskaMaterijala = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL sp_pregled_utroska_materijala()",
    );

    const racuni = rows?.[0] || [];

    return {
      success: true,
      data: racuni,
      count: racuni.length,
    };
  });
};
