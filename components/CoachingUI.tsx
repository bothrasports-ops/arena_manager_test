import React, { useState, useMemo } from 'react';
import {
    Plus,
    Search,
    Calendar,
    Clock,
    CheckCircle2,
    X,
    User as UserIcon,
    Phone,
    Trophy,
    Filter,
    CreditCard,
    Trash2,
    GraduationCap
} from 'lucide-react';
import { toast } from 'sonner';
import { Student, Sport, MembershipSchedule } from '../types';
import { supabase } from '../lib/supabase';

interface CoachingUIProps {
    students: Student[];
    onUpdate: () => void | Promise<void>;
    venueId?: string;
    availableSports: Sport[];
}

const CoachingUI: React.FC<CoachingUIProps> = ({ students, onUpdate, venueId, availableSports }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [sport, setSport] = useState<Sport>(availableSports[0] || Sport.PICKLEBALL);

    React.useEffect(() => {
        if (availableSports.length > 0 && !availableSports.includes(sport)) {
            setSport(availableSports[0]);
        }
    }, [availableSports]);

    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setMonth(d.getMonth() + 1);
        return d.toISOString().split('T')[0];
    });
    const [fee, setFee] = useState<number | ''>('');

    const getInitialEndTime = (start: string) => {
        const [h, m] = start.split(':').map(Number);
        const endH = (h + 1) % 24;
        return `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    };

    const [weeklySchedule, setWeeklySchedule] = useState<{ [key: string]: { enabled: boolean, start: string, end: string } }>({
        'Monday': { enabled: true, start: '10:00', end: '11:00' },
        'Tuesday': { enabled: true, start: '10:00', end: '11:00' },
        'Wednesday': { enabled: true, start: '10:00', end: '11:00' },
        'Thursday': { enabled: true, start: '10:00', end: '11:00' },
        'Friday': { enabled: true, start: '10:00', end: '11:00' },
        'Saturday': { enabled: false, start: '10:00', end: '11:00' },
        'Sunday': { enabled: false, start: '10:00', end: '11:00' },
    });

    const updateScheduleTime = (day: string, type: 'start' | 'end', value: string) => {
        setWeeklySchedule(prev => {
            const dayData = { ...prev[day] };
            if (type === 'start') {
                dayData.start = value;
                dayData.end = getInitialEndTime(value);
            } else {
                dayData.end = value;
            }
            return { ...prev, [day]: dayData };
        });
    };

    const toggleDay = (day: string) => {
        setWeeklySchedule(prev => ({
            ...prev,
            [day]: { ...prev[day], enabled: !prev[day].enabled }
        }));
    };

    const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

    const filteredStudents = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);

        return students.filter(s => {
            const end = new Date(s.endDate);
            const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            const matchesSearch = (s.studentName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (s.phoneNumber || '').includes(searchTerm);

            let matchesFilter = true;
            if (filter === 'active') matchesFilter = diffDays >= 0;
            if (filter === 'expiring') matchesFilter = diffDays <= 5 && diffDays >= 0;
            if (filter === 'expired') matchesFilter = diffDays < 0;

            return matchesSearch && matchesFilter;
        });
    }, [students, searchTerm, filter]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone || !endDate || fee === '') {
            toast.error("Please fill in all fields.");
            return;
        }

        try {
            const scheduleObj = {
                monday: weeklySchedule['Monday'].enabled ? `${weeklySchedule['Monday'].start}-${weeklySchedule['Monday'].end}` : 'OFF',
                tuesday: weeklySchedule['Tuesday'].enabled ? `${weeklySchedule['Tuesday'].start}-${weeklySchedule['Tuesday'].end}` : 'OFF',
                wednesday: weeklySchedule['Wednesday'].enabled ? `${weeklySchedule['Wednesday'].start}-${weeklySchedule['Wednesday'].end}` : 'OFF',
                thursday: weeklySchedule['Thursday'].enabled ? `${weeklySchedule['Thursday'].start}-${weeklySchedule['Thursday'].end}` : 'OFF',
                friday: weeklySchedule['Friday'].enabled ? `${weeklySchedule['Friday'].start}-${weeklySchedule['Friday'].end}` : 'OFF',
                saturday: weeklySchedule['Saturday'].enabled ? `${weeklySchedule['Saturday'].start}-${weeklySchedule['Saturday'].end}` : 'OFF',
                sunday: weeklySchedule['Sunday'].enabled ? `${weeklySchedule['Sunday'].start}-${weeklySchedule['Sunday'].end}` : 'OFF',
            };

            const { error } = await supabase
                .from('coaching_students')
                .insert({
                    venue_id: venueId,
                    student_name: name,
                    phone_number: phone,
                    sport: sport,
                    start_date: startDate,
                    end_date: endDate,
                    coaching_fee: Number(fee),
                    schedule: scheduleObj,
                    status: 'active'
                });

            if (error) throw error;
            toast.success("Student added successfully!");
            setIsAdding(false);
            onUpdate();
            setName('');
            setPhone('');
            setFee('');
        } catch (error: any) {
            toast.error(`Failed to add student: ${error.message}`);
        }
    };

    const handleDeleteStudent = async (id: string) => {
        if (!confirm("Are you sure you want to remove this student? This action cannot be undone.")) return;

        try {
            const { error } = await supabase
                .from('coaching_students')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success("Student removed successfully");
            onUpdate();
        } catch (error: any) {
            toast.error(`Failed to remove student: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6">
            {/* Detail Modal */}
            {selectedStudent && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-lg shadow-2xl p-8 relative animate-in zoom-in-95 duration-300">
                        <button
                            onClick={() => setSelectedStudent(null)}
                            className="absolute right-6 top-6 p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                        <div className="flex items-center gap-4 mb-8">
                            <div className="w-16 h-16 bg-emerald-600 rounded-2xl flex items-center justify-center text-white">
                                <GraduationCap className="w-8 h-8" />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-slate-900">{selectedStudent.studentName}</h3>
                                <p className="text-emerald-600 font-bold text-sm tracking-tight">{selectedStudent.sport.toUpperCase()} &bull; COACHING</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Phone Number</p>
                                <p className="text-sm font-bold text-slate-700">{selectedStudent.phoneNumber}</p>
                            </div>
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Coaching Fee (₹)</p>
                                <p className="text-sm font-bold text-slate-700">₹{selectedStudent.coachingFee}</p>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-8">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Period</p>
                            <p className="text-sm font-bold text-slate-700">{selectedStudent.startDate} to {selectedStudent.endDate}</p>
                        </div>

                        <div className="space-y-4">
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                <Clock className="w-4 h-4 text-emerald-500" />
                                Weekly Schedule
                            </h4>
                            <div className="grid gap-2">
                                {Object.entries(selectedStudent.schedule || {}).map(([day, time]) => (
                                    <div key={day} className="flex items-center justify-between py-2 px-4 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-xs font-bold text-slate-500 uppercase">{day}</span>
                                        <span className={`text-xs font-black ${time === 'OFF' ? 'text-slate-300 italic' : 'text-emerald-600'}`}>
                      {time === 'OFF' ? 'No Session' : time}
                    </span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 flex gap-3">
                            <button
                                onClick={() => setSelectedStudent(null)}
                                className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                            >
                                Close
                            </button>
                            <button
                                onClick={() => {
                                    handleDeleteStudent(selectedStudent.id);
                                    setSelectedStudent(null);
                                }}
                                className="px-6 py-3 bg-rose-50 text-rose-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-rose-100 transition-all"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <GraduationCap className="w-6 h-6 text-emerald-600" />
                        Coaching
                    </h2>
                    <p className="text-slate-500 text-sm">Manage student enrollments and coaching schedules.</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100"
                >
                    {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isAdding ? 'Cancel' : 'Enroll Student'}
                </button>
            </div>

            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                        {/* Left Column: Student & Details */}
                        <div className="space-y-8">
                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                                    <UserIcon className="w-4 h-4 text-emerald-500" />
                                    1. Student Information
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Student Name</label>
                                        <div className="relative">
                                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                value={name}
                                                onChange={e => setName(e.target.value)}
                                                required
                                                placeholder="Full Name"
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Phone Number</label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                value={phone}
                                                onChange={e => setPhone(e.target.value)}
                                                required
                                                placeholder="Contact Number"
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                                    <Trophy className="w-4 h-4 text-emerald-500" />
                                    2. Sport & Fee
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Select Sport</label>
                                        <select
                                            value={sport}
                                            onChange={e => setSport(e.target.value as Sport)}
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold appearance-none"
                                        >
                                            {availableSports.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Coaching Fee (₹)</label>
                                        <div className="relative">
                                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                            <input
                                                type="number"
                                                value={fee}
                                                onChange={e => setFee(e.target.value === '' ? '' : Number(e.target.value))}
                                                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-emerald-500 font-black text-lg"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">Start Date</label>
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold font-mono" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1">End Date</label>
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold font-mono" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Weekly Schedule */}
                        <div className="space-y-8">
                            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                                <Clock className="w-4 h-4 text-emerald-500" />
                                3. Coaching Timing
                            </h3>
                            <div className="space-y-3">
                                {Object.keys(weeklySchedule).map((day) => (
                                    <div key={day} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border transition-all ${weeklySchedule[day].enabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
                                        <button
                                            type="button"
                                            onClick={() => toggleDay(day)}
                                            className={`flex items-center gap-3 min-w-[120px] mb-3 sm:mb-0 transition-colors ${weeklySchedule[day].enabled ? 'text-emerald-600' : 'text-slate-400'}`}
                                        >
                                            <div className={`w-10 h-6 rounded-full relative transition-colors ${weeklySchedule[day].enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}>
                                                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${weeklySchedule[day].enabled ? 'left-5' : 'left-1'}`} />
                                            </div>
                                            <span className="font-black text-sm uppercase">{day}</span>
                                        </button>

                                        {weeklySchedule[day].enabled && (
                                            <div className="flex items-center gap-3 animate-in slide-in-from-left-2">
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">Start Time</span>
                                                    <div className="bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                                                        <input
                                                            type="time"
                                                            value={weeklySchedule[day].start}
                                                            onChange={(e) => updateScheduleTime(day, 'start', e.target.value)}
                                                            className="bg-transparent border-none outline-none font-black text-sm text-slate-700"
                                                        />
                                                    </div>
                                                </div>
                                                <div className="w-2 h-px bg-slate-200 mt-5" />
                                                <div className="flex flex-col gap-1">
                                                    <span className="text-[9px] font-bold text-slate-400 uppercase ml-1">End Time</span>
                                                    <div className="bg-slate-100 px-3 py-2 rounded-xl border border-slate-200">
                                                        <input
                                                            type="time"
                                                            value={weeklySchedule[day].end}
                                                            onChange={(e) => updateScheduleTime(day, 'end', e.target.value)}
                                                            className="bg-transparent border-none outline-none font-black text-sm text-slate-700"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="p-6 bg-emerald-600 rounded-[2rem] text-white shadow-xl shadow-emerald-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                                            <CheckCircle2 className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80">Monthly Fee</p>
                                            <p className="text-3xl font-black tracking-tighter">₹{fee || 0}</p>
                                        </div>
                                    </div>
                                    <button type="submit" className="px-8 py-4 bg-white text-emerald-600 rounded-2xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-lg">
                                        ENROLL STUDENT
                                    </button>
                                </div>
                                <p className="text-[10px] font-medium opacity-70 italic border-t border-white/20 pt-3">
                                    Confirm the timing and fee details. Enrolling will create a persistent coaching schedule for the student.
                                </p>
                            </div>
                        </div>
                    </div>
                </form>
            )}

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search students..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:bg-white transition-all shadow-inner"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 font-bold text-[10px] uppercase tracking-wider">
                        {['all', 'active', 'expiring', 'expired'].map((f) => (
                            <button
                                key={f}
                                onClick={() => setFilter(f as any)}
                                className={`px-3 py-1.5 rounded-lg transition-all ${filter === f ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Students Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStudents.length === 0 ? (
                    <div className="col-span-full py-20 bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-slate-400 italic">
                        No matching students found.
                    </div>
                ) : (
                    filteredStudents.map(student => {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const end = new Date(student.endDate);
                        const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

                        let statusColor = 'text-emerald-500 bg-emerald-50 border-emerald-100';
                        let statusText = 'ACTIVE';

                        if (diffDays < 0) {
                            statusColor = 'text-rose-500 bg-rose-50 border-rose-100';
                            statusText = 'EXPIRED';
                        } else if (diffDays <= 5) {
                            statusColor = 'text-orange-500 bg-orange-50 border-orange-100';
                            statusText = 'RENEWAL DUE';
                        }

                        return (
                            <div key={student.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all group">
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 group-hover:bg-emerald-50 group-hover:text-emerald-400 transition-colors">
                                            <GraduationCap className="w-6 h-6" />
                                        </div>
                                        <div className={`px-2 py-1 rounded-lg border text-[10px] font-black tracking-widest ${statusColor}`}>
                                            {statusText}
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-black text-slate-900 leading-tight truncate">{student.studentName}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{student.sport} &bull; COACHING</span>
                                    </div>

                                    <div className="mt-6 space-y-3">
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <Phone className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold">{student.phoneNumber}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold">{student.startDate} to {student.endDate}</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-slate-50">
                                        <button
                                            onClick={() => setSelectedStudent(student)}
                                            className="w-full py-3 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
                                        >
                                            View Enrollment Details
                                            <Clock className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default CoachingUI;
