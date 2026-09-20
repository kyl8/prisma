# PRISMA na Vercel

Esta pasta é o projeto Vite do frontend. Publique-a em um projeto Vercel com **Root Directory** `frontend`, usando `frontend/vercel.json`. O domínio recomendado é `prisma.kyl8.dev`.

Variáveis do projeto frontend:

```text
VITE_API_URL=https://api.prisma.kyl8.dev
VITE_DEMO_AUTH=false
```

O backend deve ser publicado como um segundo projeto Vercel, a partir da pasta `backend`, em `api.prisma.kyl8.dev`. A API já usa `VITE_API_URL`, então não há mais URLs de `localhost` embutidas nos clientes HTTP.

Para o protótipo demo funcionar após publicar, habilite temporariamente `VITE_DEMO_AUTH=true` aqui e `DEMO_AUTH_ENABLED=true` no backend. Isso é inseguro para uma aplicação pública; mantenha ambos desativados quando o login real estiver ligado ao Auth.js.

No Name.com, depois de adicionar os domínios na Vercel, crie os CNAMEs com os destinos exibidos pela Vercel:

- host `prisma` → destino CNAME do projeto frontend;
- host `api.prisma` → destino CNAME do projeto backend.

A Vercel valida o DNS e provisiona HTTPS automaticamente. O passo a passo completo está documentado no histórico de implantação do projeto.
