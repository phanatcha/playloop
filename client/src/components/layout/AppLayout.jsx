import { Outlet } from 'react-router';
import { MainNavigation } from './MainNavigation.jsx';
import styles from './AppLayout.module.css';

// Page shell shared by the desktop screens: sky background, glass grid lines, navigation and
// a 1312 px content column. Pass `navigation` to swap the header, as the Sign up and Log in
// screens do.
export function AppLayout({ navigation = <MainNavigation /> }) {
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <div className={styles.column}>
        {navigation}
        <main id="main" className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
