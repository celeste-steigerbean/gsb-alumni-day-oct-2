/** Shared limits. Kept free of server-only imports so client code can use them. */

export const TASK_MIN_LENGTH = 10;
export const TASK_MAX_LENGTH = 140;
export const RATE_LIMIT_PER_HOUR = 6;
/**
 * How many tasks a visitor adds before the full board opens to them. The
 * exercise is about naming your own work, so the price of seeing everyone
 * else's is naming three of yours.
 */
export const REQUIRED_SUBMISSIONS = 3;
export const SEED_COOKIE_ID = "seed-demo";
