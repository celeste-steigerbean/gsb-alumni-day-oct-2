import type { BucketKey } from "./buckets";

export type SeedExample = {
  bucket: BucketKey;
  functionLabel: string;
  task: string;
};

/**
 * Inspiration for the matrix before the room fills it.
 *
 * Four per task type, spread across functions so the grid shows breadth
 * rather than a stripe. One plain sentence each, no full stop, written the way
 * somebody in the room would type it on a phone: either the ask itself or who
 * does the work by hand today.
 *
 * Added in batches from the dashboard, so the board can be salted lightly
 * before the doors open and topped up if the room is slow to start.
 */
export const SEED_EXAMPLES: SeedExample[] = [
  // MONITOR ---------------------------------------------------------------
  {
    bucket: "MONITOR",
    functionLabel: "Compliance",
    task: "An analyst skims four agency feeds every Monday for rules that touch our devices",
  },
  {
    bucket: "MONITOR",
    functionLabel: "Sales",
    task: "Reps find out a key account changed its pricing when the customer mentions it",
  },
  {
    bucket: "MONITOR",
    functionLabel: "Finance",
    task: "We only catch a cost line that jumped five percent at month end",
  },
  {
    bucket: "MONITOR",
    functionLabel: "Board and governance",
    task: "Our secretary checks once a year for board members appearing on other boards",
  },

  // SYNTHESIZE ------------------------------------------------------------
  {
    bucket: "SYNTHESIZE",
    functionLabel: "Marketing",
    task: "An associate reads all thirty customer interviews to write the themes memo",
  },
  {
    bucket: "SYNTHESIZE",
    functionLabel: "Research",
    task: "Pull a year of field notes into what actually changed",
  },
  {
    bucket: "SYNTHESIZE",
    functionLabel: "HR and people",
    task: "We read a sample of the four hundred engagement survey comments",
  },
  {
    bucket: "SYNTHESIZE",
    functionLabel: "Customer success",
    task: "Find the five things that keep breaking in this quarter's support tickets",
  },

  // RESTRUCTURE -----------------------------------------------------------
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Strategy",
    task: "A partner turns the offsite notes into a one-page plan on the flight home",
  },
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Operations",
    task: "Turn our runbook into a checklist a new hire can follow",
  },
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Communications",
    task: "We write the same update three times for the board, staff and press",
  },
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Product",
    task: "Our PM writes the spec from memory the morning after a customer call",
  },

  // RECONCILE -------------------------------------------------------------
  {
    bucket: "RECONCILE",
    functionLabel: "Finance",
    task: "Two analysts match the CRM pipeline to the billing ledger every Friday",
  },
  {
    bucket: "RECONCILE",
    functionLabel: "IT",
    task: "Find people in payroll who aren't in the access directory",
  },
  {
    bucket: "RECONCILE",
    functionLabel: "Legal",
    task: "Compare the signed contract against the template we sent",
  },
  {
    bucket: "RECONCILE",
    functionLabel: "Supply chain",
    task: "Match supplier invoices against what the warehouse received",
  },

  // PRESSURE TEST ---------------------------------------------------------
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Corporate development",
    task: "Argue the seller side of our acquisition thesis",
  },
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Strategy",
    task: "Tell us why the three-year plan fails",
  },
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Fundraising",
    task: "Ask the questions a skeptical donor would ask before the pitch",
  },
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Engineering",
    task: "Poke holes in the architecture before we spend two quarters building it",
  },

  // EVALUATE --------------------------------------------------------------
  {
    bucket: "EVALUATE",
    functionLabel: "Fundraising",
    task: "Score grant applications against our published rubric",
  },
  {
    bucket: "EVALUATE",
    functionLabel: "HR and people",
    task: "Screen two hundred job applications against the spec",
  },
  {
    bucket: "EVALUATE",
    functionLabel: "Operations",
    task: "Rate vendor proposals against our selection criteria",
  },
  {
    bucket: "EVALUATE",
    functionLabel: "Compliance",
    task: "Our reviewer spot checks drafts against policy before they go out",
  },
];

/** How many go in per click of the dashboard button. */
export const SEED_BATCH_SIZE = 6;
