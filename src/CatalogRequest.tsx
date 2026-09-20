import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
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
import {
  getPublicCatalogRequest,
  saveCatalogProduct,
  startCatalogRequest,
  submitCatalogRequest,
  type PublicCatalogRequest,
} from "./features/catalog-request/api/catalogRequestApi";
import { ThemeToggle } from "./theme";
import { playUISound } from "./utils/uiSounds";
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

export function CatalogRequestFlow({ token }: { token: string }) {
  const [request, setRequest] = useState<PublicCatalogRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [index, setIndex] = useState(0);
  const [sending, setSending] = useState(false);
  const [correctionValue, setCorrectionValue] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    getPublicCatalogRequest(token)
      .then((value) => mounted && setRequest(value))
      .catch((value) => mounted && setError(value))
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [token]);

  if (loading) return <RequestShell><div className="req-card"><p className="req-eyebrow">SOLICITAÇÃO DE PREENCHIMENTO</p><h1>Carregando solicitação…</h1><p className="req-intro">Validando o link e preparando os produtos autorizados.</p></div></RequestShell>;
  if (error || !request) return <RequestShell><div className="req-card"><p className="req-eyebrow">SOLICITAÇÃO DE PREENCHIMENTO</p><h1>{(error as any)?.code === "REQUEST_EXPIRED" ? "Este link expirou." : "Link indisponível"}</h1><p className="req-intro">{error?.message ?? "Esta solicitação não foi encontrada."}</p><a className="button button--dark" href="/">Voltar ao início</a></div></RequestShell>;

  const products = request.products;
  const start = () => {
    setSending(true);
    startCatalogRequest(token).then(setRequest).then(() => setIndex(0)).catch((e) => { setError(e); playUISound("error"); }).finally(() => setSending(false));
  };
  const save = (values: Record<string, string>) => {
    const product = products[index];
    setSending(true);
    saveCatalogProduct(token, product.id, values).then((next) => { setRequest(next); showToast("Progresso salvo. Você pode continuar pelo mesmo link."); playUISound("save"); }).catch((e) => { showToast(e.message); playUISound("error"); }).finally(() => setSending(false));
  };
  const next = (values: Record<string, string>) => {
    const product = products[index];
    setSending(true);
    saveCatalogProduct(token, product.id, values)
      .then((nextRequest) => {
        setRequest(nextRequest);
        if (index < products.length - 1) { setIndex(index + 1); return; }
        return submitCatalogRequest(token).then((submitted) => { setRequest(submitted); playUISound("submit"); });
      })
      .catch((e) => { showToast(e.message); playUISound("error"); })
      .finally(() => setSending(false));
  };
  const done = request.status === "submitted" || request.status === "completed";
  if (done) return <RequestShell><motion.div className="req-card req-done" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}><motion.span className="req-check" initial={{ scale: 0 }} animate={{ scale: 1 }}><Glyph name="check" size={24} /></motion.span><h1>Tudo certo.</h1><p className="req-intro">Informações enviadas para revisão.</p><ul>{products.map((product) => <li key={product.id}><span>{product.name}</span><Glyph name="check" size={15} /></li>)}</ul><p className="req-note">O despachante poderá revisar as informações agora.</p><div className="req-actions req-actions--center"><a className="button button--light" href="/">Voltar ao início</a></div></motion.div></RequestShell>;
  if (request.status === "waiting") return <RequestShell><motion.div className="req-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}><p className="req-eyebrow">SOLICITAÇÃO DE PREENCHIMENTO</p><h1>{request.company.name}</h1><p className="req-intro">{request.requestedBy.name ?? "Seu despachante"} solicitou algumas informações para completar seu catálogo de produtos.</p><div className="req-count">{products.length} produto{products.length > 1 ? "s" : ""} precisam da sua atenção.</div><div className="req-meta"><div><span>Solicitação</span><strong>#{request.id}</strong></div><div><span>Prazo</span><strong>{fmtDate(request.expiresAt)}</strong></div><div><span>Solicitado por</span><strong>{request.requestedBy.name}</strong></div></div><button className="button button--dark" disabled={sending} onClick={start}>Começar preenchimento <Glyph name="arrow" size={17} /></button><p className="req-note"><Glyph name="file" size={14} /> Este link permite acesso somente aos produtos incluídos.</p></motion.div></RequestShell>;
  const product = products[index];
  const correctionAttribute = product.attributes.find((attribute) => Boolean(attribute.note));
  if (request.kind === "correction" && correctionAttribute) return <RequestShell><motion.div className="req-card" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}><p className="req-eyebrow">CORREÇÃO SOLICITADA</p><h1>{product.name}</h1><p className="req-intro">{correctionAttribute.label}</p><div className="req-observer-note"><strong>Observação do despachante:</strong><p>{correctionAttribute.note}</p></div><label className="req-field"><span>Novo valor *</span><input value={correctionValue} onChange={(event) => setCorrectionValue(event.target.value)} /></label><div className="req-actions" style={{ justifyContent: "flex-end" }}><button className="button button--dark" disabled={sending || !correctionValue.trim()} onClick={() => next({ [correctionAttribute.key]: correctionValue })}>Salvar correção <Glyph name="arrow" size={16} /></button></div></motion.div></RequestShell>;
  return <RequestShell><motion.div className="req-card req-card--catalog" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}><CatalogBatchForm products={products} sending={sending} onSave={async (draft) => { setSending(true); try { const updates = await Promise.all(Object.entries(draft).map(([productId, attributes]) => saveCatalogProduct(token, productId, attributes))); setRequest(updates.at(-1) ?? request); showToast("Progresso salvo. Você pode continuar pelo mesmo link."); playUISound("save"); } catch (e) { showToast(e instanceof Error ? e.message : "Não foi possível salvar."); playUISound("error"); } finally { setSending(false); } }} onSubmit={async (draft) => { setSending(true); try { const updates = await Promise.all(Object.entries(draft).map(([productId, attributes]) => saveCatalogProduct(token, productId, attributes))); const submitted = await submitCatalogRequest(token); setRequest(submitted ?? updates.at(-1) ?? request); playUISound("submit"); } catch (e) { showToast(e instanceof Error ? e.message : "Preencha os campos obrigatórios."); playUISound("warning"); } finally { setSending(false); } }} /></motion.div></RequestShell>;
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
  sending,
}: {
  product: Product;
  onNext: (values: Record<string, string>) => void;
  isLast: boolean;
  onSaveLater: (values: Record<string, string>) => void;
  sending: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(product.attributes.map((a) => [a.key, a.value])),
  );
  const [showErrors, setShowErrors] = useState(false);
  const missing = product.attributes.filter((a) => !a.value.trim());
  const missingRequired = product.attributes.filter(
    (a) => a.required && !(values[a.key] ?? "").trim(),
  );
  const handleNext = () => {
    if (missingRequired.length > 0) {
      setShowErrors(true);
      showToast("Preencha os campos obrigatórios para continuar");
      playUISound("warning");
      return;
    }
    onNext(values);
  };
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
      {missing.map((a) => {
        const hasError =
          showErrors && a.required && !(values[a.key] ?? "").trim();
        return (
          <label
            className={hasError ? "req-field is-error" : "req-field"}
            key={a.key}
          >
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
        );
      })}
      <div className="req-why">
        <Glyph name="spark" size={16} />
        <div>
          <strong>Por que estamos pedindo isso?</strong>
          Esses atributos são necessários para complementar as informações
          relacionadas à NCM {product.ncm}.
        </div>
      </div>
      <div className="req-actions">
        <button
          className="button button--light"
          disabled={sending}
          onClick={() => onSaveLater(values)}
        >
          Salvar e continuar depois
        </button>
        <button
          className="button button--dark"
          disabled={sending}
          onClick={handleNext}
        >
          {sending
            ? "Enviando…"
            : isLast
              ? "Enviar para revisão"
              : "Próximo produto"}{" "}
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

function CatalogBatchForm({
  products,
  sending,
  onSave,
  onSubmit,
}: {
  products: Product[];
  sending: boolean;
  onSave: (draft: Record<string, Record<string, string>>) => Promise<void>;
  onSubmit: (draft: Record<string, Record<string, string>>) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Record<string, Record<string, string>>>(() =>
    Object.fromEntries(products.map((product) => [product.id, Object.fromEntries(product.attributes.map((attribute) => [attribute.key, attribute.value]))])),
  );
  const [showErrors, setShowErrors] = useState(false);
  const completenessOf = (product: Product) => {
    const value = Number.parseInt(product.completeness ?? "", 10);
    return Number.isFinite(value) ? value : productCompleteness(product);
  };
  const editableProducts = products;
  const requiredMissing = editableProducts.flatMap((product) => product.attributes.filter((attribute) => attribute.required && !(draft[product.id]?.[attribute.key] ?? "").trim()).map((attribute) => `${product.id}:${attribute.key}`));
  const update = (productId: string, key: string, value: string) => setDraft((current) => ({ ...current, [productId]: { ...current[productId], [key]: value } }));
  const submit = () => {
    if (requiredMissing.length) {
      setShowErrors(true);
      showToast("Preencha os campos obrigatórios antes de enviar para revisão.");
      playUISound("warning");
      return;
    }
    void onSubmit(draft);
  };
  return <div className="req-batch">
    <div className="req-batch-head">
      <div><h1>Complete o catálogo</h1><p>{products.length} produto{products.length > 1 ? "s" : ""} incluídos nesta solicitação.</p></div>
      <span className="imp-mini"><strong>{editableProducts.length}</strong> no catálogo</span>
    </div>
    {products.map((product) => {
      const fields = product.attributes;
      return <section className="req-batch-product" key={product.id}>
        <div className="req-form-product"><div><h2>{product.name}</h2><p>{product.sku} · NCM {product.ncm}</p></div><ImpMiniStatus percent={completenessOf(product)} /></div>
        {fields.length === 0 ? <p className="req-product-complete"><Glyph name="check" size={15} /> Este produto já está completo. Nenhuma informação adicional é necessária.</p> : fields.map((attribute) => {
          const hasError = showErrors && attribute.required && !(draft[product.id]?.[attribute.key] ?? "").trim();
          return <label className={hasError ? "req-field is-error" : "req-field"} key={attribute.key}><span>{attribute.label}{attribute.required ? " *" : ""}</span>{attribute.note && <small>{attribute.note}</small>}<input value={draft[product.id]?.[attribute.key] ?? ""} onChange={(event) => update(product.id, attribute.key, event.target.value)} placeholder={`Adicionar ${attribute.label.toLowerCase()}`} /></label>;
        })}
      </section>;
    })}
    <div className="req-actions req-batch-actions"><button className="button button--light" disabled={sending} onClick={() => void onSave(draft)}>{sending ? "Salvando…" : "Salvar rascunho"}</button><button className="button button--dark" disabled={sending} onClick={submit}>{sending ? "Enviando…" : "Enviar para revisão"} <Glyph name="arrow" size={16} /></button></div>
  </div>;
}

function CorrectionForm({
  product,
  request,
  sending,
  onDone,
}: {
  product: Product;
  request: CatalogRequest;
  sending: boolean;
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
          disabled={sending}
          onClick={() => {
            updateProductAttribute(product.id, fieldKey, value);
            if (correction) {
              resolveCorrection(product.id, correction.id, value);
            }
            onDone();
          }}
        >
          {sending ? "Enviando…" : "Salvar correção"}{" "}
          <Glyph name="arrow" size={16} />
        </button>
      </div>
    </div>
  );
}

function LegacyCatalogRequestFlow({ token }: { token: string }) {
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
  const [sending, setSending] = useState(false);

  // Token inválido/inexistente: feedback de erro (som + tela).
  useEffect(() => {
    if (!request) playUISound("error");
  }, [request]);

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
      // Pequena espera simulada + loading antes do envio final.
      setSending(true);
      window.setTimeout(() => {
        submitRequest(token);
        setStage("done");
      }, 650);
    }
  };

  const finishCorrection = () => {
    setSending(true);
    window.setTimeout(() => {
      submitRequest(token);
      setStage("done");
    }, 650);
  };

  const saveLater = (values: Record<string, string>) => {
    const product = scopedProducts[index];
    Object.entries(values).forEach(([key, value]) => {
      updateProductAttribute(product.id, key, value);
    });
    // Simulação: em produção, um e-mail de lembrete seria agendado aqui.
    showToast("Progresso salvo. Você pode continuar pelo mesmo link.");
    playUISound("save");
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
          <motion.span
            className="req-check"
            initial={{ scale: 0, rotate: -14 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.05 }}
          >
            <Glyph name="check" size={24} />
          </motion.span>
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
                sending={sending}
                onDone={finishCorrection}
              />
            ) : (
              <MissingFieldsForm
                product={product}
                isLast={index === scopedProducts.length - 1}
                sending={sending}
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
