import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { LoadingProvider } from "@/contexts/LoadingContext"
import { useState, useEffect } from 'react';
import { ScanLine } from 'lucide-react';
import ReceiptUploader from '@/components/receipts/ReceiptUploader';
import LandingPage from '@/components/layout/LandingPage';
import { Toaster } from "@/components/ui/toaster"
import AuthHeader from '@/components/auth/AuthHeader';
import { Settings } from '@/components/settings/Settings';
import ExportWizard from '@/components/export/ExportWizard';
import MobileNavBar from '@/components/layout/MobileNavBar';
import { GroupProvider } from './contexts/GroupContext';
import GroupHomeScreen from '@/components/groups/GroupHomeScreen';
import GroupExpensesPage from '@/components/groups/GroupExpensesPage';
import MapTabView from '@/components/map/MapTabView';

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
  const [currentTab, setCurrentTab] = useState('expenses');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [needsFixCount, setNeedsFixCount] = useState(0);
  const [exportSelection, setExportSelection] = useState(null); // optional selected receipts
  const [scanAnimating, setScanAnimating] = useState(false);

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
    mainContent = <MapTabView />;
  } else if (currentTab === 'settings') {
    mainContent = <Settings onClose={() => setCurrentTab('expenses')} />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-app-bg text-app-fg font-display" style={{ overflowX: 'hidden' }}>
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
        <>
          <MobileNavBar
            currentTab={currentTab}
            onTabChange={setCurrentTab}
            needsFixCount={needsFixCount}
            showScanButton={false}
          />
          {currentTab !== 'upload' && (
            <button
              type="button"
              onClick={() => {
                setScanAnimating(true);
                setTimeout(() => {
                  setCurrentTab('upload');
                  setScanAnimating(false);
                }, 220);
              }}
              className={`fixed left-1/2 bottom-24 z-[2147483647] flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-app-primary text-white shadow-2xl shadow-blue-900/40 transition-all duration-200 ease-out ${
                scanAnimating ? 'scale-150 opacity-40' : 'active:scale-95'
              }`}
              aria-label="Scan receipt"
            >
              <ScanLine className="h-6 w-6" />
            </button>
          )}
        </>
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
