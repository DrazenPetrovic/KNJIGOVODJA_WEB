import { withConnection } from "./db.service.js";

/**
 * Pregled svih računa sa detaljima
 * @returns {Promise} Niz objekata sa podacima o računima
 */
export const getPregledRacuna = async () => {
  return withConnection(async (connection) => {
    const [rows] = await connection.execute(
      "CALL sp_pregled_racuna_gl(NULL, NULL)",
    );

    const racuni = rows?.[0] || [];

    return {
      success: true,
      data: racuni,
      count: racuni.length,
    };
  });
};
