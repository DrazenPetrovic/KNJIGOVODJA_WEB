import mysql from "mysql2/promise";
import { dbConfig } from "../config/db.js";

// Pool za višekratno korišćenje konekcija — znatno brže od createConnection po zahtjevu
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Helper: uzmi konekciju iz poola, vrati je nazad kad završi
export const withConnection = async (fn) => {
  const connection = await pool.getConnection();
  try {
    return await fn(connection);
  } finally {
    connection.release();
  }
};
