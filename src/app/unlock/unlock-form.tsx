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

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // The button is never dead on arrival, so an empty field is answered here
    // rather than by a control that looks broken.
    if (!code.trim()) {
      setMessage("Type the word from the slide at the front, then press Go in.");
      return;
    }

    startTransition(async () => {
      const result = await enterRoom(code);
      if (result.ok) {
        router.replace(next);
        router.refresh();
      } else {
        setMessage(result.message ?? "That did not work.");
      }
    });
  }

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Wordmark className={styles.mark} />
      </header>

      <div className={styles.body}>
        <div className={styles.intro}>
          <h1 className={styles.title}>Six things this technology is good at</h1>
          <p className={styles.lede}>
            Scan the code on the screen at the front and this step disappears. If the camera will
            not cooperate, type the word on the slide.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
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
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? "room-code-error" : undefined}
            value={code}
            onChange={(event) => {
              setCode(event.target.value);
              if (message) setMessage(null);
            }}
          />
          {/* Disabled only while the answer is in flight. A primary action that
              is greyed out before anyone has touched it reads as broken, and it
              cannot say why it will not work. */}
          <button type="submit" className={styles.button} disabled={pending}>
            {pending ? "Checking" : "Go in"}
          </button>
          {message ? (
            <p className={styles.error} role="alert" id="room-code-error">
              <span className={styles.errorMark} aria-hidden="true">{"⚠"}</span>
              <span>{message}</span>
            </p>
          ) : null}
        </form>
      </div>

      <p className={styles.footnote}>
        No name, no account, no email. Nothing you add is tied to you.
      </p>
    </main>
  );
}
