
// App.tsx - Main entry point for VenueIQ
import React, { useState, useEffect } from 'react';
import {
  PlusCircle,
  List,
  Package,
  LayoutDashboard,
  LogOut,
  Sparkles,
  Zap,
  RefreshCw,
  AlertTriangle,
  ShoppingBag,
  Users,
  CalendarClock,
  ShieldCheck,
  Grid,
  Menu,
  ChevronDown,
  PieChart,
  Globe
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Toaster, toast } from 'sonner';
import BookingForm from './components/BookingForm';
import BookingList from './components/BookingList';
import Inventory from './components/Inventory';
import Dashboard from './components/Dashboard';
import LoginForm from './components/LoginForm';
import DrinkSales from './components/DrinkSales';
import ActiveBookings from './components/ActiveBookings';
import MembershipManager from './components/MembershipManager';
import UserManagement from './components/UserManagement';
import CourtsManager from './components/CourtsManager';
import MembershipPlanManager from './components/MembershipPlanManager';
import CoachingUI from './components/CoachingUI';
import Finances from './components/Finances';
import PlatformManager from './components/PlatformManager';
import { AppState, Booking, DrinkInventoryItem, Sport, PosSale, BookingType, UserRole, Member, Student, UserProfile, Court, MembershipPlanDefinition, BookingPlatform, PaymentMethod } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';

const App: React.FC = () => {
  const isConfigMissing = !isSupabaseConfigured;
  const [activeTab, setActiveTab] = useState<'new' | 'list' | 'inventory' | 'dashboard' | 'drinks' | 'active' | 'members' | 'coaching' | 'users' | 'court_manager' | 'plans' | 'finances' | 'platforms'>('active');
  const [initialBookingData, setInitialBookingData] = useState<{courtId?: string, date?: string, startTime?: string} | null>(null);

  const handleBookSlot = (courtId: string, time: string, date: string) => {
    setInitialBookingData({ courtId, date, startTime: time });
    setActiveTab('new');
  };

  // Reset initial booking data when navigating away, but allow entering 'new' tab with data
  useEffect(() => {
    if (activeTab !== 'new' && initialBookingData) {
      setInitialBookingData(null);
    }
  }, [activeTab]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'error' | 'checking'>('checking');
  const [appState, setAppState] = useState<AppState>({
    user: null,
    profile: null,
    bookings: [],
    inventory: [],
    posSales: [],
    members: [],
    students: [],
    courts: [],
    membershipPlans: [],
    platforms: []
  });

  // Handle Auth Session
  useEffect(() => {
    if (isConfigMissing) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }: any) => {
      if (session?.user) {
        setAppState(prev => ({ ...prev, user: { id: session.user.id, email: session.user.email, user_metadata: session.user.user_metadata } }));
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      if (session?.user) {
        setAppState(prev => ({ ...prev, user: { id: session.user.id, email: session.user.email, user_metadata: session.user.user_metadata } }));
      } else {
        setAppState(prev => ({ ...prev, user: null, profile: null, bookings: [], inventory: [], posSales: [] }));
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch initial data from Supabase
  const fetchData = async () => {
    if (!appState.user || isConfigMissing) return;

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
      // Securely invoke the database get_venue_safe RPC beforehand.
      // This SECURITY DEFINER function reconciles and heals any pre-created user records
      // with their corresponding authenticating Auth IDs, resolving foreign key reference mismatches.
      const { data: safeVenueId, error: rpcError } = await supabase.rpc('get_venue_safe');
      if (rpcError) {
        console.warn("get_venue_safe RPC warning:", rpcError);
      } else if (safeVenueId) {
        console.log("Safe venue initialized or reconciled successfully:", safeVenueId);
      }

      // Check if a profile exists for this email (either pre-created by admin or previous signup)
      const { data: profileRows, error: profileError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', String(appState.user.email));

      if (profileError) throw profileError;

      let profileData: UserProfile | null = null;

      if (profileRows && profileRows.length > 0) {
        let row = profileRows[0];

        // IMPORTANT: If the profile was pre-created by an admin, it doesn't have an 'id'
        // that matches auth.uid() yet (it might have a temporary one or be null).
        // We update the existing record with the new Auth ID to link them forever.
        if (row.id !== appState.user.id) {
          const { data: updatedRow, error: updateError } = await supabase
              .from('user_profiles')
              .update({ id: String(appState.user.id) })
              .eq('email', String(appState.user.email))
              .select()
              .single();

          if (!updateError && updatedRow) {
            row = updatedRow;
          }
        }

        // Auto-sync custom sign up details if database row was initialized with defaults
        const metadata = appState.user.user_metadata || {};
        const metaVenueName = metadata.venue_name;
        const metaAdminName = metadata.admin_name;
        const metaAvailableSports = metadata.available_sports;

        let needsUpdate = false;
        const updatePayload: Record<string, any> = {};

        if (metaVenueName && (row.venue_name === 'My Arena' || row.venue_name === 'VenueIQ Venue' || !row.venue_name) && row.venue_name !== metaVenueName) {
          updatePayload.venue_name = metaVenueName;
          needsUpdate = true;
        }
        if (metaAdminName && (row.admin_name === 'Admin' || row.admin_name === row.email?.split('@')[0] || !row.admin_name) && row.admin_name !== metaAdminName) {
          updatePayload.admin_name = metaAdminName;
          needsUpdate = true;
        }
        if (metaAvailableSports && (!row.available_sports || row.available_sports.length === 0)) {
          updatePayload.available_sports = metaAvailableSports;
          needsUpdate = true;
        }

        if (needsUpdate) {
          const { data: syncedRow, error: syncError } = await supabase
              .from('user_profiles')
              .update(updatePayload)
              .eq('id', String(appState.user.id))
              .select()
              .single();

          if (!syncError && syncedRow) {
            row = syncedRow;
          }
        }

        const isAdminProfile = (row.role as UserRole) === UserRole.ADMIN;
        profileData = {
          id: isAdminProfile ? String(appState.user.id) : row.id,
          admin_name: row.admin_name || row.email?.split('@')[0] || 'Staff',
          admin_email: row.email,
          venue_name: row.venue_name || 'VenueIQ Venue',
          available_sports: row.available_sports || [Sport.PICKLEBALL, Sport.BADMINTON],
          role: (row.role as UserRole) || UserRole.USER,
          venue_id: isAdminProfile ? String(appState.user.id) : row.venue_id,
          parentId: row.parentId
        };
      } else {
        // Fallback or create default profile if it's the first time
        // We explicitly use the auth ID as the profile ID for admins
        const metadata = appState.user.user_metadata || {};
        const metaVenueName = metadata.venue_name || 'My Arena';
        const metaAvailableSports = metadata.available_sports || [Sport.PICKLEBALL, Sport.BADMINTON];
        const metaAdminName = metadata.admin_name || appState.user.email?.split('@')[0] || 'Admin';

        const { data: newProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert({
              id: appState.user.id,
              email: appState.user.email,
              role: UserRole.ADMIN,
              admin_name: metaAdminName,
              venue_name: metaVenueName,
              venue_id: appState.user.id, // For admin, venue_id is their own ID
              available_sports: metaAvailableSports
            })
            .select()
            .single();

        if (createError) {
          console.error("Profile creation error:", createError);
          throw new Error(`Could not create profile: ${createError.message}`);
        }

        if (newProfile) {
          profileData = {
            id: newProfile.id,
            admin_name: newProfile.admin_name || 'Admin',
            admin_email: newProfile.email,
            venue_name: newProfile.venue_name,
            available_sports: newProfile.available_sports || [Sport.PICKLEBALL, Sport.BADMINTON],
            role: UserRole.ADMIN,
            venue_id: newProfile.venue_id
          };
          toast.success("Welcome! Your admin profile has been created.");
        }
      }

      if (!profileData) {
        throw new Error("No profile data found or created.");
      }

      // Use the venue ID from the profile for all data fetching
      // FOR STAFF: profileData.venue_id is the admin's ID (the master venue ID)
      // FOR ADMIN: profileData.venue_id is their own ID
      const targetVenueId = profileData.venue_id || profileData.id;

      if (!targetVenueId) {
        throw new Error("Could not determine your venue association.");
      }

      console.log("Fetching data for venue:", targetVenueId);

      // 1. Fetch Courts
      const { data: courtsData, error: courtsError } = await supabase
          .from('courts')
          .select('*')
          .eq('venue_id', targetVenueId);

      if (courtsError) console.error("Error fetching courts:", courtsError);

      // 2. Fetch Membership Plans
      const { data: plansData, error: plansError } = await supabase
          .from('membership_plan_definitions')
          .select('*')
          .eq('venue_id', targetVenueId);

      if (plansError) console.error("Error fetching plans:", plansError);

      // 3. Fetch Inventory
      const { data: inventoryData, error: invError } = await supabase
          .from('inventory')
          .select('*')
          .eq('venue_id', targetVenueId)
          .order('name');

      if (invError) throw invError;

      const mappedInventory: DrinkInventoryItem[] = (inventoryData || []).map((i: any) => ({
        id: i.id,
        name: i.name,
        price: i.price,
        purchasePrice: i.purchase_price || 0,
        stockQuantity: i.stock_quantity || 0,
        imageUrl: i.image_url
      }));

      // Fetch Members
      const { data: membersData, error: membersError } = await supabase
          .from('members')
          .select('*')
          .eq('venue_id', targetVenueId);

      if (membersError) throw membersError;

      const mappedMembers: Member[] = (membersData || []).map((m: any) => ({
        id: m.id,
        venueId: m.venue_id,
        customerName: m.customer_name,
        phoneNumber: m.phone_number,
        plan: m.plan as any,
        startDate: m.start_date,
        endDate: m.end_date,
        hoursPerDay: m.hours_per_day,
        status: m.status as any,
        sport: m.sport as any
      }));

      // Fetch Coaching Students
      const { data: studentsData, error: studentsError } = await supabase
          .from('coaching_students')
          .select('*')
          .eq('venue_id', targetVenueId);

      if (studentsError) console.error("Error fetching students:", studentsError);

      const mappedStudents: Student[] = (studentsData || []).map((s: any) => ({
        id: s.id,
        venueId: s.venue_id,
        studentName: s.student_name,
        phoneNumber: s.phone_number,
        coachingFee: s.coaching_fee,
        startDate: s.start_date,
        endDate: s.end_date,
        schedule: s.schedule as any,
        status: s.status as any,
        sport: s.sport as any
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
          .eq('venue_id', targetVenueId)
          .order('created_at', { ascending: false });

      if (bookError) throw bookError;

      const mappedBookings: Booking[] = (bookingsData || []).map((b: any) => ({
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
        courtId: b.court_id,
        paymentStatus: b.payment_status || 'to_be_paid',
        advancePaid: b.advance_paid || 0,
        balancePaid: b.balance_paid || 0,
        paymentMethod: b.payment_method as PaymentMethod,
        finalPaymentMethod: b.final_payment_method as PaymentMethod,
        status: b.status || 'active',
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
          .eq('venue_id', targetVenueId)
          .order('created_at', { ascending: false });

      if (posError) throw posError;

      const mappedPosSales: PosSale[] = (posSalesData || []).map((s: any) => ({
        id: s.id,
        venueId: s.venue_id,
        totalAmount: s.total_amount,
        createdAt: s.created_at,
        paymentMethod: s.payment_method as PaymentMethod,
        items: s.pos_sale_items.map((i: any) => ({
          drinkId: i.drink_id,
          quantity: i.quantity,
          priceAtTime: i.price_at_time
        }))
      }));

      // Fetch Platforms
      const { data: platformsData, error: platesError } = await supabase
          .from('booking_platforms')
          .select('*')
          .eq('venue_id', targetVenueId)
          .order('name');

      if (platesError) console.error("Error fetching platforms:", platesError);

      const mappedPlans: MembershipPlanDefinition[] = (plansData || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        duration: p.duration,
        sport: p.sport as any,
        description: p.description,
        venueId: p.venue_id
      }));

      setAppState(prev => ({
        ...prev,
        profile: profileData,
        inventory: mappedInventory,
        bookings: mappedBookings,
        posSales: mappedPosSales,
        members: mappedMembers,
        students: mappedStudents,
        courts: courtsData || [],
        membershipPlans: mappedPlans,
        platforms: platformsData || []
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

  const isAdmin = appState.profile?.role === UserRole.ADMIN;

  if (isConfigMissing) {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
          <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-200 p-8 text-center">
            <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-10 h-10 text-amber-600" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 mb-2">Configuration Required</h1>
            <p className="text-slate-600 mb-8 text-sm leading-relaxed">
              Please provide your Supabase credentials in the <strong>Settings</strong> menu (gear icon in the bottom left) to connect to your database.
            </p>

            <div className="space-y-4 text-left bg-slate-50 p-4 rounded-2xl border border-slate-100 mb-8">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Environment Variables</p>
                <code className="text-xs font-mono text-slate-700 block select-all">VITE_SUPABASE_URL</code>
                <code className="text-xs font-mono text-slate-700 block select-all">VITE_SUPABASE_ANON_KEY</code>
              </div>
              <div className="pt-2 border-t border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Your Project URL</p>
                <code className="text-[10px] font-mono text-slate-500 break-all select-all">https://uxyhipfvupyrtuntavnw.supabase.co</code>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 text-[10px] text-slate-400 uppercase font-bold tracking-widest leading-normal">
              VenueIQ &bull; Setup Mode<br />
              (Key fallback removed for security)
            </div>
          </div>
        </div>
    );
  }

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
          <div className="max-w-[1800px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-2 rounded-xl shadow-lg shadow-indigo-200">
                <Zap className="text-white w-5 h-5 fill-white/20" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">VenueIQ</h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-4">
              <button
                  onClick={refreshData}
                  className={`p-2 text-slate-400 hover:text-indigo-600 transition-colors rounded-full hover:bg-indigo-50 ${loading ? 'animate-spin' : ''}`}
                  title="Refresh Data"
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* Top Menu Dropdown for Secondary Tabs */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button className="flex items-center gap-1 p-2 text-slate-600 hover:text-indigo-600 transition-colors rounded-lg hover:bg-slate-50 border border-transparent hover:border-slate-200">
                    <Menu className="w-5 h-5" />
                    <span className="hidden sm:inline text-sm font-bold">More</span>
                    <ChevronDown className="w-4 h-4 opacity-50" />
                  </button>
                </DropdownMenu.Trigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                      className="min-w-[200px] bg-white rounded-2xl p-2 shadow-2xl border border-slate-200 z-[100] animate-in fade-in zoom-in duration-200"
                      sideOffset={8}
                      align="end"
                  >
                    <DropdownItem
                        onClick={() => setActiveTab('court_manager')}
                        icon={<Grid className="w-4 h-4" />}
                        label="Court Manager"
                        active={activeTab === 'court_manager'}
                    />
                    {isAdmin && (
                        <DropdownItem
                            onClick={() => setActiveTab('platforms')}
                            icon={<Globe className="w-4 h-4" />}
                            label="Platforms"
                            active={activeTab === 'platforms'}
                        />
                    )}
                    {isAdmin && (
                        <DropdownItem
                            onClick={() => setActiveTab('finances')}
                            icon={<PieChart className="w-4 h-4" />}
                            label="Finances"
                            active={activeTab === 'finances'}
                        />
                    )}
                    {isAdmin && (
                        <DropdownItem
                            onClick={() => setActiveTab('dashboard')}
                            icon={<LayoutDashboard className="w-4 h-4" />}
                            label="Dashboard"
                            active={activeTab === 'dashboard'}
                        />
                    )}
                    {isAdmin && (
                        <DropdownItem
                            onClick={() => setActiveTab('members')}
                            icon={<Users className="w-4 h-4" />}
                            label="Membership"
                            active={activeTab === 'members'}
                        />
                    )}
                    {isAdmin && (
                        <DropdownItem
                            onClick={() => setActiveTab('coaching')}
                            icon={<Zap className="w-4 h-4" />}
                            label="Coaching"
                            active={activeTab === 'coaching'}
                        />
                    )}
                    <DropdownItem
                        onClick={() => setActiveTab('drinks')}
                        icon={<ShoppingBag className="w-4 h-4" />}
                        label="Drinks Sale"
                        active={activeTab === 'drinks'}
                    />
                    {isAdmin && (
                        <>
                          <DropdownMenu.Separator className="h-px bg-slate-100 my-1" />
                          <DropdownItem
                              onClick={() => setActiveTab('inventory')}
                              icon={<Package className="w-4 h-4" />}
                              label="Inventory"
                              active={activeTab === 'inventory'}
                          />
                          <DropdownItem
                              onClick={() => setActiveTab('plans')}
                              icon={<PlusCircle className="w-4 h-4" />}
                              label="Membership Plans"
                              active={activeTab === 'plans'}
                          />
                          <DropdownItem
                              onClick={() => setActiveTab('users')}
                              icon={<ShieldCheck className="w-4 h-4" />}
                              label="Staff Management"
                              active={activeTab === 'users'}
                          />
                        </>
                    )}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>

              <div className="h-4 w-px bg-slate-200 mx-1 hidden sm:block" />

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
            <div className="max-w-[1600px] mx-auto w-full px-4 mt-4">
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div>
                  <p className="text-sm font-bold">Database Sync Error</p>
                  <p className="text-xs opacity-80">{fetchError}. Please ensure your Supabase tables are created correctly.</p>
                </div>
              </div>
            </div>
        )}

        <main className="flex-1 max-w-[1800px] mx-auto w-full px-4 py-8">
          <div className="flex flex-col lg:flex-row gap-8">
            <nav className="hidden lg:flex flex-col gap-1 w-64 shrink-0">
              <NavButton
                  active={activeTab === 'active'}
                  onClick={() => setActiveTab('active')}
                  icon={<CalendarClock className="w-5 h-5" />}
                  label="Active Bookings"
              />
              <NavButton
                  active={activeTab === 'court_manager'}
                  onClick={() => setActiveTab('court_manager')}
                  icon={<Grid className="w-5 h-5" />}
                  label="Court Manager"
              />
              {isAdmin && (
                  <NavButton
                      active={activeTab === 'platforms'}
                      onClick={() => setActiveTab('platforms')}
                      icon={<Globe className="w-5 h-5" />}
                      label="Platforms"
                  />
              )}
              {isAdmin && (
                  <NavButton
                      active={activeTab === 'finances'}
                      onClick={() => setActiveTab('finances')}
                      icon={<PieChart className="w-5 h-5" />}
                      label="Finances"
                  />
              )}
              {isAdmin && (
                  <NavButton
                      active={activeTab === 'members'}
                      onClick={() => setActiveTab('members')}
                      icon={<Users className="w-5 h-5" />}
                      label="Membership"
                  />
              )}
              {isAdmin && (
                  <NavButton
                      active={activeTab === 'coaching'}
                      onClick={() => setActiveTab('coaching')}
                      icon={<Zap className="w-5 h-5" />}
                      label="Coaching"
                  />
              )}
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
            </nav>

            <div className="flex-1">
              {loading && activeTab !== 'new' ? (
                  <div className="flex items-center justify-center py-20">
                    <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
                  </div>
              ) : (
                  <>
                    {activeTab === 'finances' && isAdmin && (
                        <Finances
                            bookings={appState.bookings}
                            inventory={appState.inventory}
                            posSales={appState.posSales}
                            members={appState.members}
                            students={appState.students}
                            membershipPlans={appState.membershipPlans}
                        />
                    )}
                    {activeTab === 'platforms' && isAdmin && (
                        <PlatformManager
                            platforms={appState.platforms}
                            venueId={appState.profile?.venue_id || appState.user?.id || ''}
                            onRefresh={refreshData}
                        />
                    )}
                    {activeTab === 'dashboard' && isAdmin && (
                        <Dashboard
                            bookings={appState.bookings}
                            inventory={appState.inventory}
                            posSales={appState.posSales}
                            members={appState.members}
                            students={appState.students}
                            membershipPlans={appState.membershipPlans}
                        />
                    )}
                    {activeTab === 'active' && (
                        <ActiveBookings
                            bookings={appState.bookings}
                            inventory={appState.inventory}
                            courts={appState.courts}
                            onUpdate={refreshData}
                            venueName={appState.profile?.venue_name}
                            venueEmail={appState.profile?.admin_email}
                        />
                    )}
                    {activeTab === 'court_manager' && (
                        <CourtsManager
                            courts={appState.courts}
                            bookings={appState.bookings}
                            onUpdate={refreshData}
                            venueId={appState.profile?.venue_id || appState.user?.id}
                            isAdmin={isAdmin}
                            onBookSlot={handleBookSlot}
                            availableSports={appState.profile?.available_sports || []}
                        />
                    )}
                    {activeTab === 'plans' && isAdmin && (
                        <MembershipPlanManager
                            plans={appState.membershipPlans}
                            onUpdate={refreshData}
                            venueId={appState.profile?.venue_id || appState.user?.id}
                            availableSports={appState.profile?.available_sports || []}
                        />
                    )}
                    {activeTab === 'members' && isAdmin && (
                        <MembershipManager
                            members={appState.members}
                            plans={appState.membershipPlans}
                            onUpdate={refreshData}
                            venueId={appState.profile?.venue_id || appState.user?.id}
                            availableSports={appState.profile?.available_sports || []}
                        />
                    )}
                    {activeTab === 'coaching' && isAdmin && (
                        <CoachingUI
                            students={appState.students}
                            onUpdate={refreshData}
                            venueId={appState.profile?.venue_id || appState.user?.id}
                            availableSports={appState.profile?.available_sports || []}
                        />
                    )}
                    {activeTab === 'new' && (
                        <BookingForm
                            onSave={() => {
                              setInitialBookingData(null);
                              refreshData();
                            }}
                            inventory={appState.inventory}
                            courts={appState.courts}
                            membershipPlans={appState.membershipPlans}
                            platforms={appState.platforms}
                            venueId={appState.profile?.venue_id || appState.user?.id}
                            availableSports={appState.profile?.available_sports || []}
                            initialData={initialBookingData || undefined}
                        />
                    )}
                    {activeTab === 'list' && (
                        <BookingList
                            bookings={appState.bookings}
                            inventory={appState.inventory}
                            courts={appState.courts}
                            onDelete={handleDeleteBooking}
                            isAdmin={isAdmin}
                            onUpdate={refreshData}
                            venueName={appState.profile?.venue_name}
                            venueEmail={appState.profile?.admin_email}
                        />
                    )}
                    {activeTab === 'inventory' && isAdmin && (
                        <Inventory
                            inventory={appState.inventory}
                            bookings={appState.bookings}
                            onUpdate={refreshData}
                            venueId={appState.profile?.venue_id || appState.user?.id}
                            userRole={appState.profile?.role}
                        />
                    )}
                    {activeTab === 'drinks' && (
                        <DrinkSales
                            inventory={appState.inventory}
                            sales={appState.posSales}
                            onSave={refreshData}
                            venueId={appState.profile?.venue_id || appState.user?.id}
                        />
                    )}
                    {activeTab === 'users' && isAdmin && (
                        <UserManagement
                            currentProfile={appState.profile}
                            onUpdate={refreshData}
                        />
                    )}
                  </>
              )}
            </div>
          </div>
        </main>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex items-center justify-around py-2 z-20">
          <MobileNavButton active={activeTab === 'active'} onClick={() => setActiveTab('active')} icon={<CalendarClock className="w-6 h-6" />} label="Active" />
          <MobileNavButton active={activeTab === 'court_manager'} onClick={() => setActiveTab('court_manager')} icon={<Grid className="w-6 h-6" />} label="Courts" />
          <MobileNavButton active={activeTab === 'new'} onClick={() => setActiveTab('new')} icon={<PlusCircle className="w-6 h-6" />} label="New" />
          <MobileNavButton active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<List className="w-6 h-6" />} label="All" />
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

const DropdownItem: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => (
    <DropdownMenu.Item
        onClick={onClick}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl outline-none cursor-pointer transition-colors ${
            active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
        }`}
    >
      <div className={active ? 'text-indigo-600' : 'text-slate-400'}>
        {icon}
      </div>
      <span className="text-sm font-bold">{label}</span>
    </DropdownMenu.Item>
);

export default App;
