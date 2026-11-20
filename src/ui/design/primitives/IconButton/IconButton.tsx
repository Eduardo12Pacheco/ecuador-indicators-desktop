import { type ButtonHTMLAttributes, forwardRef, type ReactNode } from "react";

import styles from "./IconButton.module.css";

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Accessible name; icon-only controls must never be unlabelled. */
  readonly label: string;
  readonly variant?: "primary" | "ghost" | "danger";
  readonly size?: "md" | "sm";
  readonly children: ReactNode;
}

/** An icon-only button that always exposes `aria-label` and a tooltip title. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = "ghost", size = "md", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={[styles.button, styles[variant], styles[size], className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
});
