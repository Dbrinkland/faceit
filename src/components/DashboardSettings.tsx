"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { Cog, Link2, ShieldCheck, Zap } from "lucide-react";
import { useState } from "react";

import styles from "./DashboardSettings.module.css";

type DashboardSettingsProps = {
  onReplayTeaser?: () => void;
  trackedNicknames: string[];
  sourceLabel: string;
};

export function DashboardSettings({ onReplayTeaser, trackedNicknames, sourceLabel }: DashboardSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <button
        aria-label="Open settings"
        aria-expanded={isOpen}
        className={clsx(styles.trigger, isOpen && styles.triggerOpen)}
        onClick={() => setIsOpen((current) => !current)}
        type="button"
      >
        <Cog size={16} />
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.aside
            animate={{ opacity: 1, y: 0 }}
            className={styles.panel}
            exit={{ opacity: 0, y: -10 }}
            initial={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className={styles.row}>
              <ShieldCheck size={16} />
              <div>
                <strong>Cache armor</strong>
                <p>Sidste gyldige snapshot bliver liggende, hvis en refresh fejler.</p>
              </div>
            </div>
            <div className={styles.row}>
              <Zap size={16} />
              <div>
                <strong>Refresh flow</strong>
                <p>Tryk refresh efter hver kamp for at hente ny sidste-kamp data og opdatere map-performance.</p>
              </div>
            </div>
            <div className={styles.row}>
              <Link2 size={16} />
              <div>
                <strong>Teaser link</strong>
                <p>Del `/?teaser=1` hvis du vil sende introen alene.</p>
              </div>
            </div>
            {onReplayTeaser ? (
              <button
                className={styles.panelButton}
                onClick={() => {
                  setIsOpen(false);
                  onReplayTeaser();
                }}
                type="button"
              >
                Replay teaser
              </button>
            ) : null}
            <div className={styles.metaBlock}>
              <span>Snapshot mode</span>
              <strong>{sourceLabel}</strong>
            </div>
            <div className={styles.metaBlock}>
              <span>Tracked tags</span>
              <div className={styles.tagList}>
                {trackedNicknames.map((nickname) => (
                  <span key={nickname}>{nickname}</span>
                ))}
              </div>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
