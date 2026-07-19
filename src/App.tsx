import { Component, ReactNode, useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { supabaseReady } from './lib/supabase';
import RolePicker from './screens/RolePicker';
import FarmerLanguage from './screens/FarmerLanguage';
import FarmerHome from './screens/FarmerHome';
import SosFlow from './screens/SosFlow';
import TechnicianHome from './screens/TechnicianHome';
import VendorHome from './screens/VendorHome';
import AdminHome from './screens/AdminHome';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 bg-amber-50 text-center">
          <p className="text-xl font-bold text-amber-700">Something went wrong.</p>
          <button onClick={() => window.location.reload()} className="bg-amber-500 text-white rounded-xl px-6 py-3 font-semibold">Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ConfigMissing() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 p-6 bg-amber-50 text-center">
      <p className="text-xl font-bold text-amber-700">Configuration missing</p>
      <p className="text-sm text-gray-600 max-w-md">Supabase environment variables are not set. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your hosting platform's environment variables, then redeploy.</p>
    </div>
  );
}

function Router() {
  const { user } = useAuth();
  const [farmerView, setFarmerView] = useState<'lang' | 'home' | 'sos' | 'track'>('lang');

  if (!user) return <RolePicker />;

  if (user.role === 'farmer') {
    if (farmerView === 'lang') return <FarmerLanguage onDone={() => setFarmerView('home')} />;
    if (farmerView === 'sos') return <SosFlow onDone={() => setFarmerView('home')} />;
    return (
      <FarmerHome
        onSos={() => setFarmerView('sos')}
        onChangeLang={() => setFarmerView('lang')}
      />
    );
  }
  if (user.role === 'technician') return <TechnicianHome />;
  if (user.role === 'vendor') return <VendorHome />;
  if (user.role === 'admin') return <AdminHome />;
  return <RolePicker />;
}

export default function App() {
  if (!supabaseReady) return <ConfigMissing />;
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </ErrorBoundary>
  );
}
