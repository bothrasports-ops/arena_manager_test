import React, { useState, useMemo, useEffect } from 'react';
import {
    Clock,
    ShoppingBag,
    Plus,
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
import { Booking, DrinkInventoryItem, Platform } from '../types';
import { supabase } from '../lib/supabase';

interface ActiveBookingsProps {
    bookings: Booking[];
    inventory: DrinkInventoryItem[];
    onUpdate: () => void;
}

const ActiveBookings: React.FC<ActiveBookingsProps> = ({ bookings, inventory, onUpdate }) => {
    const [now, setNow] = useState(new Date());
    const [isUpdating, setIsUpdating] = useState<string | null>(null);
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
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {activeBookings.map(booking => (
                        <div key={booking.id} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                            <div className="p-6 flex-1">
                                <div className="flex items-start justify-between mb-4">
                                    <div>
                                        <h3 className="text-lg font-black text-slate-900">{booking.customerName}</h3>
                                        <p className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg inline-block mt-1">
                                            {booking.sport} &bull; {booking.platform}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Time Remaining</p>
                                        <p className="text-lg font-black text-emerald-600 leading-tight">ACTIVE</p>
                                    </div>
                                </div>

                                <div className="bg-slate-50 rounded-2xl p-4 space-y-3 mb-6 border border-slate-100">
                                    <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-2 font-medium">
                      <Clock className="w-4 h-4" /> Duration
                    </span>
                                        <span className="font-bold text-slate-900">{booking.bookingStartTime} - {booking.bookingEndTime}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 flex items-center gap-2 font-medium">
                      <ShoppingBag className="w-4 h-4" /> Current Bill
                    </span>
                                        <span className="text-lg font-black text-indigo-600">₹{booking.totalAmount}</span>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-6">
                                    <div className="flex items-center justify-between border-b border-slate-100 pb-1">
                                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Add Extra Hours</h4>
                                        <button
                                            onClick={() => setExtraHoursForm(prev => prev.bookingId === booking.id ? { ...prev, bookingId: null } : { bookingId: booking.id, duration: 0.5, amount: 0 })}
                                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700"
                                        >
                                            {extraHoursForm.bookingId === booking.id ? 'Cancel' : 'Add More Time'}
                                        </button>
                                    </div>

                                    {extraHoursForm.bookingId === booking.id && (
                                        <div className="bg-white p-3 rounded-xl border border-indigo-100 space-y-3 animate-in slide-in-from-top-2">
                                            <div className="flex gap-2">
                                                <div className="flex-1 relative group">
                                                    <select
                                                        value={extraHoursForm.duration}
                                                        onChange={(e) => setExtraHoursForm(prev => ({ ...prev, duration: Number(e.target.value) }))}
                                                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 appearance-none cursor-pointer pr-8"
                                                    >
                                                        {[0.5, 1, 1.5, 2, 2.5, 3].map(h => (
                                                            <option key={h} value={h}>{h} {h === 1 ? 'Hour' : 'Hours'}</option>
                                                        ))}
                                                    </select>
                                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                                </div>
                                                <div className="flex-1 relative">
                                                    <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        value={extraHoursForm.amount}
                                                        onChange={(e) => setExtraHoursForm(prev => ({ ...prev, amount: e.target.value === '' ? '' : Number(e.target.value) }))}
                                                        className="w-full pl-6 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                        placeholder="₹ Amount"
                                                    />
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleUpdateExtraHours(booking)}
                                                disabled={isUpdating === booking.id}
                                                className="w-full py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                            >
                                                {isUpdating === booking.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                                Confirm Extension
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-1">Quick Add Drinks</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {inventory.filter(i => i.stockQuantity > 0).slice(0, 4).map(item => {
                                            const currentQty = booking.selectedDrinks?.find(sd => sd.drinkId === item.id)?.quantity || 0;
                                            return (
                                                <button
                                                    key={item.id}
                                                    disabled={isUpdating === booking.id}
                                                    onClick={() => handleAddDrink(booking, item.id)}
                                                    className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group group-disabled:opacity-50 relative"
                                                >
                                                    <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center shrink-0 overflow-hidden text-[10px] text-slate-400">
                                                        {item.imageUrl ? (
                                                            <img src={item.imageUrl} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                        ) : (
                                                            <Package className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div className="text-left overflow-hidden flex-1">
                                                        <p className="text-[10px] font-bold text-slate-900 truncate">{item.name}</p>
                                                        <p className="text-[9px] text-indigo-500 font-black">₹{item.price}</p>
                                                    </div>
                                                    <div className="flex flex-col items-center">
                                                        {currentQty > 0 && (
                                                            <span className="absolute -top-1.5 -right-1.5 bg-indigo-600 text-white text-[8px] font-black h-5 min-w-5 px-1 flex items-center justify-center rounded-full shadow-lg border-2 border-white">
                                {currentQty}
                              </span>
                                                        )}
                                                        <Plus className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-600 p-4 flex items-center justify-between text-white">
                                <p className="text-xs font-bold uppercase tracking-widest">Ongoing Session</p>
                                <div className="flex items-center gap-2">
                                    <RefreshCw className={`w-4 h-4 ${isUpdating === booking.id ? 'animate-spin' : ''}`} />
                                    <span className="text-xs font-black">EDITABLE</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ActiveBookings;
