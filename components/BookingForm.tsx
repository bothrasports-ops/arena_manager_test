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
  const [conflicts, setConflicts] = useState<any[]>([]);

  const initialCourt = initialData?.courtId ? courts.find(c => c.id === initialData.courtId) : null;

  const [sport, setSport] = useState<Sport>(initialCourt?.sport || availableSports[0] || Sport.PICKLEBALL);

  React.useEffect(() => {
    if (availableSports.length > 0 && !availableSports.includes(sport)) {
      setSport(availableSports[0]);
    }
  }, [availableSports]);

  const [courtIds, setCourtIds] = useState<string[]>(initialData?.courtId ? [initialData.courtId] : (courts[0]?.id ? [courts[0].id] : []));
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

  const selectedCourt = useMemo(() => courts.find(c => courtIds.includes(c.id)), [courts, courtIds]);

  React.useEffect(() => {
    const sportCourts = courts.filter(c => c.sport === sport);
    if (sportCourts.length > 0) {
      const initCourtMatches = initialData?.courtId ? courts.find(c => c.id === initialData.courtId)?.sport === sport : false;
      if (initCourtMatches && initialData?.courtId) {
        setCourtIds([initialData.courtId]);
      } else {
        setCourtIds([sportCourts[0].id]);
      }
    } else {
      setCourtIds([]);
    }
  }, [sport, courts]);

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

  const autoBookingAmount = useMemo(() => {
    if (bookingType !== BookingType.COURT || courtIds.length === 0) return 0;
    let sumRate = 0;
    courtIds.forEach(id => {
      const c = courts.find(court => court.id === id);
      sumRate += Number(c?.hourly_price || 0);
    });
    return Number((sumRate * totalHours).toFixed(2));
  }, [courtIds, totalHours, bookingType, courts]);

  React.useEffect(() => {
    if (bookingType === BookingType.COURT && autoBookingAmount > 0) {
      setBookingAmount(autoBookingAmount);
    }
  }, [autoBookingAmount, bookingType]);

  const totalAmount = useMemo(() => {
    return Number(bookingAmount) || 0;
  }, [bookingAmount]);

  const executeBookingCreation = async () => {
    const pAmount = Number(bookingAmount) || 0;
    const firstCourt = courtIds[0] || null;

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
            booking_amount: pAmount,
            extra_hours_enabled: false,
            extra_hours_duration: 0,
            extra_hours_amount: 0,
            total_amount: pAmount,
            court_id: firstCourt,
            court_ids: courtIds,
            payment_status: paymentStatus,
            advance_paid: Number(advancePaid) || 0,
            payment_method: paymentStatus !== 'to_be_paid' ? paymentMethod : null,
            status: 'active'
          } as any)
          .select()
          .single();

      if (bookingError) {
        if (bookingError.message && (bookingError.message.includes('court_ids') || bookingError.message.includes('schema cache'))) {
          console.warn("court_ids column missing, falling back to court_id insert and local storage cataloging");
          const { data: retryData, error: retryError } = await supabase
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
                booking_amount: pAmount,
                extra_hours_enabled: false,
                extra_hours_duration: 0,
                extra_hours_amount: 0,
                total_amount: pAmount,
                court_id: firstCourt,
                payment_status: paymentStatus,
                advance_paid: Number(advancePaid) || 0,
                payment_method: paymentStatus !== 'to_be_paid' ? paymentMethod : null,
                status: 'active'
              })
              .select()
              .single();

          if (retryError) throw retryError;
          if (retryData) {
            localStorage.setItem(`booking_courts_${retryData.id}`, JSON.stringify(courtIds));
          }
        } else {
          throw bookingError;
        }
      } else if (bookingData) {
        localStorage.setItem(`booking_courts_${bookingData.id}`, JSON.stringify(courtIds));
      }

      setCustomerName('');
      setPhoneNumber('');
      setBookingDate(getLocalDateString());
      setBookingAmount(0);
      setAdvancePaid(0);
      setPaymentStatus('to_be_paid');
      setConflicts([]);
      onSave();
      toast.success("Entry saved successfully!");
    } catch (err: any) {
      console.error("Error creating booking:", err);
      toast.error(err.message || "Failed to create booking.");
      setIsSubmitting(false);
    }
  };

  const handleOverride = async () => {
    setIsSubmitting(true);
    try {
      const conflictIds = conflicts.map(c => c.id);
      const { error: deleteError } = await supabase
          .from('bookings')
          .delete()
          .in('id', conflictIds);

      if (deleteError) throw deleteError;

      toast.success(`Removed ${conflicts.length} conflicting booking(s).`);
      await executeBookingCreation();
    } catch (error: any) {
      console.error('Error overriding booking:', error);
      toast.error(error.message || "Failed to override booking.");
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName || !phoneNumber) {
      toast.error("Please fill in basic customer details.");
      return;
    }

    // Validate phone number: must be exactly 10 digits (ignoring leading country code +91 or 0 prefix)
    let cleanedNum = phoneNumber.replace(/\D/g, '');
    if (cleanedNum.startsWith('91') && cleanedNum.length === 12) {
      cleanedNum = cleanedNum.substring(2);
    } else if (cleanedNum.startsWith('0') && cleanedNum.length === 11) {
      cleanedNum = cleanedNum.substring(1);
    }

    if (cleanedNum.length !== 10) {
      toast.error("Contact number must be exactly 10 digits.");
      return;
    }

    if (bookingType === BookingType.COURT && courtIds.length === 0) {
      toast.error("Please select at least one court.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (bookingType === BookingType.COURT) {
        const timeToMinutes = (t: string, isEnd: boolean = false) => {
          const [h, m] = t.split(':').map(Number);
          let val = h * 60 + m;
          if (isEnd && val === 0) {
            val = 1440;
          }
          return val;
        };

        const newStart = timeToMinutes(bookingStartTime);
        const newEnd = timeToMinutes(bookingEndTime, true);

        if (newEnd <= newStart) {
          toast.error("Booking end time must be after start time.");
          setIsSubmitting(false);
          return;
        }

        // Query active/completed bookings for this date to detect overlapping slots across selected courts
        const { data: existingBookings, error: checkError } = await supabase
            .from('bookings')
            .select('id, customer_name, booking_start_time, booking_end_time, status, court_id, court_ids')
            .eq('booking_date', bookingDate);

        if (checkError) throw checkError;

        const overlappingBookings = (existingBookings || []).filter((b: any) => {
          if (b.status === 'cancelled') return false;

          const localStored = localStorage.getItem(`booking_courts_${b.id}`);
          const courtsAllocated = b.court_ids || (localStored ? JSON.parse(localStored) : (b.court_id ? [b.court_id] : []));

          const sharesCourt = courtsAllocated.some((id: string) => courtIds.includes(id));
          if (!sharesCourt) return false;

          const exStart = timeToMinutes(b.booking_start_time);
          const exEnd = timeToMinutes(b.booking_end_time, true);

          return newStart < exEnd && exStart < newEnd;
        });

        if (overlappingBookings.length > 0) {
          setConflicts(overlappingBookings);
          setIsSubmitting(false);
          return;
        }
      }

      await executeBookingCreation();
    } catch (error: any) {
      console.error('Error saving booking:', error);
      toast.error(error.message || "Failed to save booking. Please check your Supabase connection.");
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
                  <label className="text-xs font-bold text-slate-500 uppercase">Select Court(s)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {courts.filter(c => c.sport === sport).map(court => {
                      const isSelected = courtIds.includes(court.id);
                      return (
                          <button
                              key={court.id}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  if (courtIds.length > 1) {
                                    setCourtIds(courtIds.filter(id => id !== court.id));
                                  } else {
                                    toast.warning("At least one court must be selected.");
                                  }
                                } else {
                                  setCourtIds([...courtIds, court.id]);
                                }
                              }}
                              className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                                  isSelected
                                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-md font-extrabold'
                                      : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                              }`}
                          >
                            <span>{court.name}</span>
                            <span className={`text-[9px] ${isSelected ? 'text-indigo-200' : 'text-slate-400 font-medium'}`}>₹{court.hourly_price || 0}/hr</span>
                          </button>
                      );
                    })}
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

        {conflicts.length > 0 && (
            <div id="conflict-modal-overlay" className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div id="conflict-modal" className="bg-white max-w-md w-full rounded-3xl p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-200">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 text-amber-500">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-black text-slate-900">Timing Conflict Detected</h3>
                    <p className="text-slate-500 text-xs mt-1">
                      The selected slot overlaps with {conflicts.length === 1 ? 'an existing booking' : `${conflicts.length} existing bookings`}.
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 max-h-[180px] overflow-y-auto mb-6 space-y-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Conflicting Slot Mappings</span>
                  {conflicts.map((b, i) => (
                      <div key={b.id || i} className="flex items-center justify-between text-xs py-2 border-b border-slate-200/50 last:border-0 last:pb-0 first:pt-0">
                        <div className="space-y-1">
                          <p className="font-extrabold text-slate-800">{b.customer_name}</p>
                          <p className="text-slate-400 font-medium text-[10px] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {b.booking_start_time} - {b.booking_end_time}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="px-2 py-0.5 bg-indigo-50 border border-indigo-100/55 text-indigo-700 text-[9px] font-extrabold rounded lowercase">{b.platform || 'Offline'}</span>
                        </div>
                      </div>
                  ))}
                </div>

                <p className="text-xs text-rose-500 font-bold bg-rose-50 border border-rose-100 rounded-xl p-3 mb-6">
                  ⚠️ If you choose to **Override**, the conflicting bookings listed above will be permanently deleted and replaced by this new entry.
                </p>

                <div className="flex gap-3 justify-end">
                  <button
                      type="button"
                      onClick={() => setConflicts([])}
                      className="px-5 py-3 border border-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
                  >
                    Cancel & Edit
                  </button>
                  <button
                      type="button"
                      onClick={handleOverride}
                      disabled={isSubmitting}
                      className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-rose-100 hover:shadow-rose-200 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Overriding...
                        </>
                    ) : (
                        <>
                          <Trash2 className="w-4 h-4" />
                          Override
                        </>
                    )}
                  </button>
                </div>
              </div>
            </div>
        )}
      </div>
  );
};

export default BookingForm;
