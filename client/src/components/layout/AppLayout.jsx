import { Outlet } from 'react-router';
import { useResource } from '../../features/shared/useResource.js';
import { MainNavigation } from './MainNavigation.jsx';
import styles from './AppLayout.module.css';

// Page shell shared by the desktop screens: sky background, glass grid lines, navigation and
// a 1312 px content column.
export function AppLayout() {
  const session = useResource('/me');
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skipLink}>
        Skip to content
      </a>
      <div className={styles.column}>
        <MainNavigation user={session.data} />
        <main id="main" className={styles.main}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
