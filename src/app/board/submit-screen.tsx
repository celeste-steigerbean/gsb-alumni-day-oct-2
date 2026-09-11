"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { FunctionCombobox } from "@/components/function-combobox";
import type { BoardPayload } from "@/lib/board-payload";
import { BUCKETS, bucketLabel, type BucketKey } from "@/lib/buckets";
import { TASK_MAX_LENGTH, TASK_MIN_LENGTH } from "@/lib/entries-constants";
import { displayFunctionLabel } from "@/lib/functions";
import { useLiveBoard } from "@/lib/use-live-board";
import { submitEntry, type SubmitResult } from "./actions";
import styles from "./submit.module.css";

type Props = { initial: BoardPayload };

export function SubmitScreen({ initial }: Props) {
  const { payload, status, adopt } = useLiveBoard({ mode: "submit", initial });

  const [bucket, setBucket] = useState<BucketKey | null>(null);
  const [functionLabel, setFunctionLabel] = useState("");
  const [task, setTask] = useState("");
  const [error, setError] = useState<SubmitResult & { ok: false } | null>(null);
  const [ownIds, setOwnIds] = useState<string[]>(initial.ownIds);
  const [justSubmitted, setJustSubmitted] = useState<string | null>(null);
  const [composing, setComposing] = useState(initial.ownIds.length === 0);
  const [pending, startTransition] = useTransition();

  const formTopRef = useRef<HTMLDivElement>(null);
  const boardTopRef = useRef<HTMLDivElement>(null);

  const view = payload ?? initial;
  const unlocked = view.unlocked || ownIds.length > 0;

  // Server ownership wins once a live frame carries it.
  useEffect(() => {
    if (payload?.ownIds.length) setOwnIds(payload.ownIds);
  }, [payload]);

  const taskLength = task.trim().length;
  const canSubmit =
    Boolean(bucket) &&
    functionLabel.trim().length > 0 &&
    taskLength >= TASK_MIN_LENGTH &&
    taskLength <= TASK_MAX_LENGTH &&
    !pending;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!bucket) {
      setError({ ok: false, field: "bucket", message: "Pick one of the six task types." });
      return;
    }
    setError(null);

    startTransition(async () => {
      const result = await submitEntry({ bucket, functionLabel, task });
      if (!result.ok) {
        setError(result);
        return;
      }
      // The action already carries the unlocked board. Show it now rather
      // than leaving a gap until the next frame arrives.
      adopt(result.payload);
      setOwnIds(result.payload.ownIds);
      setJustSubmitted(result.entryId);
      setComposing(false);
      setBucket(null);
      setFunctionLabel("");
      setTask("");
      requestAnimationFrame(() => {
        boardTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function startAnother() {
    setComposing(true);
    setError(null);
    requestAnimationFrame(() => {
      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  const grouped = useMemo(() => {
    const entries = view.entries ?? [];
    return BUCKETS.map((definition) => ({
      key: definition.key,
      label: definition.label,
      items: entries.filter((entry) => entry.bucket === definition.key),
    }));
  }, [view.entries]);

  const ownSet = useMemo(() => new Set(ownIds), [ownIds]);

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <span className={`wordmark ${styles.mark}`}>
          Steiger Bean <span className="dot">&bull;</span>
        </span>
        <span className={styles.proofLabel}>
          Live
          <span
            className={styles.liveDot}
            data-status={status}
            aria-hidden="true"
          />
        </span>
      </header>

      <h1 className={styles.title}>Six things this technology is good at</h1>
      <p className={styles.lede}>
        Add one task from your own company. It appears on the screen at the front of the room.
      </p>

      <section className={styles.proof} aria-label="Board so far">
        <div className={styles.proofHead}>
          <span className={styles.proofCount}>{view.total}</span>
          <span className={styles.proofLabel}>
            {view.total === 1 ? "Task on the board" : "Tasks on the board"}
          </span>
        </div>

        {view.samples.length > 0 ? (
          <ul className={styles.proofList}>
            {view.samples.map((sample) => (
              <li key={sample.id} className={styles.proofItem}>
                <span className={styles.proofFunction}>
                  {displayFunctionLabel(sample.function_label)}
                  {" / "}
                  {bucketLabel(sample.bucket)}
                </span>
                {sample.task}
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.proofEmpty}>Nothing yet. Yours can be first.</p>
        )}
      </section>

      <div ref={formTopRef} />

      {composing ? (
        <form onSubmit={handleSubmit} noValidate>
          <section className={styles.step}>
            <div className={styles.stepHead}>
              <span className={styles.stepNumber}>1</span>
              <h2 className={styles.stepLabel}>Which kind of task</h2>
            </div>
            <div className={styles.buckets} role="radiogroup" aria-label="Task type">
              {BUCKETS.map((definition) => (
                <button
                  key={definition.key}
                  type="button"
                  role="radio"
                  aria-checked={bucket === definition.key}
                  data-selected={bucket === definition.key ? "true" : "false"}
                  className={styles.bucket}
                  onClick={() => {
                    setBucket(definition.key);
                    if (error?.field === "bucket") setError(null);
                  }}
                >
                  <span className={styles.bucketName}>{definition.label}</span>
                  <span className={styles.bucketHelper}>{definition.helper}</span>
                </button>
              ))}
            </div>
            {error?.field === "bucket" ? <p className={styles.error}>{error.message}</p> : null}
          </section>

          <section className={styles.step}>
            <div className={styles.stepHead}>
              <span className={styles.stepNumber}>2</span>
              <h2 className={styles.stepLabel}>Which function</h2>
            </div>
            <FunctionCombobox
              value={functionLabel}
              onChange={(next) => {
                setFunctionLabel(next);
                if (error?.field === "function") setError(null);
              }}
              invalid={error?.field === "function"}
            />
            {error?.field === "function" ? <p className={styles.error}>{error.message}</p> : null}
          </section>

          <section className={styles.step}>
            <div className={styles.stepHead}>
              <span className={styles.stepNumber}>3</span>
              <h2 className={styles.stepLabel}>The task</h2>
            </div>
            <label className="visually-hidden" htmlFor="task">
              Describe the task
            </label>
            <textarea
              id="task"
              className={styles.textarea}
              value={task}
              maxLength={TASK_MAX_LENGTH}
              placeholder="One sentence, and who does it by hand today"
              onChange={(event) => {
                setTask(event.target.value);
                if (error?.field === "task") setError(null);
              }}
            />
            <div className={styles.counter} data-over={taskLength > TASK_MAX_LENGTH}>
              <span>
                {taskLength < TASK_MIN_LENGTH
                  ? `${TASK_MIN_LENGTH - taskLength} more characters`
                  : "Ready"}
              </span>
              <span>
                {taskLength} / {TASK_MAX_LENGTH}
              </span>
            </div>
            {error?.field === "task" ? <p className={styles.error}>{error.message}</p> : null}
          </section>

          <button type="submit" className={styles.submit} disabled={!canSubmit}>
            {pending ? "Sending" : "Put it on the board"}
          </button>

          {error?.field === "form" ? <p className={styles.error}>{error.message}</p> : null}

          <p className={styles.footnote}>
            No name, no account, no email. The board shows the function and the task only.
          </p>
        </form>
      ) : null}

      <div ref={boardTopRef} />

      {unlocked ? (
        <>
          {justSubmitted ? (
            <section className={styles.thanks}>
              <h2 className={styles.thanksTitle}>That is on the board</h2>
              <p className={styles.thanksBody}>
                Look up. Your card is at the top of its column. Here is everything the room has
                put up so far.
              </p>
              {!composing ? (
                <div className={styles.actions}>
                  <button type="button" className={styles.actionButton} onClick={startAnother}>
                    Add another task
                  </button>
                </div>
              ) : null}
            </section>
          ) : !composing ? (
            <div className={styles.actions}>
              <button type="button" className={styles.actionButton} onClick={startAnother}>
                Add another task
              </button>
            </div>
          ) : null}

          {view.entries && view.entries.length > 0 ? (
            grouped.map((group) => (
              <section key={group.key}>
                <div className={styles.groupHead}>
                  <h2 className={styles.groupName}>{group.label}</h2>
                  <span className={styles.groupCount}>{group.items.length}</span>
                </div>
                {group.items.length === 0 ? (
                  <p className={styles.emptyGroup}>Nothing here yet</p>
                ) : (
                  <ul className={styles.cards}>
                    {group.items.map((entry) => {
                      const own = ownSet.has(entry.id);
                      return (
                        <li
                          key={entry.id}
                          className={styles.card}
                          data-own={own ? "true" : "false"}
                        >
                          <span className={styles.cardFunction}>
                            {displayFunctionLabel(entry.function_label)}
                            {own ? <span className={styles.ownTag}>Yours</span> : null}
                          </span>
                          <span className={styles.cardTask}>{entry.task}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            ))
          ) : (
            <p className={styles.footnote}>The board is empty. Yours will be the first card.</p>
          )}
        </>
      ) : null}
    </main>
  );
}
