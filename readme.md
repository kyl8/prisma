# PRISMA — backend operacional

Backend do PRISMA para transformar dados de documentos de comércio exterior em
evidências rastreáveis, findings operacionais, decisões explicáveis e ações de
resolução.

A branch `backend` é independente de `architecture` e `frontend`. O serviço usa
Node.js 20+, `node:http` e SQLite. O repository em memória permanece disponível
para testes unitários e integrações que o injetem explicitamente.

## Instalação e execução

```bash
npm install
npm start
```

A porta padrão é `3000`. Para configurar outra porta:

```bash
PORT=8080 npm start
```

Configuração por ambiente:

```text
DATABASE_PATH=.prisma-data/prisma.db
UPLOAD_DIR=.prisma-data/uploads
MAX_UPLOAD_SIZE=5000000
PORT=3000
```

Na inicialização, migrations pendentes são executadas transacionalmente. O
estado flexível do caso é mantido no agregado, enquanto documentos, Evidence,
Findings, Actions e eventos de Timeline também possuem tabelas operacionais e
índices próprios.

## Persistência, concorrência e auditoria

- `OperationalCase.version` começa em `1` e é incrementado em cada escrita.
- Comandos aceitam `If-Match: "<version>"`; versões obsoletas recebem `409`
  com `CASE_VERSION_CONFLICT`, sem sobrescrever a versão atual.
- Fluxos multi-step usam a transação do repository.
- Evidence e Timeline são append-only; triggers SQLite bloqueiam `UPDATE` e
  `DELETE` diretos nessas tabelas.
- Eventos guardam `eventId`, `caseId`, ator, metadata, timestamp e caseVersion.
- Repetições de `analyze` sem mudança são idempotentes. Ingest/upload aceitam
  `Idempotency-Key`; external id e SHA-256 também auxiliam rastreabilidade.

## Fluxo

```text
Structured JSON / CSV / XLS / XLSX / XLSM / OCR externo
  → Ingestion Adapter
  → CanonicalDocument
  → normalização determinística
  → Evidence Ledger
  → reconciliação e governança de catálogo
  → Findings
  → Operational Readiness
  → Decision
  → Actions
```

Readiness depende dos Findings, não do estado administrativo das Actions. Uma
Action resolvida sem evidência pode continuar ligada a um Finding aberto e não
libera a operação.

## Modelo canônico

Cada documento converge para:

```json
{
  "id": "doc-001",
  "type": "PACKING_LIST",
  "source": {
    "format": "XLSX",
    "method": "SPREADSHEET",
    "fileName": "packing.xlsx"
  },
  "metadata": {},
  "parties": {},
  "shipment": {},
  "items": [],
  "fields": [],
  "unknownFields": [],
  "rawExtraction": {}
}
```

Tipos aceitos: `COMMERCIAL_INVOICE`, `PACKING_LIST`, `BILL_OF_LADING`,
`AIR_WAYBILL`, `LPCO`, `DUIMP`, `TECHNICAL_DATASHEET`, `SPREADSHEET` e
`UNKNOWN`.

Cada campo preserva `value`, `normalizedValue`, `rawValue`, status, provenance
e informações de extração. A confiança da extração permanece separada da
confiança de negócio da evidência.

## Ingestão

Endpoint:

```text
POST /api/prisma/cases/:caseId/ingest
```

### Structured JSON

```json
{
  "kind": "structured",
  "document": {
    "type": "COMMERCIAL_INVOICE",
    "fields": {
      "quantity": 10,
      "grossWeight": "680 KG"
    }
  }
}
```

### CSV

```json
{
  "kind": "csv",
  "fileName": "products.csv",
  "documentType": "PACKING_LIST",
  "content": "Produto,Quantidade,Peso\nPump XP400,10,680 KG"
}
```

### XLS, XLSX e XLSM

```json
{
  "kind": "spreadsheet",
  "fileName": "products.xlsx",
  "documentType": "PACKING_LIST",
  "contentBase64": "..."
}
```

O parser utiliza SheetJS CE 0.20.3. Macros não são carregadas nem executadas.
Fórmulas são preservadas como texto `unverified` e nunca avaliadas pelo backend.

### Saída estruturada de OCR

```json
{
  "kind": "ocr",
  "provider": "external-ocr",
  "payload": {
    "type": "COMMERCIAL_INVOICE",
    "fileName": "invoice.pdf",
    "fields": [
      {
        "field": "gross_weight",
        "value": "720 KG",
        "page": 2,
        "confidence": 0.97
      }
    ]
  }
}
```

O backend não executa OCR. Ele apenas adapta a saída estruturada de qualquer
fornecedor ao contrato canônico.

## Field mapping e normalização

Aliases conhecidos são explícitos e configuráveis. Campos não reconhecidos são
mantidos em `unknownFields`; nenhum valor é descartado.

Normalizações implementadas:

- espaços;
- números em formatos como `1.250,50`;
- pesos e unidades como `680 KG`;
- quantidade e unidade como `10 PCS`;
- datas `DD/MM/AAAA` para ISO;
- moedas identificadas explicitamente;
- nomes de campos conhecidos em português e inglês.

Não há equivalência semântica livre entre fabricantes, modelos ou descrições.

## Findings, readiness e decisão

Tipos iniciais de Finding:

- `FIELD_CONFLICT`
- `MISSING_FIELD`
- `CATALOG_INCONSISTENCY`
- `INSUFFICIENT_EVIDENCE`
- `POSSIBLE_DUPLICATE`
- `UNVERIFIED_CLASSIFICATION`
- `INSUFFICIENT_PRODUCT_IDENTITY`
- `CONFLICTING_PRODUCT_IDENTITY`

Estados: `OPEN`, `RESOLVED`, `DISMISSED`.

Dismiss exige motivo e ator e não é tratado como resolução factual. Actions
suportam `OPEN`, `IN_PROGRESS`, `RESOLVED` e `CANCELLED`. Se uma Action for
fechada enquanto o Finding continuar aberto, uma Action substituta é criada
somente quando não houver outra ativa.

Regras:

- Finding bloqueador aberto → `BLOCKED` → `HOLD_FOR_VALIDATION`.
- Somente Findings não bloqueadores abertos → `CONDITIONAL` →
  `PROCEED_WITH_CONDITIONS`.
- Nenhum Finding ativo → `READY` → `PROCEED`.

Actions referenciam `findingId`. Evidência confirmada atualiza os dados,
reavalia o Finding e só então recalcula readiness e decisão.

## Identidade de produto

Itens são correlacionados somente por identificadores fortes exatos: SKU,
product code, part number, GTIN, supplier code ou model. Descrição textual,
mesmo idêntica, nunca é chave de identidade. Ausência ou conflito de chaves
gera Finding conservador e pode bloquear readiness quando Invoice e Packing
List precisam de reconciliação item a item. As referências de cada item de
documento permanecem no `ProductIdentity`.

## Endpoints

Serviço e política:

- `GET /health`
- `GET /api/prisma/policy`

Casos:

- `POST /api/prisma/cases`
- `GET /api/prisma/cases`
- `GET /api/prisma/cases/:caseId`
- `POST /api/prisma/cases/:caseId/documents`
- `POST /api/prisma/cases/:caseId/ingest`
- `POST /api/prisma/cases/:caseId/documents/upload`
- `POST /api/prisma/cases/:caseId/analyze`
- `GET /api/prisma/cases/:caseId/evidence`
- `GET /api/prisma/cases/:caseId/divergences`
- `GET /api/prisma/cases/:caseId/findings`
- `GET /api/prisma/cases/:caseId/actions`
- `GET /api/prisma/cases/:caseId/readiness`
- `GET /api/prisma/cases/:caseId/decision`
- `POST /api/prisma/cases/:caseId/actions/:actionId/resolve`
- `POST /api/prisma/cases/:caseId/actions/:actionId/start`
- `POST /api/prisma/cases/:caseId/actions/:actionId/cancel`
- `POST /api/prisma/cases/:caseId/actions/:actionId/reopen`
- `POST /api/prisma/cases/:caseId/findings/:findingId/dismiss`

Catálogo:

- `POST /api/prisma/catalog/validate`

## Segurança e limites

- O cliente não fornece caminhos de arquivos locais.
- Upload multipart aceita CSV, XLS, XLSX, XLSM e PDF (PDF apenas para
  armazenamento/encaminhamento; OCR continua externo).
- Filename, extensão, MIME, tamanho e assinatura básica são validados; o nome
  de storage é gerado pelo servidor e nunca deriva de path do cliente.
- SHA-256 é calculado antes da persistência de metadata.
- Planilhas são recebidas como bytes/base64 e tratadas somente como dados.
- Macros são ignoradas e fórmulas não são executadas.
- Limite interno de planilha: 5 MB, 20 sheets, 10.000 linhas por sheet e 200
  colunas.
- Limite do corpo HTTP JSON: 1 MB, incluindo o conteúdo base64.
- CSV: 10.000 linhas e 200 colunas.

## Testes

```bash
npm test
```

A suíte cobre contratos anteriores, modelo canônico, structured input, CSV,
XLS/XLSX/XLSM, OCR estruturado, normalização, provenance, Evidence, Findings,
readiness independente de Actions, resolução com e sem evidência, migrations,
persistência entre instâncias, rollback, concorrência, upload e identidade de
produto.

## Limitações atuais

- Sem autenticação ou isolamento entre organizações; atores já fazem parte do
  contrato de auditoria, mas ainda são declarados pelo chamador.
- Storage binário é filesystem local controlado, adequado ao MVP, sem object
  storage distribuído.
- A identidade de produto é estritamente determinística; não há fuzzy matching
  nem resolução assistida.
- O OCR continua externo.
- Não há classificação automática de NCM, LLM, ML ou previsão quantitativa.
- `quantitativePrediction` permanece `UNAVAILABLE` com motivo
  `INSUFFICIENT_HISTORICAL_DATA`.
