import React, { useState, useMemo, useEffect } from 'react';
import {
    Clock,
    ShoppingBag,
    Plus,
    Minus,
    Trash2,
    Package,
    RefreshCw,
    AlertCircle,
    CheckCircle2,
    CalendarClock,
    IndianRupee,
    ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';
import { Booking, DrinkInventoryItem, Platform, BookingType, Court, PaymentMethod } from '../types';
import { supabase } from '../lib/supabase';
import InvoiceModal from './InvoiceModal';

interface ActiveBookingsProps {
    bookings: Booking[];
    inventory: DrinkInventoryItem[];
    courts: Court[];
    onUpdate: () => void;
    venueName?: string;
    venueEmail?: string;
}

const ActiveBookings: React.FC<ActiveBookingsProps> = ({ bookings, inventory, courts, onUpdate, venueName, venueEmail }) => {
    const [now, setNow] = useState(new Date());
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
    const [completingBookingId, setCompletingBookingId] = useState<string | null>(null);
    const [invoiceBooking, setInvoiceBooking] = useState<Booking | null>(null);
    const [extraHoursForm, setExtraHoursForm] = useState<{
        bookingId: string | null;
        duration: number;
        amount: number | '';
    }>({
        bookingId: null,
        duration: 0.5,
        amount: 0
    });

    // Update clock every minute
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const activeBookings = useMemo(() => {
        return bookings.filter(b => {
            if (b.status === 'completed') return false;

            // Create date objects for start and end times
            const start = new Date(`${b.bookingDate}T${b.bookingStartTime}`);
            const end = new Date(`${b.bookingDate}T${b.bookingEndTime}`);

            // If end time is before start time, it crosses midnight
            if (end < start) {
                end.setDate(end.getDate() + 1);
            }

            // A booking is active if 'now' is between start and end
            return now >= start && now < end;
        });
    }, [bookings, now]);

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
            onUpdate();
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
            onUpdate();
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
            onUpdate();
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

            // Update local object for invoice modal
            const updatedBooking = fpm ? {
                ...booking,
                status: 'completed' as const,
                finalPaymentMethod: fpm,
                balancePaid: Math.max(0, booking.totalAmount - (booking.advancePaid || 0)),
                advancePaid: booking.totalAmount,
                paymentStatus: 'prepaid' as const
            } : { ...booking, status: 'completed' as const };

            setInvoiceBooking(updatedBooking); // Open invoice
            setCompletingBookingId(null);
            onUpdate();
        } catch (error: any) {
            toast.error(`Failed to complete booking: ${error.message}`);
        } finally {
            setIsUpdating(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <CalendarClock className="w-6 h-6 text-indigo-600" />
                        Active Bookings
                    </h2>
                    <p className="text-slate-500 text-sm">Showing sessions currently in progress ({now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})</p>
                </div>
            </div>

            {activeBookings.length === 0 ? (
                <div className="py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center px-6">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Clock className="text-slate-300 w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">All Quiet</h3>
                    <p className="text-slate-500 max-w-xs mt-1">No active sessions for this hour. Any bookings starting now will appear here.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-6">
                    {activeBookings.map(booking => {
                        const court = courts.find(c => c.id === booking.courtId);
                        const balanceDue = Math.max(0, booking.totalAmount - (booking.advancePaid || 0));

                        return (
                            <div key={booking.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row">
                                <div className="p-6 flex-1 border-b md:border-b-0 md:border-r border-slate-100">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900">{booking.customerName}</h3>
                                            <div className="flex flex-wrap gap-2 mt-1">
                                                <p className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">
                                                    {booking.sport} &bull; {booking.platform}
                                                </p>
                                                {court && (
                                                    <p className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-100">
                                                        {court.name}
                                                    </p>
                                                )}
                                                <p className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                                                    booking.paymentStatus === 'prepaid' ? 'bg-green-100 text-green-700' :
                                                        booking.paymentStatus === 'partially_paid' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {booking.paymentStatus?.replace(/_/g, ' ').toUpperCase()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Session Status</p>
                                            <p className="text-lg font-black text-emerald-600 leading-tight">ACTIVE</p>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-2xl p-5 space-y-4 border border-slate-200 shadow-inner">
                                        <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2">
                                            <span className="text-slate-500 font-bold uppercase tracking-wider">Bill Details Breakdown</span>
                                            <span className="font-bold text-slate-400"># {booking.id.slice(0, 8)}</span>
                                        </div>

                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between text-sm lg:text-base">
                        <span className="text-slate-600 flex items-center gap-2">
                          <Clock className="w-4 h-4 text-slate-400" />
                          Base {booking.bookingType} ({booking.bookingStartTime} - {booking.bookingEndTime})
                        </span>
                                                <span className="font-bold text-slate-900">₹{booking.bookingAmount}</span>
                                            </div>

                                            {booking.bookingType === BookingType.COACHING && booking.coachingFee !== undefined && booking.coachingFee > 0 && (
                                                <div className="flex items-center justify-between text-sm lg:text-base pl-6">
                                                    <span className="text-slate-500">Coaching Fee</span>
                                                    <span className="font-bold text-slate-900">₹{booking.coachingFee}</span>
                                                </div>
                                            )}

                                            {booking.extraHours?.enabled && booking.extraHours.amount > 0 && (
                                                <div className="flex items-center justify-between text-sm lg:text-base text-orange-600 font-bold pl-6">
                          <span className="flex items-center gap-2">
                            <Plus className="w-3.5 h-3.5" />
                            Extra Duration ({booking.extraHours.duration}h)
                          </span>
                                                    <span className="font-bold">₹{booking.extraHours.amount}</span>
                                                </div>
                                            )}

                                            {booking.selectedDrinks.length > 0 && booking.selectedDrinks.some(d => Number(d.quantity) > 0) && (
                                                <div className="space-y-2 pl-6 mt-2 border-l-2 border-slate-200">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Add-ons / Drinks</p>
                                                    {booking.selectedDrinks.filter(d => Number(d.quantity) > 0).map(sd => {
                                                        const item = inventory.find(i => i.id === sd.drinkId);
                                                        return (
                                                            <div key={sd.drinkId} className="flex items-center justify-between text-xs text-slate-600">
                                                                <span>{item?.name || 'Item'} x {sd.quantity}</span>
                                                                <span>₹{(Number(sd.priceAtTime) || 0) * (Number(sd.quantity) || 0)}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}

                                            <div className="pt-4 space-y-2">
                                                <div className="flex items-center justify-between text-lg font-black text-slate-900">
                                                    <span className="uppercase text-xs tracking-wider">Total Bill</span>
                                                    <span className="text-2xl text-indigo-600">₹{booking.totalAmount}</span>
                                                </div>

                                                {booking.paymentStatus !== 'to_be_paid' && (
                                                    <div className="flex items-center justify-between text-sm font-bold text-emerald-600">
                                                        <span>Amount Already Paid</span>
                                                        <span>-₹{booking.advancePaid || 0}</span>
                                                    </div>
                                                )}

                                                <div className="flex items-center justify-between p-3 bg-indigo-600 rounded-xl text-white shadow-md">
                                                    <span className="text-xs font-bold uppercase tracking-widest">Balance Due</span>
                                                    <span className="text-2xl font-black">₹{balanceDue}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 md:w-80 lg:w-96 flex flex-col gap-6 bg-slate-50/30">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Add Extra Duration</h4>
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
                                                    onClick={() => setExtraHoursForm({ bookingId: booking.id, duration: 0.5, amount: '' })}
                                                    className={`flex-1 py-3 px-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                                                        extraHoursForm.bookingId === booking.id && extraHoursForm.duration === 0.5
                                                            ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-sm ring-1 ring-orange-100'
                                                            : 'bg-white border-slate-200 text-slate-500 hover:border-orange-200 hover:bg-orange-50/30'
                                                    }`}
                                                >
                                                    <Clock className="w-4 h-4" /> <span>+30m</span>
                                                </button>
                                                <button
                                                    onClick={() => setExtraHoursForm({ bookingId: booking.id, duration: 1, amount: '' })}
                                                    className={`flex-1 py-3 px-3 rounded-xl border font-bold text-xs flex flex-col items-center justify-center gap-1 transition-all ${
                                                        extraHoursForm.bookingId === booking.id && extraHoursForm.duration === 1
                                                            ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-sm ring-1 ring-orange-100'
                                                            : 'bg-white border-slate-200 text-slate-500 hover:border-orange-200 hover:bg-orange-50/30'
                                                    }`}
                                                >
                                                    <Clock className="w-4 h-4" /> <span>+1h</span>
                                                </button>
                                            </div>

                                            {extraHoursForm.bookingId === booking.id && (
                                                <div className="bg-white p-3 rounded-xl border border-orange-100 space-y-3 animate-in slide-in-from-top-2">
                                                    <div className="flex flex-col gap-1.5">
                                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Enter Additional Amount (₹)</label>
                                                        <div className="relative">
                                                            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-orange-400" />
                                                            <input
                                                                autoFocus
                                                                type="number"
                                                                min="0"
                                                                value={extraHoursForm.amount}
                                                                onChange={(e) => setExtraHoursForm(prev => ({ ...prev, amount: e.target.value === '' ? '' : Number(e.target.value) }))}
                                                                className="w-full pl-8 pr-4 py-2 bg-orange-50/30 border border-orange-200 rounded-lg text-sm font-black outline-none focus:ring-2 focus:ring-orange-500 text-slate-700"
                                                                placeholder="e.g. 250"
                                                            />
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleUpdateExtraHours(booking)}
                                                        disabled={isUpdating === booking.id || extraHoursForm.amount === ''}
                                                        className="w-full py-2.5 bg-orange-500 text-white text-xs font-black rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                                                    >
                                                        {isUpdating === booking.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                                        Apply Extra Time
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Allocate Item/Drink</h4>
                                        <div className="grid grid-cols-2 gap-2">
                                            {inventory.filter(item => {
                                                const currentQty = booking.selectedDrinks?.find(sd => sd.drinkId === item.id)?.quantity || 0;
                                                return item.stockQuantity > 0 || currentQty > 0;
                                            }).slice(0, 4).map(item => {
                                                const currentQty = booking.selectedDrinks?.find(sd => sd.drinkId === item.id)?.quantity || 0;
                                                return (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center justify-between p-2 bg-white border border-slate-100 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group relative"
                                                    >
                                                        <div className="flex items-center gap-2 overflow-hidden flex-1 select-none">
                                                            <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden text-[10px] text-slate-400">
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
                                                                    className="w-6 h-6 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100 flex items-center justify-center transition-all disabled:opacity-50"
                                                                    title="Remove one"
                                                                >
                                                                    <Minus className="w-3.5 h-3.5" />
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
                                                                className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex items-center justify-center transition-all disabled:opacity-50"
                                                                title="Add one"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-6 flex flex-col gap-2">
                                        <div className="relative">
                                            {completingBookingId === booking.id ? (
                                                <div className="absolute right-0 bottom-full mb-2 bg-white p-5 rounded-3xl border border-slate-200 shadow-2xl z-50 min-w-[280px] animate-in zoom-in-95 duration-200">
                                                    <div className="flex justify-between items-center mb-4">
                                                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Final Settlement</p>
                                                        <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">₹{Math.max(0, booking.totalAmount - (booking.advancePaid || 0))}</span>
                                                    </div>
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tight mb-3">Confirm Payment Via:</p>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {Object.values(PaymentMethod).map(method => (
                                                            <button
                                                                key={method}
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleMarkCompleted(booking, method);
                                                                }}
                                                                className="px-3 py-3 bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold rounded-2xl hover:bg-indigo-600 hover:text-white hover:border-indigo-600 transition-all uppercase shadow-sm"
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
                                                        className="w-full mt-4 py-1 text-[10px] font-black text-slate-400 uppercase hover:text-red-500 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : null}

                                            <button
                                                disabled={isUpdating === booking.id}
                                                onClick={() => {
                                                    const balance = Math.max(0, booking.totalAmount - (booking.advancePaid || 0));
                                                    if (balance > 0) {
                                                        setCompletingBookingId(booking.id);
                                                    } else {
                                                        handleMarkCompleted(booking);
                                                    }
                                                }}
                                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50"
                                            >
                                                {isUpdating === booking.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                                Mark Completed & Print Bill
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <InvoiceSection
                invoiceBooking={invoiceBooking}
                setInvoiceBooking={setInvoiceBooking}
                inventory={inventory}
                courts={courts}
                venueName={venueName}
                venueEmail={venueEmail}
            />
        </div>
    );
};

const InvoiceSection: React.FC<{
    invoiceBooking: Booking | null;
    setInvoiceBooking: (b: Booking | null) => void;
    inventory: DrinkInventoryItem[];
    courts: Court[];
    venueName?: string;
    venueEmail?: string;
}> = ({ invoiceBooking, setInvoiceBooking, inventory, courts, venueName, venueEmail }) => {
    return (
        <>
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
        </>
    );
};

export default ActiveBookings;
