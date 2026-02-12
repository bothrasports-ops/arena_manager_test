
import React, { useState } from 'react';
import {
  Search,
  Calendar,
  Filter,
  AlertCircle,
  Clock,
  History,
  TrendingUp,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Package,
  IndianRupee,
  User as UserIcon,
  Globe
} from 'lucide-react';
import { Booking, Platform, DrinkInventoryItem } from '../types';

interface BookingListProps {
  bookings: Booking[];
  inventory: DrinkInventoryItem[];
}

const BookingList: React.FC<BookingListProps> = ({ bookings, inventory }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('All');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = b.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.phoneNumber.includes(searchTerm);
    const matchesPlatform = platformFilter === 'All' || b.platform === platformFilter;
    return matchesSearch && matchesPlatform;
  });

  const totalRevenue = filteredBookings.reduce((sum, b) => sum + b.totalAmount, 0);

  const toggleExpand = (id: string) => {
    setExpandedBookingId(expandedBookingId === id ? null : id);
  };

  if (bookings.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200 text-center px-6">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
          <History className="text-slate-400 w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-900">No bookings yet</h3>
        <p className="text-slate-500 max-w-sm mt-2">Start creating your first booking record to see it listed here.</p>
      </div>
    );
  }

  const getPlatformStyle = (platform: Platform) => {
    switch (platform) {
      case Platform.PLAYO:
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case Platform.HUDDLE:
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case Platform.KHELOMORE:
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case Platform.OFFLINE:
        return 'bg-slate-100 text-slate-700 border-slate-200';
      default:
        return 'bg-indigo-100 text-indigo-700 border-indigo-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Filtered Bookings"
          value={filteredBookings.length}
          icon={<History className="w-4 h-4 text-indigo-500" />}
          sub="Current selection"
        />
        <StatCard
          label="Total Revenue"
          value={`₹${totalRevenue}`}
          icon={<TrendingUp className="w-4 h-4 text-emerald-500" />}
          sub="Combined amount"
        />
        <StatCard
          label="Avg Booking"
          value={`₹${filteredBookings.length ? Math.round(totalRevenue / filteredBookings.length) : 0}`}
          icon={<CreditCard className="w-4 h-4 text-orange-500" />}
          sub="Per session"
        />
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row gap-4 items-center shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="w-full md:w-auto px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium"
          >
            <option value="All">All Platforms</option>
            {Object.values(Platform).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Bookings List */}
      <div className="space-y-4">
        {filteredBookings.length === 0 ? (
          <div className="py-12 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-sm">
            No matches found for your current search.
          </div>
        ) : (
          filteredBookings.map((booking) => (
            <div
              key={booking.id}
              className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                expandedBookingId === booking.id ? 'border-indigo-400 shadow-lg ring-1 ring-indigo-100' : 'border-slate-200 shadow-sm hover:border-slate-300'
              }`}
            >
              {/* Main Row */}
              <div
                className="p-5 cursor-pointer flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                onClick={() => toggleExpand(booking.id)}
              >
                <div className="flex items-start gap-4 flex-1">
                  <div className={`p-2.5 rounded-xl border shrink-0 ${getPlatformStyle(booking.platform)}`}>
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                      {booking.customerName}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-tighter ${getPlatformStyle(booking.platform)}`}>
                        {booking.platform}
                      </span>
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <UserIcon className="w-3.5 h-3.5" />
                        {booking.phoneNumber}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                        <Calendar className="w-3.5 h-3.5" />
                        {new Date(booking.timestamp).toLocaleDateString()} at {new Date(booking.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grand Total</p>
                    <p className="text-2xl font-black text-slate-900">₹{booking.totalAmount}</p>
                  </div>
                  <div className={`p-1.5 rounded-full transition-colors ${expandedBookingId === booking.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                    {expandedBookingId === booking.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Expandable Breakdown */}
              {expandedBookingId === booking.id && (
                <div className="bg-slate-50 border-t border-slate-200 p-6 animate-in slide-in-from-top-2 duration-300">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Booking Detailed Breakdown
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Platform Booking Cost */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 text-slate-600 mb-3">
                        <Globe className="w-4 h-4" />
                        <span className="text-sm font-bold">Platform Booking</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-xs text-slate-500">Base Amount</span>
                        <span className="text-lg font-black text-slate-900">₹{booking.bookingAmount}</span>
                      </div>
                    </div>

                    {/* Extra Hours Cost */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-2 text-orange-600 mb-3">
                        <Clock className="w-4 h-4" />
                        <span className="text-sm font-bold">Extra Hours</span>
                      </div>
                      {booking.extraHours.enabled ? (
                        <>
                          <div className="flex justify-between items-baseline mb-1">
                            <span className="text-xs text-slate-500">Duration</span>
                            <span className="text-sm font-bold text-slate-700">{booking.extraHours.duration} hrs</span>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="text-xs text-slate-500">Extra Cost</span>
                            <span className="text-lg font-black text-slate-900">₹{booking.extraHours.amount}</span>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-slate-400 italic mt-2">No extra hours added</p>
                      )}
                    </div>

                    {/* Drinks Breakdown */}
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm md:col-span-1">
                      <div className="flex items-center gap-2 text-indigo-600 mb-3">
                        <Package className="w-4 h-4" />
                        <span className="text-sm font-bold">Drinks & Refreshements</span>
                      </div>
                      {booking.selectedDrinks.length > 0 ? (
                        <div className="space-y-2">
                          {booking.selectedDrinks.map((sd, idx) => {
                            const drink = inventory.find(i => i.id === sd.drinkId);
                            return (
                              <div key={idx} className="flex justify-between text-xs border-b border-slate-50 pb-1 last:border-0">
                                <span className="text-slate-600">{drink?.name || 'Unknown Item'} x {sd.quantity}</span>
                                <span className="font-bold text-slate-900">₹{sd.priceAtTime * sd.quantity}</span>
                              </div>
                            );
                          })}
                          <div className="flex justify-between pt-2 border-t border-slate-100">
                            <span className="text-[10px] font-bold text-slate-400 uppercase">Drinks Total</span>
                            <span className="text-sm font-black text-indigo-600">
                              ₹{booking.selectedDrinks.reduce((acc, d) => acc + (d.priceAtTime * d.quantity), 0)}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic mt-2">No drinks selected</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string, value: string | number, icon: React.ReactNode, sub: string }> = ({ label, value, icon, sub }) => (
  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start gap-4">
    <div className="p-2 bg-slate-50 rounded-lg">{icon}</div>
    <div>
      <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">{label}</p>
      <p className="text-2xl font-black text-slate-900 mt-1">{value}</p>
      <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
    </div>
  </div>
);

export default BookingList;
