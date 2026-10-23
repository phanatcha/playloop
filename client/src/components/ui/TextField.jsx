import { useId } from 'react';
import { cx } from '../../lib/cx.js';
import styles from './Field.module.css';

// Labelled single-line input. Figma: Profile / Field (220:373).
export function TextField({ label, hint, error, id, className, ...inputProps }) {
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
        className={styles.control}
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
