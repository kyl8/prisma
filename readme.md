# PRISMA — inteligência e governança de catálogo

O PRISMA transforma documentos e cadastros de comércio exterior em informações
estruturadas, rastreáveis e confiáveis, identificando lacunas e inconsistências
para construir um catálogo de produtos mais completo, padronizado e seguro para
tomada de decisão.

O problema central não é a falta de documentos, mas a fragmentação dos dados:
descrições genéricas, fabricantes ausentes, modelos divergentes, identificadores
inconsistentes e classificações informadas sem evidência suficiente. O PRISMA
consolida essas fontes sem inventar valores e explica o motivo de cada resultado.

## Proposta de valor

Para cada produto, o PRISMA responde:

- o que é conhecido;
- de quais documentos e evidências a informação veio;
- o que continua ausente, conflitante ou não verificado;
- como o cadastro original difere da visão consolidada;
- quais revisões de saneamento são recomendadas;
- qual catálogo pode ser exportado para uso humano ou outro sistema.

Actions, Readiness e Decision permanecem disponíveis para fluxos operacionais,
mas não são pré-requisitos para produzir o catálogo consolidado.

## Arquitetura do MVP

```text
PDF/OCR | CSV | XLS/XLSX/XLSM | JSON | catálogo existente | Siscomex
                         ↓
                     Ingestion
                         ↓
                Canonical Document
                         ↓
                  Evidence Ledger
                         ↓
                 Product Identity
                         ↓
            Document Reconciliation
                         ↓
                Catalog Governance
                         ↓
                      Findings
                         ↓
              Catalog Consolidation
                         ↓
             Data Quality + Diff
                         ↓
                 Recommendations
                         ↓
               JSON | CSV | XLSX
```

Capacidades auxiliares: `OperationalCase`, SQLite, optimistic locking,
Timeline append-only, Readiness, Decision e Action Queue.

## Execução

Requisitos: Node.js 20+.

```bash
npm install
npm start
```

Configuração por ambiente:

```text
DATABASE_PATH=.prisma-data/prisma.db
UPLOAD_DIR=.prisma-data/uploads
MAX_UPLOAD_SIZE=5000000
PORT=3000
SISCOMEX_ENABLED=false
SISCOMEX_ENV=validation
SISCOMEX_ALLOW_PRODUCTION=false
SISCOMEX_ROLE_TYPE=IMPEXP
SISCOMEX_CLIENT_ID=
SISCOMEX_CLIENT_SECRET=
SISCOMEX_RESPONSIBLE_ROOT_ID=
SISCOMEX_CACHE_TTL_SECONDS=3600
SISCOMEX_TIMEOUT_MS=15000
SISCOMEX_MAX_SERVER_RETRIES=1
```

O runtime aplica migrations SQLite automaticamente. O repository em memória
continua disponível para testes unitários.

## Ingestão e formatos

São suportados:

- JSON estruturado;
- CSV;
- XLS, XLSX e XLSM;
- upload multipart;
- PDF para armazenamento/encaminhamento;
- saída estruturada de OCR externo.

O backend não executa OCR. Macros nunca são carregadas e fórmulas de planilha
são preservadas como texto `unverified`, sem avaliação.

Todo documento converge para o `CanonicalDocument`. Cada campo mantém valor
normalizado, valor bruto, status, método de extração e provenance como página,
sheet, linha e célula.

## Product Identity

O relacionamento é determinístico. A consolidação de catálogo aceita apenas
identificadores fortes exatos:

- SKU;
- part number;
- GTIN;
- supplier code;
- product code;
- chave externa explícita.

Descrição igual não é identidade. Model isolado também não autoriza merge do
catálogo. Itens sem chave confiável permanecem separados e geram Finding de
identidade insuficiente quando a reconciliação exigir associação.

## CatalogRecord

`CatalogRecord` é a saída central. Ele reúne:

- identificadores e cadastros originais relacionados;
- campos consolidados e atributos extensíveis;
- Evidence e fontes por campo;
- Data Quality Status e razões explícitas;
- Findings relacionados;
- recomendações de saneamento;
- documentos de origem;
- diff antes/depois.

Estados de campo:

```text
CONFIRMED
REPORTED
CONFLICTING
MISSING
UNVERIFIED
INSUFFICIENT_EVIDENCE
```

Regras principais:

- mesmo valor em fontes independentes → `CONFIRMED`;
- valor presente em uma fonte → `REPORTED`;
- valores distintos → `CONFLICTING`, sem escolha automática;
- ausência → `MISSING`;
- fórmula ou origem não verificável → `UNVERIFIED`;
- descrição genérica do cadastro, como `Pump`, pode ser substituída somente
  quando documentos independentes concordarem em uma descrição específica;
- a decisão fica registrada como `REPLACED_GENERIC_CATALOG_DESCRIPTION`.

## NCM

NCM é sempre conservadora. O PRISMA preserva a NCM informada, mas não inventa,
recomenda ou substitui classificação.

- sem evidência técnica de classificação → `UNVERIFIED`;
- com evidência declarada → `REPORTED`;
- valores divergentes → `CONFLICTING`;
- ausência → `MISSING`.

O MVP nunca produz status `VALIDATED` para NCM.

## Integração read-only com o Portal Único Siscomex

O Siscomex é uma fonte oficial adicional. Ele não substitui silenciosamente
Invoice, Packing List, Datasheet ou catálogo local. Respostas oficiais viram
snapshots imutáveis e Evidence antes de participar da consolidação.

```text
CATP + Operador Estrangeiro + CADA + Classif
                    ↓
         Snapshot/cache SQLite
                    ↓
           Evidence oficial
                    ↓
        CatalogRecord + Findings
                    ↓
      Diff oficial + Recommendations
```

A integração é desabilitada por padrão. `validation` usa
`https://val.portalunico.siscomex.gov.br`. Produção exige simultaneamente
`SISCOMEX_ENABLED=true`, `SISCOMEX_ENV=production` e
`SISCOMEX_ALLOW_PRODUCTION=true`.
Até a consulta pública do Classif exige `SISCOMEX_ENABLED=true`, impedindo
tráfego externo acidental quando a integração está desabilitada.

### Contratos oficiais

Os contratos foram conferidos na documentação e nos Swagger atuais:

- [introdução, ambientes e protocolo de sessão](https://docs.portalunico.siscomex.gov.br/introducao-api-publica/);
- [Swagger de autenticação](https://docs.portalunico.siscomex.gov.br/api/plat/plat-auth.json);
- [Swagger do CATP](https://docs.portalunico.siscomex.gov.br/api/catp/catp.json);
- [Swagger do CADA](https://docs.portalunico.siscomex.gov.br/api/cada/cadatributos.json);
- [Swagger do Classif](https://docs.portalunico.siscomex.gov.br/api/clsf/classif.json);
- [limites de acesso](https://docs.portalunico.siscomex.gov.br/pages/limites-acesso/).

Autenticação por chave de acesso usa exclusivamente o contrato oficial:

```text
POST /portal/api/autenticar/chave-acesso
Client-Id
Client-Secret
Role-Type

response headers:
Set-Token
X-CSRF-Token
X-CSRF-Expiration
```

JWT, CSRF e chaves permanecem apenas na camada de integração. A sessão renova
os tokens devolvidos pelo servidor, respeita expiração, serializa o uso do CSRF
rotativo e permite somente uma reautenticação depois de `401`.

Chamadas externas utilizadas:

```text
GET /catp/api/ext/produto
GET /catp/api/ext/produto/:cpfCnpjRaiz/:codigo/:versao
GET /catp/api/ext/produto/exportar/:cpfCnpjRaiz/:exibirDesativados
GET /catp/api/ext/operador-estrangeiro
GET /catp/api/ext/operador-estrangeiro/:cpfCnpjRaiz/:pais/:codigo/:versao
GET /cadatributos/api/ext/atributo-ncm/:ncm
GET /classif/api/publico/nomenclatura/download/json
```

Nenhum `POST`, `PUT` ou `DELETE` de negócio do CATP é exposto. Versões de
produto e operador são tratadas como strings, inclusive `1`, `1.0` e `1.1`.

O Swagger atual do CADA descreve os DTOs de atributo, mas omite o schema da
resposta `200` na consulta por NCM. O Swagger do Classif também não declara o
schema do download JSON. A resposta pública atual do ambiente de validação usa
`Nomenclaturas`, `Codigo`, `Descricao`, `Data_Inicio` e `Data_Fim`; somente
esses dados observados são mapeados. Todos os mappers preservam `rawPayload`, e
campos desconhecidos não são promovidos ao domínio.

### Cache, snapshots e indisponibilidade

`siscomex_snapshots` é append-only e guarda ambiente, subsistema, chave do
recurso, produto/caso relacionado, payload, SHA-256, versão externa e datas.
Um payload diferente cria novo histórico; payload idêntico reutiliza o snapshot.
`siscomex_cache_entries` registra apenas a última verificação do recurso sem
alterar o snapshot histórico. `siscomex_sync_runs` registra resultado e erro
sanitizado de cada sincronização manual.

Estados de cache: `FRESH`, `STALE` e `UNAVAILABLE`.

Se a API estiver indisponível e houver snapshot anterior, o PRISMA usa a última
resposta como `STALE`, preserva `fetchedAt` e continua a análise local. Erros
`500/503` recebem apenas retry curto e limitado. `PUCX-ER1001`/rate limit não é
repetido automaticamente.

### API interna Siscomex

```text
GET  /api/prisma/integrations/siscomex/status
POST /api/prisma/integrations/siscomex/test
POST /api/prisma/cases/:id/siscomex/sync
GET  /api/prisma/cases/:id/siscomex/catalog
GET  /api/prisma/cases/:id/siscomex/diff
GET  /api/prisma/siscomex/attributes/:ncm
GET  /api/prisma/siscomex/ncm/:ncm
```

Exemplo de sincronização manual:

```json
{
  "productId": "wine",
  "responsibleRootId": "12345678",
  "productCode": "0000000001",
  "version": "1",
  "foreignOperator": {
    "country": "FR",
    "code": "OPE_2",
    "version": "1"
  }
}
```

A consulta de NCM verifica somente existência e dados oficiais da NCM informada.
O campo `classificationAssigned` permanece `false`; o PRISMA não classifica a
mercadoria automaticamente.

## Data Quality

Estados globais do registro:

```text
COMPLETE
PARTIAL
CONFLICTING
INSUFFICIENT_DATA
REQUIRES_REVIEW
```

Não existe score percentual. O status é acompanhado por razões factuais como
`manufacturer_conflict`, `model_missing` e `reportedNcm_unverified`. A política
de campos essenciais pode ser configurada em
`metadata.catalogPolicy.essentialFields`.

O summary agrega apenas contagens: produtos por estado e principais tipos de
problema.

## Antes e depois

```text
ANTES
Descrição: Pump
Fabricante: -
Modelo: -
NCM: 8413.70
Origem: -

DEPOIS DO PRISMA
Descrição: Industrial Centrifugal Pump XP400 (CONFIRMED)
Fabricante: ABC Machinery Ltd. (CONFIRMED)
Modelo: XP400 (CONFIRMED)
Part Number: XP400-A (CONFIRMED)
NCM informada: 8413.70 (UNVERIFIED)
Origem: China (REPORTED)
```

O diff separa campos adicionados, alterados, inalterados, conflitantes e
ausentes, além de contagens factuais de enriquecimento e não verificação.

## Recomendações

Recommendations são derivadas de Findings e dos estados dos campos. Elas
apontam campo, motivo, prioridade, Findings e Evidence relacionados. Exemplos:

- confirmar fabricante conflitante;
- adicionar part number ausente;
- revisar NCM informada;
- fornecer identificador forte;
- revisar registros aparentemente duplicados.

Recommendation não cria obrigação de workflow. A Action Queue é opcional.

## API principal de catálogo

```text
GET /api/prisma/cases/:id/catalog
GET /api/prisma/cases/:id/catalog/diff
GET /api/prisma/cases/:id/catalog/:productId
GET /api/prisma/cases/:id/catalog/export?format=json
GET /api/prisma/cases/:id/catalog/export?format=csv
GET /api/prisma/cases/:id/catalog/export?format=xlsx
```

Exemplo resumido:

```json
{
  "productId": "catalog-xp400",
  "qualityStatus": "REQUIRES_REVIEW",
  "fields": {
    "manufacturer": {
      "value": "ABC Machinery Ltd.",
      "status": "CONFIRMED",
      "evidenceIds": ["evidence-10", "evidence-24"],
      "sources": [
        { "documentId": "invoice-demo", "documentItemId": "invoice-demo:item:1" },
        { "documentId": "datasheet-demo", "documentItemId": "datasheet-demo:item:1" }
      ]
    }
  },
  "recommendations": [
    {
      "field": "reportedNcm",
      "type": "REVIEW_CLASSIFICATION"
    }
  ]
}
```

O XLSX exporta três sheets: `Catalog`, `Evidence` e `Findings`. CSV e XLSX usam
uma visão própria e não expõem estruturas internas ou caminhos de storage.

Todos os endpoints legados de ingestão, Evidence, Findings, Actions, Readiness,
Decision, upload e validação de catálogo permanecem compatíveis.

## Demo

O arquivo `fixtures/catalog-demo.json` contém:

- um cadastro genérico de bomba enriquecido por Invoice, Packing List e
  Datasheet;
- um segundo produto com fabricantes conflitantes, mantido sem solução
  inventada.

O teste ponta a ponta cria o caso, analisa documentos, produz os dois
`CatalogRecord`, compara antes/depois e valida JSON, CSV e XLSX.

## Persistência, auditoria e concorrência

- SQLite local e transacional;
- migrations reproduzíveis;
- `OperationalCase.version` com optimistic locking;
- `If-Match` obsoleto retorna `409 CASE_VERSION_CONFLICT`;
- Evidence e Timeline append-only, protegidas também por triggers;
- eventos guardam ator, timestamp, metadata e versão do caso;
- upload possui SHA-256 e idempotência conservadora.

## Segurança

- filename, extensão, MIME, tamanho e assinatura básica são verificados;
- paths do cliente nunca são usados como destino;
- binários não são executados;
- macros e fórmulas não são executadas;
- respostas de exportação não incluem `storageKey` ou path local;
- erros HTTP não expõem stack trace.
- credenciais Siscomex existem somente em variáveis de ambiente;
- JWT, CSRF, access keys, certificados e passphrases são redigidos;
- TLS nunca é desabilitado e o cliente não aceita host arbitrário;
- o frontend nunca recebe headers ou respostas de autenticação.

## Testes

```bash
npm test
```

A suíte cobre ingestão, normalização, Evidence, reconciliation, Product
Identity, Findings, persistência, migrations, rollback, concorrência, upload,
CatalogRecord, qualidade, diff, recomendações, summary, exports, auth Siscomex,
JWT/CSRF, retries, rate limit, CATP, operador estrangeiro, CADA, snapshots,
cache, Evidence oficial e API.

## Limitações deliberadas do MVP

- autenticação dos usuários do PRISMA e multi-tenancy não fazem parte deste milestone;
- storage binário é filesystem local;
- OCR continua externo;
- identidade é exata, sem fuzzy matching;
- não há ML, LLM, embeddings ou recomendação automática de NCM;
- não há integrações ERP/TMS, notificações ou workflow BPM;
- não há write-back no CATP, DUIMP ou LPCO;
- não há scheduler, webhook ou sincronização incremental automática;
- certificado A1/A3 não é carregado neste milestone; o runtime usa chaves de
  acesso oficiais, cujo contrato atual foi confirmado;
- esta branch não contém fonte frontend versionada; a demonstração Siscomex é
  feita pela API interna;
- não há deployment cloud, Kafka, Redis ou microservices;
- valores ambíguos permanecem ambíguos para revisão humana.

O escopo funcional do MVP encerra aqui: ingestão, rastreabilidade, consolidação,
qualidade, recomendações e exportação prontas para demonstração e validação com
usuários reais.
