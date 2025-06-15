import { AuthProvider, useAuth } from "@/contexts/AuthContext"
import ReceiptUploader from './components/ReceiptUploader'
import LandingPage from './components/LandingPage'
import { Toaster } from "@/components/ui/toaster"
import AuthHeader from "@/components/AuthHeader"

// Create a RootContent component that will consume the AuthContext
function RootContent() {
  const { user } = useAuth(); // Now useAuth is called within AuthProvider's scope

  return (
    <div className="min-h-screen w-full flex flex-col bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950">
      <AuthHeader />
      {user ? <ReceiptUploader className="flex-grow" /> : <LandingPage className="flex-grow" />}
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