"use client";

import styles from "./OperatorSpinner.module.css";

type OperatorSpinnerProps = {
  size?: "sm" | "md";
};

export function OperatorSpinner({ size = "md" }: OperatorSpinnerProps) {
  return (
    <span className={size === "sm" ? styles.shellSm : styles.shell} aria-hidden="true">
      <span className={styles.ring} />
      <span className={styles.operatorCt}>
        <span className={styles.head} />
        <span className={styles.visor} />
        <span className={styles.rifle} />
      </span>
      <span className={styles.operatorT}>
        <span className={styles.head} />
        <span className={styles.bandana} />
        <span className={styles.rifle} />
      </span>
    </span>
  );
}

