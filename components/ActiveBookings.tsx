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
import { Booking, DrinkInventoryItem, Platform, BookingType } from '../types';
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
                                    <div className="flex items-center justify-between text-xs border-b border-slate-200 pb-2 mb-2">
                                        <span className="text-slate-500 font-bold uppercase tracking-wider">Bill Details</span>
                                        <span className="font-bold text-slate-400"># {booking.id.slice(0, 8)}</span>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {booking.bookingType} Session ({booking.bookingStartTime} - {booking.bookingEndTime})
                      </span>
                                            <span className="font-bold text-slate-900">₹{booking.bookingAmount}</span>
                                        </div>

                                        {booking.bookingType === BookingType.COACHING && booking.coachingFee !== undefined && booking.coachingFee > 0 && (
                                            <div className="flex items-center justify-between text-sm pl-5">
                                                <span className="text-slate-500">Coaching Fee</span>
                                                <span className="font-bold text-slate-900">₹{booking.coachingFee}</span>
                                            </div>
                                        )}

                                        {booking.selectedDrinks.length > 0 && booking.selectedDrinks.some(d => Number(d.quantity) > 0) && (
                                            <div className="space-y-1">
                                                {booking.selectedDrinks.filter(d => Number(d.quantity) > 0).map(sd => {
                                                    const item = inventory.find(i => i.id === sd.drinkId);
                                                    return (
                                                        <div key={sd.drinkId} className="flex items-center justify-between text-[11px] text-slate-500 pl-5">
                                                            <span>{item?.name || 'Drink'} x {sd.quantity}</span>
                                                            <span>₹{(Number(sd.priceAtTime) || 0) * (Number(sd.quantity) || 0)}</span>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {booking.extraHours?.enabled && booking.extraHours.amount > 0 && (
                                            <div className="flex items-center justify-between text-sm text-orange-600 font-medium">
                        <span className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Extra Time ({booking.extraHours.duration}h)
                        </span>
                                                <span className="font-bold">₹{booking.extraHours.amount}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between pt-2 border-t border-slate-200 mt-2">
                                            <span className="font-bold text-slate-900 uppercase text-xs tracking-wider">Total Bill</span>
                                            <span className="text-xl font-black text-indigo-600">₹{booking.totalAmount}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4 mb-6">
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
                                                className={`flex-1 py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                                                    extraHoursForm.bookingId === booking.id && extraHoursForm.duration === 0.5
                                                        ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-sm ring-1 ring-orange-100'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-orange-200 hover:bg-orange-50/30'
                                                }`}
                                            >
                                                <Clock className="w-3.5 h-3.5" /> +30 Mins
                                            </button>
                                            <button
                                                onClick={() => setExtraHoursForm({ bookingId: booking.id, duration: 1, amount: '' })}
                                                className={`flex-1 py-2 px-3 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                                                    extraHoursForm.bookingId === booking.id && extraHoursForm.duration === 1
                                                        ? 'bg-orange-50 border-orange-500 text-orange-600 shadow-sm ring-1 ring-orange-100'
                                                        : 'bg-white border-slate-200 text-slate-500 hover:border-orange-200 hover:bg-orange-50/30'
                                                }`}
                                            >
                                                <Clock className="w-3.5 h-3.5" /> +1 Hour
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
                                                    className="w-full py-2 bg-orange-500 text-white text-xs font-black rounded-lg hover:bg-orange-600 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                                                >
                                                    {isUpdating === booking.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                                                    Apply Extra {extraHoursForm.duration === 0.5 ? '30m' : '1h'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
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
