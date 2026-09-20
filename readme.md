# PRISMA

Monorepo da plataforma de gestão de catálogos de importação.

## Estrutura

- `frontend/`: Vite + React, Workspace e portal do importador.
- `backend/`: Next.js, Auth.js, Prisma e PostgreSQL, com catálogo, solicitações, Activity, notificações, Logcomex e SISCOMEX.
- `services/catalog-engine/`: serviço Node + SQLite opcional de governança, independente da API principal.
- `docs/`: deploy e integrações.

## Execução

Requer Node 24 e pnpm 10.29.2. Copie `backend/.env.example` para `backend/.env` e preencha `DATABASE_URL` e `AUTH_SECRET`.

```bash
pnpm install
pnpm db:generate
pnpm db:deploy
pnpm dev
```

Frontend: `http://localhost:5173`. API: `http://localhost:3000`.

## Validação

```bash
pnpm build
pnpm typecheck
pnpm test
```

A migração `20260920200000_release_baseline` representa o schema atual. A história anterior está preservada em `backend/prisma/migrations-legacy/`. Em banco existente, faça backup e compare o schema antes de resolver a baseline como aplicada; nunca use reset em produção.

O roteiro está em [GUIA_BANCA.md](GUIA_BANCA.md). Deploy: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Integrações: [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

Não há credenciais reais, `.env`, builds ou bancos locais versionados. O seed cria contas fictícias somente para avaliação. SISCOMEX é somente leitura e exige credenciais oficiais; Logcomex exige chave e agente.
