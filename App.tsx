
import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  List,
  Package,
  LayoutDashboard,
  LogOut,
  Trophy,
  RefreshCw,
  AlertTriangle,
  ShoppingBag
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import BookingForm from './components/BookingForm';
import BookingList from './components/BookingList';
import Inventory from './components/Inventory';
import Dashboard from './components/Dashboard';
import LoginForm from './components/LoginForm';
import DrinkSales from './components/DrinkSales';
import { AppState, Booking, DrinkInventoryItem, Sport, PosSale, BookingType } from './types';
import { supabase } from './lib/supabase';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'new' | 'list' | 'inventory' | 'dashboard' | 'drinks'>('new');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [appState, setAppState] = useState<AppState>({
    user: null,
    profile: null,
    bookings: [],
    inventory: [],
    posSales: []
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
        setAppState(prev => ({ ...prev, user: null, profile: null, bookings: [], inventory: [], posSales: [] }));
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
    setSupabaseStatus('checking');
    try {
      // Test connection with a simple query
      const { error: pingError } = await supabase.from('inventory').select('id').limit(1);
      if (pingError) {
        setSupabaseStatus('error');
        throw new Error(`Supabase connection failed: ${pingError.message}`);
      }
      setSupabaseStatus('connected');

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

      const mappedInventory: DrinkInventoryItem[] = (inventoryData || []).map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        purchasePrice: i.purchase_price || 0,
        stockQuantity: i.stock_quantity || 0
      }));

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
        bookingType: b.booking_type as BookingType || BookingType.COURT,
        membershipId: b.membership_id,
        coachingFee: b.coaching_fee,
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
        bookingStartTime: b.booking_start_time,
        bookingEndTime: b.booking_end_time,
        bookingDate: b.booking_date,
        sport: b.sport as Sport,
        totalHours: b.total_hours,
        totalAmount: b.total_amount,
        timestamp: new Date(b.created_at).getTime()
      }));

      // Fetch POS Sales
      const { data: posSalesData, error: posError } = await supabase
        .from('pos_sales')
        .select(`
          *,
          pos_sale_items (
            drink_id,
            quantity,
            price_at_time
          )
        `)
        .eq('venue_id', appState.user.id)
        .order('created_at', { ascending: false });

      if (posError) throw posError;

      const mappedPosSales: PosSale[] = (posSalesData || []).map(s => ({
        id: s.id,
        venueId: s.venue_id,
        totalAmount: s.total_amount,
        createdAt: s.created_at,
        items: s.pos_sale_items.map((i: any) => ({
          drinkId: i.drink_id,
          quantity: i.quantity,
          priceAtTime: i.price_at_time
        }))
      }));

      setAppState(prev => ({
        ...prev,
        profile: profileData,
        inventory: mappedInventory,
        bookings: mappedBookings,
        posSales: mappedPosSales
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

  const handleDeleteBooking = async (id: string) => {
    try {
      // Delete related drinks first (if not CASCADE)
      const { error: drinksError } = await supabase
        .from('booking_drinks')
        .delete()
        .eq('booking_id', id);

      if (drinksError) throw drinksError;

      // Delete the booking
      const { error: bookingError } = await supabase
        .from('bookings')
        .delete()
        .eq('id', id);

      if (bookingError) throw bookingError;

      // Refresh local state
      setAppState(prev => ({
        ...prev,
        bookings: prev.bookings.filter(b => b.id !== id)
      }));

      toast.success('Booking deleted successfully');
    } catch (error: any) {
      console.error('Error deleting booking:', error);
      toast.error(`Failed to delete booking: ${error.message}`);
    }
  };

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
      <Toaster position="top-right" richColors />
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">

        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Trophy className="text-white w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">ArenaSync</h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              supabaseStatus === 'connected' ? 'bg-emerald-50/50 text-emerald-600 border border-emerald-200' :
              supabaseStatus === 'error' ? 'bg-rose-50/50 text-rose-600 border border-rose-200' :
              'bg-amber-50/50 text-amber-600 border border-amber-200'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${
                supabaseStatus === 'connected' ? 'bg-emerald-500 animate-pulse' :
                supabaseStatus === 'error' ? 'bg-rose-500' :
                'bg-amber-500 animate-bounce'
              }`} />
              <span className="hidden xs:inline">{supabaseStatus}</span>
            </div>

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
            <NavButton
              active={activeTab === 'drinks'}
              onClick={() => setActiveTab('drinks')}
              icon={<ShoppingBag className="w-5 h-5" />}
              label="Drinks Sale"
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
                    posSales={appState.posSales}
                  />
                )}
                {activeTab === 'new' && (
                  <BookingForm
                    onSave={refreshData}
                    inventory={appState.inventory}
                    venueId={appState.user?.id}
                    availableSports={appState.profile?.available_sports || []}
                  />
                )}
                {activeTab === 'list' && (
                  <BookingList
                    bookings={appState.bookings}
                    inventory={appState.inventory}
                    onDelete={handleDeleteBooking}
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
                {activeTab === 'drinks' && (
                  <DrinkSales
                    inventory={appState.inventory}
                    sales={appState.posSales}
                    onSave={refreshData}
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
        <MobileNavButton active={activeTab === 'drinks'} onClick={() => setActiveTab('drinks')} icon={<ShoppingBag className="w-6 h-6" />} label="Drinks" />
        <MobileNavButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={<Package className="w-6 h-6" />} label="Stock" />
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
