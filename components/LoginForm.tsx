
import React, { useState } from 'react';
import { Zap, ArrowRight, User, Lock, ShieldCheck, AlertCircle, Info, Mail, Building2, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { Sport } from '../types';

interface LoginFormProps {
  onAuthSuccess: () => void;
}

const LoginForm: React.FC<LoginFormProps> = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginType, setLoginType] = useState<'admin' | 'user'>('admin');

  // Form states
  const [password, setPassword] = useState('');
  const [adminName, setAdminName] = useState('');
  const [venueName, setVenueName] = useState('');
  const [selectedSports, setSelectedSports] = useState<Sport[]>([]);

  const toggleSport = (sport: Sport) => {
    setSelectedSports(prev =>
        prev.includes(sport)
            ? prev.filter(s => s !== sport)
            : [...prev, sport]
    );
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // If it's a full email, use it. Otherwise, assume it's a handle for the .local domain
    const safeAdminName = adminName || '';
    const nameOnly = safeAdminName.trim().toLowerCase().replace(/\s+/g, '');
    const loginEmail = safeAdminName.includes('@')
        ? safeAdminName.trim().toLowerCase()
        : `${nameOnly}@venueiq.local`;

    try {
      if (isSignUp) {
        if (selectedSports.length === 0) {
          throw new Error("Please select at least one sport.");
        }
        if (!password) {
          throw new Error("Password is required for new venue signup.");
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: loginEmail,
          password,
          options: {
            data: {
              venue_name: venueName,
              available_sports: selectedSports,
              admin_name: safeAdminName || loginEmail.split('@')[0],
              admin_email: loginEmail
            }
          }
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error("Sign up failed.");

        toast.success("Account created successfully! You can now sign in.");
        setIsSignUp(false);
      } else {
        // PASSWORDLESS FOR STAFF ROLE - POST-LOGIN VERIFICATION FLOW
        const staffPresetPassword = `StaffBypass_2026_NoPassRequired!`;

        if (loginType === 'user') {
          let authUser: any = null;

          try {
            // 1. Try signing in with the staff preset password
            const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
              email: loginEmail,
              password: staffPresetPassword,
            });

            if (signInError) {
              // 2. First login: Auth user doesn't exist yet, register them under the hood
              const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                email: loginEmail,
                password: staffPresetPassword,
                options: {
                  data: {
                    admin_name: safeAdminName || loginEmail.split('@')[0],
                    venue_name: 'My Arena',
                    admin_email: loginEmail
                  }
                }
              });

              if (signUpError) throw signUpError;

              // Immediately log them in
              const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: staffPresetPassword,
              });

              if (retryError) throw retryError;
              authUser = retryData.user;
            } else {
              authUser = signInData.user;
            }
          } catch (authError: any) {
            throw new Error(`Staff passwordless authentication failed: ${authError.message}`);
          }

          if (!authUser) {
            throw new Error("Could not authenticate user session.");
          }

          // Trigger get_venue_safe RPC beforehand to let SECURITY DEFINER trigger the profile check,
          // which reconciles and copies/heals any pre-created user records with this new Auth ID.
          // This avoids empty profileRows due to RLS matching.
          try {
            await supabase.rpc('get_venue_safe');
          } catch (rpcErr) {
            console.warn("get_venue_safe pre-reconciliation RPC warning for user:", rpcErr);
          }

          // Real-time client-side healing: Pre-emptively update and link matching email profile to this authenticated UID.
          // This guarantees that when SELECT runs, the RLS policy (which matches auth.uid() = id) succeeds and permits full row select.
          try {
            const lowerEmail = loginEmail.trim().toLowerCase();
            const lowerName = safeAdminName.trim().toLowerCase();
            await supabase
                .from('user_profiles')
                .update({ id: authUser.id })
                .in('email', [lowerEmail, lowerName]);
          } catch (linkError) {
            console.warn("Pre-emptive staffing profile link error:", linkError);
          }

          // 3. User is now authenticated, query their profile to verify registration and role
          const { data: profileRows, error: profileErr } = await supabase
              .from('user_profiles')
              .select('*')
              .in('email', [loginEmail, safeAdminName.trim().toLowerCase()]);

          if (profileErr) {
            await supabase.auth.signOut();
            throw new Error(`Database verification failed: ${profileErr.message}`);
          }

          const hasProfile = profileRows && profileRows.length > 0;
          const foundProfile = hasProfile ? profileRows[0] : null;

          // 4. If they do not have a registered profile or they are an admin/unlinked/deactivated, sign out and reject
          if (
              !foundProfile ||
              foundProfile.role === 'admin' ||
              foundProfile.role === 'unlinked' ||
              foundProfile.venue_name === 'Deactivated'
          ) {
            await supabase.auth.signOut();
            throw new Error(`No registered Staff profile matching Username '${safeAdminName}' was found. Please ensure the admin has registered your username first.`);
          }

          // 5. Connect the authenticated user's ID back to the pre-created profile row if it's currently empty or mismatches
          if (foundProfile.id !== authUser.id) {
            const { error: linkErr } = await supabase
                .from('user_profiles')
                .update({ id: authUser.id })
                .eq('email', foundProfile.email);

            if (linkErr) {
              console.warn("Non-blocking warning: Could not link auth UID inside user_profiles table:", linkErr);
            }
          }

          toast.success("Logged in successfully as Staff!");
          onAuthSuccess();
        } else {
          // Standard login for Admin, which ALWAYS requires a password
          if (!password) {
            throw new Error("Password is required for Admin profiles.");
          }

          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: loginEmail,
            password,
          });

          if (signInError) throw signInError;

          const authUser = signInData?.user;
          if (!authUser) {
            throw new Error("Could not retrieve logged-in session.");
          }

          // Trigger get_venue_safe RPC beforehand to let SECURITY DEFINER trigger the profile check,
          // which reconciles and copies/heals any pre-created user records with this new Auth ID.
          try {
            await supabase.rpc('get_venue_safe');
          } catch (rpcErr) {
            console.warn("get_venue_safe pre-reconciliation RPC warning for admin:", rpcErr);
          }

          // Real-time client-side healing: Pre-emptively update and link matching email profile to this authenticated UID.
          try {
            const lowerEmail = loginEmail.trim().toLowerCase();
            const lowerName = safeAdminName.trim().toLowerCase();
            await supabase
                .from('user_profiles')
                .update({ id: authUser.id })
                .in('email', [lowerEmail, lowerName]);
          } catch (linkError) {
            console.warn("Pre-emptive admin profile link error:", linkError);
          }

          // Verify they are actually an Admin and not registered as a Staff user
          const { data: profileRows, error: profileErr } = await supabase
              .from('user_profiles')
              .select('*')
              .in('email', [loginEmail, safeAdminName.trim().toLowerCase()]);

          if (!profileErr && profileRows && profileRows.length > 0) {
            const foundProfile = profileRows[0];
            if (foundProfile.role === 'user') {
              await supabase.auth.signOut();
              throw new Error("This profile is registered as Staff. Please choose 'Sign in as User' to login without a password.");
            }
          }

          onAuthSuccess();
        }
      }
    } catch (err: any) {
      setError(err.message || "An error occurred during authentication.");
    } finally {
      setLoading(false);
    }
  };

  return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
        <div className="max-w-md w-full animate-in fade-in zoom-in-95 duration-700">
          <div className="text-center mb-10">
            <div className="relative inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-[2rem] shadow-2xl shadow-indigo-200 mb-6 rotate-3 group overflow-hidden">
              <Zap className="text-white w-12 h-12 fill-white/20 relative z-10 group-hover:scale-110 transition-transform duration-500" />
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <Sparkles className="absolute top-2 right-2 w-5 h-5 text-indigo-200 animate-pulse" />
            </div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight">VenueIQ</h1>
            <p className="text-slate-500 font-medium mt-2 italic flex items-center justify-center gap-2">
              Intelligence for Modern Venues
            </p>
          </div>

          <div className="bg-white p-8 rounded-3xl shadow-xl border border-slate-200">
            <div className="flex bg-slate-100 p-1 rounded-2xl mb-6">
              <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(false);
                    setError(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${!isSignUp ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Sign In
              </button>
              <button
                  type="button"
                  onClick={() => {
                    setIsSignUp(true);
                    setError(null);
                  }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${isSignUp ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Sign Up
              </button>
            </div>

            {!isSignUp && (
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1 rounded-2xl border border-slate-100 mb-6">
                  <button
                      type="button"
                      onClick={() => {
                        setLoginType('admin');
                        setError(null);
                      }}
                      className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                          loginType === 'admin'
                              ? 'bg-white text-indigo-600 border border-slate-200/60 shadow-sm font-black'
                              : 'text-slate-500 hover:text-slate-700 font-bold'
                      }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Sign in as Admin
                  </button>
                  <button
                      type="button"
                      onClick={() => {
                        setLoginType('user');
                        setError(null);
                      }}
                      className={`py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                          loginType === 'user'
                              ? 'bg-white text-indigo-600 border border-slate-200/60 shadow-sm font-black'
                              : 'text-slate-500 hover:text-slate-700 font-bold'
                      }`}
                  >
                    <User className="w-3.5 h-3.5" />
                    Sign in as User
                  </button>
                </div>
            )}

            <form onSubmit={handleAuth} className="space-y-6">
              {error && (
                  <div className="bg-red-50 border border-red-100 text-red-600 p-3 rounded-xl flex items-center gap-2 text-sm font-medium animate-in slide-in-from-top-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">
                  {isSignUp ? 'Email / Username' : (loginType === 'user' ? 'Username' : 'Email / Username')}
                </label>
                <div className="relative group">
                  {loginType === 'user' && !isSignUp ? (
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  ) : (
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  )}
                  <input
                      required
                      type="text"
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                      placeholder={isSignUp ? 'name@example.com' : (loginType === 'user' ? 'Enter Registered Username' : 'name@example.com')}
                  />
                </div>
              </div>

              {isSignUp && (
                  <>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Venue Name</label>
                      <div className="relative group">
                        <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input
                            required
                            type="text"
                            value={venueName}
                            onChange={(e) => setVenueName(e.target.value)}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                            placeholder="Pro Sports Arena"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Available Sports</label>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.values(Sport).map(sport => (
                            <button
                                key={sport}
                                type="button"
                                onClick={() => toggleSport(sport)}
                                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                                    selectedSports.includes(sport)
                                        ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                                        : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300'
                                }`}
                            >
                              {selectedSports.includes(sport) ? (
                                  <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                  <div className="w-4 h-4 rounded-full border-2 border-slate-200" />
                              )}
                              {sport}
                            </button>
                        ))}
                      </div>
                    </div>
                  </>
              )}

              {(isSignUp || loginType === 'admin') && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 uppercase tracking-wider ml-1">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input
                          required={isSignUp || loginType === 'admin'}
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all font-medium"
                          placeholder="••••••••"
                      />
                    </div>
                  </div>
              )}

              <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 hover:shadow-indigo-200 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                    <>
                      {isSignUp ? 'Create Venue Profile' : 'Enter Dashboard'}
                      <ArrowRight className="w-5 h-5" />
                    </>
                )}
              </button>

            </form>

            {!isSignUp && (
                <div className="mt-8 pt-6 border-t border-slate-100">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <div className="flex items-center gap-2 mb-2 text-slate-600">
                      <Info className="w-4 h-4" />
                      <span className="text-xs font-bold uppercase tracking-wider">Authentication Guide</span>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      <strong>Administrators:</strong> Sign in with email and secret password.<br/>
                      <strong>Staff / Users:</strong> Choose &apos;Sign in as User&apos; and type only your registered Username (no password required).
                    </p>
                  </div>
                </div>
            )}
          </div>

          <p className="text-center text-slate-400 text-xs mt-8 flex items-center justify-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Secure Cloud Authentication &bull; v1.1.0
          </p>
        </div>
      </div>
  );
};

export default LoginForm;
