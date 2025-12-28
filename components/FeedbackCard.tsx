import React, { useState, useEffect } from 'react';
import {
  CheckCircle2, XCircle, Lightbulb, Sparkles, Zap,
  Volume2, MessageSquare, BookOpen, Layers, Target, ShieldCheck, Activity, Trophy,
  TrendingUp, ChevronRight, ArrowDown, Star, Search, AlertCircle, ThumbsUp, ThumbsDown,
  Users, Mic, ArrowRight, RefreshCw
} from 'lucide-react';
import { EvaluationResult } from '../types';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface FeedbackCardProps {
  result: EvaluationResult;
  exerciseType?: string;
  originalSentence?: string;
}

const ScoreCounter = ({ value }: { value: number }) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = value;
    const duration = 1200;
    let startTimestamp: number | null = null;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.floor(ease * (end - start) + start));
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };

    window.requestAnimationFrame(step);
  }, [value]);

  return <span>{displayValue}</span>;
};

// Animated word component with tooltip
const WordWithTooltip = ({
  segment,
  showCorrection = false
}: {
  segment: any;
  showCorrection?: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isCorrect = segment.status === 'correct';
  const isError = segment.status === 'error';
  const isExtra = segment.status === 'extra';
  const isMissing = segment.status === 'missing';

  const text = showCorrection
    ? (isCorrect ? segment.text : segment.correction)
    : segment.text;

  if (!text) return null;

  return (
    <motion.span
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative inline-block"
    >
      <span className={`text-lg font-semibold px-1.5 py-0.5 rounded-lg cursor-help transition-all duration-200
        ${showCorrection ? (
          isCorrect ? 'text-slate-800' :
            'bg-emerald-100 text-emerald-700 border border-emerald-200'
        ) : (
          isCorrect ? 'text-slate-800' :
            isExtra ? 'bg-amber-100/80 text-amber-600 line-through decoration-2' :
              isError ? 'bg-rose-100/80 text-rose-600 line-through decoration-2' :
                'text-slate-800'
        )}
        ${isHovered && !isCorrect ? 'ring-2 ring-indigo-300 ring-offset-1' : ''}
      `}>
        {text}
      </span>

      {/* Tooltip */}
      <AnimatePresence>
        {isHovered && !isCorrect && (segment.explanation || segment.errorType) && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 3 }}
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 z-50 pointer-events-none"
          >
            <div className="bg-slate-900 text-white p-3 rounded-xl shadow-xl text-xs relative">
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${isError ? 'bg-rose-500' :
                    isExtra ? 'bg-amber-500' :
                      'bg-emerald-500'
                  }`}>
                  {segment.errorType || (isExtra ? 'Thừa từ' : isMissing ? 'Thiếu từ' : 'Lỗi')}
                </span>
              </div>
              {segment.correction && !showCorrection && (
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-rose-300 line-through">{segment.text}</span>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                  <span className="text-emerald-300 font-bold">{segment.correction}</span>
                </div>
              )}
              <p className="text-slate-300 leading-relaxed">
                {segment.explanation || 'Xem giải thích bên dưới'}
              </p>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-900 rotate-45" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.span>
  );
};

export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  result, exerciseType, originalSentence
}) => {
  const isPass = result?.isPass ?? false;
  const [isTakeawayHovered, setIsTakeawayHovered] = useState(false);
  const isRoleplay = exerciseType === 'roleplay';
  const isDetective = exerciseType === 'detective';

  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    }
  };

  const getVerdictInfo = () => {
    const verdicts: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
      'Case Closed': { icon: <CheckCircle2 className="w-5 h-5" />, color: 'text-emerald-700', bg: 'bg-emerald-100', label: '🔍 Case Closed!' },
      'Good Lead': { icon: <ThumbsUp className="w-5 h-5" />, color: 'text-blue-700', bg: 'bg-blue-100', label: '👍 Good Lead' },
      'Wrong Suspect': { icon: <AlertCircle className="w-5 h-5" />, color: 'text-amber-700', bg: 'bg-amber-100', label: '❌ Wrong Suspect' },
      'Cold Case': { icon: <XCircle className="w-5 h-5" />, color: 'text-rose-700', bg: 'bg-rose-100', label: '🥶 Cold Case' },
    };
    return verdicts[result.verdict || ''] || verdicts['Cold Case'];
  };

  const getToneEmoji = () => {
    const toneMap: Record<string, string> = {
      'Aggressive': '😠', 'Blunt': '😐', 'Casual': '😊',
      'Neutral': '😐', 'Warm': '🤗', 'Polite': '😌',
      'Formal': '🎩', 'OverlyFormal': '🤖'
    };
    return toneMap[result.toneType || ''] || '😐';
  };

  const getScoreColor = () => {
    if (result.score >= 90) return 'from-emerald-400 to-teal-500';
    if (result.score >= 70) return 'from-blue-400 to-indigo-500';
    if (result.score >= 50) return 'from-amber-400 to-orange-500';
    return 'from-rose-400 to-pink-500';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="mt-6 rounded-[2rem] bg-white border border-slate-200/80 flex flex-col shadow-xl relative overflow-hidden"
    >
      {/* Background decoration */}
      <div className={`absolute inset-0 opacity-40 pointer-events-none bg-gradient-to-br ${isPass ? 'from-emerald-50 via-transparent to-transparent' : 'from-rose-50 via-transparent to-transparent'}`} />

      {/* ===== HEADER ===== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="px-6 py-5 flex items-center gap-4 border-b border-slate-100 relative"
      >
        {/* Score Circle */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br ${getScoreColor()} text-white`}
        >
          <span className="text-lg font-black"><ScoreCounter value={result.score} /></span>
        </motion.div>

        {/* Title & Status */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="flex-1">
          {isDetective ? (
            <>
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${getVerdictInfo().bg} ${getVerdictInfo().color}`}>
                {getVerdictInfo().icon}
                <span className="text-sm font-black">{getVerdictInfo().label}</span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {result.userCaughtError ? '✓ Phát hiện đúng lỗi!' : '→ Xem lỗi đúng bên dưới'}
              </p>
            </>
          ) : isRoleplay ? (
            <>
              <h3 className={`font-black text-lg ${isPass ? 'text-emerald-800' : 'text-rose-800'}`}>
                {isPass ? '🎤 Giao tiếp tốt!' : '🎤 Cần cải thiện'}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-base">{getToneEmoji()}</span>
                <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded ${isPass ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                  {result.toneType || 'Phân tích...'}
                </span>
              </div>
            </>
          ) : (
            <>
              <h3 className={`font-black text-lg ${isPass ? 'text-emerald-800' : 'text-rose-800'}`}>
                {isPass ? '🎯 Xuất sắc!' : '💪 Gần đúng rồi!'}
              </h3>
              <span className={`inline-flex text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded mt-0.5 ${isPass ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                {isPass ? '✓ Hoàn thành' : 'Xem sửa lỗi bên dưới'}
              </span>
            </>
          )}
        </motion.div>

        {/* Audio button */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => speakText(result.correction)}
          className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center hover:bg-indigo-200 transition-colors"
          title="Nghe phát âm"
        >
          <Volume2 className="w-5 h-5" />
        </motion.button>
      </motion.div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="px-6 py-5 space-y-5 relative">

        {/* ===== DETECTIVE MODE ===== */}
        {isDetective && (
          <div className="space-y-4">
            {result.originalError && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-rose-400 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Lỗi cần tìm</span>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl">
                  <span className="text-lg font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-lg">{result.originalError}</span>
                </div>
              </motion.div>
            )}

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-4 rounded-full ${result.userCaughtError ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Câu bạn sửa</span>
                {result.userCaughtError && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
              </div>
              <div className={`p-3 rounded-xl border ${result.userCaughtError ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex flex-wrap gap-1.5">
                  {(result.detailedAnalysis || []).map((segment, idx) => (
                    <WordWithTooltip key={idx} segment={segment} showCorrection={false} />
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Câu đúng</span>
              </div>
              <div className="p-3 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl">
                <p className="text-lg font-bold text-emerald-800">{result.correction}</p>
              </div>
            </motion.div>
          </div>
        )}

        {/* ===== ROLE-PLAY MODE ===== */}
        {isRoleplay && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-4 rounded-full ${isPass ? 'bg-slate-300' : 'bg-rose-400'}`} />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Bạn nói</span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[50px]">
                  <div className="flex flex-wrap gap-1">
                    {(result.detailedAnalysis || []).filter(s => s.status !== 'missing').map((segment, idx) => (
                      <WordWithTooltip key={idx} segment={segment} showCorrection={false} />
                    ))}
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Câu mẫu</span>
                </div>
                <div className="p-3 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl min-h-[50px]">
                  <p className="text-base font-bold text-emerald-800">{result.modelSentence || result.correction}</p>
                </div>
              </motion.div>
            </div>

            {result.suggestionPhrases && result.suggestionPhrases.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Cụm từ hay</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {result.suggestionPhrases.map((phrase, idx) => (
                    <motion.button
                      key={idx}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => speakText(phrase)}
                      className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg text-sm font-semibold text-purple-700 transition-all flex items-center gap-1.5"
                    >
                      <Mic className="w-3 h-3" />
                      {phrase}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {result.rolePlayMetrics && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-indigo-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Chỉ số</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: '🎯 Mục tiêu', val: result.rolePlayMetrics.taskAchievement || 0, color: 'bg-emerald-500' },
                    { label: '💬 Mạch lạc', val: result.rolePlayMetrics.coherence || 0, color: 'bg-blue-500' },
                    { label: '📚 Vốn từ', val: result.rolePlayMetrics.lexicalResource || 0, color: 'bg-purple-500' },
                    { label: '✏️ Ngữ pháp', val: result.rolePlayMetrics.grammar || 0, color: 'bg-indigo-500' },
                  ].map((item, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[9px] font-bold text-slate-500">
                        <span>{item.label}</span>
                        <span className="text-slate-700">{item.val}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${item.val}%` }}
                          transition={{ duration: 0.8, delay: 0.6 + idx * 0.1 }}
                          className={`h-full ${item.color} rounded-full`}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ===== TRANSLATION MODE ===== */}
        {!isDetective && !isRoleplay && (
          <div className="space-y-4">
            {/* Your Answer */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-4 rounded-full ${isPass ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Câu của bạn</span>
                <span className="text-[9px] text-slate-400 ml-auto">Hover vào từ để xem chi tiết</span>
              </div>
              <div className="flex flex-wrap gap-x-0.5 gap-y-2 py-3 px-3 bg-slate-50/80 rounded-xl border border-slate-100">
                {(result.detailedAnalysis || []).filter(s => s.status !== 'missing').map((segment, idx) => (
                  <WordWithTooltip key={idx} segment={segment} showCorrection={false} />
                ))}
              </div>
            </motion.div>

            {/* Arrow */}
            <div className="flex justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center"
              >
                <ArrowDown className="w-4 h-4 text-indigo-400" />
              </motion.div>
            </div>

            {/* Correct Version */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-4 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Câu chuẩn</span>
              </div>
              <div className="flex flex-wrap gap-x-0.5 gap-y-2 py-3 px-3 bg-gradient-to-br from-emerald-50/80 to-white border border-emerald-100 rounded-xl">
                {(result.detailedAnalysis || []).filter(s => s.status !== 'extra').map((segment, idx) => (
                  <WordWithTooltip key={idx} segment={segment} showCorrection={true} />
                ))}
              </div>
            </motion.div>

            {/* Explanation Card - Always visible */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="p-4 bg-indigo-50/80 border border-indigo-100 rounded-xl">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider block mb-1">📝 Giải thích</span>
                  <div className="text-sm text-slate-700 leading-relaxed">
                    <ReactMarkdown>{result.explanation}</ReactMarkdown>
                  </div>
                  {result.keyTakeaway && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-amber-700">{result.keyTakeaway}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* Improved Version */}
            {result.improvedVersion && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Câu nâng cao</span>
                  <button onClick={() => speakText(result.improvedVersion || '')} className="ml-auto p-1.5 text-purple-400 hover:text-purple-600 rounded-lg transition-all">
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-3 bg-gradient-to-br from-purple-50 to-white border border-purple-100 rounded-xl">
                  <p className="text-base font-semibold text-purple-800">{result.improvedVersion}</p>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* Explanation for Detective & Roleplay */}
        {(isDetective || isRoleplay) && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="p-4 bg-indigo-50/80 border border-indigo-100 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                {isDetective ? <Search className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <span className="text-[9px] font-black text-indigo-600 uppercase tracking-wider block mb-1">
                  {isDetective ? '🔍 Detective\'s Log' : '📝 Phân tích'}
                </span>
                <div className="text-sm text-slate-700 leading-relaxed">
                  <ReactMarkdown>{result.explanation}</ReactMarkdown>
                </div>
                {result.keyTakeaway && (
                  <div className="mt-3 p-2 bg-amber-50 border border-amber-100 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <span className="text-xs font-bold text-amber-700">{result.keyTakeaway}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ===== FOOTER ===== */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="px-6 pb-5">
        <div className={`flex items-center gap-3 p-4 rounded-xl text-white relative overflow-hidden ${isPass
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
          : 'bg-gradient-to-r from-indigo-500 to-purple-500'}`}
        >
          <div className="absolute -right-4 -top-4 opacity-10">
            <Star className="w-16 h-16" />
          </div>
          <div className="p-2 bg-white/20 rounded-lg">
            {isPass ? <Trophy className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
          </div>
          <div className="relative z-10">
            <h4 className="font-bold text-sm">{isPass ? 'Tuyệt vời! 🎉' : 'Tiến bộ mỗi ngày!'}</h4>
            <p className="text-xs text-white/80">{isPass ? 'Ghi nhớ bài học này nhé!' : 'Xem lại giải thích và thử lại!'}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};