# Deploy do backend

Publique esta pasta como um projeto Next.js separado na Vercel, com domínio `api.prisma.kyl8.dev`. O `vercel.json` já usa `pnpm run build`, que executa `prisma generate` antes do `next build`.

Configure no projeto:

```text
DATABASE_URL=postgresql://...
AUTH_SECRET=<segredo aleatório longo>
AUTH_URL=https://api.prisma.kyl8.dev
AUTH_TRUST_HOST=true
NEXT_PUBLIC_APP_URL=https://prisma.kyl8.dev
FRONTEND_ORIGIN=https://prisma.kyl8.dev
DEMO_AUTH_ENABLED=false
```

Antes do primeiro deploy, execute `pnpm prisma migrate deploy` com `DATABASE_URL` apontando para o PostgreSQL de produção. Não use o banco criado por `prisma dev` como banco público.

`DEMO_AUTH_ENABLED=true` é somente para uma implantação privada de demonstração; ele permite o cabeçalho de identidade usado pelo protótipo. Para produção pública, mantenha-o desativado e use uma sessão Auth.js real.
