import { useState } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import RolePicker from './screens/RolePicker';
import FarmerLanguage from './screens/FarmerLanguage';
import FarmerHome from './screens/FarmerHome';
import SosFlow from './screens/SosFlow';
import TechnicianHome from './screens/TechnicianHome';
import VendorHome from './screens/VendorHome';
import AdminHome from './screens/AdminHome';

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
  return (
    <AuthProvider>
      <Router />
    </AuthProvider>
  );
}
