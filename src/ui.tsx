import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { AppNotification } from "./data";
import { Glyph } from "./icons";
import { dismissToast, useStoreState } from "./store";
import { toggleSound, useSoundEnabled } from "./utils/uiSounds";

/** Controle discreto de sons da interface, no padrão dos ícones do header. */
export function SoundToggle() {
  const soundOn = useSoundEnabled();
  return (
    <button
      aria-label="Sons da interface"
      title={`Sons da interface: ${soundOn ? "ativados" : "desativados"}`}
      onClick={toggleSound}
    >
      <Glyph name={soundOn ? "volume" : "volume-off"} />
    </button>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="ws-modal-backdrop"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className={`ws-modal${wide ? " ws-modal--wide" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 18, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ws-modal-head">
              <h2>{title}</h2>
              <button onClick={onClose} aria-label="Fechar">
                <Glyph name="close" size={16} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ToastHost() {
  const { toast } = useStoreState();
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => dismissToast(toast.id), 2500);
    return () => window.clearTimeout(timer);
  }, [toast?.id]);
  return (
    <div className="ws-toast-wrap" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast.id}
            className="ws-toast"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.97, filter: "blur(3px)" }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            <Glyph name="check" size={15} />
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Popover de notificações compartilhado entre Workspace (despachante) e
 * Portal (importador). Ao clicar em um item, a linha é preenchida com uma
 * animação (preto no tema claro / branco no tema escuro) e mostra
 * "abrindo . . ." sem alterar a altura do popover.
 */
export function NoticePopover({
  notifications,
  onNavigate,
}: {
  notifications: AppNotification[];
  onNavigate: (notification: AppNotification) => void;
}) {
  const [opening, setOpening] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );
  const handleClick = (notification: AppNotification) => {
    if (opening) return;
    setOpening(notification.id);
    timerRef.current = window.setTimeout(() => {
      onNavigate(notification);
    }, 220);
  };
  return (
    <div className="ws-popover notice">
      <h3>Notificações</h3>
      {notifications.slice(0, 4).map((n) => (
        <button
          className={opening === n.id ? "is-active" : ""}
          key={n.id}
          onClick={() => handleClick(n)}
        >
          <span className="ws-notice-text">{n.description}</span>
          {opening === n.id && (
            <small className="ws-notice-status">
              abrindo
              <i className="ws-notice-dots" aria-hidden="true" />
            </small>
          )}
        </button>
      ))}
      {notifications.length === 0 && (
        <p className="ws-popover-empty">Nenhuma notificação.</p>
      )}
    </div>
  );
}

type DropdownOption = string | readonly [string, string];

export function Dropdown({
  label,
  options,
  value,
  onChange,
  align = "left",
  triggerClass = "",
  menuClass = "",
  ariaLabel,
  chevronSize = 15,
  hideAllLabel = false,
}: {
  label?: string;
  options: readonly DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  align?: "left" | "right";
  triggerClass?: string;
  menuClass?: string;
  ariaLabel?: string;
  chevronSize?: number;
  /** Mostra só o label enquanto a primeira opção ("Todos") estiver ativa. */
  hideAllLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pairs = options.map((o) =>
    typeof o === "string" ? ([o, o] as [string, string]) : [o[0], o[1]],
  );
  const selected = pairs.find(([, v]) => v === value) ?? pairs[0];
  const isAll = value === pairs[0]?.[1];
  const triggerText = label
    ? hideAllLabel && isAll
      ? label
      : `${label}: ${selected?.[0] ?? value}`
    : (selected?.[0] ?? value);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return (
    <div className="ws-dropdown" ref={rootRef}>
      <button
        type="button"
        className={`ws-dropdown-trigger${triggerClass ? ` ${triggerClass}` : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span>{triggerText}</span>
        <Glyph name="chevron" size={chevronSize} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            className={`ws-menu${align === "right" ? " ws-menu--right" : ""}${menuClass ? ` ${menuClass}` : ""}`}
            role="listbox"
            aria-label={ariaLabel ?? label ?? "Opções"}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {pairs.map(([optionLabel, optionValue]) => (
              <button
                type="button"
                role="option"
                aria-selected={optionValue === value}
                key={optionValue}
                className={optionValue === value ? "is-selected" : ""}
                onClick={() => {
                  setOpen(false);
                  onChange(optionValue);
                }}
              >
                <span>{optionLabel}</span>
                {optionValue === value && <Glyph name="check" size={14} />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
