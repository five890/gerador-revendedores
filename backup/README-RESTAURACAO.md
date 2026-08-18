# Backup e restauração do Shelby Panel

Este pacote contém o código-fonte, histórico Git, schema Drizzle, migrações e instruções para migrar o sistema para outro hospedador.

## Conteúdo

- `shelby-panel-source.tar.gz`: código do projeto sem `node_modules`, `dist`, arquivos temporários e segredos.
- `shelby-panel.git.bundle`: histórico Git completo, para recriar o repositório sem depender do GitHub.
- `database-schema.sql`: estrutura SQL extraída do schema Drizzle e das migrações disponíveis.
- `backup-manifest.txt`: lista e hash dos arquivos do pacote.

## Banco de dados

O dump dos dados reais depende da `DATABASE_URL` do banco em produção. Ela não estava disponível neste ambiente durante a geração deste pacote. O backup contém o schema e todas as migrações, mas não inventa dados de usuários, Keys, créditos ou logs.

Antes de migrar, gere um dump real no servidor atual, sem publicar a senha:

```bash
pg_dump --no-owner --no-privileges "$DATABASE_URL" > database-data.sql
```

Se o banco for MySQL/MariaDB/TiDB, use uma URL acessível a partir do ambiente de backup e gere um dump compactado:

```bash
mysqldump --single-transaction --routines --triggers --events --hex-blob "$DATABASE_URL" | gzip -9 > database-data.sql.gz
```

Guarde `database-data.sql.gz` junto deste pacote em armazenamento privado. Nunca coloque a URL, usuário ou senha no GitHub, no código ou em mensagens públicas.

## Restauração em outro hospedador

1. Instale Node.js 22, pnpm e o banco compatível.
2. Extraia `shelby-panel-source.tar.gz`.
3. Copie o arquivo `.env` do ambiente atual por canal seguro; nunca o coloque no GitHub.
4. Configure a nova `DATABASE_URL` e demais variáveis de ambiente.
5. Instale dependências com `pnpm install --frozen-lockfile`.
6. Crie as tabelas executando as migrações com `pnpm db:push` ou o comando de migração usado pelo novo provedor.
7. Importe os dados com `pg_restore --no-owner --no-privileges -d "$DATABASE_URL" database.dump` para PostgreSQL. Para MySQL/MariaDB/TiDB, use `gunzip -c database.sql.gz | mysql --defaults-extra-file=/caminho/seguro/mysql.cnf` depois de criar o banco vazio.
8. Execute `pnpm check`, `pnpm test` e `pnpm build`.
9. Inicie o serviço conforme o provedor (`pnpm start` ou o comando definido no deploy).
10. Verifique login, Keys disponíveis/usadas, créditos, criação de clientes, logs e conteúdos antes de apontar o domínio.

## Backup automático

O repositório contém `scripts/backup-database.sh` e `.github/workflows/database-backup.yml`. O workflow executa automaticamente todos os dias às 03:17 UTC e também pode ser iniciado manualmente. O dump é compactado quando o banco é MySQL/MariaDB, recebe checksum SHA-256 e é enviado como artefato privado por 90 dias; nenhum dump é commitado no código.

Para ativar: no GitHub, abra **Settings → Secrets and variables → Actions → New repository secret**, crie `BACKUP_DATABASE_URL` e informe a URL pública/acessível do banco de produção. Não use um endereço interno do Railway que só funciona dentro da rede Railway. Depois, abra **Actions → Database backup → Run workflow** e confirme que o job terminou com sucesso. Antes de trocar de hospedador, baixe o artefato mais recente e guarde uma cópia privada de longo prazo, pois a retenção automática é limitada a 90 dias.

## Segurança

O token do GitHub foi exposto na conversa e deve ser revogado. Segredos de produção, senhas e `DATABASE_URL` não foram incluídos neste backup. Mantenha o pacote e principalmente o dump de dados em armazenamento privado e criptografado.

O backup é um snapshot. Se o sistema continuar recebendo clientes, Keys, créditos ou logs, gere outro dump antes da migração final.
