import { AuthIntro } from './AuthIntro.jsx';
import styles from './AuthPage.module.css';

// Two-column layout shared by Sign up and Log in: brand story on the left, the glass form (the
// children) on the right.
export function AuthPage({ title, message, children }) {
  return (
    <div className={styles.page}>
      <AuthIntro title={title} message={message} />
      {children}
    </div>
  );
}
