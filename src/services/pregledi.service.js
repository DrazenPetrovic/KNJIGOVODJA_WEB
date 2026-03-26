import { withConnection } from "./db.service.js";

/**
 * Pregled svih računa sa detaljima
 * @returns {Promise} Niz objekata sa podacima o računima
 */
export const getPregledKIF = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL sp_pregled_knjiga_izlaznih_faktura()",
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
