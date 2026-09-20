# Deploy

Crie dois projetos Vercel deste monorepo, com Root Directory frontend e backend, incluindo arquivos fora do diretório raiz e usando Node 24. Instale com pnpm install --frozen-lockfile.

Frontend: pnpm --filter @prisma/frontend build, saída frontend/dist. Backend: pnpm --filter @prisma/backend build.

Configure no backend DATABASE_URL, AUTH_SECRET, AUTH_TRUST_HOST=true, AUTH_URL=https://prisma.kyl8.dev/api/auth, NEXT_PUBLIC_APP_URL=https://prisma.kyl8.dev e FRONTEND_ORIGIN=https://prisma.kyl8.dev. Execute pnpm db:deploy uma vez antes do tráfego. Não rode seed demo em produção.

No Name.com, crie CNAME prisma para o domínio Vercel do frontend e api.prisma para o domínio Vercel do backend. Valide HTTPS, login, /api/me e um link público.
