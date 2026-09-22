"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Wordmark } from "@/components/wordmark";
import { signIn } from "./actions";
import styles from "./admin.module.css";

export function AdminGate({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // An empty field used to go to the server and come back as "That password
    // does not match", which is a wrong answer to a question nobody asked.
    if (!password) {
      setMessage("Type the session password, then press Open.");
      return;
    }

    startTransition(async () => {
      const result = await signIn(password);
      if (result.ok) {
        setMessage(null);
        router.refresh();
      } else {
        setMessage(result.message ?? "That did not work.");
      }
    });
  }

  return (
    <div className={styles.shell}>
      <main className={styles.gate}>
        <header className={styles.gateHead}>
          <Wordmark className={styles.mark} />
        </header>

        <div className={styles.gateBody}>
          <h1 className={styles.gateTitle}>Session control</h1>

          {configured ? (
            <>
              <p className={styles.gateLede}>
                The dashboard for this session. Everything the room submits, and the controls for
                the projected screens.
              </p>

              <form onSubmit={handleSubmit}>
                <label className={styles.gateLabel} htmlFor="admin-password">
                  Session password
                </label>
                <div className={styles.gateField}>
                  <input
                    id="admin-password"
                    className={styles.gateInput}
                    type={visible ? "text" : "password"}
                    autoComplete="current-password"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    enterKeyHint="go"
                    aria-invalid={message ? true : undefined}
                    aria-describedby={message ? "admin-password-error" : undefined}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      if (message) setMessage(null);
                    }}
                  />
                  {/* Typing a password you cannot see, on a phone, is the most
                      common way a sign-in fails. The toggle lets you check it. */}
                  <button
                    type="button"
                    className={styles.gateReveal}
                    aria-pressed={visible}
                    aria-controls="admin-password"
                    onClick={() => setVisible((current) => !current)}
                  >
                    {visible ? "Hide" : "Show"}
                  </button>
                </div>

                <button type="submit" className={styles.gateButton} disabled={pending}>
                  {pending ? "Checking" : "Open"}
                </button>

                {message ? (
                  <p className={styles.gateError} role="alert" id="admin-password-error">
                    <span className={styles.errorMark} aria-hidden="true">
                      {"⚠"}
                    </span>
                    <span>{message}</span>
                  </p>
                ) : null}
              </form>
            </>
          ) : (
            // Not a quiet line of grey: this is the reason nobody can get in.
            <p className={styles.gateError} role="status">
              <span className={styles.errorMark} aria-hidden="true">
                {"⚠"}
              </span>
              <span>
                ADMIN_PASSWORD is not set on this deployment. Add it in the Vercel project settings
                under Environment Variables, then redeploy.
              </span>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
