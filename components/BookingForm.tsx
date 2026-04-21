
import React, { useState, useMemo } from 'react';
import {
  User,
  Phone,
  Globe,
  IndianRupee,
  Plus,
  Trash2,
  Clock,
  Calendar,
  CheckCircle2,
  Package,
  Layers,
  Loader2,
  AlertCircle,
  Trophy,
  ChevronDown,
  IdCard,
  GraduationCap,
  Users,
  Smartphone
} from 'lucide-react';
import { toast } from 'sonner';
import { Booking, Platform, DrinkInventoryItem, SelectedDrink, Sport, BookingType } from '../types';
import { supabase } from '../lib/supabase';

interface BookingFormProps {
  onSave: () => void;
  inventory: DrinkInventoryItem[];
  venueId?: string;
  availableSports: Sport[];
}

const BookingForm: React.FC<BookingFormProps> = ({ onSave, inventory, venueId, availableSports }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [platform, setPlatform] = useState<Platform>(Platform.PLAYO);
  const [bookingType, setBookingType] = useState<BookingType>(BookingType.COURT);
  const [membershipId, setMembershipId] = useState('');
  const [coachingFee, setCoachingFee] = useState<number | ''>(0);
  const [sport, setSport] = useState<Sport>(availableSports[0] || Sport.PICKLEBALL);
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingStartTime, setBookingStartTime] = useState('10:00');
  const [bookingEndTime, setBookingEndTime] = useState('11:00');
  const [bookingAmount, setBookingAmount] = useState<number | ''>(0);
  const [selectedDrinks, setSelectedDrinks] = useState<SelectedDrink[]>([]);
  const [extraHoursEnabled, setExtraHoursEnabled] = useState(false);

  // Sync inventory with selectedDrinks
  React.useEffect(() => {
    if (inventory.length > 0 && selectedDrinks.length === 0) {
      setSelectedDrinks(inventory.map(item => ({
        drinkId: item.id,
        quantity: 0,
        priceAtTime: item.price
      })));
    }
  }, [inventory, selectedDrinks.length]);
  const [extraHoursDuration, setExtraHoursDuration] = useState<number>(0.5);
  const [extraHoursAmount, setExtraHoursAmount] = useState<number | ''>(0);

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let h = 0; h < 24; h++) {
      for (let m = 0; m < 60; m += 30) {
        const hour24 = h.toString().padStart(2, '0');
        const minute = m.toString().padStart(2, '0');
        const time24 = `${hour24}:${minute}`;

        const period = h >= 12 ? 'PM' : 'AM';
        const hour12 = h % 12 === 0 ? 12 : h % 12;
        const display = `${hour12}:${minute} ${period}`;

        slots.push({ value: time24, label: display });
      }
    }
    return slots;
  }, []);

  const calculateHours = (start: string, end: string) => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);

    let diff = (endH + endM / 60) - (startH + startM / 60);
    if (diff < 0) diff += 24; // Handle overnight bookings
    return diff;
  };

  const totalHours = useMemo(() => {
    if (bookingType !== BookingType.COURT) return 0;
    const baseHours = calculateHours(bookingStartTime, bookingEndTime);
    const extra = extraHoursEnabled ? Number(extraHoursDuration) : 0;
    return Number((baseHours + extra).toFixed(2));
  }, [bookingStartTime, bookingEndTime, extraHoursEnabled, extraHoursDuration, bookingType]);

  const totalAmount = useMemo(() => {
    const drinksTotal = selectedDrinks.reduce((acc, drink) => {
      const qty = typeof drink.quantity === 'number' ? drink.quantity : 0;
      const price = typeof drink.priceAtTime === 'number' ? drink.priceAtTime : 0;
      return acc + (price * qty);
    }, 0);
    const extraTotal = extraHoursEnabled ? (Number(extraHoursAmount) || 0) : 0;
    const coachingTotal = bookingType === BookingType.COACHING ? (Number(coachingFee) || 0) : 0;
    return (Number(bookingAmount) || 0) + drinksTotal + extraTotal + coachingTotal;
  }, [bookingAmount, selectedDrinks, extraHoursEnabled, extraHoursAmount, coachingFee, bookingType]);

  const handleUpdateQty = (drinkId: string, val: string) => {
    setSelectedDrinks(prev => prev.map(sd => {
      if (sd.drinkId === drinkId) {
        if (val === '') return { ...sd, quantity: '' };
        const num = Number(val);
        return { ...sd, quantity: isNaN(num) ? 0 : num };
      }
      return sd;
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phoneNumber) {
      toast.error("Please fill in basic customer details.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Insert main booking
      const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            venue_id: venueId,
            customer_name: customerName,
            phone_number: phoneNumber,
            platform: platform,
            booking_type: bookingType,
            membership_id: bookingType === BookingType.MEMBERSHIP ? membershipId : null,
            coaching_fee: bookingType === BookingType.COACHING ? Number(coachingFee) : null,
            sport: sport,
            booking_date: bookingDate,
            booking_start_time: bookingType === BookingType.COURT ? bookingStartTime : null,
            booking_end_time: bookingType === BookingType.COURT ? bookingEndTime : null,
            total_hours: totalHours,
            booking_amount: Number(bookingAmount) || 0,
            extra_hours_enabled: extraHoursEnabled,
            extra_hours_duration: extraHoursDuration,
            extra_hours_amount: Number(extraHoursAmount) || 0,
            total_amount: totalAmount
          })
          .select()
          .single();

      if (bookingError) throw bookingError;
      if (!bookingData) throw new Error("Booking created but no data returned from database.");

      // 2. Insert drinks if any
      const drinksToInsert = selectedDrinks
          .filter(sd => typeof sd.quantity === 'number' && sd.quantity > 0)
          .map(sd => ({
            booking_id: bookingData.id,
            drink_id: sd.drinkId,
            quantity: Number(sd.quantity),
            price_at_time: Number(sd.priceAtTime) || 0
          }));

      if (drinksToInsert.length > 0) {
        console.log('Inserting drinks:', drinksToInsert);
        const { error: drinksError } = await supabase
            .from('booking_drinks')
            .insert(drinksToInsert);

        if (drinksError) {
          console.error('Error inserting drinks:', drinksError);
          throw new Error(`Failed to save drinks: ${drinksError.message}`);
        }

        // Update Inventory Stock
        for (const drink of drinksToInsert) {
          const item = inventory.find(i => i.id === drink.drink_id);
          if (item) {
            const currentStock = Number(item.stockQuantity) || 0;
            const newStock = Math.max(0, currentStock - drink.quantity);

            const { error: invUpdateError } = await supabase
                .from('inventory')
                .update({ stock_quantity: newStock })
                .eq('id', drink.drink_id);

            if (invUpdateError) {
              console.error(`Failed to update stock for ${item.name}:`, invUpdateError);
              // We don't throw here to avoid failing the whole booking if just stock update fails,
              // but we should probably notify the user.
              toast.warning(`Booking saved, but failed to update stock for ${item.name}`);
            }
          }
        }
      }

      // Success Reset
      setCustomerName('');
      setPhoneNumber('');
      setMembershipId('');
      setCoachingFee(0);
      setBookingDate(new Date().toISOString().split('T')[0]);
      setBookingAmount(0);
      setSelectedDrinks(inventory.map(item => ({
        drinkId: item.id,
        quantity: 0,
        priceAtTime: item.price
      })));
      setExtraHoursEnabled(false);
      onSave(); // Refresh global data
      toast.success("Entry saved successfully!");
    } catch (error: any) {
      console.error('Error saving booking:', error);
      toast.error(error.message || "Failed to save booking. Please check your Supabase connection.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Create New Entry</h2>
          <div className="px-3 py-1 bg-white/20 rounded-lg text-white text-xs font-bold uppercase tracking-widest">
            Cloud Sync Active
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          {/* Entry Type Selection */}
          <div className="flex flex-wrap gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            {Object.values(BookingType).map((type) => (
                <button
                    key={type}
                    type="button"
                    onClick={() => setBookingType(type)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-bold transition-all ${
                        bookingType === type
                            ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'
                    }`}
                >
                  {type === BookingType.COURT && <Trophy className="w-4 h-4" />}
                  {type === BookingType.MEMBERSHIP && <IdCard className="w-4 h-4" />}
                  {type === BookingType.COACHING && <GraduationCap className="w-4 h-4" />}
                  {type}
                </button>
            ))}
          </div>

          {/* Customer Section */}
          <section className="space-y-4">
            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <User className="w-4 h-4 text-indigo-500" />
              1. Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Customer Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                      required
                      type="text"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="e.g. Rahul Sharma"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Contact Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                      required
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      placeholder="+91 XXXXX XXXXX"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Booking Specs Section */}
          <section className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              2. {bookingType} Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <input
                        type="date"
                        required
                        value={bookingDate}
                        onChange={(e) => setBookingDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                    />
                  </div>
                </div>

                {bookingType === BookingType.COURT && (
                    <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Start Time</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <select
                              value={bookingStartTime}
                              onChange={(e) => setBookingStartTime(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none font-bold text-slate-700"
                          >
                            {timeSlots.map(slot => (
                                <option key={`start-${slot.value}`} value={slot.value}>{slot.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">End Time</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <select
                              value={bookingEndTime}
                              onChange={(e) => setBookingEndTime(e.target.value)}
                              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none font-bold text-slate-700"
                          >
                            {timeSlots.map(slot => (
                                <option key={`end-${slot.value}`} value={slot.value}>{slot.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                )}

                {bookingType === BookingType.MEMBERSHIP && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Membership ID / Plan</label>
                      <div className="relative">
                        <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="text"
                            value={membershipId}
                            onChange={(e) => setMembershipId(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                            placeholder="e.g. GOLD-2024-001"
                        />
                      </div>
                    </div>
                )}

                {bookingType === BookingType.COACHING && (
                    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">Monthly Coaching Fee (₹)</label>
                      <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            type="number"
                            value={coachingFee}
                            onChange={(e) => setCoachingFee(e.target.value === '' ? '' : Number(e.target.value))}
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700"
                            placeholder="0"
                        />
                      </div>
                    </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Sport</label>
                  <div className="relative">
                    <Trophy className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <select
                        value={sport}
                        onChange={(e) => setSport(e.target.value as Sport)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none font-bold text-slate-700"
                    >
                      {availableSports.length > 0 ? (
                          availableSports.map(s => (
                              <option key={s} value={s}>{s}</option>
                          ))
                      ) : (
                          Object.values(Sport).map(s => (
                              <option key={s} value={s}>{s}</option>
                          ))
                      )}
                    </select>
                  </div>
                </div>

                {bookingType === BookingType.COURT && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase">Platform</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {Object.values(Platform).map(p => (
                            <button
                                key={p}
                                type="button"
                                onClick={() => setPlatform(p)}
                                className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                                    platform === p
                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                                        : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                }`}
                            >
                              {p === Platform.PLAYO && <Smartphone className="w-5 h-5" />}
                              {p === Platform.HUDDLE && <Users className="w-5 h-5" />}
                              {p === Platform.KHELOMORE && <Trophy className="w-5 h-5" />}
                              {p === Platform.OFFLINE && <User className="w-5 h-5" />}
                              <span className="text-[10px] font-bold uppercase">{p}</span>
                            </button>
                        ))}
                      </div>
                    </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Base Amount (₹)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="number"
                        min="0"
                        value={bookingAmount}
                        onChange={(e) => setBookingAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-900"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {bookingType === BookingType.COURT && (
                    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-center">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-orange-500" />
                          <span className="text-xs font-bold text-slate-700 uppercase">Extra Hours</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                              type="checkbox"
                              checked={extraHoursEnabled}
                              onChange={(e) => setExtraHoursEnabled(e.target.checked)}
                              className="sr-only peer"
                          />
                          <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-500"></div>
                        </label>
                      </div>

                      {extraHoursEnabled ? (
                          <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            <div className="flex gap-2">
                              <div className="flex-1 relative group">
                                <select
                                    value={extraHoursDuration}
                                    onChange={(e) => setExtraHoursDuration(Number(e.target.value))}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500 appearance-none cursor-pointer pr-8"
                                >
                                  {[0.5, 1, 1.5, 2, 2.5, 3].map(h => (
                                      <option key={h} value={h}>{h} {h === 1 ? 'Hour' : 'Hours'}</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none group-hover:text-slate-600 transition-colors" />
                              </div>
                              <div className="flex-1">
                                <input
                                    type="number"
                                    min="0"
                                    value={extraHoursAmount}
                                    onChange={(e) => setExtraHoursAmount(e.target.value === '' ? '' : Number(e.target.value))}
                                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
                                    placeholder="₹ Amount"
                                />
                              </div>
                            </div>
                          </div>
                      ) : (
                          <div className="text-center py-2">
                            <p className="text-xs text-slate-400 italic">No extra hours selected</p>
                          </div>
                      )}
                    </div>
                )}

                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3">Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Base Amount</span>
                      <span className="font-bold text-slate-700">₹{Number(bookingAmount) || 0}</span>
                    </div>
                    {bookingType === BookingType.COURT && extraHoursEnabled && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Extra Hours ({extraHoursDuration}h)</span>
                          <span className="font-bold text-slate-700">₹{Number(extraHoursAmount) || 0}</span>
                        </div>
                    )}
                    {bookingType === BookingType.COACHING && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Coaching Fee</span>
                          <span className="font-bold text-slate-700">₹{Number(coachingFee) || 0}</span>
                        </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Inventory Section */}
          {bookingType === BookingType.COURT && (
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                    <Package className="w-4 h-4 text-indigo-500" />
                    3. Inventory & Drinks
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {inventory.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                        <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                        <p className="text-slate-500 text-sm font-medium">Your Inventory is currently empty</p>
                        <p className="text-slate-400 text-xs mt-1">Visit the 'Inventory' tab to add items.</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {inventory.map((item) => {
                          const selectedDrink = selectedDrinks.find(sd => sd.drinkId === item.id) || { quantity: 0, priceAtTime: item.price };
                          return (
                              <div key={item.id} className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-2xl animate-in zoom-in-95 duration-200 shadow-sm">
                                <div className="w-14 h-14 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-100 shrink-0 overflow-hidden">
                                  {item.imageUrl ? (
                                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                      <Package className="text-slate-400 w-6 h-6" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-bold text-slate-700 truncate">{item.name}</p>
                                  <p className="text-[10px] text-slate-500 font-bold">₹{item.price} &bull; {item.stockQuantity} Left</p>

                                  <div className="flex items-center gap-2 mt-2">
                                    <input
                                        type="number"
                                        min="0"
                                        max={item.stockQuantity}
                                        value={selectedDrink.quantity}
                                        onChange={(e) => handleUpdateQty(item.id, e.target.value)}
                                        className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-indigo-500"
                                        placeholder="0"
                                    />
                                    <span className="text-[10px] font-black text-slate-900">₹{(Number(selectedDrink.quantity) || 0) * item.price}</span>
                                  </div>
                                </div>
                              </div>
                          );
                        })}
                      </div>
                  )}
                </div>
              </section>
          )}

          {/* Footer & Totals */}
          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-wrap items-center gap-4">
              {bookingType === BookingType.COURT && (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Hours</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 tracking-tighter">{totalHours}</span>
                      <span className="text-xs font-bold text-slate-500 uppercase">{totalHours === 1 ? 'Hr' : 'Hrs'}</span>
                    </div>
                  </div>
              )}
              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Total Payable Amount</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-indigo-600">₹</span>
                  <span className="text-4xl font-black text-slate-900 tracking-tighter">{totalAmount}</span>
                </div>
              </div>
            </div>

            <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full md:w-auto px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 hover:shadow-indigo-200 active:scale-95 ${isSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Syncing Data...
                  </>
              ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    Complete {bookingType}
                  </>
              )}
            </button>
          </div>
        </form>
      </div>
  );
};

export default BookingForm;
