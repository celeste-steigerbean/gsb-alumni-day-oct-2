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
 * rather than a stripe. Each one names the manual work it replaces, because
 * that is the sentence the exercise is trying to get attendees to write.
 *
 * Added in batches from the dashboard, so the board can be salted lightly
 * before the doors open and topped up if the room is slow to start.
 */
export const SEED_EXAMPLES: SeedExample[] = [
  // MONITOR ---------------------------------------------------------------
  {
    bucket: "MONITOR",
    functionLabel: "Compliance",
    task: "Watch four agency feeds for rules touching our device class. An analyst skims them Monday.",
  },
  {
    bucket: "MONITOR",
    functionLabel: "Sales",
    task: "Flag when a named account changes its pricing page. Nobody checks until a rep notices.",
  },
  {
    bucket: "MONITOR",
    functionLabel: "Finance",
    task: "Tell me when any cost line moves more than five percent. We find it at month end.",
  },
  {
    bucket: "MONITOR",
    functionLabel: "Board and governance",
    task: "Watch for our directors appearing on other boards. Our secretary checks once a year.",
  },

  // SYNTHESIZE ------------------------------------------------------------
  {
    bucket: "SYNTHESIZE",
    functionLabel: "Marketing",
    task: "Turn thirty customer interviews into one themes memo. An associate reads every transcript.",
  },
  {
    bucket: "SYNTHESIZE",
    functionLabel: "Research",
    task: "Pull a year of field notes into one view of what changed. Nobody has the week it takes.",
  },
  {
    bucket: "SYNTHESIZE",
    functionLabel: "HR and people",
    task: "Find the themes across four hundred engagement survey comments. We read a sample.",
  },
  {
    bucket: "SYNTHESIZE",
    functionLabel: "Customer success",
    task: "Roll every support ticket this quarter into the five things that keep breaking.",
  },

  // RESTRUCTURE -----------------------------------------------------------
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Strategy",
    task: "Reshape the offsite notes into a one page plan. A partner does this on the flight home.",
  },
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Operations",
    task: "Turn a messy runbook into a checklist a new hire can follow on their first day.",
  },
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Communications",
    task: "Rewrite the same update for the board, the staff and the press. We write it three times.",
  },
  {
    bucket: "RESTRUCTURE",
    functionLabel: "Product",
    task: "Turn a customer call into a written spec. Our PM does it from memory the next morning.",
  },

  // RECONCILE -------------------------------------------------------------
  {
    bucket: "RECONCILE",
    functionLabel: "Finance",
    task: "Match the CRM pipeline against the billing ledger. Two analysts do it every Friday.",
  },
  {
    bucket: "RECONCILE",
    functionLabel: "IT",
    task: "Find the people in the payroll system who are not in the access directory.",
  },
  {
    bucket: "RECONCILE",
    functionLabel: "Legal",
    task: "Show where the signed contract differs from the template we thought we sent.",
  },
  {
    bucket: "RECONCILE",
    functionLabel: "Supply chain",
    task: "Compare what the supplier invoiced against what the warehouse actually received.",
  },

  // PRESSURE TEST ---------------------------------------------------------
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Business development",
    task: "Argue the seller side of our acquisition thesis. Two partners do this over dinner.",
  },
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Strategy",
    task: "Tell me why the three year plan fails. Nobody in the room wants to be that person.",
  },
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Fundraising",
    task: "Play the sceptical donor and ask the questions we have not rehearsed.",
  },
  {
    bucket: "PRESSURE_TEST",
    functionLabel: "Engineering",
    task: "Attack this architecture decision before we commit two quarters of build to it.",
  },

  // EVALUATE --------------------------------------------------------------
  {
    bucket: "EVALUATE",
    functionLabel: "Fundraising",
    task: "Score every inbound grant application against the rubric we published in March.",
  },
  {
    bucket: "EVALUATE",
    functionLabel: "HR and people",
    task: "Read two hundred applications against the job spec before a human sees the shortlist.",
  },
  {
    bucket: "EVALUATE",
    functionLabel: "Operations",
    task: "Rate each vendor response against our own criteria, consistently, at volume.",
  },
  {
    bucket: "EVALUATE",
    functionLabel: "Compliance",
    task: "Check every draft against the policy before it goes out. Our reviewer spot checks.",
  },
];

/** How many go in per click of the dashboard button. */
export const SEED_BATCH_SIZE = 6;
