
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
  Table as TableIcon
} from 'lucide-react';
import { Booking, DrinkInventoryItem, Sport, PosSale, BookingType, Member, Student, PaymentMethod, MembershipPlanDefinition, Expense } from '../types';
import { exportToCSV, exportToExcel, exportToPDF } from '../lib/exportUtil';
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

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const Dashboard: React.FC<DashboardProps> = ({ bookings, inventory, posSales, members, students, membershipPlans, expenses = [] }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');
  const [sportFilter, setSportFilter] = useState<string>('All');

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
      daily: 'Today',
      weekly: 'This Week',
      monthly: 'This Month',
      quarterly: 'This Quarter',
      yearly: 'This Year'
    };

    const rangeSubtitles: Record<TimeRange, string> = {
      daily: now.toLocaleDateString('default', { day: 'numeric', month: 'short', year: 'numeric' }),
      weekly: `Since ${startOfWeek.toLocaleDateString('default', { day: 'numeric', month: 'short' })}`,
      monthly: now.toLocaleString('default', { month: 'long', year: 'numeric' }),
      quarterly: `Q${currentQuarter + 1} ${currentYear}`,
      yearly: `${currentYear}`
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
  }, [bookings, inventory, posSales, members, students, timeRange, sportFilter, membershipPlans, expenses]);

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
        {/* Filters Selector */}
        <div className="flex flex-col md:flex-row items-center gap-4">
          <div className="flex-1 w-full flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm relative">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
                <Clock className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Analytics Period</h3>
                <p className="text-xs text-slate-500 font-medium">Viewing data for {(stats.rangeLabel || '').toLowerCase()}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-700 text-sm font-bold rounded-xl hover:bg-slate-100 transition-all"
                >
                  <Download className="w-4 h-4" />
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

              <div className="relative group">
                <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                    className="appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-4 pr-10 py-2.5 outline-none cursor-pointer hover:bg-slate-100 transition-all"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
              </div>
            </div>
          </div>

          <div className="flex-1 w-full flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center border border-amber-100">
                <Hexagon className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Sport Filter</h3>
                <p className="text-xs text-slate-500 font-medium">{sportFilter === 'All' ? 'All sports included' : `Showing ${sportFilter}`}</p>
              </div>
            </div>

            <div className="relative group">
              <select
                  value={sportFilter}
                  onChange={(e) => setSportFilter(e.target.value)}
                  className="appearance-none bg-slate-50 border border-slate-200 text-slate-900 text-sm font-bold rounded-xl focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-4 pr-10 py-2.5 outline-none cursor-pointer hover:bg-slate-100 transition-all"
              >
                <option value="All">All Sports</option>
                {Object.values(Sport).map(s => (
                    <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
            </div>
          </div>
        </div>

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

export default Dashboard;

