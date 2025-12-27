import React, { useState, useEffect } from 'react';
import { signIn, signUp, resetPassword, updatePassword } from '../services/authService';
import {
    LogIn, UserPlus, Mail, Lock, User, Loader2, ArrowRight,
    Flag, ShieldCheck, Zap, Star, Globe, KeyRound
} from 'lucide-react';

interface AuthProps {
    onAuthComplete: () => void;
}

type AuthMode = 'LOGIN' | 'SIGNUP' | 'FORGOT' | 'RESET';

export const Auth: React.FC<AuthProps> = ({ onAuthComplete }) => {
    const [mode, setMode] = useState<AuthMode>('LOGIN');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);

    // Deep Link Logic for Password Reset
    useEffect(() => {
        const hash = window.location.hash;
        if (hash && hash.includes('reset_password=true')) {
            setMode('RESET');
        }
    }, []);

    const validateForm = () => {
        if (!email.includes('@')) {
            setError('Vui lòng nhập email hợp lệ.');
            return false;
        }
        if (mode !== 'FORGOT' && password.length < 6) {
            setError('Mật khẩu phải có ít nhất 6 ký tự.');
            return false;
        }
        if (mode === 'SIGNUP' && !fullName.trim()) {
            setError('Vui lòng nhập đầy đủ họ tên.');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setIsLoading(true);
        setError(null);
        setIsSuccess(false);

        try {
            switch (mode) {
                case 'LOGIN':
                    await signIn(email, password);
                    onAuthComplete();
                    break;
                case 'SIGNUP':
                    const signUpData = await signUp(email, password, fullName);
                    if (signUpData.user && !signUpData.session) {
                        setIsSuccess(true);
                    } else {
                        onAuthComplete();
                    }
                    break;
                case 'FORGOT':
                    await resetPassword(email);
                    setIsSuccess(true);
                    break;
                case 'RESET':
                    await updatePassword(password);
                    setMode('LOGIN');
                    setError(null);
                    alert('Mật khẩu đã được cập nhật. Vui lòng đăng nhập lại.');
                    break;
            }
        } catch (err: any) {
            console.error('Auth error:', err);
            setError(err.message || 'Có lỗi xảy ra, vui lòng thử lại.');
        } finally {
            setIsLoading(false);
        }
    };

    const getTitle = () => {
        switch (mode) {
            case 'LOGIN': return 'Welcome Back';
            case 'SIGNUP': return 'Join the Lab';
            case 'FORGOT': return 'Recover Access';
            case 'RESET': return 'New Security Key';
        }
    };

    const getDescription = () => {
        switch (mode) {
            case 'LOGIN': return 'Authorize your session to resume practice.';
            case 'SIGNUP': return 'Initialize your learning profile today.';
            case 'FORGOT': return 'We will send a recovery link to your email.';
            case 'RESET': return 'Update your password to secure your account.';
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#0C0F16] p-4 sm:p-6 lg:p-8 font-sans overflow-hidden relative">
            {/* Immersive Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-indigo-500/10 rounded-full blur-[150px] animate-pulse"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-purple-500/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }}></div>
            </div>

            <main className="w-full max-w-6xl flex flex-col lg:flex-row bg-slate-900/40 backdrop-blur-3xl rounded-[3rem] border border-white/5 shadow-2xl overflow-hidden relative z-10">
                {/* Brand Side (Visible on Desktop) */}
                <div className="hidden lg:flex flex-1 p-16 flex-col justify-between relative overflow-hidden bg-gradient-to-br from-indigo-600/20 to-transparent border-r border-white/5">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-16">
                            <div className="bg-indigo-600 p-3 rounded-2xl">
                                <Flag className="w-8 h-8 text-white fill-current" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-heading font-black text-white tracking-tighter">EngPractice <span className="text-indigo-500">Pro</span></h1>
                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Language Lab v4.0</p>
                            </div>
                        </div>

                        <h2 className="text-5xl font-heading font-black text-white leading-[1.15] mb-8">
                            Master English with <br />
                            <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">AI Precision.</span>
                        </h2>

                        <div className="space-y-8">
                            {[
                                { title: 'AI Evaluation', desc: 'Real-time feedback on every sentence.', icon: Zap },
                                { title: 'Expert Content', desc: 'Curated lessons for all levels.', icon: Globe },
                                { title: 'Cloud Sync', desc: 'Safe learning records everywhere.', icon: ShieldCheck },
                            ].map((feat, i) => (
                                <div key={i} className="flex gap-5">
                                    <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5">
                                        <feat.icon className="w-5 h-5 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-black text-sm uppercase tracking-widest">{feat.title}</h4>
                                        <p className="text-slate-500 text-sm">{feat.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Form Side */}
                <div className="flex-1 p-8 sm:p-16 lg:p-20 flex flex-col justify-center">
                    <div className="max-w-md mx-auto w-full">
                        <header className="mb-12 text-center lg:text-left">
                            <h3 className="text-4xl font-heading font-black text-white mb-3">{getTitle()}</h3>
                            <p className="text-slate-500 font-medium">{getDescription()}</p>
                        </header>

                        {error && (
                            <div className="mb-8 p-5 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-sm flex items-center gap-3">
                                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {isSuccess ? (
                            <div className="text-center py-10">
                                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
                                    <Mail className="w-10 h-10 text-emerald-500" />
                                </div>
                                <h3 className="text-2xl font-black text-white mb-4">Check your email</h3>
                                <p className="text-slate-400 font-medium mb-8">
                                    {mode === 'FORGOT'
                                        ? `Chúng tôi đã gửi link đặt lại mật khẩu đến ${email}.`
                                        : `Vui lòng kiểm tra ${email} để kích hoạt tài khoản.`}
                                </p>
                                <button onClick={() => { setMode('LOGIN'); setIsSuccess(false); }} className="text-indigo-500 font-black uppercase tracking-widest text-xs">Phòng thí nghiệm đăng nhập</button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {mode === 'SIGNUP' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Full Identity</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-600 group-focus-within:text-indigo-400 transition-colors">
                                                <User size={20} />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                className="w-full bg-white/5 border border-white/5 focus:border-indigo-500/50 text-white pl-16 pr-6 py-5 rounded-2xl outline-none transition-all placeholder:text-slate-600 font-medium"
                                                placeholder="Enter full name"
                                            />
                                        </div>
                                    </div>
                                )}

                                {mode !== 'RESET' && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2">Email Address</label>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-600 group-focus-within:text-indigo-400 transition-colors">
                                                <Mail size={20} />
                                            </div>
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full bg-white/5 border border-white/5 focus:border-indigo-500/50 text-white pl-16 pr-6 py-5 rounded-2xl outline-none transition-all placeholder:text-slate-600 font-medium"
                                                placeholder="email@example.com"
                                            />
                                        </div>
                                    </div>
                                )}

                                {mode !== 'FORGOT' && (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center ml-2">
                                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{mode === 'RESET' ? 'New Password' : 'Password Crypt'}</label>
                                            {mode === 'LOGIN' && <button type="button" onClick={() => setMode('FORGOT')} className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">Recover Keys?</button>}
                                        </div>
                                        <div className="relative group">
                                            <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-slate-600 group-focus-within:text-indigo-400 transition-colors">
                                                <Lock size={20} />
                                            </div>
                                            <input
                                                type="password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full bg-white/5 border border-white/5 focus:border-indigo-500/50 text-white pl-16 pr-6 py-5 rounded-2xl outline-none transition-all placeholder:text-slate-600 font-medium"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full h-20 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-3xl shadow-xl flex items-center justify-center gap-4 uppercase tracking-widest text-xs transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isLoading ? (
                                        <Loader2 className="animate-spin" size={24} />
                                    ) : (
                                        <>
                                            {mode === 'LOGIN' ? 'Access Account' : mode === 'SIGNUP' ? 'Initialize Profile' : mode === 'FORGOT' ? 'Send Link' : 'Update Security'}
                                            <ArrowRight size={20} />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        <div className="mt-12 text-center border-t border-white/5 pt-10">
                            {mode === 'LOGIN' ? (
                                <button onClick={() => setMode('SIGNUP')} className="text-slate-500 hover:text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 mx-auto">
                                    Need an ID? <span className="text-indigo-500">Register Now</span>
                                </button>
                            ) : (
                                <button onClick={() => setMode('LOGIN')} className="text-slate-500 hover:text-white text-xs font-black uppercase tracking-widest flex items-center justify-center gap-3 mx-auto">
                                    Already have an ID? <span className="text-indigo-500">Sign In</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
