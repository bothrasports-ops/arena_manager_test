import React, { useState, useEffect, useMemo } from 'react';
import {
    Users,
    Search,
    Calendar,
    Check,
    X,
    Loader2,
    ClipboardCheck,
    User,
    GraduationCap,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { Member, Student, AttendanceRecord } from '../types';
import { supabase } from '../lib/supabase';

interface AttendanceManagerProps {
    members: Member[];
    students: Student[];
    venueId?: string;
}

const AttendanceManager: React.FC<AttendanceManagerProps> = ({ members, students, venueId }) => {
    const [selectedDate, setSelectedDate] = useState(() => {
        const now = new Date();
        const offset = now.getTimezoneOffset();
        const localDate = new Date(now.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    });

    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'members' | 'students'>('all');
    const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent'>('all');

    // Real or Localized state for daily attendance registry
    const [attendanceRecords, setAttendanceRecords] = useState<Record<string, 'present' | 'absent'>>({});

    // Combined Directory List (Members + Students mapping)
    const directory = useMemo(() => {
        const list: Array<{
            id: string;
            name: string;
            phone: string;
            type: 'member' | 'student';
            detail: string; // sport, plan details, or fees
            sport: string;
        }> = [];

        // Map Members
        members.forEach(m => {
            // Only include active members
            if (m.status === 'active') {
                list.push({
                    id: m.id,
                    name: m.customerName,
                    phone: m.phoneNumber,
                    type: 'member',
                    detail: `Member - ${m.plan} (${m.sport})`,
                    sport: m.sport
                });
            }
        });

        // Map Coaching Students
        students.forEach(s => {
            if (s.status === 'active') {
                list.push({
                    id: s.id,
                    name: s.studentName,
                    phone: s.phoneNumber,
                    type: 'student',
                    detail: `Student - ₹${s.coachingFee}/mo (${s.sport})`,
                    sport: s.sport
                });
            }
        });

        return list;
    }, [members, students]);

    // Load attendance records for the selected date
    const loadAttendance = async () => {
        if (!venueId) return;
        setIsLoading(true);
        try {
            // 1. Attempt to fetch from Supabase
            const { data, error } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('venue_id', venueId)
                .eq('date', selectedDate);

            if (error) {
                // Fallback to localStorage if the table does not exist or there's an RLS issue
                throw error;
            }

            // Map rows into lookup object
            const registry: Record<string, 'present' | 'absent'> = {};
            if (data) {
                data.forEach((r: any) => {
                    const key = r.member_id || r.student_id;
                    if (key) {
                        registry[key] = r.status;
                    }
                });
            }
            setAttendanceRecords(registry);
        } catch (err: any) {
            console.warn("Using offline local attendance storage due to missing database schema:", err.message || err);
            // Load offline fallback from localStorage
            const offlineKey = `venueiq_attendance_${venueId}_${selectedDate}`;
            const saved = localStorage.getItem(offlineKey);
            setAttendanceRecords(saved ? JSON.parse(saved) : {});
        } finally {
            setIsLoading(false);
        }
    };

    // Run initial loading whenever date or venue changes
    useEffect(() => {
        loadAttendance();
    }, [selectedDate, venueId]);

    // Handle toggling attendance state
    const handleMarkAttendance = async (item: { id: string; type: 'member' | 'student' }, statusToSet: 'present' | 'absent') => {
        if (!venueId) return;

        // Determine if it already equals statusToSet (if so, we are clearing it out back to default)
        const currentStatus = attendanceRecords[item.id];
        let newStatus: 'present' | 'absent' | null = statusToSet;
        if (currentStatus === statusToSet) {
            // Second click clears registration back to default (unmarked / absent)
            newStatus = 'absent';
        }

        // Optimistic Local State Update
        const updatedRecords = { ...attendanceRecords };
        if (newStatus === null || newStatus === 'absent') {
            updatedRecords[item.id] = 'absent';
        } else {
            updatedRecords[item.id] = newStatus;
        }
        setAttendanceRecords(updatedRecords);

        try {
            // Save locally to ensure persistent cache works perfectly in dev iframe
            const offlineKey = `venueiq_attendance_${venueId}_${selectedDate}`;
            localStorage.setItem(offlineKey, JSON.stringify(updatedRecords));

            // Attempt Supabase merge insert/update (upsert)
            const fieldIdName = item.type === 'member' ? 'member_id' : 'student_id';

            const payload: any = {
                venue_id: venueId,
                date: selectedDate,
                status: newStatus || 'absent',
                type: item.type,
                [fieldIdName]: item.id
            };

            // Since standard upsert needs a primary key or unique index, let's check if record already exists first to insert or update.
            const { data: existing, error: checkError } = await supabase
                .from('attendance_records')
                .select('id')
                .eq('venue_id', venueId)
                .eq('date', selectedDate)
                .eq(fieldIdName, item.id);

            if (checkError) throw checkError;

            if (existing && existing.length > 0) {
                // Update existing record
                const { error: updateError } = await supabase
                    .from('attendance_records')
                    .update({ status: newStatus || 'absent' })
                    .eq('id', existing[0].id);

                if (updateError) throw updateError;
            } else {
                // Insert new record
                const { error: insertError } = await supabase
                    .from('attendance_records')
                    .insert(payload);

                if (insertError) throw insertError;
            }

        } catch (err: any) {
            console.warn("Synchronized locally only (Database table 'attendance_records' waiting for migrate):", err.message || err);
        }
    };

    // Perform filtering/searches in JavaScript
    const filteredList = useMemo(() => {
        return directory.filter(item => {
            // 1. Filter Type
            if (filterType === 'members' && item.type !== 'member') return false;
            if (filterType === 'students' && item.type !== 'student') return false;

            // 2. Filter Status
            const status = attendanceRecords[item.id] || 'absent';
            if (filterStatus === 'present' && status !== 'present') return false;
            if (filterStatus === 'absent' && status !== 'absent') return false;

            // 3. Search query
            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                return (
                    item.name.toLowerCase().includes(query) ||
                    item.phone.includes(query) ||
                    item.detail.toLowerCase().includes(query)
                );
            }

            return true;
        });
    }, [directory, searchQuery, filterType, filterStatus, attendanceRecords]);

    // Statistics Calculation
    const stats = useMemo(() => {
        let total = directory.length;
        let presentCount = 0;

        directory.forEach(item => {
            if (attendanceRecords[item.id] === 'present') {
                presentCount++;
            }
        });

        const absentCount = total - presentCount;
        return {
            total,
            present: presentCount,
            absent: absentCount,
            percentage: total > 0 ? Math.round((presentCount / total) * 100) : 0
        };
    }, [directory, attendanceRecords]);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Header and Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <ClipboardCheck className="w-6 h-6 text-indigo-600" />
                        Attendance Tracker
                    </h2>
                    <p className="text-slate-500 text-sm">
                        Keep track of active members and coaching students attending daily sessions.
                    </p>
                </div>

                {/* Date Selector */}
                <div className="flex items-center gap-3">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 shrink-0 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                        Select Date
                    </label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-4 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm shadow-sm"
                    />
                    <button
                        onClick={loadAttendance}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-600 transition"
                        title="Refresh Registry"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Stats Summary Bento Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Registry</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-slate-900">{stats.total}</span>
                        <span className="text-xs text-slate-400 font-bold uppercase">People</span>
                    </div>
                </div>

                <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-2">Present Registry</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-emerald-700">{stats.present}</span>
                        <span className="text-xs text-emerald-600 font-bold uppercase">Present</span>
                    </div>
                </div>

                <div className="bg-rose-50 rounded-2xl border border-rose-100 p-4 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block mb-1">Absent / Unmarked</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-rose-700">{stats.absent}</span>
                        <span className="text-xs text-rose-600 font-bold uppercase">Absent</span>
                    </div>
                </div>

                <div className="bg-indigo-50 rounded-2xl border border-indigo-100 p-4 shadow-sm flex flex-col justify-between">
                    <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest block mb-2">Attendance Ratio</span>
                    <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-black text-indigo-700">{stats.percentage}%</span>
                        <span className="text-xs text-indigo-600 font-bold uppercase">Ratio</span>
                    </div>
                </div>
            </div>

            {/* Directory Searching and Filters Panel */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
                {/* Search */}
                <div className="relative w-full md:max-w-sm">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search matching personnel name or contact..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 text-sm font-medium transition"
                    />
                </div>

                {/* Multi-tier Filter Toggles */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Type Filters */}
                    <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200 shrink-0">
                        <button
                            onClick={() => setFilterType('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'all' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            All Types
                        </button>
                        <button
                            onClick={() => setFilterType('members')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'members' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Members
                        </button>
                        <button
                            onClick={() => setFilterType('students')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterType === 'students' ? 'bg-white text-indigo-600 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Students
                        </button>
                    </div>

                    {/* Status Filters */}
                    <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200 shrink-0">
                        <button
                            onClick={() => setFilterStatus('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'all' ? 'bg-white text-slate-800 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setFilterStatus('present')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'present' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Present
                        </button>
                        <button
                            onClick={() => setFilterStatus('absent')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'absent' ? 'bg-rose-50 border border-rose-200 text-rose-600 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            Absent
                        </button>
                    </div>
                </div>
            </div>

            {/* Roster List or Empty Panel */}
            {filteredList.length === 0 ? (
                <div className="py-24 bg-white rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center px-6">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                        <Users className="text-slate-300 w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">No Roster Matches</h3>
                    <p className="text-slate-500 max-w-sm mt-1 text-sm">
                        We couldn't find any active members or students matching the current filter configurations for this date.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                    {filteredList.map(item => {
                        const status = attendanceRecords[item.id] || 'absent';
                        const isPresent = status === 'present';

                        return (
                            <div
                                key={item.id}
                                className={`bg-white rounded-2xl border transition-all p-5 shadow-sm flex items-center justify-between gap-4 ${
                                    isPresent
                                        ? 'border-emerald-200 bg-emerald-50/10'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                {/* Roster Details */}
                                <div className="flex gap-3 overflow-hidden">
                                    <div className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center ${
                                        item.type === 'member'
                                            ? 'bg-blue-50 text-blue-600'
                                            : 'bg-violet-50 text-violet-600'
                                    }`}>
                                        {item.type === 'member' ? (
                                            <User className="w-5 h-5 animate-in zoom-in-75" />
                                        ) : (
                                            <GraduationCap className="w-5 h-5 animate-in zoom-in-75" />
                                        )}
                                    </div>

                                    <div className="text-left overflow-hidden">
                                        <h4 className="font-extrabold text-slate-900 text-sm truncate leading-tight">{item.name}</h4>
                                        <p className="text-[10px] text-slate-400 font-bold mt-0.5">{item.phone}</p>
                                        <p className={`text-[10px] font-black mt-1.5 inline-block px-2 py-0.5 rounded uppercase tracking-wider ${
                                            item.type === 'member'
                                                ? 'bg-blue-50 text-blue-700 font-extrabold'
                                                : 'bg-violet-50 text-violet-700 font-extrabold'
                                        }`}>
                                            {item.sport}
                                        </p>
                                    </div>
                                </div>

                                {/* Mark Present / Absent Actions */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                        onClick={() => handleMarkAttendance(item, 'present')}
                                        disabled={isLoading}
                                        className={`h-9 items-center justify-center font-bold px-4 rounded-xl text-xs flex gap-1.5 transition-all outline-none border ${
                                            isPresent
                                                ? 'bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-100 font-black'
                                                : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-500'
                                        }`}
                                    >
                                        <Check className={`w-4 h-4 ${isPresent ? 'stroke-[3px]' : ''}`} />
                                        <span>Present</span>
                                    </button>

                                    {!isPresent && (
                                        <button
                                            onClick={() => handleMarkAttendance(item, 'absent')}
                                            disabled={isLoading}
                                            className="bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-rose-500 font-extrabold p-2.5 rounded-xl text-xs flex items-center justify-center transition-colors shadow-sm"
                                            title="Confirm Unmarked / Absent"
                                        >
                                            <X className="w-4 h-4 text-slate-400 hover:text-rose-600" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default AttendanceManager;
