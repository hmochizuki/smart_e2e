import { Link, Navigate, Route, Routes } from 'react-router-dom';
import { PlaywrightBanner } from './features/playwright-setup/PlaywrightBanner.js';
import { RunViewerPage } from './features/run-viewer/RunViewerPage.js';
import { SuiteEditPage } from './features/suite-edit/SuiteEditPage.js';
import { SuiteListPage } from './features/suite-list/SuiteListPage.js';
import styles from './App.module.css';

export const App = (): JSX.Element => (
  <div className={styles['shell']}>
    <header className={styles['topbar']}>
      <Link to="/" className={styles['brand']}>
        smart_e2e
      </Link>
    </header>
    <main className={styles['main']}>
      <PlaywrightBanner />
      <Routes>
        <Route path="/" element={<SuiteListPage />} />
        <Route path="/suites/:id" element={<SuiteEditPage />} />
        <Route path="/suites/:id/runs/:runId" element={<RunViewerPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  </div>
);
