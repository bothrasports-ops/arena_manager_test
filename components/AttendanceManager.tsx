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
    AlertCircle,
    BarChart2,
    CalendarDays,
    CheckSquare,
    AlertOctagon
} from 'lucide-react';
import { toast } from 'sonner';
import { Member, Student } from '../types';
import { supabase } from '../lib/supabase';

interface AttendanceManagerProps {
    members: Member[];
    students: Student[];
    venueId?: string;
}

const AttendanceManager: React.FC<AttendanceManagerProps> = ({ members, students, venueId }) => {
    // Navigation Tabs
    const [activeTab, setActiveTab] = useState<'daily' | 'history'>('daily');

    // Daily Tracker States
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

    // History Tracker States
    const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string; type: 'member' | 'student'; sport: string; detail: string } | null>(null);
    const [personSearch, setPersonSearch] = useState('');
    const [showPersonDropdown, setShowPersonDropdown] = useState(false);

    const [historyStartDate, setHistoryStartDate] = useState(() => {
        const d = new Date();
        d.setDate(1); // Start of current month
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    });

    const [historyEndDate, setHistoryEndDate] = useState(() => {
        const d = new Date(); // Today
        const offset = d.getTimezoneOffset();
        const localDate = new Date(d.getTime() - (offset * 60 * 1000));
        return localDate.toISOString().split('T')[0];
    });

    const [personHistory, setPersonHistory] = useState<Array<{ date: string; status: 'present' | 'absent' }>>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(false);
    const [historySearchQuery, setHistorySearchQuery] = useState('');
    const [historyStatusFilter, setHistoryStatusFilter] = useState<'all' | 'present' | 'absent'>('all');

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
            const { data, error } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('venue_id', venueId)
                .eq('date', selectedDate);

            if (error) {
                throw error;
            }

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

        const currentStatus = attendanceRecords[item.id];
        let newStatus: 'present' | 'absent' = statusToSet;
        if (currentStatus === statusToSet) {
            newStatus = 'absent';
        }

        // Optimistic Local State Update
        const updatedRecords = { ...attendanceRecords, [item.id]: newStatus };
        setAttendanceRecords(updatedRecords);

        try {
            const offlineKey = `venueiq_attendance_${venueId}_${selectedDate}`;
            localStorage.setItem(offlineKey, JSON.stringify(updatedRecords));

            const fieldIdName = item.type === 'member' ? 'member_id' : 'student_id';

            const payload: any = {
                venue_id: venueId,
                date: selectedDate,
                status: newStatus,
                type: item.type,
                [fieldIdName]: item.id
            };

            const { data: existing, error: checkError } = await supabase
                .from('attendance_records')
                .select('id')
                .eq('venue_id', venueId)
                .eq('date', selectedDate)
                .eq(fieldIdName, item.id);

            if (checkError) throw checkError;

            if (existing && existing.length > 0) {
                const { error: updateError } = await supabase
                    .from('attendance_records')
                    .update({ status: newStatus })
                    .eq('id', existing[0].id);

                if (updateError) throw updateError;
            } else {
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
            if (filterType === 'members' && item.type !== 'member') return false;
            if (filterType === 'students' && item.type !== 'student') return false;

            const status = attendanceRecords[item.id] || 'absent';
            if (filterStatus === 'present' && status !== 'present') return false;
            if (filterStatus === 'absent' && status !== 'absent') return false;

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

    // Statistics Calculation (Daily)
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


    // ==================== HISTORY TRACKING & REPORT ENGINE ====================

    // Filter matched people in history personnel search
    const matchedPeople = useMemo(() => {
        if (!personSearch.trim()) return directory.slice(0, 5); // Default top 5
        const query = personSearch.toLowerCase();
        return directory.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.phone.includes(query) ||
            p.detail.toLowerCase().includes(query)
        );
    }, [directory, personSearch]);

    // Load history function with robust Supabase + LocalStorage Fallback
    const fetchPersonHistory = async (personId: string, personType: 'member' | 'student', start: string, end: string) => {
        if (!venueId) return [];

        try {
            const fieldName = personType === 'member' ? 'member_id' : 'student_id';
            const { data, error } = await supabase
                .from('attendance_records')
                .select('*')
                .eq('venue_id', venueId)
                .eq(fieldName, personId)
                .gte('date', start)
                .lte('date', end);

            if (error) throw error;

            return (data || []).map((r: any) => ({
                date: r.date,
                status: r.status as 'present' | 'absent'
            }));
        } catch (err: any) {
            console.warn("Using offline local attendance history lookup:", err.message || err);
            // Scan localStorage keys: venueiq_attendance_{venueId}_{date}
            const history: Array<{ date: string; status: 'present' | 'absent' }> = [];
            const prefix = `venueiq_attendance_${venueId}_`;

            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    const dateStr = key.substring(prefix.length); // YYYY-MM-DD
                    if (dateStr >= start && dateStr <= end) {
                        try {
                            const dataObj = JSON.parse(localStorage.getItem(key) || '{}');
                            const status = dataObj[personId];
                            if (status) {
                                history.push({ date: dateStr, status });
                            }
                        } catch (e) {
                            console.error("Error parsing local attendance key", key, e);
                        }
                    }
                }
            }
            return history.sort((a, b) => a.date.localeCompare(b.date));
        }
    };

    const loadPersonHistory = async () => {
        if (!selectedPerson || !venueId) return;
        setIsHistoryLoading(true);
        try {
            const history = await fetchPersonHistory(
                selectedPerson.id,
                selectedPerson.type,
                historyStartDate,
                historyEndDate
            );
            setPersonHistory(history);
        } catch (err: any) {
            toast.error("Failed to load attendance history: " + err.message);
        } finally {
            setIsHistoryLoading(false);
        }
    };

    // Fetch history whenever parameters or active tab updates
    useEffect(() => {
        if (activeTab === 'history' && selectedPerson) {
            loadPersonHistory();
        }
    }, [selectedPerson, historyStartDate, historyEndDate, activeTab, venueId]);

    // Handle manual update or override of attendance within the historical reports
    const handleUpdateHistoryStatus = async (date: string, newStatus: 'present' | 'absent') => {
        if (!selectedPerson || !venueId) return;

        try {
            // 1. Update localStorage cache
            const offlineKey = `venueiq_attendance_${venueId}_${date}`;
            const saved = localStorage.getItem(offlineKey);
            const dataObj = saved ? JSON.parse(saved) : {};
            dataObj[selectedPerson.id] = newStatus;
            localStorage.setItem(offlineKey, JSON.stringify(dataObj));

            // 2. Sync to Supabase
            const fieldIdName = selectedPerson.type === 'member' ? 'member_id' : 'student_id';

            const payload: any = {
                venue_id: venueId,
                date: date,
                status: newStatus,
                type: selectedPerson.type,
                [fieldIdName]: selectedPerson.id
            };

            const { data: existing, error: checkError } = await supabase
                .from('attendance_records')
                .select('id')
                .eq('venue_id', venueId)
                .eq('date', date)
                .eq(fieldIdName, selectedPerson.id);

            if (!checkError) {
                if (existing && existing.length > 0) {
                    await supabase
                        .from('attendance_records')
                        .update({ status: newStatus })
                        .eq('id', existing[0].id);
                } else {
                    await supabase
                        .from('attendance_records')
                        .insert(payload);
                }
            }

            // Update local state
            setPersonHistory(prev => {
                const index = prev.findIndex(item => item.date === date);
                if (index > -1) {
                    return prev.map(item => item.date === date ? { ...item, status: newStatus } : item);
                } else {
                    return [...prev, { date, status: newStatus }].sort((a, b) => a.date.localeCompare(b.date));
                }
            });

            toast.success(`Updated attendance for ${date} to ${newStatus}`);

            // If the date is the selectedDate in daily tab, reload daily too
            if (date === selectedDate) {
                loadAttendance();
            }
        } catch (err: any) {
            console.error(err);
            toast.error("Failed to update attendance status: " + err.message);
        }
    };

    // Quick Preset Handlers
    const applyPreset = (preset: 'this-month' | 'last-30' | 'last-90') => {
        const today = new Date();
        const offset = today.getTimezoneOffset();
        const localToday = new Date(today.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];

        let start = '';
        if (preset === 'this-month') {
            const d = new Date();
            d.setDate(1);
            start = new Date(d.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
        } else if (preset === 'last-30') {
            const d = new Date();
            d.setDate(d.getDate() - 30);
            start = new Date(d.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
        } else if (preset === 'last-90') {
            const d = new Date();
            d.setDate(d.getDate() - 90);
            start = new Date(d.getTime() - (offset * 60 * 1000)).toISOString().split('T')[0];
        }

        setHistoryStartDate(start);
        setHistoryEndDate(localToday);
    };

    // Generate date array sequentially between start and end
    const datesInRange = useMemo(() => {
        const dates: string[] = [];
        if (!historyStartDate || !historyEndDate) return dates;

        const start = new Date(historyStartDate);
        const end = new Date(historyEndDate);

        if (start > end) return dates;

        // Safety restriction of max 366 days
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 366) {
            start.setTime(end.getTime() - (366 * 24 * 60 * 60 * 1000));
        }

        const current = new Date(start);
        while (current <= end) {
            const offset = current.getTimezoneOffset();
            const localDate = new Date(current.getTime() - (offset * 60 * 1000));
            dates.push(localDate.toISOString().split('T')[0]);
            current.setDate(current.getDate() + 1);
        }

        return dates.reverse(); // Newest dates first
    }, [historyStartDate, historyEndDate]);

    // Aggregate daily dates with status (Present or Absent/Unmarked)
    const historyList = useMemo(() => {
        const statusMap: Record<string, 'present' | 'absent'> = {};
        personHistory.forEach(item => {
            statusMap[item.date] = item.status;
        });

        return datesInRange.map(date => ({
            date,
            status: statusMap[date] || 'absent'
        }));
    }, [datesInRange, personHistory]);

    // Apply search/filters on aggregated history list
    const filteredHistoryList = useMemo(() => {
        return historyList.filter(item => {
            if (historyStatusFilter === 'present' && item.status !== 'present') return false;
            if (historyStatusFilter === 'absent' && item.status !== 'absent') return false;

            if (historySearchQuery.trim()) {
                const query = historySearchQuery.toLowerCase();
                const formattedDate = new Date(item.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                }).toLowerCase();

                return item.date.includes(query) || formattedDate.includes(query);
            }

            return true;
        });
    }, [historyList, historyStatusFilter, historySearchQuery]);

    // History Statistics Highlight
    const historyStats = useMemo(() => {
        const total = historyList.length;
        const presentCount = historyList.filter(item => item.status === 'present').length;
        const absentCount = total - presentCount;
        const ratio = total > 0 ? Math.round((presentCount / total) * 100) : 0;

        return {
            total,
            present: presentCount,
            absent: absentCount,
            ratio
        };
    }, [historyList]);


    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-200">
                <button
                    onClick={() => setActiveTab('daily')}
                    className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'daily'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <ClipboardCheck className="w-4 h-4" />
                    Daily Registry
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-5 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2 ${
                        activeTab === 'history'
                            ? 'border-indigo-600 text-indigo-600'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                >
                    <BarChart2 className="w-4 h-4" />
                    Personnel History & Reports
                </button>
            </div>

            {activeTab === 'daily' ? (
                <>
                    {/* Daily Tracker Header and Controls */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                                <ClipboardCheck className="w-6 h-6 text-indigo-600" />
                                Daily Attendance Registry
                            </h2>
                            <p className="text-slate-500 text-sm">
                                Mark active members and students attending daily training slots.
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

                    {/* Daily Stats Overview */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Registry</span>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-black text-slate-900">{stats.total}</span>
                                <span className="text-xs text-slate-400 font-bold uppercase">People</span>
                            </div>
                        </div>

                        <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 shadow-sm flex flex-col justify-between">
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest block mb-2">Present Today</span>
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

                    {/* Searching and Filters */}
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
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

                        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
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

                    {/* Roster Grid */}
                    {filteredList.length === 0 ? (
                        <div className="py-24 bg-white rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center px-6">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Users className="text-slate-300 w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">No Roster Matches</h3>
                            <p className="text-slate-500 max-w-sm mt-1 text-sm">
                                We couldn't find any active members or students matching the current filter configurations.
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
                                        <div className="flex gap-3 overflow-hidden">
                                            <div className={`w-11 h-11 rounded-xl shrink-0 flex items-center justify-center ${
                                                item.type === 'member'
                                                    ? 'bg-blue-50 text-blue-600'
                                                    : 'bg-violet-50 text-violet-600'
                                            }`}>
                                                {item.type === 'member' ? (
                                                    <User className="w-5 h-5" />
                                                ) : (
                                                    <GraduationCap className="w-5 h-5" />
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
                </>
            ) : (
                <div className="space-y-6 animate-in fade-in duration-500">

                    {/* Header */}
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                            <BarChart2 className="w-6 h-6 text-indigo-600" />
                            Attendance History & Reports
                        </h2>
                        <p className="text-slate-500 text-sm">
                            Analyze monthly attendance registers or custom date ranges for individual students or members.
                        </p>
                    </div>

                    {/* Search/Selection & Date Picker Dashboard */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm relative">

                        {/* Person Search */}
                        <div className="lg:col-span-6 space-y-2 relative">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                Select Personnel (Student or Member)
                            </label>

                            <div className="relative">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="text"
                                    placeholder="Search by name, contact, sport..."
                                    value={selectedPerson ? selectedPerson.name : personSearch}
                                    onChange={(e) => {
                                        setPersonSearch(e.target.value);
                                        if (selectedPerson) {
                                            setSelectedPerson(null);
                                            setPersonHistory([]);
                                        }
                                        setShowPersonDropdown(true);
                                    }}
                                    onFocus={() => setShowPersonDropdown(true)}
                                    className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-bold transition"
                                />
                                {selectedPerson && (
                                    <button
                                        onClick={() => {
                                            setSelectedPerson(null);
                                            setPersonSearch('');
                                            setPersonHistory([]);
                                        }}
                                        className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-200 rounded-full text-slate-400"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Personnel Suggestions Dropdown */}
                            {showPersonDropdown && !selectedPerson && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={() => setShowPersonDropdown(false)} />
                                    <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl max-h-60 overflow-y-auto divide-y divide-slate-100">
                                        {matchedPeople.length === 0 ? (
                                            <div className="p-4 text-center text-sm text-slate-500">No matching roster personnel</div>
                                        ) : (
                                            matchedPeople.map(p => (
                                                <button
                                                    key={p.id}
                                                    onClick={() => {
                                                        setSelectedPerson(p);
                                                        setShowPersonDropdown(false);
                                                    }}
                                                    className="w-full px-4 py-3 text-left hover:bg-slate-50 transition flex items-center justify-between"
                                                >
                                                    <div>
                                                        <p className="font-extrabold text-sm text-slate-900">{p.name}</p>
                                                        <p className="text-xs text-slate-400 mt-0.5">{p.detail}</p>
                                                    </div>
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                                                        p.type === 'member' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'
                                                    }`}>
                            {p.type}
                          </span>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Range Pickers */}
                        <div className="lg:col-span-6 space-y-2">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
                                Define Custom Date Range
                            </label>

                            <div className="flex flex-col sm:flex-row gap-3">
                                <div className="flex-1 flex gap-2">
                                    <input
                                        type="date"
                                        value={historyStartDate}
                                        onChange={(e) => setHistoryStartDate(e.target.value)}
                                        className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                    />
                                    <span className="self-center font-bold text-slate-400 text-xs uppercase">to</span>
                                    <input
                                        type="date"
                                        value={historyEndDate}
                                        onChange={(e) => setHistoryEndDate(e.target.value)}
                                        className="flex-1 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                                    />
                                </div>

                                {/* Presets */}
                                <div className="flex gap-1.5 self-end sm:self-center">
                                    <button
                                        onClick={() => applyPreset('this-month')}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-[10px] font-bold text-slate-600 transition"
                                    >
                                        Month
                                    </button>
                                    <button
                                        onClick={() => applyPreset('last-30')}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-[10px] font-bold text-slate-600 transition"
                                    >
                                        30 Days
                                    </button>
                                    <button
                                        onClick={() => applyPreset('last-90')}
                                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg text-[10px] font-bold text-slate-600 transition"
                                    >
                                        90 Days
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>

                    {/* Report Viewer / Empty States */}
                    {!selectedPerson ? (
                        <div className="py-24 bg-white rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center px-6">
                            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                                <Users className="text-slate-300 w-8 h-8" />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">Select Personnel above</h3>
                            <p className="text-slate-500 max-w-sm mt-1 text-sm">
                                Choose a student or active member to view their calendar timeline, total sessions, present count, and attendance ratio statistics.
                            </p>
                        </div>
                    ) : isHistoryLoading ? (
                        <div className="py-24 bg-white rounded-3xl border border-slate-200 flex flex-col items-center justify-center text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-2" />
                            <p className="text-sm font-bold text-slate-600">Generating attendance summary...</p>
                        </div>
                    ) : (
                        <div className="space-y-6">

                            {/* Profile Card & Stats Highlight Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                {/* Profile card */}
                                <div className="bg-slate-900 text-white rounded-3xl p-5 flex flex-col justify-between shadow-md relative overflow-hidden">
                                    <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-indigo-600/10 rounded-full blur-xl" />
                                    <div>
                    <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                        selectedPerson.type === 'member' ? 'bg-blue-600 text-white' : 'bg-violet-600 text-white'
                    }`}>
                      {selectedPerson.type}
                    </span>
                                        <h3 className="text-lg font-black tracking-tight mt-3 truncate">{selectedPerson.name}</h3>
                                        <p className="text-xs text-slate-400 font-bold mt-0.5">{selectedPerson.sport}</p>
                                    </div>
                                    <div className="mt-4 border-t border-slate-800 pt-3">
                                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Plan & Category</p>
                                        <p className="text-xs text-slate-300 font-medium mt-0.5 truncate">{selectedPerson.detail}</p>
                                    </div>
                                </div>

                                {/* Totals */}
                                <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm flex flex-col justify-between">
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-2">Total Calendar Days</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-slate-900">{historyStats.total}</span>
                                        <span className="text-xs text-slate-400 font-bold uppercase">Days</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1">Between {historyStartDate} and {historyEndDate}</p>
                                </div>

                                {/* Days Present */}
                                <div className="bg-emerald-50 rounded-3xl border border-emerald-100 p-5 shadow-sm flex flex-col justify-between">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest block mb-2 font-extrabold">Sessions Present</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-emerald-700">{historyStats.present}</span>
                                        <span className="text-xs text-emerald-600 font-bold uppercase">Marked</span>
                                    </div>
                                    <p className="text-[10px] text-emerald-500 mt-1 font-semibold">{historyStats.absent} Days Absent / Unmarked</p>
                                </div>

                                {/* Ratio */}
                                <div className="bg-indigo-50 rounded-3xl border border-indigo-100 p-5 shadow-sm flex flex-col justify-between">
                                    <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest block mb-2">Attendance Ratio</span>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-3xl font-black text-indigo-700">{historyStats.ratio}%</span>
                                        <span className="text-xs text-indigo-600 font-bold uppercase">Ratio</span>
                                    </div>
                                    {/* Progress bar */}
                                    <div className="w-full bg-indigo-100 h-1.5 rounded-full mt-2 overflow-hidden">
                                        <div className="bg-indigo-600 h-full transition-all duration-500" style={{ width: `${historyStats.ratio}%` }} />
                                    </div>
                                </div>
                            </div>

                            {/* Filtering individual days */}
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row gap-3 items-center justify-between">
                                <div className="relative w-full md:max-w-xs">
                                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search specific date or day..."
                                        value={historySearchQuery}
                                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none placeholder-slate-400 text-sm font-medium transition"
                                    />
                                </div>

                                <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200 shrink-0">
                                    <button
                                        onClick={() => setHistoryStatusFilter('all')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${historyStatusFilter === 'all' ? 'bg-white text-slate-800 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        All Days ({historyStats.total})
                                    </button>
                                    <button
                                        onClick={() => setHistoryStatusFilter('present')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${historyStatusFilter === 'present' ? 'bg-emerald-600 text-white shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Present ({historyStats.present})
                                    </button>
                                    <button
                                        onClick={() => setHistoryStatusFilter('absent')}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${historyStatusFilter === 'absent' ? 'bg-rose-50 border border-rose-200 text-rose-600 shadow-sm font-black' : 'text-slate-500 hover:text-slate-800'}`}
                                    >
                                        Absent / Unmarked ({historyStats.absent})
                                    </button>
                                </div>
                            </div>

                            {/* History Calendar Cards Grid */}
                            {filteredHistoryList.length === 0 ? (
                                <div className="py-16 bg-white rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center">
                                    <CalendarDays className="w-10 h-10 text-slate-300 mb-2" />
                                    <p className="text-sm font-extrabold text-slate-600">No matching dates in this range</p>
                                    <p className="text-xs text-slate-400 mt-1">Try resetting the date search query or changing filters.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {filteredHistoryList.map(item => {
                                        const isPresent = item.status === 'present';
                                        const formattedDate = new Date(item.date).toLocaleDateString('en-US', {
                                            weekday: 'short',
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        });

                                        return (
                                            <div
                                                key={item.date}
                                                className={`bg-white rounded-2xl border transition-all p-4 flex items-center justify-between shadow-sm ${
                                                    isPresent ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5 overflow-hidden">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                        isPresent ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                                                    }`}>
                                                        <Calendar className="w-4 h-4" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-xs font-black text-slate-900 truncate">{formattedDate}</p>
                                                        <p className="text-[10px] text-slate-400 font-bold uppercase">{item.date}</p>
                                                    </div>
                                                </div>

                                                {/* Status Switcher Button */}
                                                <button
                                                    onClick={() => handleUpdateHistoryStatus(item.date, isPresent ? 'absent' : 'present')}
                                                    className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black transition-all flex items-center gap-1 border shrink-0 ${
                                                        isPresent
                                                            ? 'bg-emerald-600 border-emerald-600 text-white'
                                                            : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'
                                                    }`}
                                                >
                                                    {isPresent ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                                                    <span>{isPresent ? 'Present' : 'Absent'}</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AttendanceManager;
