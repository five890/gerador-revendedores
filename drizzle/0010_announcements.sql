CREATE TABLE IF NOT EXISTS announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  productType VARCHAR(50) NOT NULL DEFAULT 'all',
  durationSeconds INT NOT NULL DEFAULT 5,
  isActive BOOLEAN NOT NULL DEFAULT TRUE,
  createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_announcements_active_product ON announcements (isActive, productType);

-- Compatibilidade para bancos que já possuem a tabela sem os campos novos:
-- A inicialização automática do servidor também verifica/adiciona as colunas ausentes.

