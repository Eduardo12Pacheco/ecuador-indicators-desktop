import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useT } from "../../../i18n/useT";
import styles from "./Toast.module.css";

export type ToastVariant = "info" | "success" | "danger";

export interface ToastInput {
  readonly title: string;
  readonly description?: string;
  readonly variant?: ToastVariant;
  readonly durationMs?: number;
}

interface ToastRecord extends ToastInput {
  readonly id: number;
  readonly title: string;
  readonly variant: ToastVariant;
  readonly durationMs: number;
}

interface ToastContextValue {
  readonly showToast: (input: ToastInput) => number;
  readonly dismissToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DEFAULT_DURATION_MS = 5000;

function ToastItem({
  toast,
  onDismiss,
}: {
  readonly toast: ToastRecord;
  readonly onDismiss: (id: number) => void;
}) {
  const { t } = useT();
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), toast.durationMs);
    return () => clearTimeout(timer);
  }, [paused, toast.id, toast.durationMs, onDismiss]);

  return (
    <article
      data-toast=""
      className={[
        styles.toast,
        toast.variant === "success" ? styles.success : "",
        toast.variant === "danger" ? styles.danger : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onMouseOver={() => setPaused(true)}
      onMouseOut={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div>
        <p className={styles.title}>{toast.title}</p>
        {toast.description ? <p className={styles.description}>{toast.description}</p> : null}
      </div>
      <button
        type="button"
        className={styles.dismiss}
        aria-label={t("primitive.toast.dismiss")}
        onClick={() => onDismiss(toast.id)}
      >
        <span aria-hidden="true">×</span>
      </button>
    </article>
  );
}

/** A polite, dismissible toast region with five-second default lifetime. */
export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const { t, tp } = useT();
  const [toasts, setToasts] = useState<readonly ToastRecord[]>([]);
  const sequence = useRef(0);

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((input: ToastInput) => {
    const id = sequence.current + 1;
    sequence.current = id;
    setToasts((current) => [
      ...current,
      {
        ...input,
        id,
        variant: input.variant ?? "info",
        durationMs: input.durationMs ?? DEFAULT_DURATION_MS,
      },
    ]);
    return id;
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({ showToast, dismissToast }),
    [showToast, dismissToast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        aria-label={t("primitive.toast.region")}
        className={styles.region}
      >
        {toasts.length > 0 ? (
          <span className={styles.visuallyHidden}>{tp("views.count", toasts.length)}</span>
        ) : null}
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/** Accesses the toast queue; throws outside `ToastProvider`. */
export function useToast(): ToastContextValue {
  const value = useContext(ToastContext);
  if (value === null) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return value;
}
