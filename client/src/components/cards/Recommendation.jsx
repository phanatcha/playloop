import { cx } from '../../lib/cx.js';
import styles from './Recommendation.module.css';

// Compact game row for the browse sidebar. Figma: Handoff / Recommendation (426:1598).
// When clickable, render the whole row as one link: `as={Link} to="/games/…"`.
export function Recommendation({
  title,
  metadata,
  coverSrc,
  coverAlt = '',
  as: Component = 'div',
  className,
  ...props
}) {
  return (
    <Component className={cx(styles.row, className)} {...props}>
      <img src={coverSrc} alt={coverAlt} width={56} height={56} className={styles.cover} />
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.metadata}>{metadata}</span>
      </span>
    </Component>
  );
}
