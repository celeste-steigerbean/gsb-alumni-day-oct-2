"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { FunctionCombobox } from "@/components/function-combobox";
import { Wordmark } from "@/components/wordmark";
import type { BoardPayload } from "@/lib/board-payload";
import { BUCKETS, bucketLabel, type BucketKey } from "@/lib/buckets";
import { TASK_MAX_LENGTH, TASK_MIN_LENGTH } from "@/lib/entries-constants";
import { FUNCTION_OPTIONS, displayFunctionLabel } from "@/lib/functions";
import { useLiveBoard } from "@/lib/use-live-board";
import { submitEntry, type SubmitResult } from "./actions";
import styles from "./submit.module.css";

type Props = { initial: BoardPayload };

/** Small counts read better as words in a sentence. */
const NUMBER_WORDS = ["zero", "one", "two", "three", "four", "five", "six"];
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1);
}

export function SubmitScreen({ initial }: Props) {
  const { payload, status, error: liveError, adopt } = useLiveBoard({ mode: "submit", initial });

  const [bucket, setBucket] = useState<BucketKey | null>(null);
  const [functionLabel, setFunctionLabel] = useState("");
  const [task, setTask] = useState("");
  const [error, setError] = useState<(SubmitResult & { ok: false }) | null>(null);
  const [ownIds, setOwnIds] = useState<string[]>(initial.ownIds);
  const [justAdded, setJustAdded] = useState(false);
  const [composing, setComposing] = useState(true);
  const [pending, startTransition] = useTransition();

  const formTopRef = useRef<HTMLDivElement>(null);
  const boardTopRef = useRef<HTMLDivElement>(null);

  const view = payload ?? initial;
  const required = view.required;
  const submitted = Math.max(ownIds.length, view.ownIds.length);
  const remaining = Math.max(0, required - submitted);
  const unlocked = view.unlocked || submitted >= required;

  // Server ownership wins once a live frame carries more than we know about.
  useEffect(() => {
    if (payload && payload.ownIds.length > ownIds.length) setOwnIds(payload.ownIds);
  }, [payload, ownIds.length]);

  // Once the quota is met, stop forcing the form open.
  useEffect(() => {
    if (unlocked && justAdded) setComposing(false);
  }, [unlocked, justAdded]);

  const taskLength = task.trim().length;
  const canSubmit =
    Boolean(bucket) &&
    functionLabel.trim().length > 0 &&
    taskLength >= TASK_MIN_LENGTH &&
    taskLength <= TASK_MAX_LENGTH &&
    !pending;

  /** For anyone staring at six choices with nothing coming. */
  const shuffle = useCallback(() => {
    const nextBucket = BUCKETS[Math.floor(Math.random() * BUCKETS.length)].key;
    const nextFunction = FUNCTION_OPTIONS[Math.floor(Math.random() * FUNCTION_OPTIONS.length)];
    setBucket(nextBucket === bucket && BUCKETS.length > 1 ? pickOther(bucket) : nextBucket);
    setFunctionLabel(nextFunction);
    setError(null);
  }, [bucket]);

  function pickOther(current: BucketKey): BucketKey {
    const others = BUCKETS.filter((b) => b.key !== current);
    return others[Math.floor(Math.random() * others.length)].key;
  }

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
      // The action already carries the current board. Show it now rather than
      // leaving a gap until the next frame arrives.
      adopt(result.payload);
      setOwnIds(result.payload.ownIds);
      setJustAdded(true);
      setBucket(null);
      setFunctionLabel("");
      setTask("");

      const done = result.payload.unlocked;
      requestAnimationFrame(() => {
        const target = done ? boardTopRef.current : formTopRef.current;
        target?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
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
        <Wordmark className={styles.mark} />
        <span className={styles.proofLabel}>
          Live
          <span className={styles.liveDot} data-status={status} aria-hidden="true" />
        </span>
      </header>

      <h1 className={styles.title}>Six things this technology is good at</h1>
      <p className={styles.lede}>
        {unlocked
          ? "You are in. Here is everything the room has put up, updating as it arrives."
          : `Add ${numberWord(required)} tasks from your own company. A few words each is plenty. The whole board opens on the last one.`}
      </p>

      {/* Progress ------------------------------------------------------- */}
      <section className={styles.slots} aria-label="Your three tasks">
        <h2 className={styles.slotsTitle}>
          {unlocked ? `Your ${numberWord(submitted)} tasks` : `Your three tasks`}
        </h2>
        <ol className={styles.slotList}>
          {Array.from({ length: Math.max(required, submitted) }, (_, index) => {
            const entry = view.ownEntries[index];
            return (
              <li
                key={index}
                className={styles.slot}
                data-filled={entry ? "true" : "false"}
                data-next={!entry && index === submitted ? "true" : "false"}
              >
                <span className={styles.slotMark} aria-hidden="true">
                  {entry ? "\u2713" : index + 1}
                </span>
                {entry ? (
                  <span className={styles.slotBody}>
                    <span className={styles.slotMeta}>
                      {bucketLabel(entry.bucket)}
                      {" / "}
                      {displayFunctionLabel(entry.function_label)}
                    </span>
                    <span className={styles.slotTask}>{entry.task}</span>
                  </span>
                ) : (
                  <span className={styles.slotEmpty}>
                    {index === submitted ? "Add this one next" : "Not yet"}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </section>

      {/* Proof ---------------------------------------------------------- */}
      <section className={styles.proof} aria-label="Board so far">
        <div className={styles.proofHead}>
          <span className={styles.proofCount}>{view.total}</span>
          <span className={styles.proofLabel}>
            {view.total === 1 ? "Task on the board" : "Tasks on the board"}
          </span>
        </div>

        {/* Samples exist to prove the board is real. Once someone has added
            their own, that job is done and repeating them is just noise. */}
        {!unlocked && submitted === 0 ? (
          view.samples.length > 0 ? (
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
          )
        ) : null}
      </section>

      {liveError && status === "stalled" ? (
        <p className={styles.offline}>
          Not connected to the board right now. Your phone keeps trying, so leave this open.
        </p>
      ) : null}

      <div ref={formTopRef} />

      {composing ? (
        <form onSubmit={handleSubmit} noValidate>
          {justAdded && !unlocked ? (
            <p className={styles.added}>
              {remaining === 1
                ? `That is ${numberWord(submitted)}. One more and the whole board opens.`
                : `That is ${numberWord(submitted)}. ${capitalize(numberWord(remaining))} more to go.`}
            </p>
          ) : null}

          <button type="button" className={styles.shuffle} onClick={shuffle}>
            Stuck? Shuffle a starting point
          </button>

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
            {pending
              ? "Sending"
              : unlocked
                ? "Add another"
                : `Add task ${Math.min(submitted + 1, required)} of ${required}`}
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
          {!composing ? (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.actionButton}
                onClick={() => {
                  setComposing(true);
                  setJustAdded(false);
                  requestAnimationFrame(() =>
                    formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
                  );
                }}
              >
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
                        <li key={entry.id} className={styles.card} data-own={own ? "true" : "false"}>
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
