import type { HTMLAttributes, ReactNode } from "react";

import styles from "./Card.module.css";

export interface CardProps extends HTMLAttributes<HTMLElement> {
  readonly as?: "div" | "section" | "article";
  readonly children: ReactNode;
}

/** A surface panel; callers pick the landmark element when appropriate. */
export function Card({ as: Element = "div", className, children, ...rest }: CardProps) {
  return (
    <Element className={[styles.card, className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </Element>
  );
}
