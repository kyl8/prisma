# Integrações do PRISMA

## Agente de IA

O endpoint `POST /api/assistant` recebe `{ message, companyId?, productId? }`, valida o usuário e monta o contexto com produtos, campos e solicitações persistidos.

Para encaminhar a pergunta ao agente hospedado na Logcomex, configure:

```env
PRISMA_AI_AGENT_URL=https://seu-agente.example/endpoint
PRISMA_AI_AGENT_TOKEN=seu-token
```

O backend envia `message`, `context`, `logcomex` e a política de segurança do PRISMA. O adaptador aceita respostas com `answer`, `message`, `response`, `output_text` ou texto simples.

Sem `PRISMA_AI_AGENT_URL`, a resposta é produzida por regras locais baseadas no catálogo real; isso mantém a plataforma utilizável durante o desenvolvimento e não inventa dados. Para usar um prompt publicado da Logcomex especificamente no chat, configure `LOGCOMEX_ASSISTANT_AGENT_ID` e `LOGCOMEX_ASSISTANT_PROMPT_ID`. Os IDs de análise documental (`LOGCOMEX_AGENT_ID` e `LOGCOMEX_PROMPT_ID`) não são reutilizados pelo assistente.

## Logcomex

As credenciais ficam somente no backend. Configure:

```env
LOGCOMEX_API_URL=https://api.logcomex.example
LOGCOMEX_API_KEY=seu-token
LOGCOMEX_API_KEY_HEADER=Authorization
LOGCOMEX_CATALOG_PATH=/v1/catalog/search
LOGCOMEX_ASSISTANT_PATH=/v1/catalog/search
```

`GET /api/integrations/logcomex/health` informa se a configuração está completa. `POST /api/integrations/logcomex/query` encaminha um JSON autenticado para o path configurado. O agente só consulta a Logcomex durante uma pergunta quando `LOGCOMEX_ASSISTANT_PATH` está definido.

Os paths padrão são deliberadamente configuráveis porque a branch remota `backend` não traz um contrato HTTP oficial da Logcomex nem credenciais; ela fornece o núcleo de governança de catálogo e a política documental, não um cliente de fornecedor.

## Contrato do agente publicado

O agente publicado usa `POST https://api.logcomex.ai/v1/agent-api-execute/{agent_id}/{prompt_id}` com `Authorization: Bearer ldi_*`. Os IDs configurados no `.env.example` correspondem ao OpenAPI fornecido pela equipe. O backend envia os campos obrigatórios do prompt, acompanha respostas `202` via `GET /agent-api-execute/{request_id}` e resume o objeto `data` no chat.
