import React, { useState, useEffect } from 'react';
import { signIn, signUp, resetPassword, updatePassword } from '../services/authService';
import {
    LogIn, UserPlus, Mail, Lock, User, Loader2, ArrowRight,
    Flag, ShieldCheck, Zap, Globe
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
            case 'LOGIN': return 'Đăng nhập';
            case 'SIGNUP': return 'Tạo tài khoản';
            case 'FORGOT': return 'Quên mật khẩu';
            case 'RESET': return 'Đặt lại mật khẩu';
        }
    };

    const getDescription = () => {
        switch (mode) {
            case 'LOGIN': return 'Tiếp tục hành trình học tiếng Anh của bạn.';
            case 'SIGNUP': return 'Bắt đầu học tiếng Anh với AI ngay hôm nay.';
            case 'FORGOT': return 'Chúng tôi sẽ gửi link khôi phục qua email.';
            case 'RESET': return 'Nhập mật khẩu mới để bảo mật tài khoản.';
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6 lg:p-8 font-sans">
            <main className="w-full max-w-5xl flex flex-col lg:flex-row bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Brand Side */}
                <div className="hidden lg:flex flex-1 p-12 flex-col justify-between bg-indigo-600 text-white">
                    <div>
                        <div className="flex items-center gap-3 mb-12">
                            <div className="bg-white/20 p-2.5 rounded-xl">
                                <Flag className="w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-semibold">Chien English</h1>
                                <p className="text-xs text-indigo-200">AI-Powered Learning</p>
                            </div>
                        </div>

                        <h2 className="text-3xl font-semibold leading-snug mb-6">
                            Học tiếng Anh hiệu quả với AI
                        </h2>

                        <div className="space-y-5">
                            {[
                                { title: 'Phản hồi tức thì', desc: 'AI chấm điểm mọi câu trả lời.', icon: Zap },
                                { title: 'Nội dung chất lượng', desc: 'Bài học được thiết kế bởi chuyên gia.', icon: Globe },
                                { title: 'Đồng bộ dữ liệu', desc: 'Tiến độ được lưu trữ an toàn.', icon: ShieldCheck },
                            ].map((feat, i) => (
                                <div key={i} className="flex gap-4">
                                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center">
                                        <feat.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-sm">{feat.title}</h4>
                                        <p className="text-indigo-200 text-sm">{feat.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Form Side */}
                <div className="flex-1 p-8 sm:p-12 flex flex-col justify-center">
                    <div className="max-w-sm mx-auto w-full">
                        <header className="mb-8">
                            <h3 className="text-2xl font-semibold text-slate-800 mb-2">{getTitle()}</h3>
                            <p className="text-slate-500 text-sm">{getDescription()}</p>
                        </header>

                        {error && (
                            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-sm flex items-center gap-3">
                                <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                                {error}
                            </div>
                        )}

                        {isSuccess ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                                    <Mail className="w-8 h-8 text-emerald-500" />
                                </div>
                                <h3 className="text-xl font-semibold text-slate-800 mb-2">Kiểm tra email</h3>
                                <p className="text-slate-500 text-sm mb-6">
                                    {mode === 'FORGOT'
                                        ? `Chúng tôi đã gửi link đặt lại mật khẩu đến ${email}.`
                                        : `Vui lòng kiểm tra ${email} để kích hoạt tài khoản.`}
                                </p>
                                <button onClick={() => { setMode('LOGIN'); setIsSuccess(false); }} className="text-indigo-600 text-sm font-medium">
                                    Quay lại đăng nhập
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-5">
                                {mode === 'SIGNUP' && (
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Họ và tên</label>
                                        <div className="relative">
                                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="text"
                                                required
                                                value={fullName}
                                                onChange={(e) => setFullName(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 text-slate-800 pl-12 pr-4 py-3 rounded-xl outline-none transition-all text-sm"
                                                placeholder="Nhập họ tên đầy đủ"
                                            />
                                        </div>
                                    </div>
                                )}

                                {mode !== 'RESET' && (
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Email</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="email"
                                                required
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 text-slate-800 pl-12 pr-4 py-3 rounded-xl outline-none transition-all text-sm"
                                                placeholder="email@example.com"
                                            />
                                        </div>
                                    </div>
                                )}

                                {mode !== 'FORGOT' && (
                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="text-xs font-medium text-slate-500">{mode === 'RESET' ? 'Mật khẩu mới' : 'Mật khẩu'}</label>
                                            {mode === 'LOGIN' && <button type="button" onClick={() => setMode('FORGOT')} className="text-xs text-indigo-600 font-medium">Quên mật khẩu?</button>}
                                        </div>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                            <input
                                                type="password"
                                                required
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 text-slate-800 pl-12 pr-4 py-3 rounded-xl outline-none transition-all text-sm"
                                                placeholder="••••••••"
                                            />
                                        </div>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm"
                                >
                                    {isLoading ? (
                                        <Loader2 className="animate-spin w-5 h-5" />
                                    ) : (
                                        <>
                                            {mode === 'LOGIN' ? 'Đăng nhập' : mode === 'SIGNUP' ? 'Tạo tài khoản' : mode === 'FORGOT' ? 'Gửi link' : 'Cập nhật'}
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </form>
                        )}

                        <div className="mt-8 text-center border-t border-slate-100 pt-6">
                            {mode === 'LOGIN' ? (
                                <button onClick={() => setMode('SIGNUP')} className="text-slate-500 text-sm">
                                    Chưa có tài khoản? <span className="text-indigo-600 font-medium">Đăng ký ngay</span>
                                </button>
                            ) : (
                                <button onClick={() => setMode('LOGIN')} className="text-slate-500 text-sm">
                                    Đã có tài khoản? <span className="text-indigo-600 font-medium">Đăng nhập</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};
