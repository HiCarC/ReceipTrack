import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { useState } from 'react';
import { UploadMethodModal } from './components/ReceiptUploader';
import ReceiptUploader from './components/ReceiptUploader'
import LandingPage from './components/LandingPage'
import { Toaster } from "@/components/ui/toaster"
import AuthHeader from "@/components/AuthHeader"
import { Settings } from './components/Settings';
import MobileNavBar from './components/MobileNavBar';

// Create a RootContent component that will consume the AuthContext
function ExpensesScreen(props) {
  // This is the summary/dashboard part of ReceiptUploader
  // You may want to extract just the summary/dashboard from ReceiptUploader for a cleaner split
  return <ReceiptUploader {...props} showOnly="expenses" />;
}

function ReceiptsScreen(props) {
  // This is the receipts list part of ReceiptUploader
  // You may want to extract just the receipts list from ReceiptUploader for a cleaner split
  return <ReceiptUploader {...props} showOnly="receipts" />;
}

function RootContent() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('expenses');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Only show bottom nav on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Render the correct screen based on currentTab
  let mainContent = null;
  if (!user) {
    mainContent = <LandingPage className="flex-grow" />;
  } else if (currentTab === 'expenses') {
    mainContent = <ExpensesScreen />;
  } else if (currentTab === 'receipts') {
    mainContent = <ReceiptsScreen />;
  } else if (currentTab === 'settings') {
    mainContent = <Settings onClose={() => setCurrentTab('expenses')} />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950" style={{ overflowX: 'hidden' }}>
      <AuthHeader />
      <div className="flex-grow">{mainContent}</div>
      {user && isMobile && (
        <MobileNavBar
          currentTab={currentTab}
          onTabChange={tab => {
            if (tab === 'upload') setShowUploadModal(true);
            else setCurrentTab(tab);
          }}
        />
      )}
      {showUploadModal && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center bg-black/40" onClick={() => setShowUploadModal(false)}>
          <div className="w-full max-w-md mx-auto mb-4" onClick={e => e.stopPropagation()}>
            <UploadMethodModal
              // Pass required props for upload actions here
              onUploadFile={() => {/* trigger file upload */}}
              onTakePhoto={() => {/* trigger camera */}}
              onManualEntry={() => {/* trigger manual entry */}}
              // ...other props as needed
            />
          </div>
        </div>
      )}
      <Toaster />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <RootContent /> {/* Render the RootContent component inside AuthProvider */}
    </AuthProvider>
  );
}

export default App 