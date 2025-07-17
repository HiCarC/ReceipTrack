import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import JoinGroupPage from './components/JoinGroupPage';
import GroupExpensesPageLoader from './components/GroupExpensesPageLoader';
import { AuthProvider } from './contexts/AuthContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { GroupProvider } from './contexts/GroupContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GroupProvider>
      <AuthProvider>
        <LoadingProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/join/:groupId" element={<JoinGroupPage />} />
              <Route path="/group/:groupId" element={<GroupExpensesPageLoader />} />
              <Route path="/*" element={<App />} />
            </Routes>
          </BrowserRouter>
        </LoadingProvider>
      </AuthProvider>
    </GroupProvider>
  </React.StrictMode>
) 