
import React, { useMemo, useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Package,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  ChevronDown,
  Clock
} from 'lucide-react';
import { Booking, DrinkInventoryItem } from '../types';

interface DashboardProps {
  bookings: Booking[];
  inventory: DrinkInventoryItem[];
}

type TimeRange = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

const Dashboard: React.FC<DashboardProps> = ({ bookings, inventory }) => {
  const [timeRange, setTimeRange] = useState<TimeRange>('monthly');

  const stats = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const currentQuarter = Math.floor(currentMonth / 3);

    // Get start of week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // Filter bookings based on selected time range
    const filteredBookings = bookings.filter(booking => {
      const date = new Date(booking.timestamp);

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
    });

    // Calculate drink sales breakdown
    const drinkSales: Record<string, { name: string; quantity: number; revenue: number }> = {};

    // Initialize with all inventory items
    inventory.forEach(item => {
      drinkSales[item.id] = { name: item.name, quantity: 0, revenue: 0 };
    });

    let totalDrinksSold = 0;
    let totalDrinkRevenue = 0;
    let totalBookingRevenue = 0;

    filteredBookings.forEach(booking => {
      totalBookingRevenue += booking.bookingAmount + (booking.extraHours.enabled ? booking.extraHours.amount : 0);

      booking.selectedDrinks.forEach(drink => {
        if (drinkSales[drink.drinkId]) {
          drinkSales[drink.drinkId].quantity += drink.quantity;
          drinkSales[drink.drinkId].revenue += drink.quantity * drink.priceAtTime;
          totalDrinksSold += drink.quantity;
          totalDrinkRevenue += drink.quantity * drink.priceAtTime;
        }
      });
    });

    const sortedSales = Object.values(drinkSales).sort((a, b) => b.quantity - a.quantity);

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

    return {
      totalDrinksSold,
      totalDrinkRevenue,
      totalBookingRevenue,
      totalRevenue: totalDrinkRevenue + totalBookingRevenue,
      salesBreakdown: sortedSales,
      bookingCount: filteredBookings.length,
      rangeLabel: rangeLabels[timeRange],
      rangeSubtitle: rangeSubtitles[timeRange]
    };
  }, [bookings, inventory, timeRange]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100">
            <Clock className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900">Analytics Period</h3>
            <p className="text-xs text-slate-500 font-medium">Viewing data for {stats.rangeLabel.toLowerCase()}</p>
          </div>
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

      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title={`${stats.rangeLabel} Revenue`}
          value={`₹${stats.totalRevenue.toLocaleString()}`}
          subtitle={stats.rangeSubtitle}
          icon={<TrendingUp className="w-6 h-6 text-emerald-600" />}
          color="emerald"
        />
        <StatCard
          title="Drinks Sold"
          value={stats.totalDrinksSold.toString()}
          subtitle={`Units ${stats.rangeLabel.toLowerCase()}`}
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
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Revenue</p>
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

      {/* Summary Footer */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
          <h3 className="text-indigo-900 font-bold mb-2 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" />
            Drink Revenue
          </h3>
          <p className="text-3xl font-black text-indigo-600">₹{stats.totalDrinkRevenue.toLocaleString()}</p>
          <p className="text-xs text-indigo-400 mt-1 font-medium">From inventory sales only</p>
        </div>
        <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200">
          <h3 className="text-slate-900 font-bold mb-2 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4" />
            Booking Revenue
          </h3>
          <p className="text-3xl font-black text-slate-900">₹{stats.totalBookingRevenue.toLocaleString()}</p>
          <p className="text-xs text-slate-400 mt-1 font-medium">From court bookings & extra hours</p>
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
  color: 'emerald' | 'indigo' | 'amber';
}

const StatCard: React.FC<StatCardProps> = ({ title, value, subtitle, icon, color }) => {
  const colorClasses = {
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-600',
    indigo: 'bg-indigo-50 border-indigo-100 text-indigo-600',
    amber: 'bg-amber-50 border-amber-100 text-amber-600',
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
