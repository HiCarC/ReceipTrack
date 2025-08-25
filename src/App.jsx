import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { LoadingProvider } from "@/contexts/LoadingContext"
import { useState, useEffect } from 'react';
import ReceiptUploader from './components/ReceiptUploader'
import LandingPage from './components/LandingPage'
import { Toaster } from "@/components/ui/toaster"
import AuthHeader from "@/components/AuthHeader"
import { Settings } from './components/Settings';
import ExportWizard from './components/ExportWizard';
import MobileNavBar from './components/MobileNavBar';
import { GroupProvider } from './contexts/GroupContext';
import GroupHomeScreen from './components/GroupHomeScreen';
import GroupExpensesPage from './components/GroupExpensesPage';
import MapPage from './components/MapPage';

// Create a RootContent component that will consume the AuthContext
function ExpensesScreen(props) {
  // This is the summary/dashboard part of ReceiptUploader
  // You may want to extract just the summary/dashboard from ReceiptUploader for a cleaner split
  return <ReceiptUploader {...props} showOnly="expenses" onTabChange={props.onTabChange} />;
}

function ReceiptsScreen(props) {
  // This is the receipts list part of ReceiptUploader
  // You may want to extract just the receipts list from ReceiptUploader for a cleaner split
  return <ReceiptUploader {...props} showOnly="receipts" onTabChange={props.onTabChange} />;
}

function UploadScreen(props) {
  // This is the upload methods part of ReceiptUploader
  return <ReceiptUploader {...props} showOnly="upload" onTabChange={props.onTabChange} />;
}

function RootContent() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('upload');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [needsFixCount, setNeedsFixCount] = useState(0);
  const [exportSelection, setExportSelection] = useState(null); // optional selected receipts

  // Only show bottom nav on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Render the correct screen based on currentTab
  let mainContent = null;
  if (!user) {
    // Bring back landing page for unauthenticated users
    mainContent = <LandingPage className="flex-grow" />;
  } else if (selectedGroup) {
    const prefill = (typeof window !== 'undefined' && window.__GROUP_PREFILL__ && window.__GROUP_PREFILL__.groupId === selectedGroup.id) ? window.__GROUP_PREFILL__ : null;
    mainContent = <GroupExpensesPage group={selectedGroup} onBack={() => setSelectedGroup(null)} prefill={prefill} />;
  } else if (currentTab === 'expenses') {
    mainContent = <ExpensesScreen onTabChange={setCurrentTab} />;
  } else if (currentTab === 'receipts') {
    mainContent = (
      <ReceiptsScreen
        onTabChange={setCurrentTab}
        onNeedsFixCountChange={setNeedsFixCount}
        onRequestExport={(selected) => { setExportSelection(selected || null); setCurrentTab('exports'); }}
      />
    );
  } else if (currentTab === 'upload') {
    mainContent = <UploadScreen onTabChange={setCurrentTab} />;
  } else if (currentTab === 'group') {
    mainContent = <GroupHomeScreen onTabChange={setCurrentTab} onGroupEnter={setSelectedGroup} />;
  } else if (currentTab === 'map') {
    mainContent = <MapPage />;
  } else if (currentTab === 'settings') {
    mainContent = <Settings onClose={() => setCurrentTab('expenses')} />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950" style={{ overflowX: 'hidden' }}>
      <AuthHeader />
      {/* Listen for global tab change requests as a fallback */}
      {(() => {
        // Inline IIFE to attach a one-time effect without refactoring structure
        // eslint-disable-next-line react-hooks/rules-of-hooks
        useEffect(() => {
          const handler = (e) => {
            const targetTab = e?.detail || 'map';
            setCurrentTab(targetTab);
          };
          document.addEventListener('requestTabChange', handler);
          return () => document.removeEventListener('requestTabChange', handler);
        }, []);
        return null;
      })()}
      <div key={currentTab} className="flex-grow animate-content-fade-in">
        {mainContent}
      </div>
      {user && isMobile && (
        <MobileNavBar
          currentTab={currentTab}
          onTabChange={setCurrentTab}
          needsFixCount={needsFixCount}
        />
      )}
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <GroupProvider>
      <AuthProvider>
        <LoadingProvider>
          <RootContent /> {/* Render the RootContent component inside AuthProvider */}
        </LoadingProvider>
      </AuthProvider>
    </GroupProvider>
  );
}

export default App
