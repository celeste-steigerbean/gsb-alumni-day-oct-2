import styles from "./wordmark.module.css";

export const STEIGER_BEAN_URL = "https://steigerbean.com";

/**
 * The firm mark, linking out to the site. Used on every screen a person can
 * actually tap. The projected board renders its own plain text version, since
 * nobody clicks a wall.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <a
      className={`wordmark ${styles.link} ${className}`}
      href={STEIGER_BEAN_URL}
      target="_blank"
      rel="noopener noreferrer"
    >
      Steiger Bean <span className="dot">&bull;</span>
    </a>
  );
}
