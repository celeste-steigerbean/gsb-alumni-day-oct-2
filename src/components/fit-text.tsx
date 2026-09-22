"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * How long a first fit waits for the brand font before settling for the
 * stand-in. Fitting in the stand-in and again when Montserrat lands shows as a
 * visible jump; waiting forever on slow wifi shows as empty boxes.
 */
const FONT_WAIT_MS = 800;

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
    // Hidden until this first runs (see the stylesheet). The server sends the
    // text at a default size, and showing it would mean every note visibly
    // snapping to its real size a moment after the page appears.
    el.dataset.fit = "";
  }, [min, max]);

  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;

    let frame = 0;
    let live = true;
    // Nothing re-fits until the first fit has happened on purpose. A
    // ResizeObserver reports once the moment it starts watching, and letting
    // that through would size the text in the stand-in font straight away,
    // which is the very jump the wait below exists to avoid.
    let armed = false;
    const first = () => {
      if (!live || armed) return;
      armed = true;
      fit();
    };
    // Coalesce to one measurement per frame: a page turn resizes every note.
    const schedule = () => {
      if (!armed) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => live && fit());
    };

    // The box, for a resize or a page turn. The text itself too: when the brand
    // font arrives after the first fit, Montserrat sets wider than the stand-in
    // it was measured in, the words overflow, and the box has not changed size
    // so nothing else would notice. That is how text ended up cut off on a
    // first visit over real wifi and never locally, where fonts load at once.
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(host);
    observer?.observe(el);

    const fonts = typeof document === "undefined" ? undefined : document.fonts;
    fonts?.addEventListener?.("loadingdone", schedule);

    // Fit now if the brand font is in, which is nearly always. If it is still
    // on its way, give it a moment so the text appears once, at its real size,
    // in its real font; after that, fit in the stand-in and re-fit on arrival.
    let wait = 0;
    if (!fonts || fonts.status === "loaded") {
      first();
    } else {
      wait = window.setTimeout(first, FONT_WAIT_MS);
    }
    fonts?.ready?.then(() => {
      window.clearTimeout(wait);
      if (armed) schedule();
      else first();
    });

    return () => {
      live = false;
      window.clearTimeout(wait);
      cancelAnimationFrame(frame);
      observer?.disconnect();
      fonts?.removeEventListener?.("loadingdone", schedule);
    };
  }, [fit, text]);

  return (
    <span ref={ref} className={className}>
      {text}
    </span>
  );
}
