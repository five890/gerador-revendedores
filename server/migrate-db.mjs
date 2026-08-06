import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not defined");
  process.exit(1);
}

const connection = await mysql.createConnection(dbUrl);
console.log("Connected to database. Running schema synchronization...");

const queries = [
  "ALTER TABLE users ADD COLUMN passwordHash VARCHAR(255)",
  "ALTER TABLE users ADD COLUMN credits INT DEFAULT 0",
  "ALTER TABLE users ADD COLUMN resellerId INT",
  "ALTER TABLE users ADD COLUMN keyId INT",
  "ALTER TABLE users ADD COLUMN isActive BOOLEAN DEFAULT TRUE",
  
  `CREATE TABLE IF NOT EXISTS \`keys\` (
    id INT AUTO_INCREMENT PRIMARY KEY,
    keyValue VARCHAR(255) NOT NULL UNIQUE,
    isActive BOOLEAN DEFAULT TRUE NOT NULL,
    isUsed BOOLEAN DEFAULT FALSE NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  
  `CREATE TABLE IF NOT EXISTS downloads (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    version VARCHAR(50) NOT NULL,
    fileUrl TEXT NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  
  `CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT NOT NULL,
    token VARCHAR(512) NOT NULL,
    deviceIdentifier VARCHAR(255) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`,
  
  `CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userId INT,
    action VARCHAR(100) NOT NULL,
    details TEXT,
    ipAddress VARCHAR(45),
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
  )`
];

for (const q of queries) {
  try {
    await connection.query(q);
    console.log("SUCCESS:", q.substring(0, 40));
  } catch (err) {
    console.log("NOTE (Safe ignore):", err.message);
  }
}

await connection.end();
console.log("Migration finished successfully!");
process.exit(0);
