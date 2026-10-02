import type { BucketKey } from "./buckets";

export type SeedExample = {
  bucket: BucketKey;
  functionLabel: string;
  task: string;
};

/**
 * Inspiration for the matrix before the room fills it.
 *
 * In rounds of six, one per click of the dashboard button: each round has one
 * example for every task type, each from a different function, so even the
 * first click fills a row of every kind instead of a stripe of one. Four
 * rounds, so four per task type in all. The order here is the order they go
 * in, so keep it in rounds.
 *
 * One plain sentence each, no full stop, written the way somebody in the room
 * would type it on a phone: either the ask itself or who does the work by hand
 * today.
 *
 * Added in batches from the dashboard, so the board can be salted lightly
 * before the doors open and topped up if the room is slow to start.
 */
export const SEED_EXAMPLES: SeedExample[] = [
  // Click 1 ------------------------------------------------------------------
  {
    bucket: "MONITOR",
    functionLabel: "Board and governance",
    task: "Our secretary checks once a year for board members appearing on other boards",
  },
  {
    bucket: "SYNTHESIZE",
    functionLabel: "Marketing",
    task: "An associate reads all thirty customer interviews to write the themes memo",
  },
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Communications",
    task: "We write the same update three times for the board, staff and press",
  },
  {
    bucket: "RECONCILE",
    functionLabel: "Finance",
    task: "Two analysts match the CRM pipeline to the billing ledger every Friday",
  },
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Corporate development",
    task: "Argue the seller side of our acquisition thesis",
  },
  {
    bucket: "EVALUATE",
    functionLabel: "HR and people",
    task: "Screen two hundred job applications against the spec",
  },

  // Click 2 ------------------------------------------------------------------
  {
    bucket: "MONITOR",
    functionLabel: "Compliance",
    task: "An analyst skims four agency feeds every Monday for rules that touch our devices",
  },
  {
    bucket: "SYNTHESIZE",
    functionLabel: "Customer success",
    task: "Find the five things that keep breaking in this quarter's support tickets",
  },
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Product",
    task: "Our PM writes the spec from memory the morning after a customer call",
  },
  {
    bucket: "RECONCILE",
    functionLabel: "Legal",
    task: "Compare the signed contract against the template we sent",
  },
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Strategy",
    task: "Tell us why the three-year plan fails",
  },
  {
    bucket: "EVALUATE",
    functionLabel: "Fundraising",
    task: "Score grant applications against our published rubric",
  },

  // Click 3 ------------------------------------------------------------------
  {
    bucket: "MONITOR",
    functionLabel: "Sales",
    task: "Reps find out a key account changed its pricing when the customer mentions it",
  },
  {
    bucket: "SYNTHESIZE",
    functionLabel: "Research",
    task: "Pull a year of field notes into what actually changed",
  },
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Operations",
    task: "Turn our runbook into a checklist a new hire can follow",
  },
  {
    bucket: "RECONCILE",
    functionLabel: "IT",
    task: "Find people in payroll who aren't in the access directory",
  },
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Engineering",
    task: "Poke holes in the architecture before we spend two quarters building it",
  },
  {
    bucket: "EVALUATE",
    functionLabel: "Compliance",
    task: "Our reviewer spot checks drafts against policy before they go out",
  },

  // Click 4 ------------------------------------------------------------------
  {
    bucket: "MONITOR",
    functionLabel: "Finance",
    task: "We only catch a cost line that jumped five percent at month end",
  },
  {
    bucket: "SYNTHESIZE",
    functionLabel: "HR and people",
    task: "We read a sample of the four hundred engagement survey comments",
  },
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Strategy",
    task: "A partner turns the offsite notes into a one-page plan on the flight home",
  },
  {
    bucket: "RECONCILE",
    functionLabel: "Supply chain",
    task: "Match supplier invoices against what the warehouse received",
  },
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Fundraising",
    task: "Ask the questions a skeptical donor would ask before the pitch",
  },
  {
    bucket: "EVALUATE",
    functionLabel: "Operations",
    task: "Rate vendor proposals against our selection criteria",
  },
];

/** How many go in per click of the dashboard button. */
export const SEED_BATCH_SIZE = 6;
