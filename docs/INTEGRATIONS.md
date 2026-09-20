# Integrações

SISCOMEX está em backend/src/modules/siscomex e consulta status, empresas, operadores, produtos, atributos e NCM. Evidências ficam em SiscomexSnapshot e execuções em SiscomexSyncRun; respostas não alteram automaticamente o catálogo. Sem credenciais, retorna configuração ausente.

Logcomex usa LOGCOMEX_API_URL, LOGCOMEX_API_KEY, LOGCOMEX_AGENT_ID e LOGCOMEX_PROMPT_ID. Nunca exponha essas variáveis no frontend.

services/catalog-engine é opcional, com SQLite próprio, e não compartilha automaticamente autenticação nem tabelas Prisma.
