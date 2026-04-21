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
    CalendarClock
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

    // Update clock every minute
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    const activeBookings = useMemo(() => {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const localToday = `${yyyy}-${mm}-${dd}`;

        return bookings.filter(b => {
            // Comparison in local date string
            if (b.bookingDate !== localToday) return false;

            const [startH, startM] = b.bookingStartTime.split(':').map(Number);
            const [endH, endM] = b.bookingEndTime.split(':').map(Number);

            const startTimeDate = new Date(now);
            startTimeDate.setHours(startH, startM, 0, 0);

            const endTimeDate = new Date(now);
            endTimeDate.setHours(endH, endM, 0, 0);

            // Handle bookings that end at midnight or next day if necessary
            // For now assuming same day bookings
            return now >= startTimeDate && now < endTimeDate;
        });
    }, [bookings, now]);

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
