import React, { useState } from 'react';
import {
    Globe,
    Plus,
    Trash2,
    Loader2,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { BookingPlatform } from '../types';
import { supabase } from '../lib/supabase';

interface PlatformManagerProps {
    platforms: BookingPlatform[];
    venueId: string;
    onRefresh: () => void;
}

const PlatformManager: React.FC<PlatformManagerProps> = ({ platforms, venueId, onRefresh }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newName, setNewName] = useState('');

    const handleAddPlatform = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newName.trim()) return;

        setIsSubmitting(true);
        try {
            const { error } = await supabase
                .from('booking_platforms')
                .insert({
                    name: newName.trim(),
                    venue_id: venueId
                });

            if (error) throw error;

            toast.success('Platform added successfully');
            setNewName('');
            onRefresh();
        } catch (error: any) {
            console.error('Error adding platform:', error);
            toast.error(error.message || 'Failed to add platform');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemovePlatform = async (id: string) => {
        if (!confirm('Are you sure you want to remove this platform?')) return;

        try {
            const { error } = await supabase
                .from('booking_platforms')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Platform removed successfully');
            onRefresh();
        } catch (error: any) {
            console.error('Error removing platform:', error);
            toast.error(error.message || 'Failed to remove platform');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                <div className="bg-indigo-600 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-white">
                        <Globe className="w-6 h-6" />
                        <h2 className="font-bold text-lg">Booking Platforms</h2>
                    </div>
                </div>

                <div className="p-6">
                    <form onSubmit={handleAddPlatform} className="flex gap-3 mb-8">
                        <div className="flex-1 relative">
                            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                value={newName}
                                onChange={(e) => setNewName(e.target.value)}
                                placeholder="Platform Name (e.g. PlayO, Huddle)"
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold"
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition-all disabled:opacity-50"
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            Add Platform
                        </button>
                    </form>

                    <div className="space-y-3">
                        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Active Platforms</h3>
                        {platforms.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                                <AlertCircle className="w-10 h-10 text-slate-300 mb-2" />
                                <p className="text-slate-500 font-medium">No custom platforms found</p>
                                <p className="text-slate-400 text-xs mt-1">Add your first platform above</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {platforms.map((platform) => (
                                    <div
                                        key={platform.id}
                                        className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-2xl hover:border-indigo-200 hover:shadow-sm transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                                                <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                                            </div>
                                            <span className="font-bold text-slate-900">{platform.name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleRemovePlatform(platform.id)}
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-4 items-start">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                    <p className="text-amber-900 font-bold text-sm">Helpful Tip</p>
                    <p className="text-amber-700 text-xs mt-1 leading-relaxed">
                        Platforms added here will appear in your "New Entry" dropdown. These helps you track where your revenue is coming from (Online apps vs Offline walk-ins).
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PlatformManager;
