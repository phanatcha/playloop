import { useId } from 'react';
import { cx } from '../../lib/cx.js';
import styles from './Field.module.css';

// Labelled single-line input. Figma: Profile / Field (220:373).
// `radius="sm"` is the 8 px corner the Sign up and Log in instances override it with.
export function TextField({ label, hint, error, id, radius = 'lg', className, ...inputProps }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-message`;
  const message = error || hint;

  return (
    <div className={cx(styles.field, className)}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={cx(styles.control, radius === 'sm' && styles.controlSm)}
        aria-invalid={error ? true : undefined}
        aria-describedby={message ? messageId : undefined}
        {...inputProps}
      />
      {message && (
        <p id={messageId} className={error ? styles.error : styles.hint}>
          {message}
        </p>
      )}
    </div>
  );
}
