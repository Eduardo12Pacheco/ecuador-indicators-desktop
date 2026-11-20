import type { CSSProperties } from "react";

import styles from "./Skeleton.module.css";

/** Decorative loading placeholder; announces nothing to screen readers. */
export function Skeleton({
  width,
  height,
  className,
}: {
  readonly width?: number | string;
  readonly height?: number | string;
  readonly className?: string;
}) {
  const style: CSSProperties = {};
  if (width !== undefined) style.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === "number" ? `${height}px` : height;
  return (
    <span
      aria-hidden="true"
      className={[styles.skeleton, className].filter(Boolean).join(" ")}
      style={style}
    />
  );
}
