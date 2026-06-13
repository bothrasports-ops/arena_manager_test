
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
  RefreshCw,
  Plus,
  Minus
} from 'lucide-react';
import { Booking, Platform, DrinkInventoryItem, Sport, Court, BookingType, UserRole, PaymentMethod } from '../types';
import InvoiceModal from './InvoiceModal';
import { supabase } from '../lib/supabase';
import { toast } from 'sonner';

interface BookingListPropsUI {
  bookings: Booking[];
  inventory: DrinkInventoryItem[];
  courts: Court[];
  onDelete?: (id: string) => void;
  isAdmin?: boolean;
  onUpdate?: () => void | Promise<void>;
  venueName?: string;
  venueEmail?: string;
}

const BookingList: React.FC<BookingListPropsUI> = ({
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
  const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);
  const [finalPaymentMethod, setFinalPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);

  const [extraHoursForm, setExtraHoursForm] = useState<{
    bookingId: string | null;
    duration: number;
    amount: number | '';
  }>({
    bookingId: null,
    duration: 0.5,
    amount: 0
  });

  const [editedSchedule, setEditedSchedule] = useState<{
    bookingId: string | null;
    date: string;
    startTime: string;
    endTime: string;
    bookingAmount: number;
  }>({
    bookingId: null,
    date: '',
    startTime: '',
    endTime: '',
    bookingAmount: 0
  });

  const calculateHoursVal = (start: string, end: string) => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) return 0;
    let diff = (endH + endM / 60) - (startH + startM / 60);
    if (diff < 0) diff += 24;
    return Number(diff.toFixed(2));
  };

  const handleScheduleFieldChange = (booking: Booking, field: 'date' | 'startTime' | 'endTime' | 'bookingAmount', value: any) => {
    const current = editedSchedule.bookingId === booking.id ? editedSchedule : {
      bookingId: booking.id,
      date: booking.bookingDate,
      startTime: booking.bookingStartTime,
      endTime: booking.bookingEndTime,
      bookingAmount: booking.bookingAmount
    };

    const updated = {
      ...current,
      [field]: value
    };

    if (field === 'startTime' || field === 'endTime') {
      const hours = calculateHoursVal(
          field === 'startTime' ? value : current.startTime,
          field === 'endTime' ? value : current.endTime
      );

      const localStored = localStorage.getItem(`booking_courts_${booking.id}`);
      const bCourtIds = booking.courtIds || (localStored ? JSON.parse(localStored) : (booking.courtId ? [booking.courtId] : []));

      let sumRate = 0;
      bCourtIds.forEach((id: string) => {
        const c = courts.find(court => court.id === id);
        sumRate += Number(c?.hourly_price || 0);
      });

      updated.bookingAmount = Number((sumRate * hours).toFixed(2));
    }

    setEditedSchedule(updated);
  };

  const handleSaveSchedule = async (booking: Booking) => {
    const current = editedSchedule.bookingId === booking.id ? editedSchedule : {
      bookingId: booking.id,
      date: booking.bookingDate,
      startTime: booking.bookingStartTime,
      endTime: booking.bookingEndTime,
      bookingAmount: booking.bookingAmount
    };

    setIsUpdating(booking.id);
    try {
      const hours = calculateHoursVal(current.startTime, current.endTime);
      if (hours <= 0) {
        toast.error("Invalid duration. End time must be after start time.");
        return;
      }

      const newTotalHours = hours + (booking.extraHours?.duration || 0);

      const drinksTotal = booking.selectedDrinks.reduce((acc, sd) => acc + (Number(sd.quantity || 0) * Number(sd.priceAtTime || 0)), 0);
      const newTotalAmount = Number(current.bookingAmount) + (booking.extraHours?.amount || 0) + drinksTotal;

      const { error } = await supabase
          .from('bookings')
          .update({
            booking_date: current.date,
            booking_start_time: current.startTime,
            booking_end_time: current.endTime,
            total_hours: newTotalHours,
            booking_amount: Number(current.bookingAmount),
            total_amount: newTotalAmount
          })
          .eq('id', booking.id);

      if (error) throw error;

      toast.success("Booking date & time updated successfully!");
      setEditedSchedule({ bookingId: null, date: '', startTime: '', endTime: '', bookingAmount: 0 });
      if (onUpdate) await onUpdate();
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to update booking time: ${error.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const calculateExtraHoursAmount = (booking: Booking, duration: number) => {
    const localStored = localStorage.getItem(`booking_courts_${booking.id}`);
    const bCourtIds = booking.courtIds || (localStored ? JSON.parse(localStored) : (booking.courtId ? [booking.courtId] : []));

    let sumRate = 0;
    bCourtIds.forEach((id: string) => {
      const c = courts.find(court => court.id === id);
      sumRate += Number(c?.hourly_price || 0);
    });
    return Number((sumRate * duration).toFixed(2));
  };

  const handleUpdateExtraHours = async (booking: Booking) => {
    if (!extraHoursForm.bookingId) return;

    setIsUpdating(booking.id);
    try {
      const duration = Number(extraHoursForm.duration);
      const amount = Number(extraHoursForm.amount) || 0;

      // Calculate new end time
      const [h, m] = booking.bookingEndTime.split(':').map(Number);
      let totalMinutes = h * 60 + m + (duration * 60);
      const newH = Math.floor(totalMinutes / 60) % 24;
      const newM = totalMinutes % 60;
      const newEndTime = `${newH.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}`;

      const newTotalHours = (Number(booking.totalHours) || 0) + duration;
      const newTotalAmount = (Number(booking.totalAmount) || 0) + amount;

      const { error } = await supabase
          .from('bookings')
          .update({
            extra_hours_enabled: true,
            extra_hours_duration: (booking.extraHours?.duration || 0) + duration,
            extra_hours_amount: (booking.extraHours?.amount || 0) + amount,
            booking_end_time: newEndTime,
            total_hours: newTotalHours,
            total_amount: newTotalAmount
          })
          .eq('id', booking.id);

      if (error) throw error;

      toast.success(`Added ${duration} extra hours to ${booking.customerName}`);
      setExtraHoursForm({ bookingId: null, duration: 0.5, amount: 0 });
      if (onUpdate) await onUpdate();
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to add extra hours: ${error.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleAddDrink = async (booking: Booking, drinkId: string) => {
    setIsUpdating(booking.id);
    try {
      const drink = inventory.find(d => d.id === drinkId);
      if (!drink) return;
      if (drink.stockQuantity <= 0) {
        toast.error(`${drink.name} is out of stock`);
        return;
      }

      // Check if drink already in booking
      const existing = booking.selectedDrinks.find(sd => sd.drinkId === drinkId);

      if (existing) {
        // Update quantity
        const { error } = await supabase
            .from('booking_drinks')
            .update({ quantity: (Number(existing.quantity) || 0) + 1 })
            .eq('booking_id', booking.id)
            .eq('drink_id', drinkId);
        if (error) throw error;
      } else {
        // Insert new
        const { error } = await supabase
            .from('booking_drinks')
            .insert({
              booking_id: booking.id,
              drink_id: drinkId,
              quantity: 1,
              price_at_time: drink.price
            });
        if (error) throw error;
      }

      // Update inventory
      const { error: invError } = await supabase
          .from('inventory')
          .update({ stock_quantity: drink.stockQuantity - 1 })
          .eq('id', drinkId);
      if (invError) throw invError;

      // Update total amount in booking
      const { error: updateBookingError } = await supabase
          .from('bookings')
          .update({
            total_amount: booking.totalAmount + drink.price
          })
          .eq('id', booking.id);
      if (updateBookingError) throw updateBookingError;

      toast.success(`Allocated ${drink.name} to ${booking.customerName}`);
      if (onUpdate) await onUpdate();
    } catch (error: any) {
      console.error(error);
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRemoveDrink = async (booking: Booking, drinkId: string) => {
    setIsUpdating(booking.id);
    try {
      const drink = inventory.find(d => d.id === drinkId);
      if (!drink) return;

      const existing = booking.selectedDrinks.find(sd => sd.drinkId === drinkId);
      if (!existing || Number(existing.quantity || 0) <= 0) return;

      const newQty = (Number(existing.quantity) || 0) - 1;

      if (newQty > 0) {
        // Update quantity
        const { error } = await supabase
            .from('booking_drinks')
            .update({ quantity: newQty })
            .eq('booking_id', booking.id)
            .eq('drink_id', drinkId);
        if (error) throw error;
      } else {
        // Delete item record
        const { error } = await supabase
            .from('booking_drinks')
            .delete()
            .eq('booking_id', booking.id)
            .eq('drink_id', drinkId);
        if (error) throw error;
      }

      // Restore 1 item back to stock
      const { error: invError } = await supabase
          .from('inventory')
          .update({ stock_quantity: drink.stockQuantity + 1 })
          .eq('id', drinkId);
      if (invError) throw invError;

      // Update total amount in booking
      const { error: updateBookingError } = await supabase
          .from('bookings')
          .update({
            total_amount: Math.max(0, booking.totalAmount - drink.price)
          })
          .eq('id', booking.id);
      if (updateBookingError) throw updateBookingError;

      toast.success(`Removed 1 ${drink.name} from ${booking.customerName}`);
      if (onUpdate) await onUpdate();
    } catch (error: any) {
      console.error(error);
      toast.error(`Update failed: ${error.message}`);
    } finally {
      setIsUpdating(null);
    }
  };

  const handleMarkCompleted = async (booking: Booking, fpm?: PaymentMethod) => {
    setIsUpdating(booking.id);
    try {
      const updates: any = {
        status: 'completed',
        final_payment_method: fpm || null
      };

      // If a final payment method is provided, it means the balance is being paid now
      if (fpm) {
        const balance = Math.max(0, booking.totalAmount - (booking.advancePaid || 0));
        updates.balance_paid = balance;
        updates.advance_paid = booking.totalAmount;
        updates.payment_status = 'prepaid';
      }

      const { error } = await supabase
          .from('bookings')
          .update(updates)
          .eq('id', booking.id);

      if (error) throw error;
      toast.success("Booking marked as completed");

      // If we cleared the balance, update the local object for the invoice modal
      const updatedBooking = fpm ? {
        ...booking,
        status: 'completed' as const,
        finalPaymentMethod: fpm,
        balancePaid: Math.max(0, booking.totalAmount - (booking.advancePaid || 0)),
        advancePaid: booking.totalAmount,
        paymentStatus: 'prepaid' as const
      } : { ...booking, status: 'completed' as const };

      setInvoiceBooking(updatedBooking); // Open invoice with updated data
      setCompletingBookingId(null);
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
                const localStored = localStorage.getItem(`booking_courts_${booking.id}`);
                const bCourtIds: string[] = booking.courtIds || (localStored ? JSON.parse(localStored) : (booking.courtId ? [booking.courtId] : []));
                const bookedCourts = courts.filter(c => bCourtIds.includes(c.id));
                return (
                    <div
                        key={booking.id}
                        className={`bg-white rounded-2xl border transition-all ${
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
                              {bookedCourts.map(bc => (
                                  <span key={bc.id} className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 uppercase tracking-tighter">
                            {bc.name}
                          </span>
                              ))}
                              {bookedCourts.length === 0 && booking.courtId && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 uppercase tracking-tighter">
                            Court ID: {booking.courtId.substring(0, 8)}
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
                                <div className="relative">
                                  {completingBookingId === booking.id ? (
                                      <div className="absolute right-0 bottom-full mb-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-xl z-50 min-w-[240px] animate-in zoom-in-95 duration-200">
                                        <div className="flex justify-between items-center mb-3">
                                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Final Payment</p>
                                          <span className="text-xs font-black text-indigo-600">₹{Math.max(0, booking.totalAmount - (booking.advancePaid || 0))}</span>
                                        </div>
                                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-2">Select Payment Method:</p>
                                        <div className="grid grid-cols-2 gap-2">
                                          {Object.values(PaymentMethod).map(method => (
                                              <button
                                                  key={method}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleMarkCompleted(booking, method);
                                                  }}
                                                  className="px-2 py-2 bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-bold rounded-xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all uppercase"
                                              >
                                                {method}
                                              </button>
                                          ))}
                                        </div>
                                        <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setCompletingBookingId(null);
                                            }}
                                            className="w-full mt-3 py-1 text-[9px] font-black text-slate-400 uppercase hover:text-red-500 transition-colors"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                  ) : null}

                                  <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const balance = Math.max(0, booking.totalAmount - (booking.advancePaid || 0));
                                        if (balance > 0) {
                                          setCompletingBookingId(booking.id);
                                        } else {
                                          handleMarkCompleted(booking);
                                        }
                                      }}
                                      disabled={isUpdating === booking.id}
                                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-sm disabled:opacity-50"
                                      title="Mark as Completed"
                                  >
                                    {isUpdating === booking.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                    Complete
                                  </button>
                                </div>
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
                            {onDelete && (
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
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <CreditCard className="w-4 h-4 opacity-80" />
                                    <span className="text-xs font-bold uppercase tracking-widest">{booking.paymentStatus?.replace(/_/g, ' ') || 'Payment'}</span>
                                  </div>
                                  {booking.paymentMethod && (
                                      <span className="text-[10px] font-black bg-white/20 px-2 py-0.5 rounded-md uppercase">{booking.paymentMethod}</span>
                                  )}
                                </div>
                                <div className="flex justify-between items-baseline pt-1">
                                  <span className="text-[10px] opacity-70">Paid</span>
                                  <span className="text-lg font-black">₹{booking.advancePaid || 0}</span>
                                </div>
                                <div className="flex justify-between items-baseline border-t border-white/20 mt-1 pt-1">
                                  <span className="text-[10px] opacity-70">Balance Due</span>
                                  <span className="text-lg font-black text-white">₹{Math.max(0, booking.totalAmount - (booking.advancePaid || 0))}</span>
                                </div>
                                {booking.status === 'completed' && booking.finalPaymentMethod && (
                                    <div className="mt-2 pt-2 border-t border-white/10 flex justify-between items-center text-[10px]">
                                      <span className="opacity-70 italic font-medium">Final Payment via</span>
                                      <span className="font-black bg-white/10 px-2 py-0.5 rounded-md uppercase">{booking.finalPaymentMethod}</span>
                                    </div>
                                )}
                              </div>
                            </div>

                            {isAdmin && (
                                <div className="mt-6 pt-6 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                                  {/* Modify Booking Schedule & Price card */}
                                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-emerald-500" />
                                        Modify Schedule & Price
                                      </h4>
                                      {editedSchedule.bookingId === booking.id && (
                                          <button
                                              onClick={() => setEditedSchedule({ bookingId: null, date: '', startTime: '', endTime: '', bookingAmount: 0 })}
                                              className="text-[10px] font-bold text-rose-500 hover:text-rose-600"
                                          >
                                            Reset
                                          </button>
                                      )}
                                    </div>

                                    <div className="space-y-3">
                                      {/* Date input */}
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">Booking Date</label>
                                        <input
                                            type="date"
                                            value={editedSchedule.bookingId === booking.id ? editedSchedule.date : booking.bookingDate}
                                            onChange={(e) => handleScheduleFieldChange(booking, 'date', e.target.value)}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
                                        />
                                      </div>

                                      {/* Time inputs row */}
                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">Start Time</label>
                                          <input
                                              type="time"
                                              value={editedSchedule.bookingId === booking.id ? editedSchedule.startTime : booking.bookingStartTime}
                                              onChange={(e) => handleScheduleFieldChange(booking, 'startTime', e.target.value)}
                                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">End Time</label>
                                          <input
                                              type="time"
                                              value={editedSchedule.bookingId === booking.id ? editedSchedule.endTime : booking.bookingEndTime}
                                              onChange={(e) => handleScheduleFieldChange(booking, 'endTime', e.target.value)}
                                              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
                                          />
                                        </div>
                                      </div>

                                      {/* Base amount input */}
                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-wider block ml-1">Base Price (₹)</label>
                                        <div className="relative">
                                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                          <input
                                              type="number"
                                              min="0"
                                              value={editedSchedule.bookingId === booking.id ? editedSchedule.bookingAmount : booking.bookingAmount}
                                              onChange={(e) => handleScheduleFieldChange(booking, 'bookingAmount', Number(e.target.value))}
                                              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500 text-slate-700"
                                              placeholder="Base Price"
                                          />
                                        </div>
                                      </div>

                                      {/* Submit Button */}
                                      <button
                                          onClick={() => handleSaveSchedule(booking)}
                                          disabled={isUpdating === booking.id}
                                          className="w-full mt-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
                                      >
                                        {isUpdating === booking.id ? (
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        ) : (
                                            <CheckCircle2 className="w-3.5 h-3.5" />
                                        )}
                                        Save Schedule Changes
                                      </button>
                                    </div>
                                  </div>

                                  {/* Extra Duration allocation */}
                                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-orange-500" />
                                        Add Extra Duration
                                      </h4>
                                      {extraHoursForm.bookingId === booking.id && (
                                          <button
                                              onClick={() => setExtraHoursForm({ bookingId: null, duration: 0.5, amount: 0 })}
                                              className="text-[10px] font-bold text-rose-500 hover:text-rose-600"
                                          >
                                            Cancel
                                          </button>
                                      )}
                                    </div>

                                    <div className="flex flex-col gap-3">
                                      <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                              const val = calculateExtraHoursAmount(booking, 0.5);
                                              setExtraHoursForm({ bookingId: booking.id, duration: 0.5, amount: val });
                                            }}
                                            className={`flex-1 py-3 px-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                                                extraHoursForm.bookingId === booking.id && extraHoursForm.duration === 0.5
                                                    ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-sm ring-1 ring-orange-100'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-orange-200 hover:bg-orange-50/30'
                                            }`}
                                        >
                                          <Clock className="w-4 h-4" /> <span className="font-extrabold">+30m</span>
                                        </button>
                                        <button
                                            onClick={() => {
                                              const val = calculateExtraHoursAmount(booking, 1);
                                              setExtraHoursForm({ bookingId: booking.id, duration: 1, amount: val });
                                            }}
                                            className={`flex-1 py-3 px-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                                                extraHoursForm.bookingId === booking.id && extraHoursForm.duration === 1
                                                    ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-sm ring-1 ring-orange-100'
                                                    : 'bg-white border-slate-200 text-slate-500 hover:border-orange-200 hover:bg-orange-50/30'
                                            }`}
                                        >
                                          <Clock className="w-4 h-4" /> <span className="font-extrabold">+1h</span>
                                        </button>
                                      </div>

                                      {extraHoursForm.bookingId === booking.id && (
                                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-3 animate-in slide-in-from-top-2">
                                            <div className="flex flex-col gap-1.5">
                                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Additional Cost Amount (₹)</label>
                                              <div className="relative">
                                                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-400" />
                                                <input
                                                    autoFocus
                                                    type="number"
                                                    min="0"
                                                    value={extraHoursForm.amount}
                                                    onChange={(e) => setExtraHoursForm(prev => ({ ...prev, amount: e.target.value === '' ? '' : Number(e.target.value) }))}
                                                    className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-black outline-none focus:ring-2 focus:ring-orange-500 text-slate-700"
                                                    placeholder="e.g. 250"
                                                />
                                              </div>
                                            </div>
                                            <button
                                                onClick={() => handleUpdateExtraHours(booking)}
                                                disabled={isUpdating === booking.id || extraHoursForm.amount === ''}
                                                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-black rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                                            >
                                              {isUpdating === booking.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                              Apply Extra Time
                                            </button>
                                          </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Allocate Item / Drink */}
                                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5 border-b border-slate-100 pb-2">
                                      <Package className="w-4 h-4 text-indigo-500" />
                                      Allocate Items & Drinks
                                    </h4>
                                    <div className="max-h-60 overflow-y-auto pr-1 space-y-1">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {inventory.filter(item => {
                                          const currentQty = booking.selectedDrinks?.find(sd => sd.drinkId === item.id)?.quantity || 0;
                                          return item.stockQuantity > 0 || currentQty > 0;
                                        }).map(item => {
                                          const currentQty = booking.selectedDrinks?.find(sd => sd.drinkId === item.id)?.quantity || 0;
                                          return (
                                              <div
                                                  key={item.id}
                                                  className="flex items-center justify-between p-2 bg-slate-50 border border-slate-100 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group relative"
                                              >
                                                <div className="flex items-center gap-2 overflow-hidden flex-1 select-none">
                                                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shrink-0 overflow-hidden text-[10px] text-slate-400 border border-slate-100">
                                                    {item.imageUrl ? (
                                                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <Package className="w-4 h-4" />
                                                    )}
                                                  </div>
                                                  <div className="text-left overflow-hidden">
                                                    <p className="text-[10px] font-bold text-slate-900 truncate">{item.name}</p>
                                                    <p className="text-[9px] text-indigo-500 font-black">₹{item.price}</p>
                                                  </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 shrink-0 z-10">
                                                  {currentQty > 0 && (
                                                      <button
                                                          type="button"
                                                          disabled={isUpdating === booking.id}
                                                          onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveDrink(booking, item.id);
                                                          }}
                                                          className="w-6 h-6 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-all disabled:opacity-50 border border-rose-100"
                                                          title="Remove one"
                                                      >
                                                        <Minus className="w-3 h-3" />
                                                      </button>
                                                  )}

                                                  {currentQty > 0 && (
                                                      <span className="text-xs font-black text-slate-700 min-w-[12px] text-center">
                                          {currentQty}
                                        </span>
                                                  )}

                                                  <button
                                                      type="button"
                                                      disabled={isUpdating === booking.id || item.stockQuantity <= 0}
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleAddDrink(booking, item.id);
                                                      }}
                                                      className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-all disabled:opacity-50 border border-indigo-100"
                                                      title="Add one"
                                                  >
                                                    <Plus className="w-3 h-3" />
                                                  </button>
                                                </div>
                                              </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                            )}
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
