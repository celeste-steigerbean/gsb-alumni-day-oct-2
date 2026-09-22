"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Wordmark } from "@/components/wordmark";
import { signIn } from "./actions";
import styles from "./admin.module.css";

export function AdminGate({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className={styles.shell}>
      <main className={styles.gate}>
        <Wordmark className={styles.mark} />
        <h1 className={styles.gateTitle}>Session control</h1>
        <p className={styles.gateLede}>
          {configured
            ? "Enter the session password."
            : "ADMIN_PASSWORD is not set on this deployment. Add it in the project settings and redeploy."}
        </p>

        {configured ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                const result = await signIn(password);
                if (result.ok) {
                  setMessage(null);
                  router.refresh();
                } else {
                  setMessage(result.message ?? "That did not work.");
                }
              });
            }}
          >
            <label className="visually-hidden" htmlFor="admin-password">
              Password
            </label>
            <input
              id="admin-password"
              className={styles.gateInput}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <button type="submit" className={styles.gateButton} disabled={pending}>
              {pending ? "Checking" : "Open"}
            </button>
            {message ? (
            <p className={styles.gateError} role="alert">
              <span className={styles.errorMark} aria-hidden="true">{"\u26A0"}</span>
              <span>{message}</span>
            </p>
          ) : null}
          </form>
        ) : null}
      </main>
    </div>
  );
}
