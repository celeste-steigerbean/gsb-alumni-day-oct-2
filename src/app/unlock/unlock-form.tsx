"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Wordmark } from "@/components/wordmark";
import { enterRoom } from "./actions";
import styles from "./unlock.module.css";

export function UnlockForm({ next }: { next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <main className={styles.page}>
      <Wordmark className={styles.mark} />

      <h1 className={styles.title}>Six things this technology is good at</h1>
      <p className={styles.lede}>
        Scan the code on the screen at the front and this step disappears. If the camera will not
        cooperate, type the word on the slide.
      </p>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          startTransition(async () => {
            const result = await enterRoom(code);
            if (result.ok) {
              router.replace(next);
              router.refresh();
            } else {
              setMessage(result.message ?? "That did not work.");
            }
          });
        }}
      >
        <label className={styles.label} htmlFor="room-code">
          Code from the slide
        </label>
        <input
          id="room-code"
          className={styles.input}
          type="text"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="Type it here"
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            if (message) setMessage(null);
          }}
        />
        <button type="submit" className={styles.button} disabled={pending || !code.trim()}>
          {pending ? "Checking" : "Go in"}
        </button>
        {message ? (
          <p className={styles.error} role="alert">
            <span className={styles.errorMark} aria-hidden="true">{"\u26A0"}</span>
            <span>{message}</span>
          </p>
        ) : null}
      </form>

      <p className={styles.footnote}>
        No name, no account, no email. Nothing you add is tied to you.
      </p>
    </main>
  );
}
