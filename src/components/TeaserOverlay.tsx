"use client";

import clsx from "clsx";
import { motion } from "framer-motion";
import { Play, SkipForward } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import styles from "./TeaserOverlay.module.css";

const DEFAULT_TAGS = ["v1rtux", "C10_dk", "OllieReed", "N-hat", "Wond3r_"] as const;

const SQUAD_COMMENTS: Record<string, string> = {
  wond3r_: "Running on Dust II is better than running a half marathon.",
  c10_dk: "Boss, even on the map.",
  olliereed: "Legend. The only man able to stay sane when playing with Sø.",
  "n-hat": "Probably the nicest human on earth?",
  v1rtux: "Learn to play, noob."
};

const TEASER_STEPS = [
  {
    kicker: "Probably the most important day of Q1",
    title: ["20 map", "mayham"],
    body: "One stack, one control room, one place to track the whole FACEIT run.",
    focus: "v1rtux"
  },
  {
    kicker: "Pressure on the board",
    title: ["The elo train", "is rolling"],
    body: "Every queue adds weight. Every map adds story. The dashboard is built to make the climb feel inevitable.",
    focus: "C10_dk"
  },
  {
    kicker: "Composure check",
    title: ["Stay cold", "stay lethal"],
    body: "Map form, multi-kills, last-match pull and squad standing. The point is to know exactly who is hot.",
    focus: "OllieReed"
  },
  {
    kicker: "Squad folklore",
    title: ["Warm house", "hot server"],
    body: "This is not just stats. It is the brag board, the receipts and the post-game flex layer for the full stack.",
    focus: "N-hat"
  },
  {
    kicker: "Launch sequence",
    title: ["Get ready", "for the war room"],
    body: "High-level first. Detailed breakdowns below. Click through, open the dashboard and let the queue begin.",
    focus: "Wond3r_"
  }
] as const;

type TeaserOverlayProps = {
  onClose: () => void;
  trackedNicknames?: string[];
};

function normalizeNickname(value: string) {
  return value.trim().toLowerCase();
}

export function TeaserOverlay({ onClose, trackedNicknames = [] }: TeaserOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [replaySeed, setReplaySeed] = useState(0);
  const lastStepIndex = TEASER_STEPS.length - 1;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeydown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === " " || event.key === "Enter" || event.key === "ArrowRight") {
        event.preventDefault();
        if (stepIndex >= lastStepIndex) {
          onClose();
          return;
        }

        setStepIndex((current) => Math.min(current + 1, lastStepIndex));
      }
    }

    window.addEventListener("keydown", onKeydown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeydown);
    };
  }, [lastStepIndex, onClose, stepIndex]);

  const visibleTags = useMemo(() => {
    const preferred = trackedNicknames.length > 0 ? trackedNicknames.slice(0, 5) : [...DEFAULT_TAGS];
    return preferred.map((tag) => ({
      nickname: tag,
      comment: SQUAD_COMMENTS[normalizeNickname(tag)] ?? "Ready for the next FACEIT pull."
    }));
  }, [trackedNicknames]);

  const activeStep = TEASER_STEPS[stepIndex];
  const orderedVisibleTags = [...visibleTags].sort((left, right) => {
    const leftIndex = DEFAULT_TAGS.findIndex((tag) => normalizeNickname(tag) === normalizeNickname(left.nickname));
    const rightIndex = DEFAULT_TAGS.findIndex((tag) => normalizeNickname(tag) === normalizeNickname(right.nickname));
    return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) - (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
  });
  const activeComment =
    orderedVisibleTags.find((entry) => normalizeNickname(entry.nickname) === normalizeNickname(activeStep.focus)) ??
    orderedVisibleTags[Math.min(stepIndex, orderedVisibleTags.length - 1)] ??
    visibleTags[0];
  const progress = (stepIndex + 1) / TEASER_STEPS.length;

  function nextStep() {
    if (stepIndex >= lastStepIndex) {
      onClose();
      return;
    }

    setStepIndex((current) => Math.min(current + 1, lastStepIndex));
  }

  function resetTeaser() {
    setReplaySeed((current) => current + 1);
    setStepIndex(0);
  }

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className={styles.overlay}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
    >
      <div className={styles.clickLayer} key={replaySeed} onClick={nextStep} role="presentation">
        <div className={styles.stage}>
          <div className={styles.halo} />
          <div className={styles.lane} />
          <div className={styles.sideRailLeft} />
          <div className={styles.sideRailRight} />
          <div className={styles.tracerOne} />
          <div className={styles.tracerTwo} />
          <div className={styles.tracerThree} />
          <div className={styles.grid} />
          <div className={styles.noise} />

          <div className={styles.hudTop}>
            <span>Faceit War Room</span>
            <span>
              Step {stepIndex + 1}/{TEASER_STEPS.length}
            </span>
          </div>

          <div className={styles.sideLabelLeft}>Q1 // 20 MAPS</div>
          <div className={styles.sideLabelRight}>ELO TRAIN // LIVE</div>

          <div className={styles.heroBlock}>
            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className={styles.kicker}
              initial={{ opacity: 0, y: 18 }}
              key={`kicker-${stepIndex}`}
              transition={{ duration: 0.24 }}
            >
              {activeStep.kicker}
            </motion.p>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className={styles.titleBlock}
              initial={{ opacity: 0, y: 20 }}
              key={`title-${stepIndex}`}
              transition={{ duration: 0.28 }}
            >
              <h2>{activeStep.title[0]}</h2>
              <h2>{activeStep.title[1]}</h2>
            </motion.div>

            <motion.p
              animate={{ opacity: 1, y: 0 }}
              className={styles.body}
              initial={{ opacity: 0, y: 12 }}
              key={`body-${stepIndex}`}
              transition={{ duration: 0.24, delay: 0.03 }}
            >
              {activeStep.body}
            </motion.p>

            <div className={styles.statRow}>
              <div className={styles.statTile}>
                <span>Quarter 1 target</span>
                <strong>20 maps</strong>
              </div>
              <div className={styles.statTile}>
                <span>Dashboard mode</span>
                <strong>Live squad intel</strong>
              </div>
              <div className={styles.statTile}>
                <span>Gaming newer dies</span>
                <strong>Maps, elo, multikills</strong>
              </div>
            </div>
          </div>

          <div className={styles.rosterPanel}>
            <div className={styles.tagCloud}>
              {orderedVisibleTags.map((entry) => (
                <span
                  key={entry.nickname}
                  className={clsx(
                    styles.tag,
                    normalizeNickname(entry.nickname) === normalizeNickname(activeComment.nickname) && styles.tagActive
                  )}
                >
                  {entry.nickname}
                </span>
              ))}
            </div>

            <motion.div
              animate={{ opacity: 1, y: 0 }}
              className={styles.rosterCard}
              initial={{ opacity: 0, y: 14 }}
              key={`comment-${stepIndex}`}
              transition={{ duration: 0.26 }}
            >
              <span>Squad note</span>
              <strong>{activeComment.nickname}</strong>
              <p>{activeComment.comment}</p>
            </motion.div>
          </div>

          <div className={styles.bottomBand}>
            <div className={styles.timelineCopy}>
              <span>Click to continue</span>
              <span>Map by map tracking</span>
              <span>Post-game brag board</span>
            </div>

            <div className={styles.controls}>
              <button
                aria-label="Replay teaser"
                className={styles.controlButton}
                onClick={(event) => {
                  event.stopPropagation();
                  resetTeaser();
                }}
                type="button"
              >
                <Play size={16} />
              </button>
              <button
                aria-label="Skip teaser"
                className={styles.controlButtonPrimary}
                onClick={(event) => {
                  event.stopPropagation();
                  onClose();
                }}
                type="button"
              >
                <SkipForward size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.progressTrack}>
        <motion.div
          animate={{ scaleX: progress }}
          className={styles.progressValue}
          initial={{ scaleX: 0 }}
          key={`progress-${stepIndex}-${replaySeed}`}
          style={{ transformOrigin: "left center" }}
          transition={{ duration: 0.22 }}
        />
      </div>
    </motion.div>
  );
}
