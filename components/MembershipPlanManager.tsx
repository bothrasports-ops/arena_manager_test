
import React, { useState } from 'react';
import {
    Plus,
    Trash2,
    RefreshCw,
    Trophy,
    CheckCircle2,
    AlertCircle,
    IndianRupee,
    Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { MembershipPlanDefinition, Sport } from '../types';
import { supabase } from '../lib/supabase';

interface MembershipPlanManagerProps {
    plans: MembershipPlanDefinition[];
    onUpdate: () => void | Promise<void>;
    venueId?: string;
}

const MembershipPlanManager: React.FC<MembershipPlanManagerProps> = ({ plans, onUpdate, venueId }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newName, setNewName] = useState('');
    const [newPrice, setNewPrice] = useState<number | ''>('');
    const [newDuration, setNewDuration] = useState<'monthly' | 'quarterly' | 'yearly'>('monthly');
    const [newSport, setNewSport] = useState<Sport>(Sport.PICKLEBALL);
    const [newDescription, setNewDescription] = useState('');
    const [filterSport, setFilterSport] = useState<Sport | 'All'>('All');

    const filteredPlans = filterSport === 'All' ? plans : plans.filter(p => p.sport === filterSport);

    const handleAddPlan = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName || !newPrice) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('membership_plan_definitions')
                .insert({
                    name: newName,
                    price: Number(newPrice),
                    duration: newDuration,
                    sport: newSport,
                    venue_id: venueId,
                    description: newDescription
                });

            if (error) throw error;
            toast.success("Plan created successfully");
            setNewName('');
            setNewPrice('');
            setNewDescription('');
            onUpdate();
        } catch (error: any) {
            toast.error(`Failed to create plan: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePlan = async (id: string) => {
        if (!confirm("Are you sure?")) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('membership_plan_definitions')
                .delete()
                .eq('id', id);

            if (error) throw error;
            toast.success("Plan deleted");
            onUpdate();
        } catch (error: any) {
            toast.error(`Failed to delete plan: ${error.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Trophy className="w-6 h-6 text-indigo-600" />
                        Membership Plans
                    </h2>
                    <p className="text-slate-500 text-sm">Create and manage recurring membership definitions</p>
                </div>
            </div>

            <form onSubmit={handleAddPlan} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 items-end gap-4">
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Plan Name</label>
                    <input
                        required
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Gold Pickleball"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Price (₹)</label>
                    <div className="relative">
                        <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                            required
                            type="number"
                            value={newPrice}
                            onChange={(e) => setNewPrice(e.target.value === '' ? '' : Number(e.target.value))}
                            placeholder="0"
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                        />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Duration</label>
                    <select
                        value={newDuration}
                        onChange={(e) => setNewDuration(e.target.value as any)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold appearance-none"
                    >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="yearly">Yearly</option>
                    </select>
                </div>
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Sport</label>
                    <select
                        value={newSport}
                        onChange={(e) => setNewSport(e.target.value as Sport)}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold appearance-none"
                    >
                        {Object.values(Sport).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
                <div className="space-y-1.5 lg:col-span-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">Description (Plan Details)</label>
                    <input
                        type="text"
                        value={newDescription}
                        onChange={(e) => setNewDescription(e.target.value)}
                        placeholder="e.g. Includes 2 hours per day access"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    />
                </div>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="lg:col-start-5 px-6 py-3 bg-indigo-600 text-white rounded-xl font-black flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                >
                    {isSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Add Plan
                </button>
            </form>

            {/* Sport Filter */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <label className="text-xs font-bold text-slate-500 uppercase">Filter by Sport:</label>
                <div className="flex flex-wrap gap-2">
                    {['All', ...Object.values(Sport)].map(s => (
                        <button
                            key={s}
                            onClick={() => setFilterSport(s as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                                filterSport === s
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                            }`}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredPlans.length === 0 ? (
                    <div className="col-span-full py-20 bg-white rounded-3xl border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-center px-6">
                        <AlertCircle className="w-12 h-12 text-slate-200 mb-4" />
                        <h3 className="text-lg font-bold text-slate-900">No Plans Created</h3>
                        <p className="text-slate-500 text-sm mt-1">Define your membership tiers to start enrolling members.</p>
                    </div>
                ) : (
                    plans.map((plan) => (
                        <div key={plan.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden relative">
                            <div className="absolute top-0 right-0 p-4">
                                <button
                                    onClick={() => handleDeletePlan(plan.id)}
                                    className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 ring-4 ring-indigo-50/50">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 leading-tight">{plan.name}</h3>
                                    <span className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">{plan.sport}</span>
                                </div>
                            </div>

                            <div className="mt-4 flex items-baseline gap-1">
                                <span className="text-2xl font-black text-slate-900 tracking-tighter">₹{plan.price}</span>
                                <span className="text-xs font-bold text-slate-400 capitalize">/ {plan.duration}</span>
                            </div>

                            {plan.description && (
                                <p className="mt-2 text-xs text-slate-500 italic line-clamp-2">
                                    {plan.description}
                                </p>
                            )}

                            <div className="mt-6 pt-4 border-t border-slate-50">
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                    <span className="text-xs font-bold text-slate-600">Standard Perks Included</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MembershipPlanManager;
