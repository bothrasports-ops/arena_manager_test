
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
  Trophy,
  User as UserIcon,
  Trash2,
  Globe,
  Printer,
  Edit2,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { Booking, Platform, DrinkInventoryItem, Sport, Court, BookingType, UserRole } from '../types';
import InvoiceModal from './InvoiceModal';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface BookingListProps {
  bookings: Booking[];
  inventory: DrinkInventoryItem[];
  courts: Court[];
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
  onUpdate?: () => void;
  venueName?: string;
  venueEmail?: string;
}

const BookingList: React.FC<BookingListProps> = ({
                                                   bookings,
                                                   inventory,
                                                   courts,
                                                   onDelete,
                                                   isAdmin,
                                                   onUpdate,
                                                   venueName,
                                                   venueEmail
                                                 }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('All');
  const [sportFilter, setSportFilter] = useState<string>('All');
  const [statusFilter, setStatusFilter] = useState<'All' | 'active' | 'completed'>('All');
  const [expandedBookingId, setExpandedBookingId] = useState<string | null>(null);
  const [invoiceBooking, setInvoiceBooking] = useState<Booking | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const handleMarkCompleted = async (booking: Booking) => {
    setIsUpdating(booking.id);
    try {
      const { error } = await supabase
          .from('bookings')
          .update({ status: 'completed' })
          .eq('id', booking.id);

      if (error) throw error;
      toast.success("Booking marked as completed");
      setInvoiceBooking(booking); // Open invoice
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast.error(`Failed to complete booking: ${error.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const filteredBookings = bookings.filter(b => {
    const matchesSearch = (b.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (b.phoneNumber || '').includes(searchTerm);
    const matchesPlatform = platformFilter === 'All' || b.platform === platformFilter;
    const matchesSport = sportFilter === 'All' || b.sport === sportFilter;
    const matchesStatus = statusFilter === 'All' || b.status === statusFilter;
    return matchesSearch && matchesPlatform && matchesSport && matchesStatus;
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
      case 'PlayO':
        return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'Huddle':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'KheloMore':
        return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'Offline':
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
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col lg:flex-row gap-4 items-center shadow-sm">
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full lg:w-auto">
            <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-xs"
            >
              <option value="All">All Status</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
            <select
                value={platformFilter}
                onChange={(e) => setPlatformFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-xs"
            >
              <option value="All">All Platforms</option>
              {Array.from(new Set(bookings.map(b => b.platform))).map(p => (
                  <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
                value={sportFilter}
                onChange={(e) => setSportFilter(e.target.value)}
                className="col-span-2 md:col-span-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-xs"
            >
              <option value="All">All Sports</option>
              {Object.values(Sport).map(s => (
                  <option key={s} value={s}>{s}</option>
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
              filteredBookings.map((booking) => {
                const court = courts.find(c => c.id === booking.courtId);
                return (
                    <div
                        key={booking.id}
                        className={`bg-white rounded-2xl border transition-all overflow-hidden ${
                            expandedBookingId === booking.id
                                ? 'border-indigo-400 shadow-lg ring-1 ring-indigo-100'
                                : booking.status !== 'completed'
                                    ? 'border-emerald-400 bg-emerald-50/10 shadow-sm hover:border-emerald-500'
                                    : 'border-slate-200 shadow-sm hover:border-slate-300'
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
                            <h3 className="font-bold text-slate-900 text-lg flex flex-wrap items-center gap-2">
                              {booking.customerName}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border border-indigo-200 bg-indigo-50 text-indigo-700 uppercase tracking-tighter`}>
                          {booking.sport}
                        </span>
                              {court && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 uppercase tracking-tighter">
                            {court.name}
                          </span>
                              )}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border uppercase tracking-tighter ${
                                  booking.status === 'completed' ? 'bg-slate-100 text-slate-600 border-slate-200' : 'bg-emerald-100 text-emerald-600 border-emerald-200'
                              }`}>
                          {booking.status?.toUpperCase() || 'ACTIVE'}
                        </span>
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1">
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                <UserIcon className="w-3.5 h-3.5" />
                                {booking.phoneNumber}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                                <Calendar className="w-3.5 h-3.5" />
                                {booking.bookingDate}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-bold">
                                <Clock className="w-3.5 h-3.5" />
                                {booking.bookingStartTime} - {booking.bookingEndTime} ({booking.totalHours} {booking.totalHours === 1 ? 'Hr' : 'Hrs'})
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0">
                          <div className="text-right">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grand Total</p>
                            <p className="text-2xl font-black text-slate-900">₹{booking.totalAmount}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {booking.status !== 'completed' && (
                                <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkCompleted(booking);
                                    }}
                                    disabled={isUpdating === booking.id}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50"
                                    title="Mark as Completed"
                                >
                                  {isUpdating === booking.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  Complete
                                </button>
                            )}
                            <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setInvoiceBooking(booking);
                                }}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all"
                                title="Print Bill"
                            >
                              <Printer className="w-5 h-5" />
                            </button>
                            {onDelete && isAdmin && (
                                <div className="flex items-center gap-1">
                                  {deletingId === booking.id ? (
                                      <div className="flex items-center gap-1 animate-in fade-in zoom-in-95 duration-200">
                                        <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setDeletingId(null);
                                            }}
                                            className="px-2 py-1 text-[10px] font-bold text-slate-500 hover:bg-slate-100 rounded-lg transition-all uppercase tracking-wider"
                                        >
                                          No
                                        </button>
                                        <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onDelete(booking.id);
                                              setDeletingId(null);
                                            }}
                                            className="px-2 py-1 text-[10px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all uppercase tracking-wider shadow-sm"
                                        >
                                          Yes
                                        </button>
                                      </div>
                                  ) : (
                                      <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingId(booking.id);
                                          }}
                                          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                                          title="Delete Booking"
                                      >
                                        <Trash2 className="w-5 h-5" />
                                      </button>
                                  )}
                                </div>
                            )}
                            <div className={`p-1.5 rounded-full transition-colors ${expandedBookingId === booking.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-50 text-slate-400'}`}>
                              {expandedBookingId === booking.id ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                            </div>
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

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                              {/* Booking Cost */}
                              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2 text-slate-600 mb-2">
                                  <Globe className="w-4 h-4" />
                                  <span className="text-xs font-bold uppercase tracking-wider">
                            {booking.bookingType === BookingType.MEMBERSHIP ? 'Membership' : booking.bookingType === BookingType.COACHING ? 'Coaching' : 'Session'} Rate
                          </span>
                                </div>
                                <div className="flex justify-between items-baseline">
                          <span className="text-[10px] text-slate-500">
                            {booking.bookingType === BookingType.MEMBERSHIP ? 'Membership Amount' : booking.bookingType === BookingType.COACHING ? 'Coaching Fee' : 'Base Amount'}
                          </span>
                                  <span className="text-lg font-black text-slate-900">₹{booking.bookingAmount}</span>
                                </div>
                                {booking.coachingFee !== undefined && booking.coachingFee > 0 && (
                                    <div className="flex justify-between items-baseline mt-1">
                                      <span className="text-[10px] text-slate-500">Coaching Fee</span>
                                      <span className="text-sm font-bold text-slate-700">₹{booking.coachingFee}</span>
                                    </div>
                                )}
                              </div>

                              {/* Extra Hours Cost */}
                              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2 text-orange-600 mb-2">
                                  <Clock className="w-4 h-4" />
                                  <span className="text-xs font-bold uppercase tracking-wider">Extra Duration</span>
                                </div>
                                {booking.extraHours.enabled ? (
                                    <>
                                      <div className="flex justify-between items-baseline mb-1">
                                        <span className="text-[10px] text-slate-500">Duration</span>
                                        <span className="text-sm font-bold text-slate-700">{booking.extraHours.duration} hrs</span>
                                      </div>
                                      <div className="flex justify-between items-baseline">
                                        <span className="text-[10px] text-slate-500">Extra Cost</span>
                                        <span className="text-lg font-black text-slate-900">₹{booking.extraHours.amount}</span>
                                      </div>
                                    </>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic mt-2">No extra hours added</p>
                                )}
                              </div>

                              {/* Drinks Breakdown */}
                              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                <div className="flex items-center gap-2 text-indigo-600 mb-2">
                                  <Package className="w-4 h-4" />
                                  <span className="text-xs font-bold uppercase tracking-wider">Add-ons / Drinks</span>
                                </div>
                                {booking.selectedDrinks.length > 0 ? (
                                    <div className="space-y-1">
                                      {booking.selectedDrinks.filter(sd => Number(sd.quantity) > 0).map((sd, idx) => {
                                        const drink = inventory.find(i => i.id === sd.drinkId);
                                        return (
                                            <div key={idx} className="flex justify-between text-[10px] border-b border-slate-50 pb-0.5 last:border-0">
                                              <span className="text-slate-600 truncate mr-2">{drink?.name || 'Item'} x {sd.quantity}</span>
                                              <span className="font-bold text-slate-900 shrink-0">₹{(Number(sd.quantity) || 0) * Number(sd.priceAtTime)}</span>
                                            </div>
                                        );
                                      })}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-slate-400 italic mt-2">No items selected</p>
                                )}
                              </div>

                              {/* Payment Status */}
                              <div className="bg-indigo-600 p-4 rounded-xl border border-indigo-700 shadow-lg text-white">
                                <div className="flex items-center gap-2 mb-2">
                                  <CreditCard className="w-4 h-4 opacity-80" />
                                  <span className="text-xs font-bold uppercase tracking-widest">{booking.paymentStatus?.replace(/_/g, ' ') || 'Payment'}</span>
                                </div>
                                <div className="flex justify-between items-baseline pt-1">
                                  <span className="text-[10px] opacity-70">Paid</span>
                                  <span className="text-lg font-black">₹{booking.advancePaid || 0}</span>
                                </div>
                                <div className="flex justify-between items-baseline border-t border-white/20 mt-1 pt-1">
                                  <span className="text-[10px] opacity-70">Balance Due</span>
                                  <span className="text-lg font-black text-white">₹{Math.max(0, booking.totalAmount - (booking.advancePaid || 0))}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                      )}
                    </div>
                );
              })
          )}
        </div>

        {invoiceBooking && (
            <InvoiceModal
                isOpen={!!invoiceBooking}
                onClose={() => setInvoiceBooking(null)}
                booking={invoiceBooking}
                inventory={inventory}
                courts={courts}
                venueName={venueName}
                venueEmail={venueEmail}
            />
        )}
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
