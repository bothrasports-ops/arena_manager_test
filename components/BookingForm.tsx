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
  Zap,
  Hexagon,
  ChevronDown,
  IdCard,
  GraduationCap,
  Users,
  Smartphone,
  CreditCard
} from 'lucide-react';
import { toast } from 'sonner';
import { Booking, Platform, DrinkInventoryItem, SelectedDrink, Sport, BookingType, Court, MembershipPlanDefinition, BookingPlatform, PaymentMethod } from '../types';
import { supabase } from '../lib/supabase';

interface BookingFormProps {
  onSave: () => void;
  inventory: DrinkInventoryItem[];
  courts: Court[];
  membershipPlans: MembershipPlanDefinition[];
  platforms: BookingPlatform[];
  venueId?: string;
  availableSports: Sport[];
  initialData?: {
    courtId?: string;
    date?: string;
    startTime?: string;
  };
}

const BookingForm: React.FC<BookingFormProps> = ({ onSave, inventory, courts, membershipPlans, platforms, venueId, availableSports, initialData }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [platform, setPlatform] = useState<Platform>(platforms[0]?.name || 'Offline');
  const [bookingType, setBookingType] = useState<BookingType>(BookingType.COURT);

  const initialCourt = initialData?.courtId ? courts.find(c => c.id === initialData.courtId) : null;

  const [sport, setSport] = useState<Sport>(initialCourt?.sport || availableSports[0] || Sport.PICKLEBALL);
  const [courtId, setCourtId] = useState<string>(initialData?.courtId || courts[0]?.id || '');
  const [paymentStatus, setPaymentStatus] = useState<'prepaid' | 'to_be_paid' | 'partially_paid'>('to_be_paid');
  const [advancePaid, setAdvancePaid] = useState<number | ''>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);

  const getLocalDateString = () => {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localDate = new Date(now.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const [bookingDate, setBookingDate] = useState(initialData?.date || getLocalDateString());
  const [bookingStartTime, setBookingStartTime] = useState(initialData?.startTime || '10:00');

  const getInitialEndTime = (start: string) => {
    const [h, m] = start.split(':').map(Number);
    const endH = (h + 1) % 24;
    return `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const [bookingEndTime, setBookingEndTime] = useState(getInitialEndTime(initialData?.startTime || '10:00'));
  const [bookingAmount, setBookingAmount] = useState<number | ''>(0);

  const selectedCourt = useMemo(() => courts.find(c => c.id === courtId), [courts, courtId]);

  const timeSlots = useMemo(() => {
    const slots = [];
    let startMin = 0;
    let endMin = 1440;

    if (selectedCourt?.start_time && selectedCourt?.end_time) {
      const [sh, sm] = selectedCourt.start_time.split(':').map(Number);
      const [eh, em] = selectedCourt.end_time.split(':').map(Number);
      startMin = sh * 60 + sm;
      endMin = eh * 60 + em;

      if (startMin === endMin) {
        endMin = startMin + 1440;
      } else if (endMin < startMin) {
        endMin += 1440;
      }
    }

    for (let totalMin = startMin; totalMin <= endMin; totalMin += 30) {
      const h = Math.floor(totalMin / 60) % 24;
      const m = totalMin % 60;
      const hour24 = h.toString().padStart(2, '0');
      const minute = m.toString().padStart(2, '0');
      const time24 = `${hour24}:${minute}`;
      const period = h >= 12 ? 'PM' : 'AM';
      const hour12 = h % 12 === 0 ? 12 : h % 12;
      const display = `${hour12}:${minute} ${period}`;
      slots.push({ value: time24, label: display });
    }
    return slots;
  }, [selectedCourt]);

  React.useEffect(() => {
    if (timeSlots.length > 0) {
      const isValidStart = timeSlots.some(s => s.value === bookingStartTime);
      if (!isValidStart) setBookingStartTime(timeSlots[0].value);

      const isValidEnd = timeSlots.some(s => s.value === bookingEndTime);
      if (!isValidEnd && timeSlots.length > 2) setBookingEndTime(timeSlots[2].value);
      else if (!isValidEnd) setBookingEndTime(timeSlots[timeSlots.length-1].value);
    }
  }, [timeSlots, bookingStartTime, bookingEndTime]);

  const calculateHours = (start: string, end: string) => {
    const [startH, startM] = start.split(':').map(Number);
    const [endH, endM] = end.split(':').map(Number);
    let diff = (endH + endM / 60) - (startH + startM / 60);
    if (diff < 0) diff += 24;
    return diff;
  };

  const totalHours = useMemo(() => {
    if (bookingType !== BookingType.COURT) return 0;
    return Number(calculateHours(bookingStartTime, bookingEndTime).toFixed(2));
  }, [bookingStartTime, bookingEndTime, bookingType]);

  const totalAmount = useMemo(() => {
    return Number(bookingAmount) || 0;
  }, [bookingAmount]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phoneNumber) {
      toast.error("Please fill in basic customer details.");
      return;
    }

    if (bookingType === BookingType.COURT && !courtId) {
      toast.error("Please select a court.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: bookingData, error: bookingError } = await supabase
          .from('bookings')
          .insert({
            venue_id: venueId,
            customer_name: customerName,
            phone_number: phoneNumber,
            platform: platform,
            booking_type: bookingType,
            membership_id: null,
            coaching_fee: null,
            sport: sport,
            booking_date: bookingDate,
            booking_start_time: bookingType === BookingType.COURT ? bookingStartTime : '10:00',
            booking_end_time: bookingType === BookingType.COURT ? bookingEndTime : '11:00',
            total_hours: totalHours,
            booking_amount: Number(bookingAmount) || 0,
            extra_hours_enabled: false,
            extra_hours_duration: 0,
            extra_hours_amount: 0,
            total_amount: totalAmount,
            court_id: courtId || null,
            payment_status: paymentStatus,
            advance_paid: Number(advancePaid) || 0,
            payment_method: paymentStatus !== 'to_be_paid' ? paymentMethod : null,
            status: 'active'
          })
          .select()
          .single();

      if (bookingError) throw bookingError;
      if (!bookingData) throw new Error("Booking created but no data returned from database.");

      setCustomerName('');
      setPhoneNumber('');
      setBookingDate(getLocalDateString());
      setBookingAmount(0);
      setAdvancePaid(0);
      setPaymentStatus('to_be_paid');
      onSave();
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
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-8">
          <div className="flex flex-wrap gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
            {[BookingType.COURT].map((type) => (
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
                  <Zap className="w-4 h-4 fill-indigo-600/10" />
                  {type}
                </button>
            ))}
          </div>

          <section className="space-y-4">
            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-100 pb-2">
              <User className="w-4 h-4 text-indigo-500" />
              1. Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase">
                  Customer Name
                </label>
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

          <section className="space-y-4 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
            <h3 className="text-slate-900 font-bold text-sm uppercase tracking-wider flex items-center gap-2 border-b border-slate-200 pb-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              2. {bookingType} Details
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Sport</label>
                  <div className="relative">
                    <Hexagon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
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

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Select Court</label>
                  <div className="grid grid-cols-3 gap-2">
                    {courts.filter(c => c.sport === sport).map(court => (
                        <button
                            key={court.id}
                            type="button"
                            onClick={() => setCourtId(court.id)}
                            className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                                courtId === court.id
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                            }`}
                        >
                          {court.name}
                        </button>
                    ))}
                    {courts.filter(c => c.sport === sport).length === 0 && (
                        <p className="col-span-3 text-[10px] text-slate-400 italic">No courts found for this sport</p>
                    )}
                  </div>
                </div>

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

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase">Start Time</label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <select
                          value={bookingStartTime}
                          onChange={(e) => {
                            const newStart = e.target.value;
                            setBookingStartTime(newStart);
                            setBookingEndTime(getInitialEndTime(newStart));
                          }}
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

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Platform</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                        type="button"
                        onClick={() => setPlatform('Offline')}
                        className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                            platform === 'Offline'
                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                        }`}
                    >
                      <User className={`w-5 h-5 ${platform === 'Offline' ? 'text-indigo-600' : 'text-slate-300'}`} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Offline</span>
                    </button>
                    {platforms.map(p => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setPlatform(p.name)}
                            className={`flex flex-col items-center justify-center gap-2 p-3 rounded-xl border transition-all ${
                                platform === p.name
                                    ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                            }`}
                        >
                          <Globe className={`w-5 h-5 ${platform === p.name ? 'text-indigo-600' : 'text-slate-300'}`} />
                          <span className="text-[10px] font-bold uppercase tracking-wider">{p.name}</span>
                        </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-1.5 animate-in fade-in">
                  <label className="text-xs font-bold text-slate-500 uppercase">Booking Amount (₹)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="number"
                        min="0"
                        value={bookingAmount}
                        onChange={(e) => setBookingAmount(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-black text-slate-900"
                        placeholder="0"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase">Payment Status</label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {(['to_be_paid', 'partially_paid', 'prepaid'] as const).map(status => (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setPaymentStatus(status)}
                            className={`py-2 px-3 rounded-xl border text-[10px] font-bold uppercase transition-all ${
                                paymentStatus === status
                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-md'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-emerald-300'
                            }`}
                        >
                          {status.replace(/_/g, ' ')}
                        </button>
                    ))}
                  </div>
                </div>

                {(paymentStatus === 'partially_paid' || paymentStatus === 'prepaid') && (
                    <div className="space-y-4 animate-in slide-in-from-top-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Advance Collected (₹)</label>
                        <div className="relative">
                          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                              type="number"
                              min="0"
                              value={advancePaid}
                              onChange={(e) => setAdvancePaid(e.target.value === '' ? '' : Number(e.target.value))}
                              className="w-full pl-10 pr-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-black text-emerald-900"
                          />
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-500 uppercase">Payment Method</label>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.values(PaymentMethod).map(method => (
                              <button
                                  key={method}
                                  type="button"
                                  onClick={() => setPaymentMethod(method)}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[10px] font-bold uppercase transition-all ${
                                      paymentMethod === method
                                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                                          : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                                  }`}
                              >
                                <CreditCard className={`w-3.5 h-3.5 ${paymentMethod === method ? 'text-white' : 'text-slate-400'}`} />
                                {method}
                              </button>
                          ))}
                        </div>
                      </div>
                    </div>
                )}

                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                  <h4 className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-3">Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Booking Amount</span>
                      <span className="font-bold text-slate-700">₹{Number(bookingAmount) || 0}</span>
                    </div>
                    {paymentStatus !== 'to_be_paid' && (
                        <div className="flex justify-between text-emerald-600 font-bold">
                          <span>Advance Paid</span>
                          <span>-₹{Number(advancePaid) || 0}</span>
                        </div>
                    )}
                    <div className="pt-2 border-t border-indigo-200 flex justify-between font-black text-slate-900">
                      <span>Remaining (at start)</span>
                      <span>₹{Math.max(0, totalAmount - (Number(advancePaid) || 0))}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="flex flex-wrap items-center gap-4">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Hours</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 tracking-tighter">{totalHours}</span>
                  <span className="text-xs font-bold text-slate-500 uppercase">{totalHours === 1 ? 'Hr' : 'Hrs'}</span>
                </div>
              </div>
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
