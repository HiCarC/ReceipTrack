import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { useState } from 'react';
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

function UploadScreen(props) {
  // This is the upload methods part of ReceiptUploader
  return <ReceiptUploader {...props} showOnly="upload" />;
}

function RootContent() {
  const { user } = useAuth();
  const [currentTab, setCurrentTab] = useState('expenses');
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
  } else if (currentTab === 'upload') {
    mainContent = <UploadScreen />;
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
          onTabChange={setCurrentTab}
        />
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