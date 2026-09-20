# Guia da banca

## Início

pnpm install
Copy-Item backend/.env.example backend/.env
Preencha DATABASE_URL e AUTH_SECRET.
pnpm db:deploy
pnpm db:seed:demo
pnpm dev

Contas fictícias: banca@prisma.local / Banca@123 e banca.despachante@prisma.local / Banca@123. Use somente em avaliação. Link público: /r/prisma-demo-importer-link-2026-portal/catalogo.

## Roteiro

1. Entre como administrador e crie uma solicitação para a empresa demo.
2. Copie o link e abra-o em janela anônima.
3. Preencha, salve o rascunho e envie para revisão.
4. No Workspace, abra a solicitação e revise as respostas.
5. Aprove ou solicite correção com motivo; confirme status, Activity e notificação.
6. Como importador, confira Pendências, Notificações e Activity.
7. Importe .xls, .xlsx ou .xlsm: selecione cliente, revise o preview, renomeie campos e confirme.
8. No Catálogo, use o dropdown para alternar entre empresas.

## Checklist

- [ ] Login admin e importador
- [ ] Empresa/CNPJ corretos e isolamento entre empresas
- [ ] Solicitação, link público, rascunho e envio
- [ ] Revisão, correção e aprovação
- [ ] Notificação e Activity persistidas
- [ ] Importação Excel com preview/edição
- [ ] Dropdown de catálogo
- [ ] pnpm build, pnpm typecheck e pnpm test

Não há WebSocket: recarregue para buscar alterações. SISCOMEX depende de credenciais oficiais e é somente leitura; Logcomex depende de chave/agente. O serviço catalog-engine é opcional.
