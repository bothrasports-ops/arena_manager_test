import React, { useState, useMemo } from 'react';
import {
    Users,
    Plus,
    Search,
    Calendar,
    Clock,
    CheckCircle2,
    AlertTriangle,
    X,
    History,
    TrendingUp,
    CreditCard,
    User as UserIcon,
    Phone,
    Trophy,
    Filter
} from 'lucide-react';
import { toast } from 'sonner';
import { Member, MembershipPlan, MembershipSchedule, Sport, MembershipPlanDefinition } from '../types';
import { supabase } from '../lib/supabase';

interface MembershipManagerProps {
    members: Member[];
    plans: MembershipPlanDefinition[];
    onUpdate: () => void;
    venueId?: string;
    availableSports: Sport[];
}

const MembershipManager: React.FC<MembershipManagerProps> = ({ members, plans, onUpdate, venueId, availableSports }) => {
    const [isAdding, setIsAdding] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'expiring' | 'expired'>('all');

    // Form State
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [plan, setPlan] = useState<MembershipPlan>(MembershipPlan.MONTHLY);
    const [sport, setSport] = useState<Sport>(availableSports[0] || Sport.PICKLEBALL);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState('');
    const [schedule, setSchedule] = useState<MembershipSchedule>({
        monday: '10:00-11:00',
        tuesday: '10:00-11:00',
        wednesday: '10:00-11:00',
        thursday: '10:00-11:00',
        friday: '10:00-11:00',
        saturday: '10:00-11:00',
        sunday: '10:00-11:00',
    });

    const filteredMembers = useMemo(() => {
        const today = new Date();
        today.setHours(0,0,0,0);

        return members.filter(m => {
            const end = new Date(m.endDate);
            const diffDays = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            const matchesSearch = m.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || m.phoneNumber.includes(searchTerm);

            let matchesFilter = true;
            if (filter === 'active') matchesFilter = diffDays > 5;
            if (filter === 'expiring') matchesFilter = diffDays <= 5 && diffDays >= 0;
            if (filter === 'expired') matchesFilter = diffDays < 0;

            return matchesSearch && matchesFilter;
        });
    }, [members, searchTerm, filter]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || !phone || !endDate) {
            toast.error("Please fill in all fields.");
            return;
        }

        try {
            const { error } = await supabase
                .from('members')
                .insert({
                    venue_id: venueId,
                    customer_name: name,
                    phone_number: phone,
                    plan: plan,
                    sport: sport,
                    start_date: startDate,
                    end_date: endDate,
                    hours_per_day: schedule,
                    status: 'active'
                });

            if (error) throw error;
            toast.success("Member added successfully!");
            setIsAdding(false);
            onUpdate();
            setName('');
            setPhone('');
        } catch (error: any) {
            toast.error(`Failed to add member: ${error.message}`);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-600" />
                        Memberships & Students
                    </h2>
                    <p className="text-slate-500 text-sm">Manage recurring members and their schedules.</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                    {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    {isAdding ? 'Cancel' : 'Add New Member'}
                </button>
            </div>

            {isAdding && (
                <form onSubmit={handleSubmit} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-xl animate-in zoom-in-95 duration-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Basic Info</h3>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Full Name</label>
                                    <input value={name} onChange={e => setName(e.target.value)} required placeholder="Customer Name" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Phone Number</label>
                                    <input value={phone} onChange={e => setPhone(e.target.value)} required placeholder="Contact Number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Plan</label>
                                        <select value={plan} onChange={e => setPlan(e.target.value as any)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold">
                                            <option value={MembershipPlan.MONTHLY}>Monthly</option>
                                            <option value={MembershipPlan.QUARTERLY}>Quarterly</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Sport</label>
                                        <select value={sport} onChange={e => setSport(e.target.value as any)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold">
                                            {Object.values(Sport).map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Start Date</label>
                                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">End Date</label>
                                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl font-bold" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Weekly Schedule (Time Slots)</h3>
                            <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2">
                                {Object.keys(schedule).map((day) => (
                                    <div key={day} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider min-w-[70px]">{day}</span>
                                        <input
                                            value={(schedule as any)[day]}
                                            onChange={e => setSchedule({...schedule, [day]: e.target.value})}
                                            className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold w-full max-w-[150px] outline-none focus:ring-1 focus:ring-indigo-500"
                                            placeholder="HH:MM-HH:MM"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-end">
                        <button type="submit" className="px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-lg shadow-emerald-100 hover:bg-emerald-700 transition-all flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5" />
                            Enroll Member
                        </button>
                    </div>
                </form>
            )}

            {/* Filters & Search */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row gap-4 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search members..."
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
                                className={`px-3 py-1.5 rounded-lg transition-all ${filter === f ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Members Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMembers.length === 0 ? (
                    <div className="col-span-full py-20 bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center text-slate-400 italic">
                        No matching members found.
                    </div>
                ) : (
                    filteredMembers.map(member => {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const end = new Date(member.endDate);
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
                            <div key={member.id} className="bg-white rounded-3xl border border-slate-200 overflow-hidden hover:shadow-xl transition-all group">
                                <div className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 border border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-400 transition-colors">
                                            <UserIcon className="w-6 h-6" />
                                        </div>
                                        <div className={`px-2 py-1 rounded-lg border text-[10px] font-black tracking-widest ${statusColor}`}>
                                            {statusText}
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-black text-slate-900 leading-tight truncate">{member.customerName}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{member.sport} &bull; {member.plan}</span>
                                    </div>

                                    <div className="mt-6 space-y-3">
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <Phone className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold">{member.phoneNumber}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-500">
                                            <Calendar className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold">{member.startDate} to {member.endDate}</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 pt-6 border-t border-slate-50">
                                        <button className="w-full py-3 bg-slate-50 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-2">
                                            View Daily Schedule
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

export default MembershipManager;
