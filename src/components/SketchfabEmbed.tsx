"use client";

import clsx from "clsx";

import styles from "./SketchfabEmbed.module.css";

type SketchfabEmbedProps = {
  title: string;
  src: string;
  href: string;
  compact?: boolean;
  inert?: boolean;
};

export function SketchfabEmbed({
  title,
  src,
  href,
  compact = false,
  inert = false
}: SketchfabEmbedProps) {
  return (
    <div className={clsx(styles.shell, compact && styles.compact, inert && styles.inert)}>
      <iframe
        allow="autoplay; fullscreen; xr-spatial-tracking"
        className={styles.frame}
        loading="lazy"
        src={src}
        title={title}
      />
      <a className={styles.credit} href={href} rel="noreferrer" target="_blank">
        {title}
      </a>
    </div>
  );
}

