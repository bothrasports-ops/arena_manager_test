
import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  List,
  Package,
  LayoutDashboard,
  LogOut,
  Trophy,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import BookingForm from './components/BookingForm';
import BookingList from './components/BookingList';
import Inventory from './components/Inventory';
import Dashboard from './components/Dashboard';
import LoginForm from './components/LoginForm';
import { AppState, Booking, DrinkInventoryItem } from './types';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'new' | 'list' | 'inventory' | 'dashboard'>('new');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [appState, setAppState] = useState<AppState>({
    user: null,
    profile: null,
    bookings: [],
    inventory: []
  });

  // Handle Auth Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAppState(prev => ({ ...prev, user: { id: session.user.id, email: session.user.email } }));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setAppState(prev => ({ ...prev, user: { id: session.user.id, email: session.user.email } }));
      } else {
        setAppState(prev => ({ ...prev, user: null, profile: null, bookings: [], inventory: [] }));
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch initial data from Supabase
  const fetchData = async () => {
    if (!appState.user) return;

    setLoading(true);
    setFetchError(null);
    try {
      // Fetch Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', appState.user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') throw profileError;

      // Fetch Inventory
      const { data: inventoryData, error: invError } = await supabase
        .from('inventory')
        .select('*')
        .eq('venue_id', appState.user.id)
        .order('name');

      if (invError) throw invError;

      // Fetch Bookings with their related drinks
      const { data: bookingsData, error: bookError } = await supabase
        .from('bookings')
        .select(`
          *,
          booking_drinks (
            drink_id,
            quantity,
            price_at_time
          )
        `)
        .eq('venue_id', appState.user.id)
        .order('created_at', { ascending: false });

      if (bookError) throw bookError;

      const mappedBookings: Booking[] = (bookingsData || []).map(b => ({
        id: b.id,
        customerName: b.customer_name,
        phoneNumber: b.phone_number,
        platform: b.platform,
        bookingAmount: b.booking_amount,
        selectedDrinks: b.booking_drinks ? b.booking_drinks.map((d: any) => ({
          drinkId: d.drink_id,
          quantity: d.quantity,
          priceAtTime: d.price_at_time
        })) : [],
        extraHours: {
          enabled: b.extra_hours_enabled,
          duration: b.extra_hours_duration,
          amount: b.extra_hours_amount
        },
        totalAmount: b.total_amount,
        timestamp: new Date(b.created_at).getTime()
      }));

      setAppState(prev => ({
        ...prev,
        profile: profileData,
        inventory: inventoryData || [],
        bookings: mappedBookings
      }));
    } catch (error: any) {
      console.error('Error fetching data from Supabase:', error);
      setFetchError(error.message || 'Unknown database error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (appState.user) {
      fetchData();
    }
  }, [appState.user]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const refreshData = () => fetchData();

  if (loading && !appState.user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!appState.user) {
    return <LoginForm onAuthSuccess={fetchData} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Trophy className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">ArenaSync</h1>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={refreshData}
              className={`p-2 text-slate-400 hover:text-indigo-600 transition-colors rounded-full hover:bg-indigo-50 ${loading ? 'animate-spin' : ''}`}
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <span className="hidden sm:inline text-sm text-slate-500 font-medium">
              {appState.profile?.venue_name || 'Arena'}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-full hover:bg-red-50"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {fetchError && (
        <div className="max-w-5xl mx-auto w-full px-4 mt-4">
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="text-sm font-bold">Database Sync Error</p>
              <p className="text-xs opacity-80">{fetchError}. Please ensure your Supabase tables are created correctly.</p>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <nav className="hidden lg:flex flex-col gap-1 w-64 shrink-0">
            <NavButton
              active={activeTab === 'dashboard'}
              onClick={() => setActiveTab('dashboard')}
              icon={<LayoutDashboard className="w-5 h-5" />}
              label="Dashboard"
            />
            <NavButton
              active={activeTab === 'new'}
              onClick={() => setActiveTab('new')}
              icon={<PlusCircle className="w-5 h-5" />}
              label="New Booking"
            />
            <NavButton
              active={activeTab === 'list'}
              onClick={() => setActiveTab('list')}
              icon={<List className="w-5 h-5" />}
              label="All Bookings"
            />
            <NavButton
              active={activeTab === 'inventory'}
              onClick={() => setActiveTab('inventory')}
              icon={<Package className="w-5 h-5" />}
              label="Inventory"
            />
          </nav>

          <div className="flex-1">
            {loading && activeTab !== 'new' ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
              </div>
            ) : (
              <>
                {activeTab === 'dashboard' && (
                  <Dashboard
                    bookings={appState.bookings}
                    inventory={appState.inventory}
                  />
                )}
                {activeTab === 'new' && (
                  <BookingForm
                    onSave={refreshData}
                    inventory={appState.inventory}
                    venueId={appState.user?.id}
                  />
                )}
                {activeTab === 'list' && (
                  <BookingList
                    bookings={appState.bookings}
                    inventory={appState.inventory}
                  />
                )}
                {activeTab === 'inventory' && (
                  <Inventory
                    inventory={appState.inventory}
                    bookings={appState.bookings}
                    onUpdate={refreshData}
                    venueId={appState.user?.id}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around py-2 z-20">
        <MobileNavButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard className="w-6 h-6" />} label="Dashboard" />
        <MobileNavButton active={activeTab === 'new'} onClick={() => setActiveTab('new')} icon={<PlusCircle className="w-6 h-6" />} label="New" />
        <MobileNavButton active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<List className="w-6 h-6" />} label="Bookings" />
        <MobileNavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package className="w-6 h-6" />} label="Inventory" />
      </nav>
      <div className="lg:hidden h-16" />
    </div>
  );
};

interface NavButtonProps { active: boolean; onClick: () => void; icon: React.ReactNode; label: string; }
const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
    {icon} <span className="font-semibold">{label}</span>
  </button>
);
const MobileNavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1 transition-colors ${active ? 'text-indigo-600' : 'text-slate-400'}`}>
    {icon} <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

export default App;
