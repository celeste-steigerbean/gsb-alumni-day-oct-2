"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

import {
  FUNCTION_OPTIONS,
  MAX_FUNCTION_LENGTH,
  suggestFunctionOption,
} from "@/lib/functions";
import styles from "./function-combobox.module.css";

type Props = {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
};

function matches(option: string, needle: string): boolean {
  if (!needle) return true;
  return option.toLowerCase().includes(needle.toLowerCase());
}

/**
 * Function picker. A plain select hides its options behind a native wheel that
 * is slow to scan on a phone, so this opens an inline list with a filter and
 * an escape hatch for anything the list does not cover.
 */
export function FunctionCombobox({ value, onChange, invalid }: Props) {
  const [open, setOpen] = useState(false);
  const [needle, setNeedle] = useState("");
  const [customMode, setCustomMode] = useState(false);
  const [customDraft, setCustomDraft] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);

  const wrapRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const listboxId = useId();

  const filtered = useMemo(
    () => FUNCTION_OPTIONS.filter((option) => matches(option, needle)),
    [needle],
  );

  const isPreloaded = useMemo(
    () => FUNCTION_OPTIONS.some((option) => option.toLowerCase() === value.trim().toLowerCase()),
    [value],
  );

  // Only a custom value gets a nudge, and only until the person waves it off.
  const suggestion = useMemo(() => {
    if (!value || isPreloaded || dismissedSuggestion) return null;
    return suggestFunctionOption(value);
  }, [value, isPreloaded, dismissedSuggestion]);

  // Opening a picker used to do nothing you could see: the list unfolds below
  // the trigger, and on a phone that put one option of six on screen, on a
  // laptop none at all. Bring the control to the top so its options have the
  // rest of the screen.
  useEffect(() => {
    if (!open) return;
    const wrap = wrapRef.current;
    if (!wrap) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const frame = requestAnimationFrame(() =>
      wrap.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [open]);

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

  useEffect(() => {
    if (customMode) customInputRef.current?.focus();
  }, [customMode]);

  function choose(option: string) {
    onChange(option);
    setOpen(false);
    setCustomMode(false);
    setNeedle("");
    setActiveIndex(-1);
    setDismissedSuggestion(false);
  }

  function commitCustom() {
    const trimmed = customDraft.trim().slice(0, MAX_FUNCTION_LENGTH);
    if (!trimmed) return;
    onChange(trimmed);
    setOpen(false);
    setCustomMode(false);
    setNeedle("");
    setDismissedSuggestion(false);
  }

  function onListKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0 && filtered[activeIndex]) {
      event.preventDefault();
      choose(filtered[activeIndex]);
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
        data-invalid={invalid ? "true" : "false"}
        aria-haspopup="listbox"
        aria-invalid={invalid || undefined}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          setOpen((current) => !current);
          setActiveIndex(-1);
        }}
      >
        <span>{value || "Choose a function"}</span>
        <span className={styles.caret} aria-hidden="true">
          {open ? "−" : "+"}
        </span>
      </button>

      {open ? (
        <div className={styles.panel}>
          {customMode ? (
            <div className={styles.customRow}>
              <label className="visually-hidden" htmlFor={`${listboxId}-custom`}>
                Your function
              </label>
              <input
                id={`${listboxId}-custom`}
                ref={customInputRef}
                className={styles.customInput}
                type="text"
                inputMode="text"
                autoComplete="off"
                maxLength={MAX_FUNCTION_LENGTH}
                placeholder="Type your function"
                value={customDraft}
                onChange={(event) => setCustomDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    commitCustom();
                  }
                  if (event.key === "Escape") setCustomMode(false);
                }}
              />
              <div className={styles.customActions}>
                <button type="button" className={styles.customButton} onClick={commitCustom}>
                  Use this
                </button>
                <button
                  type="button"
                  className={styles.customButton}
                  data-variant="quiet"
                  onClick={() => setCustomMode(false)}
                >
                  Back to list
                </button>
              </div>
            </div>
          ) : (
            <>
              <input
                className={styles.search}
                type="text"
                inputMode="search"
                autoComplete="off"
                placeholder="Filter the list"
                aria-label="Filter functions"
                value={needle}
                onChange={(event) => {
                  setNeedle(event.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={onListKeyDown}
              />

              <ul className={styles.list} id={listboxId} role="listbox" aria-label="Function">
                {filtered.map((option, index) => (
                  <li key={option} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={option === value}
                      data-active={index === activeIndex ? "true" : "false"}
                      data-selected={option === value ? "true" : "false"}
                      className={styles.option}
                      onClick={() => choose(option)}
                    >
                      <span>{option}</span>
                      <span className={styles.tick} aria-hidden="true">
                        {option === value ? "\u2713" : ""}
                      </span>
                    </button>
                  </li>
                ))}
                {filtered.length === 0 ? (
                  <li className={styles.empty}>Nothing matches. Add your own below.</li>
                ) : null}
              </ul>

              <button
                type="button"
                className={styles.addOwn}
                onClick={() => {
                  setCustomDraft(needle || (isPreloaded ? "" : value));
                  setCustomMode(true);
                }}
              >
                + Add your own
              </button>
            </>
          )}
        </div>
      ) : null}

      {suggestion ? (
        <div className={styles.suggestion}>
          <span>
            {`Close to `}
            <strong className={styles.suggestionName}>{suggestion}</strong>
            {`. Use that instead, or keep what you wrote.`}
          </span>
          <div className={styles.suggestionActions}>
            <button
              type="button"
              className={styles.suggestionButton}
              onClick={() => choose(suggestion)}
            >
              {`Use ${suggestion}`}
            </button>
            <button
              type="button"
              className={styles.suggestionButton}
              data-variant="quiet"
              onClick={() => setDismissedSuggestion(true)}
            >
              {`Keep ${value}`}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
