"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Text, sized to the box it is in.
 *
 * Used wherever a slot has a definite height and the alternative to shrinking
 * is cutting the sentence in half — which is the worst failure available to a
 * screen whose whole job is showing what people wrote.
 *
 * Binary search over whole pixels: about five reflows for a typical range, and
 * it only re-runs when the text or the box actually changes.
 *
 * The element it measures against is its own parent, so the parent needs a
 * definite height and `overflow: hidden`.
 */
export function FitText({
  text,
  min,
  max,
  className,
}: {
  text: string;
  min: number;
  max: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;

    let lo = min;
    let hi = max;
    let best = min;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      el.style.fontSize = `${mid}px`;
      if (host.scrollHeight <= host.clientHeight && host.scrollWidth <= host.clientWidth) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    el.style.fontSize = `${best}px`;
  }, [min, max]);

  useLayoutEffect(() => {
    fit();
    const host = ref.current?.parentElement;
    if (!host || typeof ResizeObserver === "undefined") return;
    // Coalesce to one measurement per frame: a page turn resizes every note.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    });
    observer.observe(host);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [fit, text]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
