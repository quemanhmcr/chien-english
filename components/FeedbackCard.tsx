import React, { useState } from 'react';
import {
  CheckCircle2, XCircle, Lightbulb, ArrowRight, Sparkles, Zap,
  Volume2, MessageSquare, BookOpen, Layers
} from 'lucide-react';
import { EvaluationResult } from '../types';

interface FeedbackCardProps {
  result: EvaluationResult;
  onNext: () => void;
  isLastQuestion: boolean;
}

export const FeedbackCard: React.FC<FeedbackCardProps> = ({ result, onNext, isLastQuestion }) => {
  const [activeSubTab, setActiveSubTab] = useState<'explanation' | 'native'>('explanation');
  const isPass = result.isPass;

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className={`mt-8 rounded-[2.5rem] overflow-hidden border-2 animate-slide-up bg-white relative
      ${isPass ? 'border-emerald-100 shadow-xl shadow-emerald-500/5' : 'border-rose-100 shadow-xl shadow-rose-500/5'}`}>

      {/* Status Bar */}
      <div className={`px-10 py-8 flex items-center justify-between border-b ${isPass ? 'border-emerald-50 bg-emerald-50/30' : 'border-rose-50 bg-rose-50/30'}`}>
        <div className="flex items-center gap-6">
          <div className={`w-16 h-16 rounded-[1.25rem] flex items-center justify-center shadow-lg ${isPass ? 'bg-emerald-500 text-white shadow-emerald-100' : 'bg-rose-500 text-white shadow-rose-100'}`}>
            {isPass ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
          </div>
          <div>
            <h3 className={`font-heading font-black text-2xl tracking-tight ${isPass ? 'text-emerald-900' : 'text-rose-900'}`}>
              {isPass ? 'Excellent Work!' : 'Almost There!'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isPass ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                Result: {result.score}/100
              </span>
              <span className="text-slate-300 font-bold">•</span>
              <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest italic">{result.isPass ? 'PASSED' : 'RETRY SUGGESTED'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-10 space-y-10">

        {/* Core Lesson (Key Takeaway) */}
        <div className="relative group p-8 rounded-[2rem] bg-slate-900 text-white overflow-hidden shadow-2xl">
          <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-125 transition-transform duration-1000">
            <Zap className="w-24 h-24 text-amber-400 fill-current" />
          </div>
          <div className="relative z-10">
            <span className="text-[10px] font-black text-amber-400 uppercase tracking-[0.3em] block mb-3">Professional Insight</span>
            <p className="text-xl font-bold leading-relaxed">{result.keyTakeaway}</p>
          </div>
        </div>

        {/* Dynamic Detail Section */}
        <div className="space-y-6">
          <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100 w-fit">
            <button
              onClick={() => setActiveSubTab('explanation')}
              className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeSubTab === 'explanation' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <MessageSquare className="w-4 h-4" /> Comprehensive Analysis
            </button>
            {result.improvedVersion && (
              <button
                onClick={() => setActiveSubTab('native')}
                className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${activeSubTab === 'native' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
              >
                <Sparkles className="w-4 h-4" /> Native Rewrite
              </button>
            )}
          </div>

          <div className="animate-fade-in">
            {activeSubTab === 'explanation' ? (
              <div className="bg-gradient-to-br from-indigo-700 to-purple-800 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                  <MessageSquare className="w-40 h-40 text-indigo-400" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-start justify-between gap-4 mb-6">
                    <div className="flex-1">
                      <span className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em] block mb-3">Phân tích chi tiết</span>
                      <p className="text-2xl font-black text-white leading-tight">{result.correction}</p>
                    </div>
                    <button
                      onClick={() => speakText(result.correction)}
                      className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-md transition-all active:translate-y-1 border border-white/10"
                    >
                      <Volume2 className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="pt-6 border-t border-white/10 text-indigo-100 font-medium leading-relaxed text-base">
                    {result.explanation}
                  </div>

                  {result.grammarPoints && result.grammarPoints.length > 0 && (
                    <div className="flex flex-wrap gap-3 mt-8">
                      {result.grammarPoints.map((point, idx) => (
                        <span key={idx} className="bg-white/10 text-white border border-white/10 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                          <Layers className="w-3.5 h-3.5" /> {point}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-1000">
                  <Sparkles className="w-40 h-40" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.3em]">Bản dịch nâng cao</span>
                    <button
                      onClick={() => speakText(result.improvedVersion || '')}
                      className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-2xl backdrop-blur-md transition-all active:translate-y-1 border border-white/10"
                    >
                      <Volume2 className="w-6 h-6" />
                    </button>
                  </div>
                  <p className="text-3xl font-black leading-tight tracking-tight mb-4">{result.improvedVersion}</p>
                  <p className="text-indigo-100/70 text-sm font-medium italic">"Dùng cấu trúc này để nghe tự nhiên và chuyên nghiệp hơn như một Native Speaker."</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Coach's direct note */}
        {result.coachNote && (
          <div className="flex items-start gap-4 p-6 bg-slate-50 rounded-3xl border border-slate-100">
            <div className="p-3 bg-white rounded-2xl shadow-sm text-indigo-600 flex-shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <p className="text-slate-500 font-medium italic text-sm leading-relaxed">"{result.coachNote}"</p>
          </div>
        )}
      </div>

      {/* Action Area managed by LearnerView for consistency */}
    </div>
  );
};