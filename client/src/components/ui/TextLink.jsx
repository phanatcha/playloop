import { cx } from '../../lib/cx.js';
import styles from './TextLink.module.css';

// Inline navigation link. Figma: Handoff / Text link (426:1519). Use `as={Link}` for app routes.
export function TextLink({ as: Component = 'a', className, ...props }) {
  return <Component className={cx(styles.link, className)} {...props} />;
}
