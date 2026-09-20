import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { CatalogRequest, Product, users } from "./data";
import { Glyph } from "./icons";
import {
  fieldLabelOf,
  navigate,
  productsForRequest,
  productCompleteness,
  resolveCorrection,
  showToast,
  startRequest,
  submitRequest,
  updateProductAttribute,
  useStoreState,
} from "./store";
import { ThemeToggle } from "./theme";
import "./importer.css";

function fmtDate(iso: string): string {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function RequestShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="req-screen">
      <header className="req-top">
        <a className="req-brand" href="/">
          <span className="logo-mark">P</span> PRISMA
        </a>
        <ThemeToggle />
      </header>
      <main className="req-main">{children}</main>
    </div>
  );
}

function MissingFieldsForm({
  product,
  onNext,
  isLast,
  onSaveLater,
}: {
  product: Product;
  onNext: (values: Record<string, string>) => void;
  isLast: boolean;
  onSaveLater: (values: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.attributes.map((a) => [a.key, a.value])),
  );
  const missing = product.attributes.filter((a) => !a.value.trim());
  return (
    <div>
      <div className="req-form-product">
        <div>
          <h2>{product.name}</h2>
          <p>
            {product.sku} · NCM {product.ncm}
          </p>
        </div>
        <ImpMiniStatus percent={productCompleteness(product)} />
      </div>
      {missing.map((a) => (
        <label className="req-field" key={a.key}>
          <span>
            {a.label}
            {a.required ? " *" : ""}
          </span>
          <input
            value={values[a.key] ?? ""}
            onChange={(e) =>
              setValues((v) => ({ ...v, [a.key]: e.target.value }))
            }
            placeholder={`Adicionar ${a.label.toLowerCase()}`}
          />
        </label>
      ))}
      <div className="req-why">
        <Glyph name="spark" size={16} />
        <div>
          <strong>Por que estamos pedindo isso?</strong>
          Esses atributos são necessários para complementar as informações
          relacionadas à NCM {product.ncm}.
        </div>
      </div>
      <div className="req-actions">
        <button className="button button--light" onClick={() => onSaveLater(values)}>
          Salvar e continuar depois
        </button>
        <button className="button button--dark" onClick={() => onNext(values)}>
          {isLast ? "Enviar para revisão" : "Próximo produto"}{" "}
          <Glyph name="arrow" size={16} />
        </button>
      </div>
    </div>
  );
}

function ImpMiniStatus({ percent }: { percent: number }) {
  return (
    <span className="imp-mini">
      <strong>{percent}%</strong> completo
    </span>
  );
}

function CorrectionForm({
  product,
  request,
  onDone,
}: {
  product: Product;
  request: CatalogRequest;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const fieldKey = request.correctionFieldKey ?? "material";
  const correction = product.corrections.find(
    (c) => c.status === "open" && c.fieldKey === fieldKey,
  );
  return (
    <div>
      <div className="req-form-product">
        <div>
          <h2>Uma informação precisa ser corrigida</h2>
          <p>{product.name}</p>
        </div>
      </div>
      <div className="req-correction-box">
        <div className="req-meta">
          <div>
            <span>Produto</span>
            <strong>{product.name}</strong>
          </div>
          <div>
            <span>Campo</span>
            <strong>{fieldLabelOf(product, fieldKey)}</strong>
          </div>
          <div>
            <span>Valor informado</span>
            <strong>{correction?.currentValue ?? "—"}</strong>
          </div>
        </div>
        <div className="req-observer-note">
          <strong>Observação do despachante:</strong>
          <p>{correction?.note ?? request.correctionNote}</p>
        </div>
        <label className="req-field">
          <span>Novo valor *</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Informar ${fieldLabelOf(product, fieldKey).toLowerCase()}`}
          />
        </label>
      </div>
      <div className="req-actions" style={{ justifyContent: "flex-end" }}>
        <button
          className="button button--dark"
          onClick={() => {
            updateProductAttribute(product.id, fieldKey, value);
            if (correction) {
              resolveCorrection(product.id, correction.id, value);
            }
            onDone();
          }}
        >
          Salvar correção <Glyph name="arrow" size={16} />
        </button>
      </div>
    </div>
  );
}

export function CatalogRequestFlow({ token }: { token: string }) {
  const { requests, products } = useStoreState();
  const request = requests.find((r) => r.token === token);
  const [stage, setStage] = useState<"landing" | "form" | "done">(() =>
    request
      ? request.status === "submitted" || request.status === "completed"
        ? "done"
        : request.status === "in_progress"
          ? "form"
          : "landing"
      : "landing",
  );
  const [index, setIndex] = useState(0);

  if (!request) {
    return (
      <RequestShell>
        <div className="req-card">
          <p className="req-eyebrow">SOLICITAÇÃO DE PREENCHIMENTO</p>
          <h1>Link indisponível</h1>
          <p className="req-intro">
            Esta solicitação não foi encontrada ou já expirou. Peça ao seu
            despachante um novo link.
          </p>
          <a className="button button--dark" href="/">
            Voltar ao início
          </a>
        </div>
      </RequestShell>
    );
  }

  // Isolamento: somente produtos do companyId da solicitação E presentes em productIds.
  const scopedProducts = productsForRequest(request);
  const creator = users.find((u) => u.id === request.createdByUserId);
  const creatorName = creator?.name ?? "Seu despachante";
  const creatorTitle = creator?.title ?? "Despachante aduaneiro";
  const companyName =
    scopedProducts.length > 0
      ? scopedProducts[0].companyId === "atlas"
        ? "Atlas Importações"
        : scopedProducts[0].companyId === "ocean"
          ? "Ocean Trade"
          : "Sua empresa"
      : "Sua empresa";

  const begin = () => {
    startRequest(token);
    setStage("form");
    setIndex(0);
  };

  const handleProductDone = (values: Record<string, string>) => {
    const product = scopedProducts[index];
    Object.entries(values).forEach(([key, value]) => {
      updateProductAttribute(product.id, key, value);
    });
    if (index < scopedProducts.length - 1) {
      setIndex(index + 1);
    } else {
      submitRequest(token);
      setStage("done");
    }
  };

  const saveLater = (values: Record<string, string>) => {
    const product = scopedProducts[index];
    Object.entries(values).forEach(([key, value]) => {
      updateProductAttribute(product.id, key, value);
    });
    // Simulação: em produção, um e-mail de lembrete seria agendado aqui.
    showToast("Progresso salvo. Você pode continuar pelo mesmo link.");
  };

  if (stage === "landing") {
    return (
      <RequestShell>
        <motion.div
          className="req-card"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <p className="req-eyebrow">SOLICITAÇÃO DE PREENCHIMENTO</p>
          <h1>{companyName}</h1>
          <p className="req-intro">
            {creatorName} solicitou algumas informações para completar seu
            catálogo de produtos.
          </p>
          <div className="req-count">
            {scopedProducts.length} produto
            {scopedProducts.length > 1 ? "s" : ""}{" "}
            {scopedProducts.length > 1 ? "precisam" : "precisa"} da sua atenção.
          </div>
          <div className="req-meta">
            <div>
              <span>Solicitação</span>
              <strong>#{request.id}</strong>
            </div>
            <div>
              <span>Prazo</span>
              <strong>{fmtDate(request.expiresAt)}</strong>
            </div>
            <div>
              <span>Solicitado por</span>
              <strong>
                {creatorName}
                <small>
                  <br />
                  {creatorTitle}
                </small>
              </strong>
            </div>
          </div>
          <button className="button button--dark" onClick={begin}>
            Começar preenchimento <Glyph name="arrow" size={17} />
          </button>
          <p className="req-note">
            <Glyph name="file" size={14} /> Este link permite acesso somente aos
            produtos incluídos nesta solicitação.
          </p>
        </motion.div>
      </RequestShell>
    );
  }

  if (stage === "done") {
    return (
      <RequestShell>
        <motion.div
          className="req-card req-done"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="req-check">
            <Glyph name="check" size={24} />
          </span>
          <h1>Tudo certo.</h1>
          <p className="req-intro">Informações enviadas para revisão.</p>
          <ul>
            {scopedProducts.map((p) => (
              <li key={p.id}>
                <span>{p.name}</span>
                <Glyph name="check" size={15} />
              </li>
            ))}
          </ul>
          <p className="req-note">
            O despachante foi avisado e poderá revisar as informações.
          </p>
          <button
            className="button button--light"
            onClick={() => navigate("/app")}
          >
            Acessar minha conta no PRISMA
          </button>
        </motion.div>
      </RequestShell>
    );
  }

  const product = scopedProducts[index];
  if (!product) {
    return (
      <RequestShell>
        <div className="req-card">
          <h1>Nada para preencher.</h1>
          <p className="req-intro">
            Esta solicitação não possui produtos pendentes.
          </p>
          <a className="button button--dark" href="/">
            Voltar ao início
          </a>
        </div>
      </RequestShell>
    );
  }

  return (
    <RequestShell>
      <motion.div
        className="req-card req-form"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="req-steps-header">
          <p className="req-eyebrow">CATÁLOGO DE PRODUTOS</p>
          <div className="req-form-product">
            <div>
              <h2>
                {scopedProducts.length} produto
                {scopedProducts.length > 1 ? "s" : ""} para preencher
              </h2>
              <p>
                Produto {index + 1} de {scopedProducts.length}
              </p>
            </div>
          </div>
          <div className="req-progress">
            <b style={{ width: `${((index + 1) / scopedProducts.length) * 100}%` }} />
          </div>
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={product.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
          >
            {request.kind === "correction" ? (
              <CorrectionForm
                product={product}
                request={request}
                onDone={() => {
                  submitRequest(token);
                  setStage("done");
                }}
              />
            ) : (
              <MissingFieldsForm
                product={product}
                isLast={index === scopedProducts.length - 1}
                onNext={handleProductDone}
                onSaveLater={saveLater}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </RequestShell>
  );
}
