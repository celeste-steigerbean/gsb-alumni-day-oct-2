"use client";

import { useEffect, useId, useRef, useState } from "react";

import { BUCKETS, bucketHelper, bucketLabel, type BucketKey } from "@/lib/buckets";
import styles from "./function-combobox.module.css";

type Props = {
  value: BucketKey | null;
  onChange: (value: BucketKey) => void;
  invalid?: boolean;
};

/**
 * Task type picker. Same control as the function field on purpose: six stacked
 * cards pushed the rest of the form off the screen on a phone, and two
 * identical dropdowns are one thing to learn instead of two.
 */
export function BucketSelect({ value, onChange, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [open]);

  function choose(key: BucketKey) {
    onChange(key);
    setOpen(false);
    setActiveIndex(-1);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, BUCKETS.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(BUCKETS[activeIndex].key);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.trigger}
        data-filled={value ? "true" : "false"}
        data-open={open ? "true" : "false"}
        style={invalid ? { borderColor: "var(--gold)" } : undefined}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          setOpen((current) => !current);
          setActiveIndex(-1);
        }}
        onKeyDown={onKeyDown}
      >
        {value ? (
          <span className={styles.triggerStack}>
            <span className={styles.triggerName}>{bucketLabel(value)}</span>
            <span className={styles.triggerHelper}>{bucketHelper(value)}</span>
          </span>
        ) : (
          <span>Choose a kind of task</span>
        )}
        <span className={styles.caret} aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      {open ? (
        <div className={styles.panel}>
          <ul className={styles.list} id={listboxId} role="listbox" aria-label="Kind of task">
            {BUCKETS.map((definition, index) => (
              <li key={definition.key} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={definition.key === value}
                  data-active={index === activeIndex ? "true" : "false"}
                  data-selected={definition.key === value ? "true" : "false"}
                  className={`${styles.option} ${styles.optionStack}`}
                  onClick={() => choose(definition.key)}
                >
                  <span className={styles.optionName}>{definition.label}</span>
                  <span className={styles.optionHelper}>{definition.helper}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
