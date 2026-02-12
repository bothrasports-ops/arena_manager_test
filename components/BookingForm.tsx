
import React, { useState, useMemo } from 'react';
import {
  User,
  Phone,
  Globe,
  IndianRupee,
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  Package,
  Layers,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { Booking, Platform, DrinkInventoryItem, SelectedDrink } from '../types';
import { supabase } from '../lib/supabase';

interface BookingFormProps {
  onSave: () => void;
  inventory: DrinkInventoryItem[];
}

const BookingForm: React.FC<BookingFormProps> = ({ onSave, inventory }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [platform, setPlatform] = useState<Platform>(Platform.PLAYO);
  const [bookingAmount, setBookingAmount] = useState<number | ''>(0);
  const [selectedDrinks, setSelectedDrinks] = useState<SelectedDrink[]>([]);
  const [extraHoursEnabled, setExtraHoursEnabled] = useState(false);
  const [extraHoursDuration, setExtraHoursDuration] = useState<number>(0);
  const [extraHoursAmount, setExtraHoursAmount] = useState<number | ''>(0);

  const totalAmount = useMemo(() => {
    const drinksTotal = selectedDrinks.reduce((acc, drink) => acc + (drink.priceAtTime * drink.quantity), 0);
    const extraTotal = extraHoursEnabled ? (Number(extraHoursAmount) || 0) : 0;
    return (Number(bookingAmount) || 0) + drinksTotal + extraTotal;
  }, [bookingAmount, selectedDrinks, extraHoursEnabled, extraHoursAmount]);

  const handleAddDrink = () => {
    if (inventory.length === 0) {
      alert("Inventory is empty! Go to the 'Settings' tab to add items (e.g. Water, Soda) first.");
      return;
    }
    const firstItem = inventory[0];
    setSelectedDrinks([...selectedDrinks, {
      drinkId: firstItem.id,
      quantity: 1,
      priceAtTime: firstItem.price
    }]);
  };

  const handleRemoveDrink = (index: number) => {
    setSelectedDrinks(selectedDrinks.filter((_, i) => i !== index));
  };

  const handleUpdateDrink = (index: number, drinkId: string) => {
    const item = inventory.find(i => i.id === drinkId);
    if (!item) return;
    const updated = [...selectedDrinks];
    updated[index] = { ...updated[index], drinkId: item.id, priceAtTime: item.price };
    setSelectedDrinks(updated);
  };

  const handleUpdateQty = (index: number, qty: number) => {
    const updated = [...selectedDrinks];
    updated[index].quantity = Math.max(1, qty);
    setSelectedDrinks(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phoneNumber) {
      alert("Please fill in basic customer details.");
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Insert main booking
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert({
          customer_name: customerName,
          phone_number: phoneNumber,
          platform: platform,
          booking_amount: Number(bookingAmount) || 0,
          extra_hours_enabled: extraHoursEnabled,
          extra_hours_duration: extraHoursDuration,
          extra_hours_amount: Number(extraHoursAmount) || 0,
          total_amount: totalAmount
        })
        .select()
        .single();

      if (bookingError) throw bookingError;

      // 2. Insert drinks if any
      if (selectedDrinks.length > 0) {
        const drinksToInsert = selectedDrinks.map(sd => ({
          booking_id: bookingData.id,
          drink_id: sd.drinkId,
          quantity: sd.quantity,
          price_at_time: sd.priceAtTime
        }));

        const { error: drinksError } = await supabase
          .from('booking_drinks')
          .insert(drinksToInsert);

        if (drinksError) throw drinksError;
      }

      // Success Reset
      setCustomerName('');
      setPhoneNumber('');
      setBookingAmount(0);
      setSelectedDrinks([]);
      setExtraHoursEnabled(false);
      onSave(); // Refresh global data
      alert("Booking saved successfully!");
    } catch (error) {
      console.error('Error saving booking:', error);
      alert("Failed to save booking. Please check your Supabase connection.");
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
            2. Booking Specification
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Select Platform</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <select
                    value={platform}
                    onChange={(e) => setPlatform(e.target.value as Platform)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none appearance-none font-bold text-slate-700"
                  >
                    {Object.values(Platform).map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">Platform Base Amount (₹)</label>
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
                    <div className="flex-1">
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        value={extraHoursDuration}
                        onChange={(e) => setExtraHoursDuration(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-orange-500"
                        placeholder="Hours"
                      />
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
          </div>
        </section>

        {/* Inventory Section */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" />
              3. Inventory & Drinks
            </h3>
            <button
              type="button"
              onClick={handleAddDrink}
              title={inventory.length === 0 ? "Inventory is empty! Add items in Settings first." : "Add a drink item"}
              className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all border ${
                inventory.length > 0
                  ? 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border-indigo-100'
                  : 'text-slate-400 bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Add Drink Item
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {inventory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-slate-100 rounded-2xl bg-slate-50/30">
                <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-slate-500 text-sm font-medium">Your Inventory is currently empty</p>
                <p className="text-slate-400 text-xs mt-1">Visit the 'Settings' tab to add items before adding them to a booking.</p>
              </div>
            ) : selectedDrinks.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed border-slate-100 rounded-2xl">
                 <p className="text-slate-400 text-sm">Click "Add Drink" to include refreshments in this booking.</p>
              </div>
            ) : (
              selectedDrinks.map((sd, index) => (
                <div key={index} className="flex flex-wrap items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl animate-in zoom-in-95 duration-200 shadow-sm">
                  <div className="flex-1 min-w-[180px]">
                    <select
                      value={sd.drinkId}
                      onChange={(e) => handleUpdateDrink(index, e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none"
                    >
                      {inventory.map(item => (
                        <option key={item.id} value={item.id}>{item.name} (₹{item.price})</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20">
                      <input
                        type="number"
                        min="1"
                        value={sd.quantity}
                        onChange={(e) => handleUpdateQty(index, Number(e.target.value))}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-center outline-none"
                      />
                    </div>
                    <div className="min-w-[80px] text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Subtotal</p>
                      <p className="text-sm font-black text-slate-900">₹{sd.priceAtTime * sd.quantity}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveDrink(index)}
                      className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Footer & Totals */}
        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
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
                Complete Booking
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default BookingForm;
