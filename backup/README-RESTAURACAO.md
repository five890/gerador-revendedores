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

Se o banco for MySQL/TiDB, use:

```bash
mysqldump --single-transaction --routines --triggers "$DATABASE_URL" > database-data.sql
```

Guarde `database-data.sql` junto deste pacote em armazenamento privado.

## Restauração em outro hospedador

1. Instale Node.js 22, pnpm e o banco compatível.
2. Extraia `shelby-panel-source.tar.gz`.
3. Copie o arquivo `.env` do ambiente atual por canal seguro; nunca o coloque no GitHub.
4. Configure a nova `DATABASE_URL` e demais variáveis de ambiente.
5. Instale dependências com `pnpm install --frozen-lockfile`.
6. Crie as tabelas executando as migrações com `pnpm db:push` ou o comando de migração usado pelo novo provedor.
7. Importe os dados com `psql "$DATABASE_URL" < database-data.sql` para PostgreSQL, ou com o cliente equivalente para MySQL/TiDB.
8. Execute `pnpm check`, `pnpm test` e `pnpm build`.
9. Inicie o serviço conforme o provedor (`pnpm start` ou o comando definido no deploy).
10. Verifique login, Keys disponíveis/usadas, créditos, criação de clientes, logs e conteúdos antes de apontar o domínio.

## Backup automático

O repositório agora contém `scripts/backup-database.sh` e `.github/workflows/database-backup.yml`. O workflow roda manualmente, a cada push no `main` e diariamente, mas só executa quando o secret privado `BACKUP_DATABASE_URL` estiver configurado no GitHub em **Settings → Secrets and variables → Actions**. O dump é enviado como artefato privado do workflow por 90 dias; ele não é commitado no código.

Configure esse secret com a URL do banco atual e execute o workflow manualmente uma vez para testar. Antes de trocar de hospedador, baixe o artefato mais recente e guarde-o em armazenamento privado de longo prazo, porque artefatos têm retenção limitada.

## Segurança

O token do GitHub foi exposto na conversa e deve ser revogado. Segredos de produção, senhas e `DATABASE_URL` não foram incluídos neste backup. Mantenha o pacote e principalmente o dump de dados em armazenamento privado e criptografado.

O backup é um snapshot. Se o sistema continuar recebendo clientes, Keys, créditos ou logs, gere outro dump antes da migração final.
