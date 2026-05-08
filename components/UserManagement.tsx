import React, { useState, useEffect } from 'react';
import {
    Users,
    UserPlus,
    Shield,
    Trash2,
    Mail,
    Lock,
    Loader2,
    CheckCircle2,
    UserCheck,
    UserX
} from 'lucide-react';
import { toast } from 'sonner';
import { UserProfile, UserRole } from '../types';
import { supabase } from '../lib/supabase';

interface UserManagementProps {
    currentProfile: UserProfile | null;
    onUpdate: () => void | Promise<void>;
}

const UserManagement: React.FC<UserManagementProps> = ({ currentProfile, onUpdate }) => {
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);

    // Form
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<UserRole>(UserRole.USER);

    useEffect(() => {
        fetchProfiles();
    }, []);

    const fetchProfiles = async () => {
        setIsLoading(true);
        try {
            const targetVenueId = currentProfile?.venue_id || currentProfile?.id;
            const { data, error } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('venue_id', String(targetVenueId));
            if (error) throw error;

            const mapped: UserProfile[] = (data || []).map((row: any) => ({
                id: row.id,
                admin_name: row.admin_name || '',
                admin_email: row.email, // Mapping email to admin_email
                venue_name: row.venue_name || '',
                available_sports: row.available_sports || [],
                role: row.role as UserRole,
                parentId: row.parentId
            }));
            setProfiles(mapped);
        } catch (error: any) {
            toast.error(`Error loading users: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddUser = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setIsProcessing('add');
        try {
            // In a real app, you'd call a Supabase Edge Function to create an auth user.
            // For this prototype/MVP, we'll suggest the admin has the staff sign up
            // and we pre-create their profile role here.
            const { error } = await supabase
                .from('user_profiles')
                .insert({
                    email: email.trim().toLowerCase(),
                    role: role,
                    venue_id: currentProfile?.venue_id || currentProfile?.id,
                    venue_name: currentProfile?.venue_name || 'My Arena'
                });

            if (error) throw error;

            toast.success(`Profile for ${email} created as ${role}`);
            setEmail('');
            setIsAdding(false);
            fetchProfiles();
        } catch (error: any) {
            toast.error(`Failed to add user: ${error.message}`);
        } finally {
            setIsProcessing(null);
        }
    };

    const handleDelete = async (id: string, userEmail: string) => {
        if (userEmail === currentProfile?.admin_email) {
            toast.error("You cannot delete your own admin profile.");
            return;
        }

        setIsProcessing(id);
        try {
            const { error } = await supabase
                .from('user_profiles')
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success("User profile removed");
            fetchProfiles();
        } catch (error: any) {
            toast.error(`Delete failed: ${error.message}`);
        } finally {
            setIsProcessing(null);
        }
    };

    if (currentProfile?.role !== UserRole.ADMIN) {
        return (
            <div className="py-20 text-center">
                <Shield className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-900">Access Restricted</h2>
                <p className="text-slate-500">Only administrators can manage users.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                        <Users className="w-6 h-6 text-indigo-600" />
                        Staff Management
                    </h2>
                    <p className="text-slate-500 text-sm">Control who can access the system and their permissions.</p>
                </div>
                <button
                    onClick={() => setIsAdding(!isAdding)}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                    {isAdding ? <Lock className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
                    {isAdding ? 'Cancel' : 'Add Staff Member'}
                </button>
            </div>

            {isAdding && (
                <form onSubmit={handleAddUser} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xl max-w-xl mx-auto">
                    <div className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Staff Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    placeholder="staff@venueiq.com"
                                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase ml-1">Assigned Role</label>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.values(UserRole).map(r => (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setRole(r)}
                                        className={`py-3 px-4 rounded-xl font-bold border transition-all ${
                                            role === r
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-500'
                                                : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                                        }`}
                                    >
                                        {r}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="pt-2">
                            <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl mb-4">
                                <p className="text-[10px] text-blue-700 font-bold leading-tight">
                                    Note: The staff member must sign up with this email. Their restricted access will automatically apply once they log in.
                                </p>
                            </div>
                            <button
                                type="submit"
                                disabled={isProcessing === 'add'}
                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                            >
                                {isProcessing === 'add' ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                Grant Access
                            </button>
                        </div>
                    </div>
                </form>
            )}

            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">User Status</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center">Permissions</th>
                            <th className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest text-right">Actions</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center">
                                    <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto" />
                                </td>
                            </tr>
                        ) : profiles.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No staff members added yet</td>
                            </tr>
                        ) : (
                            profiles.map(profile => (
                                <tr key={profile.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4 text-center">
                                        {profile.admin_email === currentProfile?.admin_email ? (
                                            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto" title="Active (You)">
                                                <UserCheck className="w-4 h-4" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto" title="System Profile">
                                                <Shield className="w-4 h-4" />
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="font-bold text-slate-900">{profile.admin_email}</p>
                                        {profile.admin_email === currentProfile?.admin_email && <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Current Session</span>}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black tracking-widest border ${
                          profile.role === UserRole.ADMIN
                              ? 'bg-purple-50 text-purple-600 border-purple-100'
                              : 'bg-blue-50 text-blue-600 border-blue-100'
                      }`}>
                        {profile.role}
                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        {profile.admin_email !== currentProfile?.admin_email && (
                                            <button
                                                onClick={() => handleDelete(profile.id, profile.admin_email || '')}
                                                disabled={isProcessing === profile.id}
                                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all disabled:opacity-50"
                                            >
                                                {isProcessing === profile.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserManagement;
