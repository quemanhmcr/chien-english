import React from 'react';
import { Mic, Activity, CheckCircle2, AlertTriangle, Play } from 'lucide-react';
import { PronunciationResult } from '../types';

interface PronunciationFeedbackProps {
  result: PronunciationResult;
}

export const PronunciationFeedback: React.FC<PronunciationFeedbackProps> = ({ result }) => {
  const isHighQuality = result.score >= 80;

  return (
    <div className="bg-white rounded-3xl shadow-sm border-2 border-slate-100 p-6 sm:p-8 mb-6 animate-slide-up">
      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-100">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold border-4
          ${isHighQuality ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-orange-50 border-orange-500 text-orange-700'}`}>
          {result.score}
        </div>
        <div>
          <h3 className="text-xl font-heading font-bold text-slate-800">
            {isHighQuality ? 'Phát âm chuẩn!' : 'Cần cải thiện'}
          </h3>
          <p className="text-slate-500 text-sm">AI Native Evaluation</p>
        </div>
      </div>

      <div className="space-y-4">
        <div>
           <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Chi tiết từng từ</h4>
           <div className="flex flex-wrap gap-2">
             {result.words.map((word, idx) => (
               <div key={idx} className={`relative group px-3 py-1.5 rounded-lg border text-lg font-medium transition-all
                  ${word.isCorrect 
                    ? 'bg-slate-50 border-slate-200 text-slate-700' 
                    : 'bg-rose-50 border-rose-200 text-rose-700'}`}>
                  {word.word}
                  
                  {!word.isCorrect && word.ipa && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-rose-600 text-white text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      {word.ipa}
                    </div>
                  )}
               </div>
             ))}
           </div>
        </div>

        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Activity className="w-4 h-4" /> Nhận xét chung
          </h4>
          <p className="text-indigo-900 text-sm leading-relaxed">
            {result.generalFeedback}
          </p>
        </div>
      </div>
    </div>
  );
};