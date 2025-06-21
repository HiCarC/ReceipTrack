import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import { LoadingProvider } from "@/contexts/LoadingContext"
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

  // Only show bottom nav on mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // Render the correct screen based on currentTab
  let mainContent = null;
  if (!user) {
    mainContent = <LandingPage className="flex-grow" />;
  } else if (currentTab === 'expenses') {
    mainContent = <ExpensesScreen onTabChange={setCurrentTab} />;
  } else if (currentTab === 'receipts') {
    mainContent = <ReceiptsScreen onTabChange={setCurrentTab} />;
  } else if (currentTab === 'upload') {
    mainContent = <UploadScreen onTabChange={setCurrentTab} />;
  } else if (currentTab === 'settings') {
    mainContent = <Settings onClose={() => setCurrentTab('expenses')} />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950" style={{ overflowX: 'hidden' }}>
      <AuthHeader />
      <div key={currentTab} className="flex-grow animate-content-fade-in">
        {mainContent}
      </div>
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
      <LoadingProvider>
        <RootContent /> {/* Render the RootContent component inside AuthProvider */}
      </LoadingProvider>
    </AuthProvider>
  );
}

export default App 