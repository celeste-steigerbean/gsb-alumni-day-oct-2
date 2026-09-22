"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { BucketSelect } from "@/components/bucket-select";
import { FunctionCombobox } from "@/components/function-combobox";
import { Wordmark } from "@/components/wordmark";
import type { BoardPayload } from "@/lib/board-payload";
import { BUCKETS, bucketLabel, bucketPrompt, type BucketKey } from "@/lib/buckets";
import { TASK_MAX_LENGTH, TASK_MIN_LENGTH } from "@/lib/entries-constants";
import { FUNCTION_OPTIONS, displayFunctionLabel, taskPrompt } from "@/lib/functions";
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

/** How long a newly arrived card keeps its entrance animation. */
const ARRIVAL_MS = 1_400;

export function SubmitScreen({ initial }: Props) {
  const { payload, status, error: liveError, adopt } = useLiveBoard({ mode: "submit", initial });

  const [bucket, setBucket] = useState<BucketKey | null>(null);
  const [functionLabel, setFunctionLabel] = useState("");
  const [task, setTask] = useState("");
  const [error, setError] = useState<(SubmitResult & { ok: false }) | null>(null);
  const [ownIds, setOwnIds] = useState<string[]>(initial.ownIds);
  const [justAdded, setJustAdded] = useState(false);
  const [composing, setComposing] = useState(true);
  const [showBoard, setShowBoard] = useState(false);
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

  // Mark cards that were not on the board a moment ago, so the reveal is
  // visibly live rather than a static list that happens to refresh.
  const [arriving, setArriving] = useState<Set<string>>(new Set());
  const seenRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!showBoard) return;
    const current = new Set((view.entries ?? []).map((entry) => entry.id));
    if (seenRef.current === null) {
      seenRef.current = current;
      return;
    }
    const fresh = new Set<string>();
    for (const id of current) if (!seenRef.current.has(id)) fresh.add(id);
    seenRef.current = current;
    if (fresh.size === 0) return;
    setArriving(fresh);
    const timer = window.setTimeout(() => setArriving(new Set()), ARRIVAL_MS);
    return () => window.clearTimeout(timer);
  }, [view.entries, showBoard]);

  const taskLength = task.trim().length;

  /** For anyone staring at the choices with nothing coming. */
  const shuffle = useCallback(() => {
    const others = bucket ? BUCKETS.filter((b) => b.key !== bucket) : BUCKETS;
    setBucket(others[Math.floor(Math.random() * others.length)].key);
    setFunctionLabel(FUNCTION_OPTIONS[Math.floor(Math.random() * FUNCTION_OPTIONS.length)]);
    setError(null);
  }, [bucket]);

  /** Put the step that needs attention back on screen. */
  function showStep(field: "bucket" | "function" | "task") {
    requestAnimationFrame(() => {
      document.getElementById(`step-${field}`)?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
      });
    });
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    // The button is never dead on arrival, so what is missing gets said out
    // loud here rather than left for somebody to work out from a grey button
    // that cannot explain itself.
    if (!bucket) {
      setError({ ok: false, field: "bucket", message: "Pick which kind of task this is." });
      showStep("bucket");
      return;
    }
    if (!functionLabel.trim()) {
      setError({ ok: false, field: "function", message: "Pick the function this sits in." });
      showStep("function");
      return;
    }
    if (taskLength < TASK_MIN_LENGTH) {
      setError({
        ok: false,
        field: "task",
        message:
          taskLength === 0
            ? "Write the task itself. A few words is plenty."
            : `A few more words, ${TASK_MIN_LENGTH - taskLength} characters at least.`,
      });
      showStep("task");
      return;
    }

    setError(null);

    startTransition(async () => {
      let result: SubmitResult;
      try {
        result = await submitEntry({ bucket, functionLabel, task });
      } catch {
        // A dropped connection, a redeploy mid-session, or a request the
        // server refused. Uncaught, this replaced the whole screen with "This
        // page couldn't load" and threw away what they had typed.
        setError({
          ok: false,
          field: "form",
          message:
            "That did not reach the board. Your words are still here. Check your connection, then press the button again.",
        });
        return;
      }
      if (!result.ok) {
        setError(result);
        return;
      }
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

  const ownSet = useMemo(() => new Set(ownIds), [ownIds]);
  const stream = view.entries ?? [];

  // The two choices above compose into the question asked in the task field,
  // so the prompt gets more specific the more they have told us.
  const prompt = useMemo(
    () => taskPrompt(bucket ? bucketPrompt(bucket) : null, functionLabel),
    [bucket, functionLabel],
  );

  return (
    <main className={styles.page}>
      <header className={styles.head}>
        <Wordmark className={styles.mark} />
        <span className={styles.live} data-status={status}>
          <span className={styles.liveDot} aria-hidden="true" />
          {status === "stalled" ? "Reconnecting" : "Live"}
        </span>
      </header>

      <h1 className={styles.title}>Six things this technology is good at</h1>
      <p className={styles.lede}>
        {unlocked
          ? "You are in. Open the board whenever you like, it keeps filling as the room adds more."
          : `Add ${numberWord(required)} tasks from your own company. A few words each is plenty. The whole board opens on the last one.`}
      </p>

      {/* Teaser. A count only: nobody sees anyone else's words until they
          have added their own three. */}
      <section className={styles.proof} aria-label="The room so far">
        <div className={styles.proofHead}>
          <span className={styles.proofCount}>{view.total}</span>
          <span className={styles.proofLabel}>
            {view.total === 1 ? "Task in" : "Tasks in"}
          </span>
        </div>
        <p className={styles.proofNote}>
          {view.people === 0
            ? "Nobody has gone yet. Yours can be first."
            : `From ${view.people} ${view.people === 1 ? "person" : "people"} in this room.`}
        </p>
      </section>

      {/* The three slots ------------------------------------------------- */}
      <section className={styles.slots} aria-label="Your three tasks">
        <h2 className={styles.slotsTitle}>
          {unlocked ? `Your ${numberWord(submitted)} tasks` : "Your three tasks"}
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
                <span className={styles.slotMark}>
                  <span aria-hidden="true">{entry ? "\u2713" : index + 1}</span>
                  <span className="visually-hidden">
                    {entry ? `Task ${index + 1}, added` : `Task ${index + 1}, not added yet`}
                  </span>
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

      {liveError && status === "stalled" ? (
        <p className={styles.offline} role="status">
          Not connected to the board right now. Your phone keeps trying, so leave this open.
        </p>
      ) : null}

      <div ref={formTopRef} />

      {composing ? (
        <form onSubmit={handleSubmit} noValidate>
          {justAdded && !unlocked ? (
            <p className={styles.added} role="status">
              {remaining === 1
                ? `That is ${numberWord(submitted)}. One more and the whole board opens.`
                : `That is ${numberWord(submitted)}. ${capitalize(numberWord(remaining))} more to go.`}
            </p>
          ) : null}

          <button type="button" className={styles.shuffle} onClick={shuffle}>
            Stuck? Fill these in for me
          </button>

          <section className={styles.step} id="step-bucket">
            <div className={styles.stepHead}>
              <span className={styles.stepNumber}>1</span>
              <h2 className={styles.stepLabel}>Which kind of task</h2>
            </div>
            <BucketSelect
              value={bucket}
              onChange={(next) => {
                setBucket(next);
                if (error?.field === "bucket") setError(null);
              }}
              invalid={error?.field === "bucket"}
            />
            {error?.field === "bucket" ? (
              <p className={styles.error} role="alert" id="err-bucket">
                <span className={styles.errorMark} aria-hidden="true">{"\u26A0"}</span>
                <span>{error.message}</span>
              </p>
            ) : null}
          </section>

          <section className={styles.step} id="step-function">
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
            {error?.field === "function" ? (
              <p className={styles.error} role="alert" id="err-function">
                <span className={styles.errorMark} aria-hidden="true">{"\u26A0"}</span>
                <span>{error.message}</span>
              </p>
            ) : null}
          </section>

          <section className={styles.step} id="step-task">
            <div className={styles.stepHead}>
              <span className={styles.stepNumber}>3</span>
              <h2 className={styles.stepLabel}>The task</h2>
            </div>
            {/* The question the two choices above compose into. It was the
                textarea's placeholder, which is the wrong place for anything
                worth reading: it disappears on the first keystroke. */}
            <p className={styles.prompt} id="task-prompt">
              {prompt ?? "What takes somebody hours by hand today?"}
            </p>
            <label className="visually-hidden" htmlFor="task">
              Your answer
            </label>
            <textarea
              id="task"
              className={styles.textarea}
              value={task}
              maxLength={TASK_MAX_LENGTH}
              aria-describedby={
                error?.field === "task" ? "task-prompt err-task" : "task-prompt task-count"
              }
              aria-invalid={error?.field === "task" || undefined}
              placeholder="A few words is plenty"
              onChange={(event) => {
                setTask(event.target.value);
                if (error?.field === "task") setError(null);
              }}
            />
            <div className={styles.counter} id="task-count">
              <span className={taskLength >= TASK_MIN_LENGTH ? styles.counterReady : undefined}>
                {taskLength < TASK_MIN_LENGTH
                  ? `${TASK_MIN_LENGTH - taskLength} more characters`
                  : "Long enough"}
              </span>
              <span>
                {taskLength} of {TASK_MAX_LENGTH}
              </span>
            </div>
            {error?.field === "task" ? (
              <p className={styles.error} role="alert" id="err-task">
                <span className={styles.errorMark} aria-hidden="true">{"\u26A0"}</span>
                <span>{error.message}</span>
              </p>
            ) : null}
          </section>

          <button type="submit" className={styles.submit} disabled={pending}>
            {pending
              ? "Sending"
              : unlocked
                ? "Add another"
                : `Add task ${Math.min(submitted + 1, required)} of ${required}`}
          </button>

          {error?.field === "form" ? (
              <p className={styles.error} role="alert" id="err-form">
                <span className={styles.errorMark} aria-hidden="true">{"\u26A0"}</span>
                <span>{error.message}</span>
              </p>
            ) : null}

          <p className={styles.footnote}>
            No name, no account, no email. The board shows the function and the task only.
          </p>
        </form>
      ) : null}

      <div ref={boardTopRef} />

      {unlocked ? (
        <section className={styles.reveal}>
          <button
            type="button"
            className={styles.revealButton}
            aria-expanded={showBoard}
            onClick={() => setShowBoard((current) => !current)}
          >
            {showBoard ? "Hide the board" : `Show the whole board (${view.total})`}
          </button>

          {!composing ? (
            <button
              type="button"
              className={styles.revealQuiet}
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
          ) : null}
        </section>
      ) : null}

      {unlocked && showBoard ? (
        <section aria-label="The whole board">
          <p className={styles.streamNote}>
            Newest first, updating as the room adds more.
          </p>
          {stream.length === 0 ? (
            <p className={styles.footnote}>The board is empty. Yours will be the first card.</p>
          ) : (
            <ul className={styles.cards}>
              {stream.map((entry) => {
                const own = ownSet.has(entry.id);
                return (
                  <li
                    key={entry.id}
                    className={`${styles.card} ${arriving.has(entry.id) ? styles.cardEnter : ""}`}
                    data-own={own ? "true" : "false"}
                  >
                    <span className={styles.cardFunction}>
                      {bucketLabel(entry.bucket)}
                      {" / "}
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
      ) : null}
    </main>
  );
}
