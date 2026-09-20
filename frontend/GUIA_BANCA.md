# PRISMA — Guia da banca

Este documento explica como executar e avaliar o PRISMA, quais acessos usar, quais fluxos estão funcionando e onde cada informação é armazenada.

## Acesso rápido da banca

**Login da banca — Portal do Importador**

- E-mail: `banca@prisma.local`
- Senha: `Banca@123`

**Link público para preenchimento**

`http://localhost:5173/r/prisma-demo-importer-link-2026-portal/catalogo`

Para testar o lado do despachante e criar/revisar solicitações:

- E-mail: `banca.despachante@prisma.local`
- Senha: `Banca@123`

Esse login possui perfil de despachante e acesso a todas as empresas demo.

O login administrativo completo também está disponível:

- E-mail: `admin@prisma.local`
- Senha: `Prisma@123`

## 1. Visão geral

O projeto possui dois aplicativos:

- `frontend`: interface Vite/React do Workspace do despachante e Portal do Importador.
- `backend`: API Next.js, autenticação Auth.js, Prisma e PostgreSQL.

O fluxo principal demonstrado é:

```text
Despachante cria solicitação
        ↓
Importador recebe notificação/link
        ↓
Importador preenche produtos
        ↓
Importador envia para revisão
        ↓
Despachante revisa ou solicita correção
        ↓
Importador corrige e reenvia
        ↓
Activity e notificações registram o fluxo
```

## 2. Como iniciar

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend, em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Endereços locais:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

O backend precisa estar conectado ao PostgreSQL configurado em `backend/.env`.

## 3. Contas para avaliação

### Administrador/despachante

- E-mail: `admin@prisma.local`
- Senha: `Prisma@123`

Esse usuário possui perfil de despachante e acesso a todas as empresas cadastradas, incluindo a empresa de demonstração da banca.

Use-o para testar:

- visão geral do Workspace;
- clientes e empresas;
- catálogo;
- importação de produtos;
- criação de solicitações;
- envio de links;
- revisão de respostas;
- solicitação de correção;
- aprovação;
- Activity.

### Importador da banca

- E-mail: `banca@prisma.local`
- Senha: `Banca@123`
- Empresa: `PRISMA Demo Importações`

Use-o para testar:

- Home;
- Meu catálogo;
- Pendências;
- Correções;
- Notificações;
- Activity;
- preenchimento de produtos;
- envio para revisão;
- atualização de dados.

## 4. Link público de preenchimento

Link preparado para a banca:

`http://localhost:5173/r/prisma-demo-importer-link-2026-portal/catalogo`

Esse link representa uma solicitação criada pelo despachante para o importador preencher dois produtos.

O link público funciona sem login e permite:

1. iniciar a solicitação;
2. preencher atributos;
3. salvar respostas;
4. enviar a solicitação para revisão.

Depois do envio, o despachante consegue consultar a solicitação no Workspace.

## 5. Roteiro recomendado para a apresentação

### Parte A — Acesso do administrador

1. Entre com `admin@prisma.local`.
2. Abra a área de clientes/catalogação.
3. Localize `PRISMA Demo Importações`.
4. Abra a solicitação de preenchimento.
5. Confira os produtos associados e o status `waiting`.
6. Copie ou abra o link público de preenchimento.

### Parte B — Acesso do importador

1. Abra uma janela anônima ou encerre a sessão atual.
2. Entre com `banca@prisma.local`.
3. Na Home, confira empresa, CNPJ, métricas e atividade recente.
4. Abra `Meu catálogo`.
5. Teste a busca por nome, código interno e NCM.
6. Teste as abas:
   - Todos;
   - Preciso preencher;
   - Correções solicitadas;
   - Em revisão;
   - Aprovados.

### Parte C — Preenchimento

1. Abra `Produto Demo com pendência`.
2. Preencha os campos obrigatórios.
3. Clique em `Salvar rascunho`.
4. Atualize a página e confirme que os dados continuam salvos.
5. Clique em `Enviar para revisão`.
6. Confirme que o status e as métricas foram atualizados.

### Parte D — Correção

1. Abra `Pendências`.
2. Localize a correção solicitada.
3. Clique em `Corrigir informação`.
4. Confira que o produto correto é aberto.
5. Confira que o campo indicado recebe foco visual.
6. Corrija o valor.
7. Envie novamente para revisão.

### Parte E — Notificações e Activity

1. Abra `Notificações`.
2. Confira o badge de não lidas.
3. Clique em uma notificação relacionada a produto.
4. Marque uma notificação como lida.
5. Use `Marcar todas como lidas`.
6. Abra `Atividade`.
7. Teste os filtros de usuário, tipo e data.
8. Confira os eventos de correção, atualização e envio para revisão.

## 6. O que funciona

### Autenticação

- Login por e-mail e senha usando Auth.js Credentials.
- Sessão persistida por cookie do backend.
- Logout encerra a sessão real.
- Rotas protegidas validam usuário autenticado.
- Rotas do importador validam o perfil `importer`.

### Isolamento por empresa

O frontend não escolhe `companyId` para consultar produtos do importador.

O backend identifica a empresa através do usuário autenticado. Portanto, o importador da banca só recebe produtos, notificações e atividades da própria empresa.

### Portal do importador

- Perfil, nome, empresa e CNPJ reais.
- Catálogo real.
- Busca e filtros locais.
- Completude baseada nos atributos persistidos.
- Detalhe de produto.
- Salvamento de rascunho.
- Envio para revisão.
- Pendências derivadas de correções e campos obrigatórios.
- Notificações reais.
- Activity real.
- Loading, erro e retry na Activity.

### Workspace do despachante

- Consulta de empresas vinculadas.
- Consulta de produtos.
- Criação de solicitações.
- Solicitações de preenchimento.
- Solicitações de correção.
- Revisão das respostas.
- Aprovação ou rejeição.
- Importação de catálogo.

### Sincronização

As alterações são persistidas no PostgreSQL. Não existe sincronização fake entre telas.

Exemplos:

- uma correção criada pelo despachante aparece nas Pendências do importador;
- uma resposta enviada pelo importador aparece na revisão do despachante;
- uma alteração gera Activity;
- notificações são criadas para o usuário relacionado;
- a atualização da página recarrega os dados do banco.

## 7. O que ainda não está implementado

- O botão `Enviar mensagem` da Central de ajuda ainda é apenas feedback visual; não existe endpoint de mensagens.
- Não há WebSocket ou atualização em tempo real. É necessário atualizar a página ou navegar novamente para recarregar dados.
- O nome do despachante só aparece quando existe vínculo persistido entre a empresa e um despachante.
- O assistente possui integração própria, mas respostas de IA dependem da configuração da API correspondente.
- O sistema não possui recuperação de senha ou cadastro público.
- O link público possui validade e pode ficar indisponível após expiração ou cancelamento.

## 8. Localização das principais informações

### Frontend

- Portal do importador: `src/ImporterPortal.tsx`
- Cliente de API do importador: `src/api/importer.ts`
- Configuração da API: `src/api/config.ts`
- Activity: `src/features/activity/`
- Fluxo público do catálogo: `src/CatalogRequest.tsx`
- Workspace do despachante: `src/Workspace.tsx`
- Estilos do importador: `src/importer.css`

### Backend

- Schema do banco: `backend/prisma/schema.prisma`
- Autenticação: `backend/src/lib/auth.ts`
- Perfil atual: `backend/src/app/api/me/route.ts`
- Perfil do importador: `backend/src/app/api/importer/profile/route.ts`
- Produtos do importador: `backend/src/app/api/importer/products/`
- Serviço do importador: `backend/src/modules/importer/importer.service.ts`
- Notificações: `backend/src/app/api/notifications/`
- Activity: `backend/src/app/api/activities/` e `backend/src/modules/activity/`
- Solicitações: `backend/src/app/api/catalog-requests/`
- Fluxo público: `backend/src/app/api/catalog-requests/public/`

### Banco

- Usuários: `User`
- Empresas/importadores: `Importer`
- Despachantes: `customsbroker`
- Vínculos despachante–empresa: `CustomsBrokerCompanyAccess`
- Produtos: `Product`
- Atributos: `ProductField`
- Respostas persistidas: `Record` e `ProdFieldResp`
- Solicitações: `CatalogRequest`
- Correções/respostas: `CatalogRequestResponse`
- Notificações: `Notification`
- Histórico: `ActivityEvent`

## 9. Seed da demonstração

Para recriar ou atualizar as contas e os dados da banca:

```bash
cd backend
npm run db:seed:demo-accounts
```

O seed é idempotente para contas, produtos e solicitação principal. Ele também recria as notificações e Activity da empresa demo.

## 10. Verificações técnicas

Frontend:

```bash
npm run build
```

Backend:

```bash
npm run build
```

TypeScript do backend:

```bash
npx tsc --noEmit
```

## 11. Checklist rápido da banca

- [ ] Login admin funciona.
- [ ] Login importador funciona.
- [ ] Empresa correta aparece para cada usuário.
- [ ] Produtos da empresa aparecem no catálogo.
- [ ] Link público abre a solicitação.
- [ ] Importador consegue salvar rascunho.
- [ ] Importador consegue enviar para revisão.
- [ ] Despachante visualiza a atualização.
- [ ] Correção aparece nas Pendências.
- [ ] Correção pode ser respondida.
- [ ] Notificação pode ser marcada como lida.
- [ ] Activity registra o fluxo.
- [ ] Usuário não acessa dados de outra empresa alterando IDs.
