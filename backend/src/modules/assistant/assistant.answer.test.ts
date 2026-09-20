import assert from "node:assert/strict";
import test from "node:test";
import { answerFromCatalog, catalogScopeAnswer, type AssistantCatalogContext } from "./assistant.answer";

const context: AssistantCatalogContext = {
  company: { name: "TechImport Brasil" },
  products: [
    { name: "Notebook", ncm: "8471.30.19", completeness: "100%", status: "Ativo" },
    { name: "Tablet", ncm: "8471.30.19", completeness: "75%", status: "Em análise" },
    { name: "Smartphone", ncm: "8517.13.00", completeness: "50%", status: "Pendente" },
  ],
};

test("responde top NCM somente com dados do catálogo", () => {
  const answer = answerFromCatalog("top10 ncm", context);

  assert.match(answer, /8471\.30\.19 — 2 produtos/);
  assert.match(answer, /8517\.13\.00 — 1 produto/);
  assert.match(answer, /somente 2 NCMs distintas/);
  assert.match(answer, /não é um ranking do mercado brasileiro/i);
  assert.doesNotMatch(answer, /skills_ativas|prompts_prontos|success:\s*true/i);
});

test("lista produtos pendentes a partir do estado persistido", () => {
  const answer = answerFromCatalog("O que falta no meu catálogo?", context);

  assert.match(answer, /2 produtos que precisam de atenção/);
  assert.match(answer, /Tablet \(75%; Em análise\)/);
  assert.match(answer, /Smartphone \(50%; Pendente\)/);
});

test("declara o limite quando a pergunta não pode ser respondida localmente", () => {
  const answer = catalogScopeAnswer(context);

  assert.match(answer, /3 produtos/);
  assert.match(answer, /dados de mercado/i);
  assert.match(answer, /fonte externa apropriada/i);
});
