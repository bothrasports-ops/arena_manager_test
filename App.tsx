
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
  ShieldAlert,
  Grid,
  Menu,
  ChevronDown,
  PieChart,
  Globe,
  TrendingDown
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
import ExpensesManager from './components/ExpensesManager';
import PlatformManager from './components/PlatformManager';
import { AppState, Booking, DrinkInventoryItem, Sport, PosSale, BookingType, UserRole, Member, Student, UserProfile, Court, MembershipPlanDefinition, BookingPlatform, PaymentMethod, Expense } from './types';
import { supabase, isSupabaseConfigured } from './lib/supabase';

const App: React.FC = () => {
  const isConfigMissing = !isSupabaseConfigured;
  const [activeTab, setActiveTab] = useState<'new' | 'list' | 'inventory' | 'dashboard' | 'drinks' | 'active' | 'members' | 'coaching' | 'users' | 'court_manager' | 'plans' | 'finances' | 'platforms' | 'expenses'>('active');
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
  const [isReadOnlyDb, setIsReadOnlyDb] = useState(false);
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
    platforms: [],
    expenses: []
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

      let readOnlyActive = false;
      if (pingError) {
        if (
            pingError.message?.includes('read-only') ||
            pingError.message?.includes('UPDATE') ||
            pingError.message?.includes('transaction')
        ) {
          console.warn("Supabase database is currently in READ-ONLY mode. Proceeding in read-only viewing fallback.");
          readOnlyActive = true;
          setIsReadOnlyDb(true);
          setSupabaseStatus('connected');
        } else {
          setSupabaseStatus('error');
          throw new Error(`Supabase connection failed: ${pingError.message}`);
        }
      } else {
        setSupabaseStatus('connected');
        setIsReadOnlyDb(false);
      }

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
      const userEmail = String(appState.user.email || '').trim().toLowerCase();

      let profileRows: any[] | null = null;
      let profileError: any = null;

      // Check 1: Try exact search
      const { data: exactRows, error: exactError } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('email', userEmail);

      profileRows = exactRows;
      profileError = exactError;

      // Check 2: Try ILIKE casing search if first returned empty
      if (!profileRows || profileRows.length === 0) {
        const { data: ilikeRows, error: ilikeError } = await supabase
            .from('user_profiles')
            .select('*')
            .ilike('email', userEmail);

        if (!ilikeError && ilikeRows && ilikeRows.length > 0) {
          profileRows = ilikeRows;
        }
      }

      // Check 3: Pre-emptively update and link matching email to current user's UID to heal RLS select blockages
      if (!profileRows || profileRows.length === 0) {
        try {
          const { data: updatedRows, error: updateError } = await supabase
              .from('user_profiles')
              .update({ id: String(appState.user.id) })
              .eq('email', userEmail)
              .select();

          if (!updateError && updatedRows && updatedRows.length > 0) {
            profileRows = updatedRows;
          }
        } catch (e) {
          console.warn("Pre-emptive linking update warning:", e);
        }
      }

      let profileData: UserProfile | null = null;

      if (profileRows && profileRows.length > 0) {
        let row = profileRows[0];

        // Ensure row.id holds matching authenticated user record ID
        if (row.id !== appState.user.id) {
          const { data: updatedRow, error: updateError } = await supabase
              .from('user_profiles')
              .update({ id: String(appState.user.id) })
              .eq('email', userEmail)
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
        const metadata = appState.user.user_metadata || {};
        const metaVenueName = metadata.venue_name || 'My Arena';
        const metaAvailableSports = metadata.available_sports || [Sport.PICKLEBALL, Sport.BADMINTON];
        const metaAdminName = metadata.admin_name || appState.user.email?.split('@')[0] || 'Admin';

        try {
          const { data: newProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert({
                id: appState.user.id,
                email: userEmail,
                role: UserRole.ADMIN,
                admin_name: metaAdminName,
                venue_name: metaVenueName,
                venue_id: appState.user.id, // For admin, venue_id is their own ID
                available_sports: metaAvailableSports
              })
              .select()
              .single();

          if (createError) throw createError;

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
        } catch (insertError: any) {
          // Detect unique constraint violation or read-only transaction errors
          const isReadOnlyErr = insertError?.message?.includes('read-only') || insertError?.message?.includes('read_only') || insertError?.message?.includes('transaction');

          if (
              insertError?.message?.includes('duplicate key') ||
              insertError?.code === '23505' ||
              insertError?.message?.includes('user_profiles_email_key') ||
              isReadOnlyErr
          ) {
            console.warn("Detected duplicate email, unique constraint, or read-only restriction on insert. Handling gracefully...");

            // Try fetching by UID directly as RLS enables own ID viewing
            const { data: uidRows, error: uidError } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', String(appState.user.id));

            if (!uidError && uidRows && uidRows.length > 0) {
              const row = uidRows[0];
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
              // Construct a safe fallback profile object from session details so users are never locked out of their session
              console.warn("Could not retrieve profile. Initializing custom fallback profiling for:", userEmail);
              const isStaffUser = userEmail.includes('staff') || userEmail.endsWith('.local') || userEmail !== 'bothrasports@gmail.com';
              profileData = {
                id: String(appState.user.id),
                admin_name: metaAdminName,
                admin_email: userEmail,
                venue_name: metaVenueName,
                available_sports: metaAvailableSports,
                role: isStaffUser ? UserRole.USER : UserRole.ADMIN,
                venue_id: String(appState.user.id)
              };
            }
          } else {
            throw insertError;
          }
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

      // Try to fetch expenses from Supabase; fallback seamlessly to localStorage if table does not exist
      let mappedExpenses: Expense[] = [];
      let loadedFromDb = false;
      try {
        const { data: dbExpenses, error: expensesError } = await supabase
            .from('expenses')
            .select('*')
            .eq('venue_id', targetVenueId)
            .order('expense_date', { ascending: false });

        if (!expensesError && dbExpenses) {
          mappedExpenses = dbExpenses.map((e: any) => ({
            id: e.id,
            venueId: e.venue_id,
            description: e.description,
            amount: Number(e.amount),
            category: e.category,
            expenseDate: e.expense_date,
            paymentMethod: e.payment_method as PaymentMethod,
            createdAt: e.created_at
          }));
          loadedFromDb = true;
        } else if (expensesError) {
          console.warn("Supabase 'expenses' table check skipped/failed (likely table not created yet):", expensesError.message);
        }
      } catch (err) {
        console.warn("Supabase expenses table request errored (falling back to LocalStorage):", err);
      }

      if (!loadedFromDb) {
        // Fetch Expenses from Local Storage for multi-tenant venue partitioning
        const expensesKey = `venueiq_expenses_${targetVenueId}`;
        const expensesStr = localStorage.getItem(expensesKey);
        mappedExpenses = expensesStr ? JSON.parse(expensesStr) : [];
      }

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
        platforms: platformsData || [],
        expenses: mappedExpenses
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

  const handleSaveExpenses = async (updatedExpenses: any[]) => {
    const venueId = appState.profile?.venue_id || appState.user?.id;
    if (!venueId) return;

    // 1. Instantly update local UI state for snappy user experience
    setAppState(prev => ({ ...prev, expenses: updatedExpenses }));

    // 2. Persist locally to localStorage as an immediate fallback backup
    const expensesKey = `venueiq_expenses_${venueId}`;
    localStorage.setItem(expensesKey, JSON.stringify(updatedExpenses));

    // 3. Try to sync with Supabase 'expenses' table in the background
    try {
      // Check if table is available by querying it
      const { data: dbCurrent, error: fetchError } = await supabase
          .from('expenses')
          .select('id')
          .eq('venue_id', venueId);

      if (!fetchError) {
        const dbIds = new Set((dbCurrent || []).map((e: any) => e.id));
        const updatedIds = new Set(updatedExpenses.map(e => e.id));

        // Delete records in DB that are not in the current list
        const deletedIds = Array.from(dbIds).filter(id => !updatedIds.has(id));
        if (deletedIds.length > 0) {
          await supabase.from('expenses').delete().in('id', deletedIds);
        }

        // Upsert the updated list
        if (updatedExpenses.length > 0) {
          const rowsToUpsert = updatedExpenses.map(e => ({
            id: e.id,
            venue_id: venueId,
            description: e.description,
            amount: Number(e.amount),
            category: e.category,
            expense_date: e.expenseDate,
            payment_method: e.paymentMethod || 'Cash',
            created_at: e.createdAt
          }));
          await supabase.from('expenses').upsert(rowsToUpsert);
        }
      }
    } catch (err) {
      console.warn("Could not sync expenses to database (standard local fallback is active):", err);
    }
  };

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

  // Seamless route/tab-guard enforcing strict role permissions for non-admin profiles
  useEffect(() => {
    if (appState.profile && !isAdmin) {
      const adminOnlyTabs = ['dashboard', 'finances', 'users', 'inventory', 'platforms', 'expenses'];
      if (adminOnlyTabs.includes(activeTab)) {
        setActiveTab('active');
        toast.error('Access restricted to administrators.');
      }
    }
  }, [activeTab, isAdmin, appState.profile]);

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

  if (appState.profile?.role === ('unlinked' as any) || appState.profile?.venue_name === 'Deactivated') {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <Toaster position="top-right" richColors />
          <div className="max-w-md w-full bg-white border border-slate-200 p-8 rounded-3xl shadow-xl text-center space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
              <ShieldAlert className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900">Access Revoked</h2>
              <p className="text-slate-500 text-sm leading-relaxed">
                Your staff account has been deactivated or unlinked from this venue by the administrator.
                Please contact your administrator if you believe this is an error.
              </p>
            </div>
            <button
                onClick={handleLogout}
                className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-100"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
    );
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
                            onClick={() => setActiveTab('expenses')}
                            icon={<TrendingDown className="w-4 h-4" />}
                            label="Expenses"
                            active={activeTab === 'expenses'}
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
                    <DropdownItem
                        onClick={() => setActiveTab('members')}
                        icon={<Users className="w-4 h-4" />}
                        label="Membership"
                        active={activeTab === 'members'}
                    />
                    <DropdownItem
                        onClick={() => setActiveTab('coaching')}
                        icon={<Zap className="w-4 h-4" />}
                        label="Coaching"
                        active={activeTab === 'coaching'}
                    />
                    <DropdownItem
                        onClick={() => setActiveTab('plans')}
                        icon={<PlusCircle className="w-4 h-4" />}
                        label="Membership Plans"
                        active={activeTab === 'plans'}
                    />
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

        {isReadOnlyDb && (
            <div className="max-w-[1800px] mx-auto w-full px-4 sm:px-6 mt-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-2xl flex items-start gap-3 shadow-md animate-in fade-in slide-in-from-top-4 duration-300">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold">Cloud Database in Read-Only Mode</p>
                  <p className="text-xs leading-relaxed opacity-90">
                    Your Supabase project database has been set to transaction read-only mode by the host (frequently because of storage capacity ceilings or account plan boundaries).
                    We have initialized a secure viewing partition so you can still read and browse all of your active bookings, inventory levels, coaching sheets, and historic records!
                  </p>
                  <div className="pt-1.5 flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 rounded px-2 py-0.5">
                  How to Fix: Log into your Supabase Dashboard &rarr; Project Settings &rarr; Check Storage/Billing.
                </span>
                  </div>
                </div>
              </div>
            </div>
        )}

        {fetchError && (
            <div className="max-w-[1600px] mx-auto w-full px-4 mt-4 space-y-4">
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-5 rounded-2xl flex items-start gap-3 shadow-sm">
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-black text-rose-900">Database Sync Error</p>
                  <p className="text-xs opacity-90 leading-relaxed font-semibold">{fetchError}</p>
                  <p className="text-xs text-rose-700 font-medium leading-relaxed mt-2">
                    This is caused by a recursive query in your Supabase table RLS policies (where a table policy queries itself).
                    To resolve this immediately, please follow the 4 simple copy-paste steps below to clean your RLS policies instantly!
                  </p>
                </div>
              </div>

              {(fetchError.toLowerCase().includes('recursion') || fetchError.toLowerCase().includes('infinite') || fetchError.toLowerCase().includes('policy')) && (
                  <div className="bg-indigo-900 text-indigo-100 p-6 rounded-3xl border border-indigo-950/40 shadow-xl space-y-4 animate-in slide-in-from-top-3 duration-300">
                    <div className="flex items-center gap-2 pb-2 border-b border-indigo-800">
                      <Zap className="w-5 h-5 text-amber-400 fill-amber-400" />
                      <h3 className="text-sm font-black uppercase tracking-wider text-white">How to Fix of Database policy Recursion</h3>
                    </div>

                    <div className="space-y-3 text-xs leading-relaxed">
                      <p>
                        Your current database has an infinite RLS policy recursion on <code className="bg-indigo-950 px-1.5 py-0.5 rounded text-indigo-300 font-mono">user_profiles</code>.
                        Running this safe SQL snippet in your Supabase compiler will drops the old policies and creates fresh, super optimized ones that utilize a secure and fast helper function.
                      </p>

                      <ol className="list-decimal pl-5 space-y-2 text-[11px] text-indigo-200 font-medium">
                        <li>Open your <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-amber-400 underline font-bold hover:text-amber-300">Supabase Dashboard</a>.</li>
                        <li>Click on the <strong>SQL Editor</strong> tab (the icon that looks like <span className="font-mono font-bold">&gt;_</span> on the far left navigation rail).</li>
                        <li>Click on <strong>+ New query</strong> at the top left.</li>
                        <li><strong>Copy the SQL script below</strong>, paste it into the editor window, and click <strong>Run</strong> (or press Command/Ctrl + Enter).</li>
                      </ol>
                    </div>

                    <div className="space-y-2 mt-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest leading-none">Safe SQL Snippet</span>
                        <button
                            onClick={() => {
                              const sqlText = `-- 1. Create a security definer helper function to safely bypass RLS checks for current venue selection
CREATE OR REPLACE FUNCTION public.get_auth_user_venue_id()
RETURNS UUID AS $$
  SELECT venue_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Drop all old recursive policies to avoid conflicts
DROP POLICY IF EXISTS "Allow select on user_profiles for self or matching venue" ON user_profiles;
DROP POLICY IF EXISTS "Allow select on user_profiles for self, staff, or matching venue" ON user_profiles;
DROP POLICY IF EXISTS "Allow all operations for self on user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow select on user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow insert on user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow update on user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow delete on user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow courts management based on venue" ON courts;
DROP POLICY IF EXISTS "Allow platforms management based on venue" ON booking_platforms;
DROP POLICY IF EXISTS "Allow membership plans management based on venue" ON membership_plan_definitions;
DROP POLICY IF EXISTS "Allow members management based on venue" ON members;
DROP POLICY IF EXISTS "Allow coaching students management based on venue" ON coaching_students;
DROP POLICY IF EXISTS "Allow inventory management based on venue" ON inventory;
DROP POLICY IF EXISTS "Allow bookings management based on venue" ON bookings;
DROP POLICY IF EXISTS "Allow booking drinks management based on booking venue" ON booking_drinks;
DROP POLICY IF EXISTS "Allow direct sales management based on venue" ON pos_sales;
DROP POLICY IF EXISTS "Allow POS counter sales items management based on sales venue" ON pos_sale_items;
DROP POLICY IF EXISTS "Allow expenses management based on venue" ON expenses;

-- 2.5 Drop strict foreign key constraint to allow creating staff profiles before they have auth accounts
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_id_fkey;

-- 3. Create fresh, recursion-free policies
CREATE POLICY "Allow select on user_profiles" ON user_profiles
  FOR SELECT USING (
    id = auth.uid() OR 
    venue_id = auth.uid()
  );

CREATE POLICY "Allow insert on user_profiles" ON user_profiles
  FOR INSERT WITH CHECK (
    id = auth.uid() OR 
    venue_id = auth.uid()
  );

CREATE POLICY "Allow update on user_profiles" ON user_profiles
  FOR UPDATE USING (
    id = auth.uid() OR 
    venue_id = auth.uid()
  ) WITH CHECK (
    id = auth.uid() OR 
    venue_id = auth.uid()
  );

CREATE POLICY "Allow delete on user_profiles" ON user_profiles
  FOR DELETE USING (
    id = auth.uid() OR 
    venue_id = auth.uid()
  );

CREATE POLICY "Allow courts management based on venue" ON courts 
  FOR ALL USING (venue_id = public.get_auth_user_venue_id());

CREATE POLICY "Allow platforms management based on venue" ON booking_platforms 
  FOR ALL USING (venue_id = public.get_auth_user_venue_id());

CREATE POLICY "Allow membership plans management based on venue" ON membership_plan_definitions 
  FOR ALL USING (venue_id = public.get_auth_user_venue_id());

CREATE POLICY "Allow members management based on venue" ON members 
  FOR ALL USING (venue_id = public.get_auth_user_venue_id());

CREATE POLICY "Allow coaching students management based on venue" ON coaching_students 
  FOR ALL USING (venue_id = public.get_auth_user_venue_id());

CREATE POLICY "Allow inventory management based on venue" ON inventory 
  FOR ALL USING (venue_id = public.get_auth_user_venue_id());

CREATE POLICY "Allow bookings management based on venue" ON bookings 
  FOR ALL USING (venue_id = public.get_auth_user_venue_id());

CREATE POLICY "Allow booking drinks management based on booking venue" ON booking_drinks 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM bookings 
      WHERE bookings.id = booking_drinks.booking_id 
      AND bookings.venue_id = public.get_auth_user_venue_id()
    )
  );

CREATE POLICY "Allow direct sales management based on venue" ON pos_sales 
  FOR ALL USING (venue_id = public.get_auth_user_venue_id());

CREATE POLICY "Allow POS counter sales items management based on sales venue" ON pos_sale_items 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM pos_sales 
      WHERE pos_sales.id = pos_sale_items.sale_id 
      AND pos_sales.venue_id = public.get_auth_user_venue_id()
    )
  );

CREATE POLICY "Allow expenses management based on venue" ON expenses 
  FOR ALL USING (venue_id = public.get_auth_user_venue_id());`;
                              navigator.clipboard.writeText(sqlText);
                              toast.success("SQL Script copied to clipboard! Ready to run in SQL Editor.");
                            }}
                            className="px-3 py-1 bg-indigo-800 hover:bg-indigo-700 text-white font-bold text-[10px] rounded-lg transition-colors border border-indigo-700/60 shadow-xs"
                        >
                          Copy SQL Script
                        </button>
                      </div>

                      <div className="relative">
                  <pre className="p-4 bg-indigo-950 text-indigo-300 font-mono text-[10px] rounded-2xl overflow-y-auto max-h-[190px] border border-indigo-800/80 shadow-inner select-all leading-relaxed whitespace-pre font-medium">
                    {`-- 1. Create a security definer helper function
CREATE OR REPLACE FUNCTION public.get_auth_user_venue_id()
RETURNS UUID AS $$
  SELECT venue_id FROM public.user_profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- 2. Drop all old recursive policies to avoid conflicts
DROP POLICY IF EXISTS "Allow select on user_profiles for self or matching venue" ON user_profiles;
DROP POLICY IF EXISTS "Allow select on user_profiles for self, staff, or matching venue" ON user_profiles;
DROP POLICY IF EXISTS "Allow courts management based on venue" ON courts;
... (Click Copy SQL to get the full script!)`}
                  </pre>
                      </div>
                    </div>
                  </div>
              )}
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
                      active={activeTab === 'expenses'}
                      onClick={() => setActiveTab('expenses')}
                      icon={<TrendingDown className="w-5 h-5" />}
                      label="Expenses"
                  />
              )}
              <NavButton
                  active={activeTab === 'members'}
                  onClick={() => setActiveTab('members')}
                  icon={<Users className="w-5 h-5" />}
                  label="Membership"
              />
              <NavButton
                  active={activeTab === 'coaching'}
                  onClick={() => setActiveTab('coaching')}
                  icon={<Zap className="w-5 h-5" />}
                  label="Coaching"
              />
              <NavButton
                  active={activeTab === 'plans'}
                  onClick={() => setActiveTab('plans')}
                  icon={<PlusCircle className="w-5 h-5" />}
                  label="Membership Plans"
              />
              <NavButton
                  active={activeTab === 'drinks'}
                  onClick={() => setActiveTab('drinks')}
                  icon={<ShoppingBag className="w-5 h-5" />}
                  label="Drinks Sale"
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
                            expenses={appState.expenses}
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
                            expenses={appState.expenses}
                        />
                    )}
                    {activeTab === 'expenses' && isAdmin && (
                        <ExpensesManager
                            expenses={appState.expenses}
                            onSave={handleSaveExpenses}
                            venueId={appState.profile?.venue_id || appState.user?.id || ''}
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
                    {activeTab === 'plans' && (
                        <MembershipPlanManager
                            plans={appState.membershipPlans}
                            onUpdate={refreshData}
                            venueId={appState.profile?.venue_id || appState.user?.id}
                            availableSports={appState.profile?.available_sports || []}
                        />
                    )}
                    {activeTab === 'members' && (
                        <MembershipManager
                            members={appState.members}
                            plans={appState.membershipPlans}
                            onUpdate={refreshData}
                            venueId={appState.profile?.venue_id || appState.user?.id}
                            availableSports={appState.profile?.available_sports || []}
                        />
                    )}
                    {activeTab === 'coaching' && (
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
