import mysql from "mysql2/promise";
import crypto from "crypto";
import dotenv from "dotenv";

dotenv.config();

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    // Verificar colunas da tabela users
    const [rows] = await connection.execute("DESCRIBE users");
    console.log("Colunas da tabela users:", rows);

    const username = "murillo";
    const passwordHash = hashPassword("300530");

    // Verificar se existe openId ou username
    const hasUsername = rows.some((r) => r.Field === "username");
    const hasOpenId = rows.some((r) => r.Field === "openId");

    if (hasUsername) {
      await connection.execute(
        "INSERT INTO users (username, passwordHash, role, credits, isActive) VALUES (?, ?, 'moderator', 9999, true) ON DUPLICATE KEY UPDATE passwordHash = ?, role = 'moderator'",
        [username, passwordHash, passwordHash]
      );
    } else if (hasOpenId) {
      await connection.execute(
        "INSERT INTO users (openId, role) VALUES ('murillo', 'admin') ON DUPLICATE KEY UPDATE role = 'admin'"
      );
    }
    console.log("Moderador murillo configurado com sucesso!");
  } catch (err) {
    console.error("Erro no seed:", err);
  } finally {
    await connection.end();
  }
}

main();
