
import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  ArrowUpRight,
  ShoppingBag,
  ChevronDown,
  Clock,
  Hexagon,
  Coins,
  CreditCard,
  GraduationCap,
  Download,
  FileText,
  Table as TableIcon,
  Scale,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Booking, DrinkInventoryItem, Sport, PosSale, BookingType, Member, Student, PaymentMethod, MembershipPlanDefinition, Expense } from '../types';
import { exportToCSV, exportToExcel, exportToPDF } from '../lib/exportUtil';
import { getAvailableMonths, formatMonthLabel, calculateMonthStats } from '../lib/comparisonUtil';
import { toast } from 'sonner';

interface DashboardProps {
  bookings: Booking[];
  inventory: DrinkInventoryItem[];
  posSales: PosSale[];
  members: Member[];
  students: Student[];
  membershipPlans: MembershipPlanDefinition[];
  expenses?: Expense[];
}

type TimeRange = 'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

const Dashboard: React.FC<DashboardProps> = ({ bookings, inventory, posSales, members, students, membershipPlans, expenses = [] }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [sportFilter, setSportFilter] = useState<string>('All');
  const [compareMode, setCompareMode] = useState<boolean>(false);

  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const yyyy = firstDay.getFullYear();
    const mm = String(firstDay.getMonth() + 1).padStart(2, '0');
    const dd = String(firstDay.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const yyyy = lastDay.getFullYear();
    const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
    const dd = String(lastDay.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  // Available months derived from existing datasets
  const availableMonths = useMemo(() => getAvailableMonths(bookings, posSales, expenses), [bookings, posSales, expenses]);

  // Default monthA to the current month or first available month
  const [monthA, setMonthA] = useState<string>(() => {
    const now = new Date();
    const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return availableMonths.includes(current) ? current : (availableMonths[0] || current);
  });

  // Default monthB to previous month
  const [monthB, setMonthB] = useState<string>(() => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prev = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return availableMonths.includes(prev) ? prev : (availableMonths[1] || availableMonths[0] || prev);
  });

  const comparisonData = useMemo(() => {
    if (!compareMode) return null;
    const statsA = calculateMonthStats(monthA, bookings, inventory, posSales, members, students, membershipPlans, expenses, sportFilter);
    const statsB = calculateMonthStats(monthB, bookings, inventory, posSales, members, students, membershipPlans, expenses, sportFilter);

    const calculateDiff = (valA: number, valB: number) => {
      const diff = valA - valB;
      const pct = valB !== 0 ? (diff / valB) * 100 : 0;
      return { diff, pct };
    };

    return {
      statsA,
      statsB,
      revenue: calculateDiff(statsA.totalRevenue, statsB.totalRevenue),
      expenses: calculateDiff(statsA.totalExpenses, statsB.totalExpenses),
      profit: calculateDiff(statsA.totalProfit, statsB.totalProfit),
      drinksSold: calculateDiff(statsA.totalDrinksSold, statsB.totalDrinksSold),
      bookingsCount: calculateDiff(statsA.bookingCount, statsB.bookingCount),
      courtRevenue: calculateDiff(statsA.totalBookingRevenue, statsB.totalBookingRevenue),
      membershipRevenue: calculateDiff(statsA.totalMembershipRevenue, statsB.totalMembershipRevenue),
      coachingRevenue: calculateDiff(statsA.totalCoachingRevenue, statsB.totalCoachingRevenue),
      drinkRevenue: calculateDiff(statsA.totalDrinkRevenue, statsB.totalDrinkRevenue),
    };
  }, [compareMode, monthA, monthB, bookings, inventory, posSales, members, students, membershipPlans, expenses, sportFilter]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(currentMonth / 3);

    // Get start of week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const isInRange = (dateInput: string | number) => {
      const date = new Date(dateInput);
      switch (timeRange) {
        case 'daily':
          return date.toDateString() === now.toDateString();
        case 'weekly':
          return date >= startOfWeek;
        case 'monthly':
          return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        case 'quarterly':
          return Math.floor(date.getMonth() / 3) === currentQuarter && date.getFullYear() === currentYear;
        case 'yearly':
          return date.getFullYear() === currentYear;
        case 'custom':
          if (customStartDate && customEndDate) {
            const start = new Date(customStartDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(customEndDate);
            end.setHours(23, 59, 59, 999);
            return date >= start && date <= end;
          }
          return true;
        default:
          return true;
      }
    };

    // Filter bookings based on selected time range and sport
    const filteredBookings = bookings.filter(booking => {
      const matchesSport = sportFilter === 'All' || booking.sport === sportFilter;
      if (!matchesSport) return false;
      return isInRange(booking.timestamp);
    });

    // Filter members based on selected time range and sport
    const filteredMembers = members.filter(member => {
      const matchesSport = sportFilter === 'All' || member.sport === sportFilter;
      if (!matchesSport) return false;
      return isInRange(member.startDate);
    });

    // Filter students based on selected time range and sport
    const filteredStudents = students.filter(student => {
      const matchesSport = sportFilter === 'All' || student.sport === sportFilter;
      if (!matchesSport) return false;
      return isInRange(student.startDate);
    });

    const courtBookingsCount = filteredBookings.filter(b => (b.bookingType || BookingType.COURT) === BookingType.COURT).length;
    const membershipBookingsCount = filteredMembers.length;
    const coachingBookingsCount = filteredStudents.length;

    // Filter POS sales based on time range
    const filteredPosSales = posSales.filter(sale => isInRange(sale.createdAt));

    // Calculate drink sales breakdown
    const drinkSales: Record<string, { name: string; quantity: number; revenue: number; cost: number }> = {};

    // Initialize with all inventory items
    inventory.forEach(item => {
      drinkSales[item.id] = { name: item.name, quantity: 0, revenue: 0, cost: 0 };
    });

    let totalDrinksSold = 0;
    let totalDrinkRevenue = 0;
    let totalDrinkCost = 0;
    let totalBookingRevenue = 0;
    let totalMembershipRevenue = 0;
    let totalCoachingRevenue = 0;

    // Process Bookings
    filteredBookings.forEach(booking => {
      const bookingType = booking.bookingType || BookingType.COURT;

      if (bookingType === BookingType.COURT) {
        totalBookingRevenue += Number(booking.bookingAmount) + (booking.extraHours.enabled ? Number(booking.extraHours.amount) : 0);
      } else if (bookingType === BookingType.MEMBERSHIP) {
        totalMembershipRevenue += Number(booking.bookingAmount);
      } else if (bookingType === BookingType.COACHING) {
        totalCoachingRevenue += Number(booking.coachingFee || 0);
      }

      booking.selectedDrinks.forEach(drink => {
        const invItem = inventory.find(i => i.id === drink.drinkId);
        if (drinkSales[drink.drinkId]) {
          const qty = Number(drink.quantity) || 0;
          const sellPrice = Number(drink.priceAtTime);
          const purchasePrice = invItem?.purchasePrice || 0;

          drinkSales[drink.drinkId].quantity += qty;
          drinkSales[drink.drinkId].revenue += qty * sellPrice;
          drinkSales[drink.drinkId].cost += qty * purchasePrice;

          totalDrinksSold += qty;
          totalDrinkRevenue += qty * sellPrice;
          totalDrinkCost += qty * purchasePrice;
        }
      });
    });

    // Process Members table revenue
    filteredMembers.forEach(member => {
      const planName = member.plan || 'Monthly';
      const matchedPlan = membershipPlans?.find(p =>
          p.sport === member.sport &&
          (p.name?.toLowerCase() === planName.toLowerCase() ||
              p.duration?.toLowerCase() === planName.toLowerCase())
      );
      const price = matchedPlan ? matchedPlan.price : (
          planName.toLowerCase() === 'monthly' ? 1500 :
              planName.toLowerCase() === 'quarterly' ? 4000 :
                  planName.toLowerCase() === 'yearly' ? 12000 : 1000
      );
      totalMembershipRevenue += price;
    });

    // Process Students table revenue
    filteredStudents.forEach(student => {
      totalCoachingRevenue += Number(student.coachingFee || 0);
    });

    // Process POS Sales
    filteredPosSales.forEach(sale => {
      sale.items.forEach(item => {
        const invItem = inventory.find(i => i.id === item.drinkId);
        if (drinkSales[item.drinkId]) {
          const qty = Number(item.quantity) || 0;
          const sellPrice = Number(item.priceAtTime);
          const purchasePrice = invItem?.purchasePrice || 0;

          drinkSales[item.drinkId].quantity += qty;
          drinkSales[item.drinkId].revenue += qty * sellPrice;
          drinkSales[item.drinkId].cost += qty * purchasePrice;

          totalDrinksSold += qty;
          totalDrinkRevenue += qty * sellPrice;
          totalDrinkCost += qty * purchasePrice;
        }
      });
    });

    const sortedSales = Object.values(drinkSales).sort((a, b) => b.quantity - a.quantity);

    // Calculate revenue by payment method
    const revenueByMethod: Record<string, number> = {};
    filteredBookings.forEach(booking => {
      const method1 = booking.paymentMethod;
      const method2 = booking.finalPaymentMethod;
      const advance = Number(booking.advancePaid || 0);
      const balance = Number(booking.balancePaid || 0);

      if (booking.status === 'completed' && method2) {
        if (method1 && method1 !== method2) {
          // Split between two methods
          const bAmount = balance;
          const aAmount = advance - bAmount;
          revenueByMethod[method1] = (revenueByMethod[method1] || 0) + aAmount;
          revenueByMethod[method2] = (revenueByMethod[method2] || 0) + bAmount;
        } else {
          // Single method (either method1 was null or same as method2)
          const targetMethod = method2 || method1;
          if (targetMethod) {
            revenueByMethod[targetMethod] = (revenueByMethod[targetMethod] || 0) + advance;
          }
        }
      } else if (method1) {
        // Not completed, or completed without method2 (fully prepaid at start)
        revenueByMethod[method1] = (revenueByMethod[method1] || 0) + advance;
      }
    });

    // Add POS sales - assuming POS sales have a payment method (I added it to the type)
    filteredPosSales.forEach(sale => {
      if (sale.paymentMethod) {
        revenueByMethod[sale.paymentMethod] = (revenueByMethod[sale.paymentMethod] || 0) + sale.totalAmount;
      }
    });

    const rangeLabels: Record<TimeRange, string> = {
      all: 'Lifetime',
      daily: 'Today',
      weekly: 'This Week',
      monthly: 'This Month',
      quarterly: 'This Quarter',
      yearly: 'This Year',
      custom: 'Custom Range'
    };

    const rangeSubtitles: Record<TimeRange, string> = {
      all: 'All-time performance',
      daily: now.toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' }),
      weekly: `Since ${startOfWeek.toLocaleDateString('default', { day: 'numeric', month: 'short' })}`,
      monthly: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      quarterly: `Q${currentQuarter + 1} ${currentYear}`,
      yearly: `${currentYear}`,
      custom: customStartDate && customEndDate
          ? `${new Date(customStartDate).toLocaleDateString('default', { day: 'numeric', month: 'short' })} to ${new Date(customEndDate).toLocaleDateString('default', { day: 'numeric', month: 'short' })}`
          : 'Select dates'
    };

    const filteredExpenses = expenses.filter(e => isInRange(e.expenseDate));
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e?.amount, 0);

    const totalRevenue = totalDrinkRevenue + totalBookingRevenue + totalMembershipRevenue + totalCoachingRevenue;
    const totalProfit = (totalDrinkRevenue - totalDrinkCost) + totalBookingRevenue + totalMembershipRevenue + totalCoachingRevenue - totalExpenses;

    // Membership Stats
    const activeMembers = members.filter(m => m.status === 'active' || m.status === 'renewal_required').length;
    const expiredMembers = members.filter(m => m.status === 'expired').length;

    // Coaching Stats
    const activeStudents = students.filter(s => s.status === 'active').length;
    const expiredStudents = students.filter(s => s.status === 'expired').length;

    return {
      totalDrinksSold,
      totalDrinkRevenue,
      totalDrinkCost,
      totalBookingRevenue,
      totalMembershipRevenue,
      totalCoachingRevenue,
      totalRevenue,
      totalProfit,
      totalExpenses,
      salesBreakdown: sortedSales,
      bookingCount: courtBookingsCount,
      membershipTransactionCount: membershipBookingsCount,
      coachingTransactionCount: coachingBookingsCount,
      rangeLabel: rangeLabels[timeRange],
      rangeSubtitle: rangeSubtitles[timeRange],
      activeMembers,
      expiredMembers,
      activeStudents,
      expiredStudents,
      revenueByMethod
    };
  }, [bookings, inventory, posSales, members, students, timeRange, customStartDate, customEndDate, sportFilter, membershipPlans, expenses]);

  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExport = (format: 'csv' | 'excel' | 'pdf') => {
    const fileName = `VenueIQ_Dashboard_${stats.rangeLabel}_${new Date().toISOString().split('T')[0]}`;

    // Prepare data for export
    const summaryData = [{
      Category: 'Overall',
      Label: stats.rangeLabel,
      Subtitle: stats.rangeSubtitle,
      Total_Revenue: stats.totalRevenue,
      Total_Expenses: stats.totalExpenses,
      Estimated_Profit: stats.totalProfit,
      Drinks_Sold: stats.totalDrinksSold,
      Total_Bookings: stats.bookingCount,
      Active_Members: stats.activeMembers,
      Active_Students: stats.activeStudents,
      Court_Revenue: stats.totalBookingRevenue,
      Membership_Revenue: stats.totalMembershipRevenue,
      Coaching_Revenue: stats.totalCoachingRevenue,
      Drink_Revenue: stats.totalDrinkRevenue
    }];

    const breakdownData = stats.salesBreakdown.map(item => ({
      Item_Name: item.name,
      Quantity: item.quantity,
      Revenue: item.revenue,
      Cost: item.cost,
      Profit: item.revenue - item.cost
    }));

    // Combine or use specific for formats
    const fullData = [...summaryData, ...breakdownData];

    try {
      if (format === 'csv') exportToCSV(fullData, fileName);
      else if (format === 'excel') exportToExcel(fullData, fileName);
      else if (format === 'pdf') exportToPDF(fullData, fileName, `VenueIQ Dashboard - ${stats.rangeLabel}`);

      toast.success(`Report exported as ${format.toUpperCase()}`);
      setShowExportMenu(false);
    } catch (error) {
      toast.error('Failed to export report');
      console.error(error);
    }
  };

  return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
        {/* Filters & Comparison Selector */}
        <div className="flex flex-col xl:flex-row items-center gap-4">
          {/* MoM Comparison Selector */}
          <div className="flex-1 w-full flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mr-auto">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-300 ${compareMode ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">Month Comparison Mode</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {compareMode ? 'Comparing two custom periods' : 'Compare custom months side-by-side'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <button
                  onClick={() => setCompareMode(!compareMode)}
                  className={`px-4 py-2.5 text-xs font-black rounded-xl transition-all border flex items-center gap-2 cursor-pointer ${compareMode ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100' : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'}`}
              >
                <span>{compareMode ? '✓ Comparison Active' : '📊 Compare Months'}</span>
              </button>

              {compareMode && (
                  <div className="flex items-center gap-2 w-full sm:w-auto animate-in fade-in zoom-in-95 duration-200">
                    <div className="relative group flex-1 sm:flex-initial">
                      <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold text-indigo-500 z-10">Base Month</span>
                      <select
                          value={monthA}
                          onChange={(e) => setMonthA(e.target.value)}
                          className="appearance-none bg-slate-50 border border-indigo-200 text-slate-900 text-xs font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block pl-3 pr-8 py-2 outline-none cursor-pointer hover:bg-indigo-50/50 transition-all"
                      >
                        {availableMonths.map(m => (
                            <option key={m} value={m}>{formatMonthLabel(m)}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-indigo-400 pointer-events-none" />
                    </div>

                    <span className="text-slate-400 font-bold text-xs shrink-0">vs</span>

                    <div className="relative group flex-1 sm:flex-initial">
                      <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold text-indigo-500 z-10">Compare with</span>
                      <select
                          value={monthB}
                          onChange={(e) => setMonthB(e.target.value)}
                          className="appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block pl-3 pr-8 py-2 outline-none cursor-pointer hover:bg-slate-100 transition-all"
                      >
                        {availableMonths.map(m => (
                            <option key={m} value={m}>{formatMonthLabel(m)}</option>
                        ))}
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
              )}
            </div>
          </div>

          {/* Regular TimeRange filter (only visible if compareMode is false) */}
          {!compareMode && (
              <div className="w-full xl:w-auto flex flex-col md:flex-row items-stretch md:items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative shrink-0 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                    <Clock className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="mr-4">
                    <h3 className="text-sm font-bold text-slate-900">Period</h3>
                    <p className="text-xs text-slate-500 font-medium">{(stats.rangeLabel || '').toLowerCase()}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {timeRange === 'custom' && (
                      <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2 duration-300">
                        <div className="relative group">
                          <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold text-indigo-500 z-10">Start</span>
                          <input
                              type="date"
                              value={customStartDate}
                              onChange={(e) => setCustomStartDate(e.target.value)}
                              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block px-3 py-2 outline-none cursor-pointer hover:bg-slate-100 transition-all"
                          />
                        </div>
                        <span className="text-slate-400 font-bold text-xs shrink-0">to</span>
                        <div className="relative group">
                          <span className="absolute -top-2 left-2 px-1 bg-white text-[9px] font-bold text-indigo-500 z-10">End</span>
                          <input
                              type="date"
                              value={customEndDate}
                              onChange={(e) => setCustomEndDate(e.target.value)}
                              className="bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block px-3 py-2 outline-none cursor-pointer hover:bg-slate-100 transition-all"
                          />
                        </div>
                      </div>
                  )}

                  <div className="relative group">
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                        className="appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block pl-3 pr-8 py-2 outline-none cursor-pointer hover:bg-slate-100 transition-all"
                    >
                      <option value="all">Lifetime</option>
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                      <option value="custom">Custom Range</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>
          )}

          {/* Export and Sport Filters */}
          <div className="w-full xl:w-auto flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100">
                <Hexagon className="w-5 h-5 text-amber-600" />
              </div>
              <div className="mr-4">
                <h3 className="text-sm font-bold text-slate-900">Sport</h3>
                <p className="text-xs text-slate-500 font-medium">{sportFilter}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative group">
                <select
                    value={sportFilter}
                    onChange={(e) => setSportFilter(e.target.value)}
                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-xs font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block pl-3 pr-8 py-2 outline-none cursor-pointer hover:bg-slate-100 transition-all"
                >
                  <option value="All">All Sports</option>
                  {Object.values(Sport).map(s => (
                      <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
              </div>

              <div className="relative">
                <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-1 px-3 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </button>

                {showExportMenu && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                      <button
                          onClick={() => handleExport('csv')}
                          className="w-full px-4 py-2 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                      >
                        <FileText className="w-4 h-4" />
                        CSV Report
                      </button>
                      <button
                          onClick={() => handleExport('excel')}
                          className="w-full px-4 py-2 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                      >
                        <TableIcon className="w-4 h-4 text-emerald-600" />
                        Excel Spreadsheet
                      </button>
                      <button
                          onClick={() => handleExport('pdf')}
                          className="w-full px-4 py-2 text-left text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3"
                      >
                        <FileText className="w-4 h-4 text-rose-600" />
                        PDF Document
                      </button>
                    </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {compareMode && comparisonData ? (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Comparison Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <ComparisonStatCard
                    title="Total Revenue"
                    valA={comparisonData.statsA.totalRevenue}
                    valB={comparisonData.statsB.totalRevenue}
                    diff={comparisonData.revenue.diff}
                    pct={comparisonData.revenue.pct}
                    monthA={formatMonthLabel(monthA)}
                    monthB={formatMonthLabel(monthB)}
                    isCurrency={true}
                    color="emerald"
                />
                <ComparisonStatCard
                    title="Operating Expenses"
                    valA={comparisonData.statsA.totalExpenses}
                    valB={comparisonData.statsB.totalExpenses}
                    diff={comparisonData.expenses.diff}
                    pct={comparisonData.expenses.pct}
                    monthA={formatMonthLabel(monthA)}
                    monthB={formatMonthLabel(monthB)}
                    isCurrency={true}
                    color="rose"
                    invertColors={true}
                />
                <ComparisonStatCard
                    title="Net Profit"
                    valA={comparisonData.statsA.totalProfit}
                    valB={comparisonData.statsB.totalProfit}
                    diff={comparisonData.profit.diff}
                    pct={comparisonData.profit.pct}
                    monthA={formatMonthLabel(monthA)}
                    monthB={formatMonthLabel(monthB)}
                    isCurrency={true}
                    color="indigo"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ComparisonStatCard
                    title="Total Bookings"
                    valA={comparisonData.statsA.bookingCount}
                    valB={comparisonData.statsB.bookingCount}
                    diff={comparisonData.bookingsCount.diff}
                    pct={comparisonData.bookingsCount.pct}
                    monthA={formatMonthLabel(monthA)}
                    monthB={formatMonthLabel(monthB)}
                    isCurrency={false}
                    color="amber"
                />
                <ComparisonStatCard
                    title="Drinks Sold"
                    valA={comparisonData.statsA.totalDrinksSold}
                    valB={comparisonData.statsB.totalDrinksSold}
                    diff={comparisonData.drinksSold.diff}
                    pct={comparisonData.drinksSold.pct}
                    monthA={formatMonthLabel(monthA)}
                    monthB={formatMonthLabel(monthB)}
                    isCurrency={false}
                    color="indigo"
                />
              </div>

              {/* Visual Comparison Chart */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <div>
                    <h3 className="text-base font-black text-slate-900">Revenue Component Breakdown</h3>
                    <p className="text-xs text-slate-500 font-medium">Side-by-side performance of revenue sectors and expenses</p>
                  </div>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart
                        data={[
                          {
                            name: 'Court Bookings',
                            [formatMonthLabel(monthA)]: comparisonData.statsA.totalBookingRevenue,
                            [formatMonthLabel(monthB)]: comparisonData.statsB.totalBookingRevenue,
                          },
                          {
                            name: 'Memberships',
                            [formatMonthLabel(monthA)]: comparisonData.statsA.totalMembershipRevenue,
                            [formatMonthLabel(monthB)]: comparisonData.statsB.totalMembershipRevenue,
                          },
                          {
                            name: 'Coaching Fees',
                            [formatMonthLabel(monthA)]: comparisonData.statsA.totalCoachingRevenue,
                            [formatMonthLabel(monthB)]: comparisonData.statsB.totalCoachingRevenue,
                          },
                          {
                            name: 'Drink Sales',
                            [formatMonthLabel(monthA)]: comparisonData.statsA.totalDrinkRevenue,
                            [formatMonthLabel(monthB)]: comparisonData.statsB.totalDrinkRevenue,
                          },
                          {
                            name: 'Expenses',
                            [formatMonthLabel(monthA)]: comparisonData.statsA.totalExpenses,
                            [formatMonthLabel(monthB)]: comparisonData.statsB.totalExpenses,
                          }
                        ]}
                        margin={{ top: 20, right: 30, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} fontWeight={600} tickLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value.toLocaleString()}`} />
                      <RechartsTooltip formatter={(value: any) => `₹${Number(value).toLocaleString()}`} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                      <Legend />
                      <Bar dataKey={formatMonthLabel(monthA)} fill="#6366f1" radius={[6, 6, 0, 0]} />
                      <Bar dataKey={formatMonthLabel(monthB)} fill="#cbd5e1" radius={[6, 6, 0, 0]} />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* MoM Detailed Comparison Table */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-900 px-6 py-4">
                  <h3 className="text-white font-bold text-base flex items-center gap-2">
                    <TableIcon className="w-4 h-4" />
                    Line-by-Line Revenue & Profit Comparison Statement
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                      <th className="py-4 px-6">Line Item / Metric</th>
                      <th className="py-4 px-6 text-right">{formatMonthLabel(monthA)} (Base)</th>
                      <th className="py-4 px-6 text-right">{formatMonthLabel(monthB)} (Compare)</th>
                      <th className="py-4 px-6 text-right">Variance</th>
                      <th className="py-4 px-6 text-right">Variance %</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                    <ComparisonTableRow label="Court Rental Bookings" valA={comparisonData.statsA.totalBookingRevenue} valB={comparisonData.statsB.totalBookingRevenue} isCurrency={true} />
                    <ComparisonTableRow label="Membership Collections" valA={comparisonData.statsA.totalMembershipRevenue} valB={comparisonData.statsB.totalMembershipRevenue} isCurrency={true} />
                    <ComparisonTableRow label="Coaching Academy Fees" valA={comparisonData.statsA.totalCoachingRevenue} valB={comparisonData.statsB.totalCoachingRevenue} isCurrency={true} />
                    <ComparisonTableRow label="Beverage & Snacks Sales" valA={comparisonData.statsA.totalDrinkRevenue} valB={comparisonData.statsB.totalDrinkRevenue} isCurrency={true} />
                    <tr className="bg-indigo-50/30 font-bold border-t border-indigo-100">
                      <td className="py-4 px-6 text-indigo-950">Total Gross Revenue</td>
                      <td className="py-4 px-6 text-right text-indigo-950">₹{comparisonData.statsA.totalRevenue.toLocaleString()}</td>
                      <td className="py-4 px-6 text-right text-slate-600">₹{comparisonData.statsB.totalRevenue.toLocaleString()}</td>
                      <td className={`py-4 px-6 text-right ${comparisonData.revenue.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {comparisonData.revenue.diff >= 0 ? '+' : ''}₹{comparisonData.revenue.diff.toLocaleString()}
                      </td>
                      <td className={`py-4 px-6 text-right ${comparisonData.revenue.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {comparisonData.revenue.diff >= 0 ? '▲' : '▼'} {comparisonData.revenue.pct.toFixed(1)}%
                      </td>
                    </tr>
                    <ComparisonTableRow label="Wholesale Drinks Cost Price" valA={comparisonData.statsA.totalDrinkCost} valB={comparisonData.statsB.totalDrinkCost} isCurrency={true} invertTrend={true} />
                    <ComparisonTableRow label="Logged Operating Expenses" valA={comparisonData.statsA.totalExpenses} valB={comparisonData.statsB.totalExpenses} isCurrency={true} invertTrend={true} />
                    <tr className="bg-emerald-50/50 font-extrabold border-t border-emerald-100 text-base">
                      <td className="py-4 px-6 text-emerald-950">Estimated Net Profit</td>
                      <td className="py-4 px-6 text-right text-emerald-950">₹{comparisonData.statsA.totalProfit.toLocaleString()}</td>
                      <td className="py-4 px-6 text-right text-slate-600">₹{comparisonData.statsB.totalProfit.toLocaleString()}</td>
                      <td className={`py-4 px-6 text-right ${comparisonData.profit.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {comparisonData.profit.diff >= 0 ? '+' : ''}₹{comparisonData.profit.diff.toLocaleString()}
                      </td>
                      <td className={`py-4 px-6 text-right ${comparisonData.profit.diff >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {comparisonData.profit.diff >= 0 ? '▲' : '▼'} {comparisonData.profit.pct.toFixed(1)}%
                      </td>
                    </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
        ) : (
            <>

              {/* Header Stats */}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <StatCard
                    title={`${stats.rangeLabel} Revenue`}
                    value={`₹${stats.totalRevenue.toLocaleString()}`}
                    subtitle={stats.rangeSubtitle}
                    icon={<TrendingUp className="w-6 h-6 text-emerald-600" />}
                    color="emerald"
                />
                <StatCard
                    title="Operating Expenses"
                    value={`₹${stats.totalExpenses.toLocaleString()}`}
                    subtitle="Outflow in selected range"
                    icon={<TrendingDown className="w-6 h-6 text-rose-600" />}
                    color="rose"
                />
                <StatCard
                    title="Estimated Profit"
                    value={`₹${stats.totalProfit.toLocaleString()}`}
                    subtitle="Revenue - Cost & Expenses"
                    icon={<Coins className="w-6 h-6 text-blue-600" />}
                    color="indigo"
                />
                <StatCard
                    title="Drinks Sold"
                    value={stats.totalDrinksSold.toString()}
                    subtitle={`Units ${(stats.rangeLabel || '').toLowerCase()}`}
                    icon={<ShoppingBag className="w-6 h-6 text-indigo-600" />}
                    color="indigo"
                />
                <StatCard
                    title="Total Bookings"
                    value={stats.bookingCount.toString()}
                    subtitle="Completed sessions"
                    icon={<Calendar className="w-6 h-6 text-amber-600" />}
                    color="amber"
                />
              </div>

              {/* Payment Method Breakdown */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.values(PaymentMethod).map(method => (
                    <div key={method} className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-100">
                          <CreditCard className="w-4 h-4 text-slate-400" />
                        </div>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{method}</span>
                      </div>
                      <span className="text-sm font-black text-slate-900">₹{(stats.revenueByMethod[method] || 0).toLocaleString()}</span>
                    </div>
                ))}
              </div>

              {/* Revenue Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
                  <h3 className="text-slate-900 font-bold mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-500" />
                    Court Revenue
                  </h3>
                  <p className="text-2xl font-black text-slate-900">₹{stats.totalBookingRevenue.toLocaleString()}</p>
                  <div className="flex gap-3 mt-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Bookings: {stats.bookingCount}</p>
                  </div>
                </div>
                <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <h3 className="text-indigo-900 font-bold mb-2 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-500" />
                    Membership
                  </h3>
                  <p className="text-2xl font-black text-indigo-600">₹{stats.totalMembershipRevenue.toLocaleString()}</p>
                  <div className="flex gap-3 mt-1">
                    <p className="text-[10px] text-emerald-600 font-bold uppercase">Active: {stats.activeMembers}</p>
                    <p className="text-[10px] text-rose-400 font-bold uppercase">Exp: {stats.expiredMembers}</p>
                  </div>
                </div>
                <div className="p-6 bg-amber-50 rounded-3xl border border-amber-100">
                  <h3 className="text-amber-900 font-bold mb-2 flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-amber-500" />
                    Coaching
                  </h3>
                  <p className="text-2xl font-black text-amber-600">₹{stats.totalCoachingRevenue.toLocaleString()}</p>
                  <div className="flex gap-3 mt-1">
                    <p className="text-[10px] text-emerald-600 font-bold uppercase">Active: {stats.activeStudents}</p>
                    <p className="text-[10px] text-rose-400 font-bold uppercase">Exp: {stats.expiredStudents}</p>
                  </div>
                </div>
                <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
                  <h3 className="text-emerald-900 font-bold mb-2 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-emerald-500" />
                    Drink Sales
                  </h3>
                  <p className="text-2xl font-black text-emerald-600">₹{stats.totalDrinkRevenue.toLocaleString()}</p>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase mt-1">Units: {stats.totalDrinksSold}</p>
                </div>
              </div>

              {/* Breakdown Section */}
              <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-slate-900 px-6 py-4 flex items-center justify-between">
                  <h2 className="text-white font-bold text-lg flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Drink Sales Breakdown
                  </h2>
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
            {stats.rangeLabel}
          </span>
                </div>

                <div className="p-6">
                  {stats.salesBreakdown.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 italic">
                        No sales data available for this period.
                      </div>
                  ) : (
                      <div className="space-y-6">
                        {stats.salesBreakdown.map((item, index) => (
                            <div key={index} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100">
                                    <Package className="w-5 h-5 text-slate-600" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-slate-900">{item.name}</p>
                                    <p className="text-xs text-slate-500">{item.quantity} units sold</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-slate-900">₹{item.revenue.toLocaleString()}</p>
                                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                                    Profit: ₹{(item.revenue - item.cost).toLocaleString()}
                                  </p>
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000"
                                    style={{
                                      width: `${stats.totalDrinksSold > 0 ? (item.quantity / stats.totalDrinksSold) * 100 : 0}%`
                                    }}
                                />
                              </div>
                            </div>
                        ))}
                      </div>
                  )}
                </div>
              </div>
            </>
        )}
      </div>
  );
};

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: 'emerald' | 'indigo' | 'amber' | 'rose';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color }) => {
  const colorClasses = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
    rose: 'bg-rose-50 border-rose-100 text-rose-600',
  };

  return (
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className={`p-3 rounded-2xl border ${colorClasses[color]}`}>
            {icon}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">{subtitle}</p>
        </div>
      </div>
  );
};

interface ComparisonStatCardProps {
  title: string;
  valA: number;
  valB: number;
  diff: number;
  pct: number;
  monthA: string;
  monthB: string;
  isCurrency: boolean;
  color: 'emerald' | 'indigo' | 'amber' | 'rose';
  invertColors?: boolean;
}

const ComparisonStatCard: React.FC<ComparisonStatCardProps> = ({
                                                                 title, valA, valB, diff, pct, monthA, monthB, isCurrency, color, invertColors = false
                                                               }) => {
  const isPositive = diff >= 0;
  const isBetter = invertColors ? !isPositive : isPositive;
  const isZero = diff === 0;

  const trendColor = isZero ? 'text-slate-500' : (isBetter ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50');
  const formatVal = (v: number) => isCurrency ? `₹${v.toLocaleString()}` : v.toString();

  return (
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-black text-slate-400 uppercase tracking-wider">{title}</p>
            <span className={`px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1 ${trendColor}`}>
            {!isZero && (isPositive ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />)}
              {isZero ? 'No Change' : `${isPositive ? '+' : ''}${pct.toFixed(1)}%`}
          </span>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <span className="text-xs text-slate-400 font-bold">{monthA} (Base)</span>
              <span className="text-2xl font-black text-slate-900">{formatVal(valA)}</span>
            </div>
            <div className="flex justify-between items-baseline text-slate-400">
              <span className="text-xs text-slate-400 font-medium">{monthB} (Compare)</span>
              <span className="text-lg font-bold">{formatVal(valB)}</span>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-100 mt-4 pt-3 flex justify-between items-center text-xs">
          <span className="text-slate-400 font-bold uppercase">Variance</span>
          <span className={`font-black ${isZero ? 'text-slate-500' : (isBetter ? 'text-emerald-600' : 'text-rose-600')}`}>
          {isPositive ? '+' : ''}{formatVal(diff)}
        </span>
        </div>
      </div>
  );
};

interface ComparisonTableRowProps {
  label: string;
  valA: number;
  valB: number;
  isCurrency: boolean;
  invertTrend?: boolean;
}

const ComparisonTableRow: React.FC<ComparisonTableRowProps> = ({ label, valA, valB, isCurrency, invertTrend = false }) => {
  const diff = valA - valB;
  const pct = valB !== 0 ? (diff / valB) * 100 : 0;
  const isPositive = diff >= 0;
  const isBetter = invertTrend ? !isPositive : isPositive;
  const isZero = diff === 0;

  const formatVal = (v: number) => isCurrency ? `₹${v.toLocaleString()}` : v.toString();

  return (
      <tr className="hover:bg-slate-50/50 transition-colors">
        <td className="py-3 px-6 font-bold text-slate-700">{label}</td>
        <td className="py-3 px-6 text-right font-black text-slate-900">{formatVal(valA)}</td>
        <td className="py-3 px-6 text-right text-slate-500">{formatVal(valB)}</td>
        <td className={`py-3 px-6 text-right font-bold ${isZero ? 'text-slate-400' : (isBetter ? 'text-emerald-600' : 'text-rose-600')}`}>
          {isZero ? '-' : `${isPositive ? '+' : ''}${formatVal(diff)}`}
        </td>
        <td className={`py-3 px-6 text-right font-bold ${isZero ? 'text-slate-400' : (isBetter ? 'text-emerald-600' : 'text-rose-600')}`}>
          {isZero ? '0.0%' : `${isPositive ? '▲' : '▼'} ${Math.abs(pct).toFixed(1)}%`}
        </td>
      </tr>
  );
};

export default Dashboard;

