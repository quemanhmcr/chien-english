import React, { useState, useCallback, useEffect } from 'react';
import {
    Wand2, Edit3, ArrowLeft, ArrowRight, X, Loader2, Sparkles,
    Book, Settings, CheckCircle2, ChevronRight
} from 'lucide-react';
import { Lesson, Exercise } from '../types';
import { generateLessonContent } from '../services/mimoService';
import { LESSON_GENERATION_PROMPT } from '../services/prompts';

interface LessonWizardProps {
    isOpen: boolean;
    onClose: () => void;
    onAddLesson: (lesson: Lesson) => void;
}

type WizardStep = 1 | 2 | 3;
type CreationMethod = 'ai' | 'manual' | null;

interface WizardState {
    method: CreationMethod;
    // AI mode
    aiTopic: string;
    aiComplexity: number | 'auto';
    // Manual mode
    manualTitle: string;
    manualDescription: string;
    manualLevel: 'Beginner' | 'Intermediate' | 'Advanced';
    manualExercises: Partial<Exercise>[];
    // External support
    importJson: string;
}

const initialState: WizardState = {
    method: null,
    aiTopic: '',
    aiComplexity: 'auto',
    manualTitle: '',
    manualDescription: '',
    manualLevel: 'Beginner',
    manualExercises: [],
    importJson: ''
};

export const LessonWizard: React.FC<LessonWizardProps> = ({
    isOpen,
    onClose,
    onAddLesson
}) => {
    const [currentStep, setCurrentStep] = useState<WizardStep>(1);
    const [state, setState] = useState<WizardState>(initialState);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [animatingStep, setAnimatingStep] = useState<'enter' | 'exit' | null>('enter');

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setCurrentStep(1);
                setState(initialState);
                setAnimatingStep('enter');
            }, 300);
        }
    }, [isOpen]);

    // Handle keyboard
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const goToStep = useCallback((step: WizardStep) => {
        setAnimatingStep('exit');
        setTimeout(() => {
            setCurrentStep(step);
            setAnimatingStep('enter');
        }, 200);
    }, []);

    const handleMethodSelect = (method: CreationMethod) => {
        setState(prev => ({ ...prev, method }));
    };

    const handleNext = () => {
        if (currentStep === 1 && state.method) {
            goToStep(2);
        } else if (currentStep === 2) {
            if (state.method === 'manual') {
                goToStep(3);
            } else {
                // AI generation happens in step 2
                handleAIGenerate();
            }
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            goToStep((currentStep - 1) as WizardStep);
        }
    };

    const handleAIGenerate = async () => {
        if (!state.aiTopic.trim()) return;
        setIsGenerating(true);
        try {
            const generatedContent = await generateLessonContent(state.aiTopic, state.aiComplexity);
            const newLesson = {
                title: generatedContent.title,
                description: generatedContent.description,
                level: generatedContent.level,
                exercises: generatedContent.exercises
            };
            await onAddLesson(newLesson as any);
            onClose();
        } catch (err) {
            console.error(err);
            alert('Có lỗi khi tạo bài học. Vui lòng thử lại.');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyPrompt = async () => {
        const fullPrompt = `${LESSON_GENERATION_PROMPT}\n\n[USER TOPIC]\nTopic: "${state.aiTopic}". Generate exactly ${state.aiComplexity === 'auto' ? '12' : state.aiComplexity} exercises.`;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(fullPrompt);
            } else {
                // Fallback for non-secure contexts or older browsers
                const textArea = document.createElement("textarea");
                textArea.value = fullPrompt;
                textArea.style.position = "fixed";
                textArea.style.left = "-999999px";
                textArea.style.top = "-999999px";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                document.execCommand('copy');
                textArea.remove();
            }
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            console.error('Copy failed:', err);
            alert('Không thể tự động copy. Vui lòng copy thủ công topic.');
        }
    };

    const handleImportJson = async () => {
        if (!state.importJson.trim()) return;
        try {
            let jsonToParse = state.importJson.trim();
            const jsonMatch = jsonToParse.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                jsonToParse = jsonMatch[0];
            }
            const parsed = JSON.parse(jsonToParse);
            if (!parsed.title || !parsed.exercises || !Array.isArray(parsed.exercises)) {
                throw new Error('Thiếu trường bắt buộc (title hoặc exercises).');
            }
            const hasInvalidExercises = parsed.exercises.some((ex: any) => !ex.vietnamese);
            if (hasInvalidExercises) {
                throw new Error('Một số câu hỏi thiếu trường "vietnamese".');
            }
            await onAddLesson(parsed as any);
            onClose();
        } catch (err: any) {
            alert(`Lỗi: ${err.message || 'JSON không đúng định dạng.'}`);
        }
    };

    const handleManualSubmit = async () => {
        if (!state.manualTitle.trim()) return;
        const newLesson = {
            title: state.manualTitle,
            description: state.manualDescription,
            level: state.manualLevel,
            exercises: state.manualExercises.filter(e => e.vietnamese).map((e, i) => ({
                id: crypto.randomUUID ? crypto.randomUUID() : `ex-${Date.now()}-${i}`,
                type: e.type || 'translation',
                vietnamese: e.vietnamese!,
                difficulty: e.difficulty || 'Medium',
                hint: e.hint
            }))
        };
        await onAddLesson(newLesson as any);
        onClose();
    };

    const addManualExercise = () => {
        setState(prev => ({
            ...prev,
            manualExercises: [...prev.manualExercises, { type: 'translation', difficulty: 'Medium', vietnamese: '', hint: '' }]
        }));
    };

    const updateManualExercise = (index: number, updates: Partial<Exercise>) => {
        setState(prev => ({
            ...prev,
            manualExercises: prev.manualExercises.map((ex, i) => i === index ? { ...ex, ...updates } : ex)
        }));
    };

    const removeManualExercise = (index: number) => {
        setState(prev => ({
            ...prev,
            manualExercises: prev.manualExercises.filter((_, i) => i !== index)
        }));
    };

    const canProceed = () => {
        if (currentStep === 1) return state.method !== null;
        if (currentStep === 2) {
            if (state.method === 'ai') return state.aiTopic.trim().length > 0;
            if (state.method === 'manual') return state.manualTitle.trim().length > 0;
        }
        if (currentStep === 3) return state.manualExercises.some(e => e.vietnamese?.trim());
        return false;
    };

    if (!isOpen) return null;

    const steps = [
        { label: 'Phương thức', icon: <Settings className="w-4 h-4" /> },
        { label: 'Cấu hình', icon: <Book className="w-4 h-4" /> },
        ...(state.method === 'manual' ? [{ label: 'Nội dung', icon: <Edit3 className="w-4 h-4" /> }] : [])
    ];

    return (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[200] flex items-center justify-center p-4 md:p-6 animate-in fade-in duration-300">
            <div
                className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-[2.5rem] shadow-3xl overflow-hidden"
                style={{ backgroundColor: 'var(--md-sys-surface-wizard-base)' }}
            >
                {/* Fixed Header with Progress */}
                <div className="flex-shrink-0 px-8 py-6 border-b border-slate-200/60" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                                <Sparkles className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-slate-900 tracking-tight">Lesson Architect</h2>
                                <p className="text-xs text-slate-500 font-medium">Tạo bài học mới</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="w-10 h-10 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all hover:rotate-90"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Progress Indicator */}
                    <div className="flex items-center gap-2">
                        {steps.map((step, idx) => (
                            <React.Fragment key={idx}>
                                <div className="flex items-center gap-2">
                                    <div
                                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${idx + 1 < currentStep
                                            ? 'bg-[var(--md-sys-color-wizard-complete)] text-white'
                                            : idx + 1 === currentStep
                                                ? 'bg-[var(--md-sys-color-wizard-current)] text-white ring-4 ring-[var(--md-sys-color-wizard-current)]/20'
                                                : 'bg-[var(--md-sys-color-wizard-pending)] text-white/60'
                                            }`}
                                    >
                                        {idx + 1 < currentStep ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                                    </div>
                                    <span className={`text-xs font-bold hidden sm:block ${idx + 1 <= currentStep ? 'text-slate-700' : 'text-slate-400'
                                        }`}>
                                        {step.label}
                                    </span>
                                </div>
                                {idx < steps.length - 1 && (
                                    <div className={`flex-1 h-0.5 rounded-full transition-colors duration-300 ${idx + 1 < currentStep ? 'bg-[var(--md-sys-color-wizard-complete)]' : 'bg-slate-200'
                                        }`} />
                                )}
                            </React.Fragment>
                        ))}
                    </div>
                </div>

                {/* Step Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className={animatingStep === 'enter' ? 'wizard-step-enter' : animatingStep === 'exit' ? 'wizard-step-exit' : ''}>
                        {/* Step 1: Method Selection */}
                        {currentStep === 1 && (
                            <div className="space-y-6">
                                <div className="text-center mb-8">
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">Chọn phương thức tạo bài</h3>
                                    <p className="text-slate-500">Bạn muốn sử dụng AI hay tự viết nội dung?</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* AI Card */}
                                    <button
                                        onClick={() => handleMethodSelect('ai')}
                                        className={`group p-6 rounded-3xl border-2 text-left transition-all duration-300 ${state.method === 'ai'
                                            ? 'border-indigo-500 bg-[var(--md-sys-surface-wizard-active)] shadow-lg shadow-indigo-100'
                                            : 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-md'
                                            }`}
                                        style={{ backgroundColor: state.method === 'ai' ? 'var(--md-sys-surface-wizard-active)' : 'var(--md-sys-color-surface-container-lowest)' }}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${state.method === 'ai' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100'
                                            }`}>
                                            <Wand2 className="w-7 h-7" />
                                        </div>
                                        <h4 className="text-lg font-black text-slate-900 mb-1">AI Generation</h4>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            Mô tả chủ đề và để AI tự động tạo bài học chất lượng cao với nhiều dạng câu hỏi.
                                        </p>
                                        {state.method === 'ai' && (
                                            <div className="mt-4 flex items-center gap-2 text-indigo-600 text-xs font-bold">
                                                <CheckCircle2 className="w-4 h-4" /> Đã chọn
                                            </div>
                                        )}
                                    </button>

                                    {/* Manual Card */}
                                    <button
                                        onClick={() => handleMethodSelect('manual')}
                                        className={`group p-6 rounded-3xl border-2 text-left transition-all duration-300 ${state.method === 'manual'
                                            ? 'border-emerald-500 bg-emerald-50/50 shadow-lg shadow-emerald-100'
                                            : 'border-slate-200 bg-white hover:border-emerald-300 hover:shadow-md'
                                            }`}
                                        style={{ backgroundColor: state.method === 'manual' ? undefined : 'var(--md-sys-color-surface-container-lowest)' }}
                                    >
                                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all ${state.method === 'manual' ? 'bg-emerald-600 text-white' : 'bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100'
                                            }`}>
                                            <Edit3 className="w-7 h-7" />
                                        </div>
                                        <h4 className="text-lg font-black text-slate-900 mb-1">Manual Creation</h4>
                                        <p className="text-sm text-slate-500 leading-relaxed">
                                            Tự tạo từng câu hỏi với toàn quyền kiểm soát nội dung và độ khó.
                                        </p>
                                        {state.method === 'manual' && (
                                            <div className="mt-4 flex items-center gap-2 text-emerald-600 text-xs font-bold">
                                                <CheckCircle2 className="w-4 h-4" /> Đã chọn
                                            </div>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 2: Configuration */}
                        {currentStep === 2 && (
                            <div className="space-y-6">
                                {state.method === 'ai' ? (
                                    <>
                                        <div className="text-center mb-8">
                                            <h3 className="text-2xl font-black text-slate-900 mb-2">Cấu hình AI Generation</h3>
                                            <p className="text-slate-500">Mô tả chủ đề và chọn độ phức tạp</p>
                                        </div>

                                        {/* Internal AI */}
                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Chủ đề bài học</label>
                                                <textarea
                                                    value={state.aiTopic}
                                                    onChange={(e) => setState(prev => ({ ...prev, aiTopic: e.target.value }))}
                                                    disabled={isGenerating}
                                                    placeholder="VD: Giao tiếp email chuyên nghiệp trong môi trường công sở..."
                                                    className="w-full p-5 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none h-32 text-slate-900"
                                                    style={{ backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Số lượng câu hỏi</label>
                                                <select
                                                    value={state.aiComplexity}
                                                    onChange={(e) => setState(prev => ({ ...prev, aiComplexity: e.target.value === 'auto' ? 'auto' : Number(e.target.value) }))}
                                                    className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-white cursor-pointer font-bold"
                                                >
                                                    <option value="auto">Tối ưu tự động (~12 câu)</option>
                                                    <option value="5">Cơ bản (5 câu)</option>
                                                    <option value="10">Tiêu chuẩn (10 câu)</option>
                                                    <option value="15">Nâng cao (15 câu)</option>
                                                </select>
                                            </div>
                                        </div>

                                        {/* External Support Section */}
                                        <div className="mt-8 pt-8 border-t border-slate-200">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="flex-1 h-px bg-slate-200" />
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">hoặc sử dụng ChatGPT/Claude</span>
                                                <div className="flex-1 h-px bg-slate-200" />
                                            </div>

                                            <div className="p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 mb-4">
                                                <div className="flex items-center justify-between gap-4">
                                                    <div>
                                                        <p className="text-sm font-bold text-slate-700">Copy prompt ra ngoài</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">Dán vào ChatGPT/Claude để tạo JSON</p>
                                                    </div>
                                                    <button
                                                        onClick={handleCopyPrompt}
                                                        disabled={!state.aiTopic.trim()}
                                                        className={`px-5 py-2.5 font-bold rounded-xl text-xs border transition-all ${isCopied
                                                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                                                : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50'
                                                            } disabled:opacity-50`}
                                                    >
                                                        {isCopied ? '✓ Copied!' : 'Copy Prompt'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Import JSON từ bên ngoài</label>
                                                <textarea
                                                    value={state.importJson}
                                                    onChange={(e) => setState(prev => ({ ...prev, importJson: e.target.value }))}
                                                    placeholder='Dán JSON từ ChatGPT/Claude vào đây...'
                                                    className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none h-32 text-sm font-mono text-slate-600"
                                                    style={{ backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}
                                                />
                                                {state.importJson.trim() && (
                                                    <button
                                                        onClick={handleImportJson}
                                                        className="mt-3 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all"
                                                    >
                                                        Import & Tạo bài học
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-center mb-8">
                                            <h3 className="text-2xl font-black text-slate-900 mb-2">Thông tin bài học</h3>
                                            <p className="text-slate-500">Nhập tiêu đề và mô tả cho bài học</p>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Tiêu đề bài học</label>
                                                <input
                                                    type="text"
                                                    value={state.manualTitle}
                                                    onChange={(e) => setState(prev => ({ ...prev, manualTitle: e.target.value }))}
                                                    placeholder="VD: Giao tiếp văn phòng cơ bản"
                                                    className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                                                    style={{ backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Mô tả</label>
                                                <textarea
                                                    value={state.manualDescription}
                                                    onChange={(e) => setState(prev => ({ ...prev, manualDescription: e.target.value }))}
                                                    placeholder="Mô tả ngắn gọn về nội dung bài học..."
                                                    className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all resize-none h-24"
                                                    style={{ backgroundColor: 'var(--md-sys-color-surface-container-lowest)' }}
                                                />
                                            </div>

                                            <div>
                                                <label className="text-xs font-black text-slate-500 uppercase tracking-widest mb-2 block">Cấp độ</label>
                                                <select
                                                    value={state.manualLevel}
                                                    onChange={(e) => setState(prev => ({ ...prev, manualLevel: e.target.value as any }))}
                                                    className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-white cursor-pointer font-bold"
                                                >
                                                    <option value="Beginner">Beginner</option>
                                                    <option value="Intermediate">Intermediate</option>
                                                    <option value="Advanced">Advanced</option>
                                                </select>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Step 3: Manual Exercises */}
                        {currentStep === 3 && state.method === 'manual' && (
                            <div className="space-y-6">
                                <div className="text-center mb-8">
                                    <h3 className="text-2xl font-black text-slate-900 mb-2">Thêm câu hỏi</h3>
                                    <p className="text-slate-500">Tạo các bài tập cho học viên</p>
                                </div>

                                <div className="space-y-4">
                                    {state.manualExercises.map((ex, idx) => (
                                        <div key={idx} className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Câu {idx + 1}</span>
                                                <button
                                                    onClick={() => removeManualExercise(idx)}
                                                    className="text-rose-500 hover:text-rose-600 text-xs font-bold"
                                                >
                                                    Xóa
                                                </button>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Nội dung tiếng Việt..."
                                                value={ex.vietnamese || ''}
                                                onChange={(e) => updateManualExercise(idx, { vietnamese: e.target.value })}
                                                className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm"
                                            />
                                            <div className="grid grid-cols-2 gap-3">
                                                <select
                                                    value={ex.type || 'translation'}
                                                    onChange={(e) => updateManualExercise(idx, { type: e.target.value as any })}
                                                    className="p-3 rounded-xl border border-slate-200 outline-none text-sm font-medium bg-white"
                                                >
                                                    <option value="translation">Translation</option>
                                                    <option value="roleplay">Role-play</option>
                                                    <option value="detective">Detective</option>
                                                </select>
                                                <select
                                                    value={ex.difficulty || 'Medium'}
                                                    onChange={(e) => updateManualExercise(idx, { difficulty: e.target.value as any })}
                                                    className="p-3 rounded-xl border border-slate-200 outline-none text-sm font-medium bg-white"
                                                >
                                                    <option value="Easy">Easy</option>
                                                    <option value="Medium">Medium</option>
                                                    <option value="Hard">Hard</option>
                                                </select>
                                            </div>
                                            <input
                                                type="text"
                                                placeholder="Gợi ý (tùy chọn)..."
                                                value={ex.hint || ''}
                                                onChange={(e) => updateManualExercise(idx, { hint: e.target.value })}
                                                className="w-full p-3 rounded-xl border border-slate-200 focus:border-indigo-500 outline-none text-sm"
                                            />
                                        </div>
                                    ))}

                                    <button
                                        onClick={addManualExercise}
                                        className="w-full p-4 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 font-bold hover:border-indigo-400 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"
                                    >
                                        <span className="text-xl">+</span> Thêm câu hỏi mới
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Navigation */}
                <div className="flex-shrink-0 px-8 py-5 border-t border-slate-200/60 flex items-center justify-between" style={{ backgroundColor: 'var(--md-sys-color-surface-container-low)' }}>
                    <button
                        onClick={currentStep === 1 ? onClose : handleBack}
                        className="flex items-center gap-2 px-5 py-3 text-slate-600 hover:text-slate-900 font-bold rounded-xl hover:bg-slate-100 transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        {currentStep === 1 ? 'Hủy' : 'Quay lại'}
                    </button>

                    {currentStep === 2 && state.method === 'ai' && !state.importJson.trim() ? (
                        <button
                            onClick={handleAIGenerate}
                            disabled={!canProceed() || isGenerating}
                            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Đang tạo...
                                </>
                            ) : (
                                <>
                                    <Wand2 className="w-4 h-4" /> Tạo bài học
                                </>
                            )}
                        </button>
                    ) : currentStep === 3 ? (
                        <button
                            onClick={handleManualSubmit}
                            disabled={!canProceed()}
                            className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            <CheckCircle2 className="w-4 h-4" /> Hoàn thành
                        </button>
                    ) : (
                        <button
                            onClick={handleNext}
                            disabled={!canProceed()}
                            className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                        >
                            Tiếp tục <ArrowRight className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
