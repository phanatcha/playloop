import { cx } from '../../lib/cx.js';
import styles from './ReviewProgress.module.css';

// Step pips with a label. Figma: Handoff / Review progress (426:1537). Pips and label both come
// from currentStep / totalSteps; orange marks reached and current steps.
export function ReviewProgress({ currentStep, totalSteps, label = 'Final verdict', className }) {
  const text = `${label} · ${currentStep} of ${totalSteps}`;
  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-valuenow={currentStep}
      aria-valuetext={text}
      className={cx(styles.progress, className)}
    >
      <span className={styles.pips} aria-hidden="true">
        {Array.from({ length: totalSteps }, (_, index) => (
          <span key={index} className={cx(styles.pip, index < currentStep && styles.reached)} />
        ))}
      </span>
      <span className={styles.label}>{text}</span>
    </div>
  );
}
