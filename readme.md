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
PDF/OCR | CSV | XLS/XLSX/XLSM | JSON | catálogo existente
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

## Testes

```bash
npm test
```

A suíte cobre ingestão, normalização, Evidence, reconciliation, Product
Identity, Findings, persistência, migrations, rollback, concorrência, upload,
CatalogRecord, qualidade, diff, recomendações, summary, exports e API.

## Limitações deliberadas do MVP

- autenticação e multi-tenancy não fazem parte deste milestone;
- storage binário é filesystem local;
- OCR continua externo;
- identidade é exata, sem fuzzy matching;
- não há ML, LLM, embeddings ou recomendação automática de NCM;
- não há integrações ERP/TMS, notificações ou workflow BPM;
- não há deployment cloud, Kafka, Redis ou microservices;
- valores ambíguos permanecem ambíguos para revisão humana.

O escopo funcional do MVP encerra aqui: ingestão, rastreabilidade, consolidação,
qualidade, recomendações e exportação prontas para demonstração e validação com
usuários reais.
