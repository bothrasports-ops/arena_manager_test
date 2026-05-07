
import React, { useState } from 'react';
import {
    Grid,
    Plus,
    Trash2,
    RefreshCw,
    Trophy,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { Court, Sport, Booking } from '../types';
import { supabase } from '../lib/supabase';

interface CourtsManagerProps {
    courts: Court[];
    bookings: Booking[];
    onUpdate: () => void;
    venueId?: string;
    isAdmin: boolean;
    onBookSlot?: (courtId: string, time: string, date: string) => void;
}

const CourtsManager: React.FC<CourtsManagerProps> = ({ courts, bookings, onUpdate, venueId, isAdmin, onBookSlot }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newCourtName, setNewCourtName] = useState('');
    const [newCourtSport, setNewCourtSport] = useState<Sport>(Sport.PICKLEBALL);
    const [startTime, setStartTime] = useState('06:00');
    const [endTime, setEndTime] = useState('07:00');

    const getAutoEndTime = (start: string) => {
        const [h, m] = start.split(':').map(Number);
        const endH = (h + 1) % 24;
        return `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const today = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(today);

    const getDayBookings = (courtId: string) => {
        return bookings.filter(b =>
            b.courtId === courtId &&
            b.bookingDate === selectedDate &&
            b.status !== 'completed' // only show active/upcoming bookings
        );
    };

    const isTimeBooked = (courtId: string, time24: string) => {
        const courtBookings = getDayBookings(courtId);
        return courtBookings.find(b => {
            const start = b.bookingStartTime;
            const end = b.bookingEndTime;
            return time24 >= start && time24 < end;
        });
    };

    const renderTimeline = (court: Court) => {
        const slots = [];
        const [startH] = (court.start_time || '06:00').split(':').map(Number);
        const [endH] = (court.end_time || '23:00').split(':').map(Number);

        for (let h = startH; h < endH; h++) {
            slots.push(`${h.toString().padStart(2, '0')}:00`);
            slots.push(`${h.toString().padStart(2, '0')}:30`);
        }

        return (
            <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        <span className="text-sm font-black text-slate-400 uppercase tracking-widest">{selectedDate === today ? "Today's" : selectedDate} Slots</span>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Free</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-indigo-500" />
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Booked</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 min-h-[100px] max-h-[220px] overflow-y-auto pr-1">
                    {slots.map((time, idx) => {
                        const bookedBy = isTimeBooked(court.id, time);
                        return (
                            <div
                                key={idx}
                                onClick={() => !bookedBy && onBookSlot?.(court.id, time, selectedDate)}
                                className={`group relative py-2 rounded-xl border flex flex-col items-center justify-center transition-all ${
                                    bookedBy
                                        ? 'bg-indigo-50 border-indigo-100 text-indigo-700 font-bold cursor-default'
                                        : 'bg-emerald-50/20 border-emerald-100/30 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 cursor-pointer hover:scale-[1.02]'
                                }`}
                            >
                                <span className="text-base font-bold">{time}</span>
                                {bookedBy && (
                                    <>
                                        <div className="absolute inset-0 bg-indigo-600/10 rounded-md z-0" />
                                        <div className="absolute inset-x-0 bottom-0 top-0 flex flex-col items-center justify-center p-0.5 z-10">
                      <span className="text-[8px] font-black uppercase text-indigo-700 truncate w-full text-center px-0.5 leading-none">
                        {(bookedBy.customerName || 'N/A').split(' ')[0]}
                      </span>
                                        </div>
                                        <div className="absolute inset-0 bg-indigo-600 text-white rounded-md opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-1 z-20 transition-opacity duration-200 cursor-help">
                                            <span className="text-[6px] font-black uppercase tracking-tighter mb-0.5">Booked By</span>
                                            <span className="text-[7px] font-bold truncate w-full text-center leading-tight">
                        {bookedBy.customerName || 'No Name'}
                      </span>
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const handleAddCourt = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCourtName) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('courts')
                .insert({
                    name: newCourtName,
                    sport: newCourtSport,
                    venue_id: venueId,
                    start_time: startTime,
                    end_time: endTime
                });

            if (error) throw error;
            toast.success("Court added successfully");
            setNewCourtName('');
            onUpdate();
        } catch (error: any) {
            toast.error(`Failed to add court: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteCourt = async (id: string) => {
        if (!confirm("Are you sure you want to delete this court?")) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('courts')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success("Court deleted");
            onUpdate();
        } catch (error: any) {
            toast.error(`Failed to delete court: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 flex items-center gap-3">
                        <Grid className="w-8 h-8 text-indigo-600" />
                        Court Management
                    </h2>
                    <p className="text-slate-500 text-lg mt-2">Define and manage your arena's playing areas</p>
                </div>
                <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 w-full lg:w-auto">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest pl-2">Check Date</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-4 py-2 bg-slate-50 border-none rounded-xl text-sm font-bold text-slate-900 focus:ring-0 outline-none cursor-pointer"
                    />
                </div>
            </div>

            {isAdmin && (
                <form onSubmit={handleAddCourt} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col gap-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-1">Court Name / Number</label>
                            <input
                                required
                                type="text"
                                value={newCourtName}
                                onChange={(e) => setNewCourtName(e.target.value)}
                                placeholder="e.g. Court 1"
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-base font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-1">Sport</label>
                            <select
                                value={newCourtSport}
                                onChange={(e) => setNewCourtSport(e.target.value as Sport)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-base font-bold appearance-none"
                            >
                                {Object.values(Sport).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-1">Start Hour</label>
                            <input
                                type="time"
                                value={startTime}
                                onChange={(e) => {
                                    const newStart = e.target.value;
                                    setStartTime(newStart);
                                    setEndTime(getAutoEndTime(newStart));
                                }}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-base font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider pl-1">End Hour</label>
                            <input
                                type="time"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none text-base font-bold"
                            />
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full lg:w-max px-8 py-3 bg-indigo-600 text-white rounded-2xl text-xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50 self-end"
                    >
                        {isSubmitting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                        Add Court
                    </button>
                </form>
            )}

            <div className="grid grid-cols-1 gap-6">
                {courts.length === 0 ? (
                    <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center px-6">
                        <AlertCircle className="w-12 h-12 text-slate-200 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900">No Courts Defined</h3>
                        <p className="text-slate-500 text-sm mt-1">Start by adding your first court above.</p>
                    </div>
                ) : (
                    courts.map((court) => (
                        <div key={court.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-lg transition-all group">
                            <div className="flex items-start justify-between mb-6">
                                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                                    <Trophy className="w-6 h-6" />
                                </div>
                                {isAdmin && (
                                    <button
                                        onClick={() => handleDeleteCourt(court.id)}
                                        className="p-2.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                    >
                                        <Trash2 className="w-5 h-5" />
                                    </button>
                                )}
                            </div>
                            <h3 className="text-3xl font-black text-slate-900">{court.name}</h3>
                            <p className="text-indigo-500 font-bold text-sm mt-1.5">{court.sport}</p>

                            <div className="mt-4 flex items-center gap-2 text-slate-500">
                                <Clock className="w-5 h-5" />
                                <span className="text-base font-bold">{court.start_time || '00:00'} - {court.end_time || '00:00'}</span>
                            </div>

                            {renderTimeline(court)}

                            <div className="mt-6 pt-6 border-t border-slate-50 flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getDayBookings(court.id).length > 0 ? 'bg-indigo-500' : 'bg-emerald-500 animate-pulse'}`} />
                                <span className={`text-xs font-black uppercase tracking-widest ${getDayBookings(court.id).length > 0 ? 'text-indigo-600' : 'text-emerald-600'}`}>
                  {getDayBookings(court.id).length > 0 ? `${getDayBookings(court.id).length} Bookings on ${selectedDate === today ? 'Today' : selectedDate}` : 'No Bookings'}
                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default CourtsManager;
