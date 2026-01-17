import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import JoinGroupPage from '@/components/groups/JoinGroupPage';
import GroupExpensesPageLoader from '@/components/groups/GroupExpensesPageLoader';
import { AuthProvider } from './contexts/AuthContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { GroupProvider } from './contexts/GroupContext';
import NotFound from '@/components/layout/NotFound';
import { HelmetProvider } from 'react-helmet-async';
import { installBackgroundSync } from './data/sync';
import { getAuth } from 'firebase/auth';
import { loadSettings } from '@/utils/settingsUtils';

const applyAppearance = (appearance, locked) => {
  if (typeof document === 'undefined' || !locked || !appearance) return;
  const wantsDark = appearance === 'dark';
  document.documentElement.classList.toggle('dark', wantsDark);
};

const getSavedAppearance = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem('expenseAppSettings');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Object.prototype.hasOwnProperty.call(parsed, 'appearance')) return null;
    return {
      appearance: parsed.appearance,
      locked: parsed.appearanceLocked === true
    };
  } catch {
    return null;
  }
};

const savedAppearance = getSavedAppearance();
if (savedAppearance) {
  applyAppearance(savedAppearance.appearance, savedAppearance.locked);
}
window.addEventListener('settings-updated', (event) => {
  applyAppearance(event.detail?.appearance, event.detail?.appearanceLocked === true);
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HelmetProvider>
      <GroupProvider>
        <AuthProvider>
          <LoadingProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/join/:groupId" element={<JoinGroupPage />} />
                <Route path="/group/:groupId/:tab?" element={<GroupExpensesPageLoader />} />
                <Route path="/*" element={<App />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </LoadingProvider>
        </AuthProvider>
      </GroupProvider>
    </HelmetProvider>
  </React.StrictMode>
) 

// Install background sync after app mounts
installBackgroundSync(() => {
  try { return getAuth().currentUser?.uid || null; } catch { return null; }
});
