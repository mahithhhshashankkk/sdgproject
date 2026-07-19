import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { t } from '../lib/i18n';
import { Header, Screen } from '../lib/ui';
import { IndianRupee, Check, X, ShoppingCart, Boxes, BarChart3 } from 'lucide-react';

type Part = { id: string; part_name: string; quantity: number; price: number; demand_forecast: number };
type Order = { id: string; farmer_name: string; phone: string; region: string | null; acres: number | null; pump_model: string | null; status: string; created_at: string };
type VendorRecord = { id: string; company_name: string; inventory_level: number; region: string | null };

export default function VendorHome() {
  const { user, signOut } = useAuth();
  const lang = user?.language ?? 'en';
  const [vendor, setVendor] = useState<VendorRecord | null>(null);
  const [parts, setParts] = useState<Part[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tab, setTab] = useState<'new' | 'accepted' | 'inventory'>('new');

  const load = async () => {
    try {
      if (!user) return;
      const { data: v } = await supabase.from('vendors').select('id,company_name,inventory_level,region').eq('user_id', user.id).maybeSingle();
      const vendorRecord = v as VendorRecord | null;
      setVendor(vendorRecord);
      if (vendorRecord) {
        const { data: p } = await supabase.from('spare_parts').select('id,part_name,quantity,price,demand_forecast').eq('vendor_id', vendorRecord.id);
        setParts((p as Part[]) ?? []);
      }
      const { data: o } = await supabase.from('install_requests').select('*').order('created_at', { ascending: false });
      setOrders((o as Order[]) ?? []);
    } catch { /* best-effort */ }
  };

  useEffect(() => { load(); }, [user]);

  const act = async (id: string, status: 'accepted' | 'rejected') => {
    try {
      const patch: { status: 'accepted' | 'rejected'; vendor_id?: string } = { status };
      if (status === 'accepted' && vendor) patch.vendor_id = vendor.id;
      await supabase.from('install_requests').update(patch).eq('id', id);
      load();
    } catch { /* best-effort */ }
  };

  const totalStock = parts.reduce((s, p) => s + p.quantity, 0);
  const totalValue = parts.reduce((s, p) => s + p.quantity * Number(p.price), 0);
  const newOrders = orders.filter((o) => o.status === 'new');
  const acceptedOrders = orders.filter((o) => o.status === 'accepted');

  return (
    <Screen className="bg-slate-50">
      <Header title={vendor?.company_name ?? 'Vendor'} />
      <div className="px-4 py-3 grid grid-cols-3 gap-2">
        <Metric icon={<Boxes className="w-5 h-5" />} value={totalStock} label={t(lang, 'inventory')} color="bg-blue-50 text-blue-700 border border-blue-200" />
        <Metric icon={<ShoppingCart className="w-5 h-5" />} value={newOrders.length} label={t(lang, 'newOrders')} color="bg-orange-50 text-orange-700 border border-orange-200" />
        <Metric icon={<IndianRupee className="w-5 h-5" />} value={Math.round(totalValue / 1000)} label={`${t(lang, 'revenue')} (₹k)`} color="bg-emerald-50 text-emerald-700 border border-emerald-200" />
      </div>

      {/* Tabs */}
      <div className="px-4 flex gap-2 mb-3">
        {([['new', t(lang, 'newOrders')], ['accepted', t(lang, 'acceptedOrders')], ['inventory', t(lang, 'inventory')]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${tab === k ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>{label}</button>
        ))}
      </div>

      <main className="px-4 flex-1 space-y-3 pb-4">
        {tab === 'inventory' && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2"><BarChart3 className="w-5 h-5 text-slate-600" /><h2 className="font-bold text-slate-800">{t(lang, 'demandForecast')}</h2></div>
            <div className="p-4 space-y-3">
              {parts.map((p) => {
                const max = Math.max(...parts.map((x) => x.demand_forecast), 1);
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="text-xs text-slate-600 w-32 truncate">{p.part_name}</span>
                    <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden"><div className="bg-amber-500 h-3 rounded-full" style={{ width: `${(p.demand_forecast / max) * 100}%` }} /></div>
                    <span className="text-xs font-semibold text-slate-700 w-6 text-right">{p.demand_forecast}</span>
                  </div>
                );
              })}
              {parts.length === 0 && <p className="text-center text-slate-400 py-4">No parts</p>}
            </div>
            <div className="border-t border-slate-100 p-4 space-y-2">
              {parts.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <span className="text-slate-700">{p.part_name}</span>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${p.quantity < 10 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>{p.quantity} {p.quantity < 10 ? t(lang, 'lowInventory') : t(lang, 'inStock')}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab !== 'inventory' && (
          (tab === 'new' ? newOrders : acceptedOrders).length === 0 ? (
            <p className="text-center text-slate-400 py-8">{t(lang, 'noTickets')}</p>
          ) : (
            (tab === 'new' ? newOrders : acceptedOrders).map((o) => (
              <div key={o.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-bold text-slate-800">{o.farmer_name}</p>
                    <p className="text-xs text-slate-500">{new Date(o.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${o.status === 'new' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}`}>{o.status}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-slate-400">{t(lang, 'phoneNo')}: </span><a href={`tel:${o.phone}`} className="font-semibold text-green-700">{o.phone}</a></div>
                  <div><span className="text-slate-400">{t(lang, 'region')}: </span>{o.region ?? '—'}</div>
                  {o.acres != null && <div><span className="text-slate-400">{t(lang, 'acresLand')}: </span>{o.acres}</div>}
                  {o.pump_model && <div><span className="text-slate-400">{t(lang, 'pumpModel')}: </span>{o.pump_model}</div>}
                </div>
                {o.status === 'new' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => act(o.id, 'accepted')} className="flex-1 bg-emerald-600 text-white rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1 active:scale-95"><Check className="w-4 h-4" /> {t(lang, 'accept')}</button>
                    <button onClick={() => act(o.id, 'rejected')} className="flex-1 bg-red-100 text-red-700 rounded-xl py-2.5 text-sm font-bold flex items-center justify-center gap-1 active:scale-95"><X className="w-4 h-4" /> {t(lang, 'reject')}</button>
                  </div>
                )}
              </div>
            ))
          )
        )}
      </main>

      <button onClick={() => signOut()} className="m-4 bg-slate-200 text-slate-700 rounded-2xl py-3 font-semibold">{t(lang, 'logout')}</button>
    </Screen>
  );
}

function Metric({ icon, value, label, color }: { icon: React.ReactNode; value: number; label: string; color: string }) {
  return (
    <div className={`${color} rounded-2xl p-3 flex flex-col items-center gap-1`}>
      {icon}
      <span className="text-2xl font-extrabold">{value}</span>
      <span className="text-xs font-semibold text-center leading-tight">{label}</span>
    </div>
  );
}
