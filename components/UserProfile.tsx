import React, { useState } from 'react';
import { UserProfile as UserProfileType } from '../types';
import { updateProfile } from '../services/authService';
import { useToast } from './Toast';
import { User, Camera, Save, Loader2, X } from 'lucide-react';

interface UserProfileProps {
    profile: UserProfileType;
    onUpdate: (updated: UserProfileType) => void;
    onClose: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ profile, onUpdate, onClose }) => {
    const [fullName, setFullName] = useState(profile.full_name);
    const [isUpdating, setIsUpdating] = useState(false);
    const { showToast } = useToast();

    const handleSave = async () => {
        if (!fullName.trim() || fullName === profile.full_name) return;

        setIsUpdating(true);
        try {
            await updateProfile(profile.id, { full_name: fullName });
            const updatedProfile = { ...profile, full_name: fullName };
            onUpdate(updatedProfile);
            showToast('Cập nhật thông tin thành công!', 'success');
            onClose(); // Close modal on success
        } catch (err) {
            showToast('Lỗi khi cập nhật thông tin.', 'error');
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between">
                    <h2 className="text-xl font-heading font-bold text-slate-800">Thông tin cá nhân</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-8 space-y-8">
                    {/* Avatar Section */}
                    <div className="flex flex-col items-center">
                        <div className="relative group">
                            <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-indigo-500/20">
                                {profile.full_name.charAt(0).toUpperCase()}
                            </div>
                            <button className="absolute bottom-0 right-0 p-2 bg-white rounded-full shadow-lg border border-slate-100 text-indigo-600 hover:text-indigo-700 transition-transform active:scale-95">
                                <Camera size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-500 ml-1">Họ và tên</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                    <User size={18} />
                                </div>
                                <input
                                    type="text"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 text-slate-800 pl-11 pr-4 py-3 rounded-xl outline-none transition-all"
                                    placeholder="Họ và tên của bạn"
                                />
                            </div>
                        </div>

                        <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Thông tin tài khoản</div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500">Vai trò</span>
                                <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-lg font-bold text-xs uppercase">
                                    {profile.role}
                                </span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSave}
                        disabled={isUpdating || fullName === profile.full_name}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3.5 rounded-xl shadow-lg transform transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:active:scale-100 flex items-center justify-center gap-2"
                    >
                        {isUpdating ? <Loader2 className="animate-spin" size={20} /> : <Save size={18} />}
                        Lưu thay đổi
                    </button>
                </div>
            </div>
        </div>
    );
};
