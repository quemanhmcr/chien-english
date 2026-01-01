import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Loader2, RefreshCw, Trophy, Settings, Flag, ArrowRight, Book, Star,
  ChevronLeft, LogOut, Search, Filter, TrendingUp, CheckCircle2,
  Clock, Award, Sparkles, ChevronRight, MessageSquare, Lightbulb, Zap, Flame
} from 'lucide-react';
import { AppState, EvaluationResult, Lesson, UserProfile as UserProfileType, UserProgress } from '../types';
import { evaluateExercise } from '../services/mimoService';

import { ProgressBar } from './ProgressBar';
import { FeedbackCard } from './FeedbackCard';
import { FeedbackSkeleton } from './FeedbackSkeleton';
import { useToast } from './Toast';
import { signOut } from '../services/authService';
import { saveProgress, saveExerciseProgress } from '../services/lessonService';

// Helper for development-only logging
const devLog = (...args: any[]) => {
  if (import.meta.env.DEV) console.log(...args);
};

interface LearnerViewProps {
  lessons: Lesson[];
  onOpenAdmin: () => void;
  userProfile: UserProfileType | null;
  onOpenProfile: () => void;
  userProgress: UserProgress[];
  exerciseProgress: any[];
  onRefreshData: () => void;
}

export const LearnerView: React.FC<LearnerViewProps> = ({
  lessons, onOpenAdmin, userProfile, onOpenProfile, userProgress, exerciseProgress, onRefreshData
}) => {
  const { showToast } = useToast();
  // Navigation State
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('All');

  // Exercise State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [feedback, setFeedback] = useState<EvaluationResult | null>(null);
  const [sessionScore, setSessionScore] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('AI is investigating...');

  // Ghost Pipeline State - Instant feedback with Material Motion 3
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [isSkeletonExiting, setIsSkeletonExiting] = useState(false);

  // M3 Timing Constants
  const SKELETON_MIN_DURATION = 400; // ms - minimum skeleton display time
  const CROSSFADE_DURATION = 150; // ms - crossfade animation time
  const SCROLL_DELAY = 50; // ms - delay scroll after content visible
  const skeletonStartTimeRef = useRef<number>(0);

  const LOADING_MESSAGES = [
    "Analyzing grammar structure...",
    "Checking vocabulary usage...",
    "Detecting 'Vietlish' patterns...",
    "Measuring social tone...",
    "Formulating pedagogical feedback..."
  ];

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const skeletonRef = useRef<HTMLDivElement>(null);

  // Filtered lessons
  const filteredLessons = useMemo(() => {
    return lessons.filter(l => {
      const matchesSearch = l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = levelFilter === 'All' || l.level === levelFilter;
      return matchesSearch && matchesFilter;
    });
  }, [lessons, searchTerm, levelFilter]);

  // Lesson stats
  const completedCount = useMemo(() => {
    const uniqueLessons = new Set(userProgress.map(p => p.lesson_id));
    return uniqueLessons.size;
  }, [userProgress]);

  const avgScore = useMemo(() => {
    if (userProgress.length === 0) return 0;
    const total = userProgress.reduce((acc, curr) => acc + curr.score, 0);
    return Math.round(total / userProgress.length);
  }, [userProgress]);

  // Reset state and handle auto-resume when entering a lesson
  useEffect(() => {
    if (selectedLesson) {
      // Determine where the user left off
      const lessonExercises = selectedLesson.exercises;
      const completedIds = new Set(exerciseProgress.map(p => p.exercise_id));

      let firstIncompleteIndex = 0;
      for (let i = 0; i < lessonExercises.length; i++) {
        if (completedIds.has(lessonExercises[i].id)) {
          firstIncompleteIndex = i + 1;
        } else {
          break;
        }
      }

      // If they finished all, start from the beginning or stay at last? 
      // Let's start from start if finished, otherwise resume.
      setCurrentIndex(firstIncompleteIndex < lessonExercises.length ? firstIncompleteIndex : 0);
      setUserInput('');
      setFeedback(null);
      setAppState(AppState.IDLE);
      setSessionScore(0);
      setShowSkeleton(false);
      setIsSkeletonExiting(false);

    }
  }, [selectedLesson, exerciseProgress]);

  const currentExercise = selectedLesson ? selectedLesson.exercises[currentIndex] : null;
  const isLastQuestion = selectedLesson ? currentIndex === selectedLesson.exercises.length - 1 : false;

  useEffect(() => {
    if (appState === AppState.IDLE && inputRef.current) {
      inputRef.current.focus();
    }
  }, [appState, currentIndex]);

  // Auto-scroll removed - now handled manually with proper M3 timing

  /**
   * Performs M3-compliant crossfade from skeleton to content.
   * Ensures minimum display time and smooth visual transition.
   */
  const performCrossfadeTransition = (finalResult: EvaluationResult, msgInterval: NodeJS.Timeout) => {
    const elapsed = Date.now() - skeletonStartTimeRef.current;
    const remaining = Math.max(0, SKELETON_MIN_DURATION - elapsed);

    // Wait for minimum duration, then start crossfade
    setTimeout(() => {
      // Start exit animation
      setIsSkeletonExiting(true);

      // After exit animation completes, show content
      setTimeout(() => {
        setShowSkeleton(false);
        setIsSkeletonExiting(false);
        setAppState(AppState.FEEDBACK);
        clearInterval(msgInterval);

        // Delayed scroll for cognitive comfort
        setTimeout(() => {
          feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, SCROLL_DELAY);
      }, CROSSFADE_DURATION);
    }, remaining);
  };

  const handleCheck = async () => {
    if (!userInput.trim() || !currentExercise) return;

    // ========== GHOST PIPELINE (Material Motion 3) ==========
    // L1: Instant skeleton (0ms) - Show visual feedback immediately
    skeletonStartTimeRef.current = Date.now();
    setShowSkeleton(true);
    setIsSkeletonExiting(false);
    setAppState(AppState.EVALUATING);

    // Scroll to skeleton immediately for user focus
    setTimeout(() => {
      skeletonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);



    // L3: API streaming - Full AI analysis
    // Cycle loading messages (for fallback if skeleton hides)
    let msgIdx = 0;
    let hasTransitioned = false;
    setLoadingMessage(LOADING_MESSAGES[0]);
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[msgIdx]);
    }, 1200);

    try {
      const result = await evaluateExercise(
        currentExercise.vietnamese,
        userInput,
        currentExercise.type || 'translation',
        (partial) => {
          setFeedback(partial);
          // Start M3 crossfade once AI has meaningful analysis
          if (!hasTransitioned && partial.detailedAnalysis && partial.detailedAnalysis.length > 0) {
            hasTransitioned = true;
            performCrossfadeTransition(partial, msgInterval);
          }
        }
      );

      setFeedback(result);
      setSessionScore(prev => prev + result.score);

      // If streaming didn't trigger transition, do it now
      if (!hasTransitioned) {
        performCrossfadeTransition(result, msgInterval);
      }
    } catch (error) {
      console.error(error);
      setShowSkeleton(false);
      setIsSkeletonExiting(false);
      setAppState(AppState.ERROR);
      clearInterval(msgInterval);
    }
  };


  const finishQuestion = () => {
    // OPTIMISTIC UI: Update state FIRST for instant response, save to DB in background
    const exerciseToSave = currentExercise;
    const scoreToSave = feedback?.score || 0;

    if (isLastQuestion) {
      setAppState(AppState.COMPLETED);

      // Background save for lesson completion
      if (userProfile && selectedLesson) {
        const finalScore = selectedLesson.exercises.length > 0
          ? Math.round(sessionScore / selectedLesson.exercises.length)
          : 0;

        devLog('[SAVE] Lesson completion:', {
          userId: userProfile.id,
          lessonId: selectedLesson.id,
          finalScore,
          sessionScore,
          exerciseCount: selectedLesson.exercises.length
        });

        Promise.all([
          feedback ? saveExerciseProgress(userProfile.id, exerciseToSave!.id, scoreToSave) : Promise.resolve(),
          saveProgress(userProfile.id, selectedLesson.id, finalScore)
        ]).then(() => {
          devLog('[SAVE] Success! Refreshing data...');
          showToast('Chúc mừng! Bạn đã hoàn thành bài học! 🎉', 'success');
          onRefreshData();
        }).catch(e => {
          console.error('[SAVE] Failed to save progress:', e);
          showToast('Không thể lưu tiến độ. Vui lòng kiểm tra kết nối.', 'error');
        });
      }
    } else {
      // Update UI immediately
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setFeedback(null);
      setAppState(AppState.IDLE);

      if (userProfile && exerciseToSave && feedback) {
        saveExerciseProgress(userProfile.id, exerciseToSave.id, scoreToSave)
          .catch(e => {
            console.error('Failed to save step progress:', e);
            showToast('Không thể lưu tiến độ bài tập.', 'warning');
          });
      }
    }
  };

  const handleBackToMenu = () => {
    setSelectedLesson(null);
    setAppState(AppState.IDLE);
    onRefreshData(); // Refresh to show latest step-by-step progress
  };

  const handleSignOut = async () => {
    await signOut();
    showToast('Đã đăng xuất thành công', 'info', 2000);
  };

  // --- RENDER: LESSON MENU ---
  if (!selectedLesson) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">
        <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-indigo-50 rounded-xl p-2.5">
                <Flag className="w-5 h-5 text-indigo-600" />
              </div>
              <div className="hidden sm:block">
                <h1 className="font-heading font-bold text-xl text-slate-900 tracking-tight">Chien <span className="text-indigo-600">English</span></h1>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Learning Platform</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {userProfile?.role === 'admin' && (
                <button
                  onClick={onOpenAdmin}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors duration-fast text-sm"
                >
                  <Settings className="w-4 h-4" />
                  <span>Admin Panel</span>
                </button>
              )}

              <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>

              <div className="flex items-center gap-2">
                {/* Gamification Stats (Desktop) */}
                <div className="hidden md:flex items-center gap-3 mr-2">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 text-rose-500 rounded-xl border border-rose-100 font-bold text-xs animate-in fade-in zoom-in" title="Daily Streak">
                    <Flame className="w-3.5 h-3.5 fill-current" />
                    <span>{userProfile?.streak_current || 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 font-bold text-xs animate-in fade-in zoom-in delay-100" title="Total XP">
                    <Zap className="w-3.5 h-3.5 fill-current" />
                    <span>{userProfile?.xp || 0} XP</span>
                  </div>
                </div>

                <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>

                <button
                  onClick={onOpenProfile}
                  className="flex items-center gap-3 hover:bg-slate-50 p-1.5 pr-4 rounded-2xl transition-all border border-transparent hover:border-slate-200"
                >
                  <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm relative">
                    {userProfile?.full_name?.charAt(0).toUpperCase()}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center text-[8px] font-black text-white border-2 border-white" title="Level">
                      {userProfile?.level || 1}
                    </div>
                  </div>
                  <div className="text-left hidden md:block">
                    <p className="text-xs font-black text-slate-900">{userProfile?.full_name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Lvl {userProfile?.level || 1} Student</p>
                  </div>
                </button>
                <button
                  onClick={handleSignOut}
                  className="p-2.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors duration-fast"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6 md:p-10">
          {/* Welcome Section - M3 Clean */}
          <div className="mb-10 flex flex-col lg:flex-row gap-6 items-start lg:items-stretch">
            <div className="flex-1 bg-white rounded-2xl p-8 border border-slate-100">
              <p className="text-xs font-medium text-slate-400 mb-4 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5" /> Tổng quan
              </p>
              <h2 className="text-2xl font-semibold text-slate-800 mb-2">
                Chào mừng trở lại, {userProfile?.full_name ? userProfile.full_name.split(' ')[0] : 'bạn'}!
              </h2>
              <p className="text-slate-500 text-sm mb-6 max-w-lg leading-relaxed">
                Bạn đã hoàn thành <span className="text-indigo-600 font-semibold">{completedCount}</span> bài học. Tiếp tục duy trì phong độ nhé!
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Hoàn thành
                  </p>
                  <p className="text-xl font-semibold text-slate-800">{completedCount} <span className="text-sm text-slate-400 font-normal">bài</span></p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                    <Award className="w-3 h-3 text-amber-500" /> Điểm TB
                  </p>
                  <p className="text-xl font-semibold text-slate-800">{avgScore}%</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl col-span-2 sm:col-span-1">
                  <p className="text-xs font-medium text-slate-400 mb-1 flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-indigo-500" /> Tiến độ
                  </p>
                  <p className="text-xl font-semibold text-slate-800">{completedCount} <span className="text-sm text-slate-400 font-normal">/ {lessons.length}</span></p>
                </div>
              </div>
            </div>

            {/* Weekly Challenge - M3 Clean */}
            <div className="w-full lg:w-72 bg-indigo-600 rounded-2xl p-6 text-white flex flex-col justify-between">
              {(() => {
                const intermediateLessons = lessons.filter(l => l.level === 'Intermediate');
                const completedIntermediate = intermediateLessons.filter(l =>
                  userProgress.some(p => p.lesson_id === l.id)
                ).length;
                const targetCount = Math.min(5, intermediateLessons.length);
                const progressPct = targetCount > 0 ? Math.round((completedIntermediate / targetCount) * 100) : 0;
                const clampedPct = Math.min(100, progressPct);

                return (
                  <>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">Thử thách tuần</h3>
                      <p className="text-indigo-100 text-sm leading-relaxed">
                        {intermediateLessons.length > 0
                          ? `Hoàn thành ${targetCount} bài Intermediate để nhận huy hiệu.`
                          : 'Hoàn thành các bài học để mở khoá!'}
                      </p>
                    </div>
                    <div className="mt-6">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-medium text-indigo-200">Tiến độ</span>
                        <span className="text-sm font-semibold">{clampedPct}%</span>
                      </div>
                      <div className="h-2 bg-indigo-900/50 rounded-full overflow-hidden">
                        <div className="h-full bg-white rounded-full transition-all duration-500" style={{ width: `${clampedPct}%` }}></div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>

          {/* Lesson Filter - M3 Clean */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <h3 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              Bài học <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-lg text-xs font-medium">{filteredLessons.length}</span>
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-sm w-full sm:w-56 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all"
                />
              </div>
              <div className="flex bg-white p-1 rounded-xl border border-slate-200">
                {['All', 'Beginner', 'Intermediate', 'Hard'].map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setLevelFilter(lvl)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${levelFilter === lvl ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  >
                    {lvl === 'All' ? 'Tất cả' : lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lesson Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLessons.length === 0 ? (
              <div className="col-span-full py-16 bg-white rounded-2xl border border-slate-100 text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Book className="w-8 h-8 text-slate-300" />
                </div>
                <h4 className="text-xl font-black text-slate-800 mb-2">Không tìm thấy bài học nào</h4>
                <p className="text-slate-400 max-w-xs mx-auto text-sm font-medium mb-6">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc độ khó để tìm thấy nhiều nội dung hơn.</p>
                <button
                  onClick={() => { setSearchTerm(''); setLevelFilter('All'); onRefreshData(); }}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all active:scale-95"
                >
                  Làm mới danh sách
                </button>
              </div>
            ) : (
              filteredLessons.map((lesson) => {
                const isCompleted = userProgress.some(p => p.lesson_id === lesson.id);
                const bestScore = Math.max(...userProgress.filter(p => p.lesson_id === lesson.id).map(p => p.score), 0);

                const completedSteps = exerciseProgress.filter(ep =>
                  lesson.exercises.some(ex => ex.id === ep.exercise_id)
                ).length;
                const totalSteps = lesson.exercises.length;
                const isPartial = completedSteps > 0 && completedSteps < totalSteps;

                return (
                  <div
                    key={lesson.id}
                    onClick={() => setSelectedLesson(lesson)}
                    className={`bg-white rounded-xl p-6 border hover:border-indigo-300 hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer group flex flex-col h-full ${isCompleted ? 'border-emerald-100' : isPartial ? 'border-amber-100' : 'border-slate-100'}`}
                  >
                    <div className="mb-4 flex-1">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-50 text-emerald-600' : isPartial ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white'}`}>
                          {isCompleted ? <Trophy className="w-5 h-5" /> : isPartial ? <TrendingUp className="w-5 h-5" /> : <Book className="w-5 h-5" />}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${lesson.level === 'Beginner' ? 'bg-emerald-50 text-emerald-600' :
                            lesson.level === 'Intermediate' ? 'bg-indigo-50 text-indigo-600' :
                              'bg-rose-50 text-rose-600'
                            }`}>
                            {lesson.level}
                          </span>
                          {isPartial && (
                            <span className="text-xs text-amber-500 font-medium">
                              {completedSteps}/{totalSteps}
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-lg font-semibold text-slate-800 leading-snug mb-2 group-hover:text-indigo-600 transition-colors">
                        {lesson.title}
                      </h3>
                      <p className="text-slate-500 text-sm leading-relaxed line-clamp-2">
                        {lesson.description}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-50">
                      <div className="flex items-center justify-between mb-3">
                        <span className="flex items-center gap-1.5 text-slate-400 text-xs">
                          <Clock className="w-3.5 h-3.5" /> ~15 phút
                        </span>
                        {isCompleted ? (
                          <span className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
                            <Star className="w-4 h-4 fill-current" /> {bestScore}%
                          </span>
                        ) : isPartial ? (
                          <span className="text-amber-500 text-xs font-medium">Tiếp tục</span>
                        ) : (
                          <span className="text-slate-400 text-xs">Mới</span>
                        )}
                      </div>

                      <button className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-medium transition-all text-sm ${isCompleted ? 'bg-slate-50 text-slate-600 hover:bg-emerald-50 hover:text-emerald-700' : isPartial ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-900 text-white hover:bg-indigo-600'}`}>
                        {isCompleted ? 'Ôn tập' : isPartial ? 'Tiếp tục' : 'Bắt đầu'}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </main>
      </div>
    );
  }

  // --- RENDER: EXERCISE FLOW ---

  if (appState === AppState.COMPLETED) {
    const finalScore = selectedLesson.exercises.length > 0
      ? Math.round(sessionScore / selectedLesson.exercises.length)
      : 0;
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 overflow-hidden relative">
        {/* Background Sparkles */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px] animate-pulse delay-700"></div>

        <div className="bg-white rounded-[3rem] shadow-2xl p-12 max-w-lg w-full text-center space-y-10 animate-slide-up border border-slate-100 relative z-10">
          <div className="relative inline-block">
            <div className="w-40 h-40 bg-gradient-to-br from-yellow-400 to-amber-600 rounded-[2.5rem] flex items-center justify-center mx-auto rotate-12 group hover:rotate-0 transition-transform duration-700 shadow-2xl shadow-amber-200">
              <Trophy className="w-20 h-20 text-white drop-shadow-lg" />
            </div>
            <div className="absolute -bottom-4 -right-4 bg-indigo-600 text-white w-20 h-20 rounded-full border-8 border-white shadow-xl flex flex-col items-center justify-center leading-none">
              <span className="text-xl font-black">{finalScore}%</span>
              <span className="text-[10px] font-bold uppercase">Score</span>
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-heading font-black text-slate-900 mb-4 tracking-tight">Mission Accomplished!</h1>
            <p className="text-slate-500 font-medium text-lg leading-relaxed mb-4">Bạn đã xuất sắc hoàn thành bài học:<br /><span className="text-indigo-600 font-black px-2">{selectedLesson.title}</span></p>

            <div className="flex items-center justify-center gap-1.5">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} className={`w-6 h-6 ${s <= Math.round(finalScore / 20) ? 'text-amber-400 fill-current' : 'text-slate-100'}`} />
              ))}
            </div>
          </div>
          <button
            onClick={handleBackToMenu}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-heading font-black py-6 rounded-[2rem] flex items-center justify-center gap-3 shadow-2xl shadow-slate-200 transition-all active:scale-95 group"
          >
            <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-700" /> VỀ TRANG CHỦ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <header className="bg-white border-b border-slate-100 px-6 py-5 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <button onClick={handleBackToMenu} className="p-3 -ml-3 text-slate-400 hover:bg-slate-50 hover:text-slate-900 rounded-[1.25rem] transition-all group flex items-center gap-2">
            <ChevronLeft className="w-7 h-7 group-active:-translate-x-1 transition-transform" />
            <span className="font-black text-xs uppercase tracking-widest hidden sm:inline">Quay lại</span>
          </button>

          <div className="flex flex-col items-center flex-1 max-w-[50%]">
            <h2 className="text-base font-black text-slate-900 truncate w-full text-center">{selectedLesson.title}</h2>
            <div className="flex items-center gap-3 mt-1 cursor-default">
              <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] bg-indigo-50 px-3 py-1 rounded-full">Section {currentIndex + 1} of {selectedLesson.exercises.length}</span>
            </div>
          </div>

          <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center font-black text-indigo-600 shadow-inner border border-slate-100">
            {Math.round(((currentIndex + 1) / selectedLesson.exercises.length) * 100)}%
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-6 sm:p-12 pb-40">
        <div className="mb-14">
          <ProgressBar current={currentIndex} total={selectedLesson.exercises.length} />
        </div>

        {currentExercise && (
          <div className="space-y-8 animate-fade-in">
            {/* Question Card - Clean, minimal */}
            <div className="bg-white rounded-2xl p-8 border border-slate-100 relative">
              {/* Subtle type indicators */}
              <div className="flex items-center gap-2 mb-6">
                <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium
                  ${currentExercise.difficulty === 'Easy' ? 'bg-emerald-50 text-emerald-600' :
                    currentExercise.difficulty === 'Medium' ? 'bg-amber-50 text-amber-600' :
                      'bg-rose-50 text-rose-600'}`}>
                  {currentExercise.difficulty}
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-50 text-slate-500">
                  {currentExercise.type === 'translation' && <Book className="w-3.5 h-3.5" />}
                  {currentExercise.type === 'roleplay' && <MessageSquare className="w-3.5 h-3.5" />}
                  {currentExercise.type === 'detective' && <Search className="w-3.5 h-3.5" />}
                  {currentExercise.type === 'translation' ? 'Dịch câu' :
                    currentExercise.type === 'roleplay' ? 'Đóng vai' : 'Sửa lỗi'}
                </span>
              </div>

              {/* Context label for special types */}
              {currentExercise.type === 'roleplay' && (
                <p className="text-xs font-medium text-slate-400 mb-2">Tình huống & Mục tiêu</p>
              )}
              {currentExercise.type === 'detective' && (
                <p className="text-xs font-medium text-slate-400 mb-2">Tìm và sửa lỗi sai</p>
              )}

              {/* Question text - comfortable reading size */}
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-800 leading-relaxed">
                {currentExercise.vietnamese}
              </h2>

              {/* Hint - subtle, inline */}
              {currentExercise.hint && (
                <div className="mt-6 flex items-start gap-3 text-slate-500 text-sm">
                  <Lightbulb className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="leading-relaxed">{currentExercise.hint}</p>
                </div>
              )}
            </div>

            {/* Response Area */}
            <div className="relative" ref={skeletonRef}>
              {/* Ghost Pipeline: Instant Skeleton with M3 Crossfade */}
              {showSkeleton && appState === AppState.EVALUATING && (
                <FeedbackSkeleton isExiting={isSkeletonExiting} />
              )}

              {/* Fallback loader - professional styling */}
              {!showSkeleton && appState === AppState.EVALUATING && (!feedback || !feedback.detailedAnalysis || feedback.detailedAnalysis.length === 0) && (
                <div className="w-full py-12 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
                  <p className="text-slate-400 text-sm font-medium">{loadingMessage}</p>
                </div>
              )}

              {/* Error State - professional */}
              {appState === AppState.ERROR && (
                <div className="w-full py-12 bg-rose-50 rounded-2xl border border-rose-100 flex flex-col items-center justify-center gap-4 text-center px-8">
                  <div className="w-12 h-12 bg-white rounded-xl border border-rose-100 flex items-center justify-center text-rose-400">
                    <Flag className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-rose-800 mb-1">Không thể kết nối</h3>
                    <p className="text-rose-500 text-sm">Có lỗi xảy ra. Vui lòng thử lại.</p>
                  </div>
                </div>
              )}

              {/* Feedback spacer */}
              {appState === AppState.FEEDBACK && feedback && (
                <div className="w-full h-1" />
              )}

              {/* Text Input - subtle, clean */}
              {appState === AppState.IDLE && (
                <textarea
                  ref={inputRef}
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  disabled={appState !== AppState.IDLE}
                  placeholder={
                    currentExercise.type === 'roleplay'
                      ? "Nhập câu trả lời của bạn..."
                      : currentExercise.type === 'detective'
                        ? "Nhập câu đã sửa..."
                        : "Dịch sang tiếng Anh..."
                  }
                  spellCheck={false}
                  className="w-full h-32 p-6 text-lg font-medium bg-white border-2 border-slate-100 rounded-2xl transition-all duration-200 resize-none outline-none placeholder:text-slate-300 text-slate-800 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (appState === AppState.IDLE) handleCheck();
                    }
                  }}
                />
              )}
            </div>

            {appState === AppState.FEEDBACK && feedback && (
              <div ref={feedbackRef} className="animate-slide-up-slight relative">
                {/* XP Gained Animation */}
                {(feedback.score >= 70 || feedback.isPass) && (
                  <div className="absolute -top-6 right-4 sm:-top-12 sm:right-0 bg-yellow-400 text-yellow-900 font-black px-4 py-2 rounded-full shadow-lg animate-bounce flex items-center gap-2 border-2 border-white z-20">
                    <Zap className="w-4 h-4 fill-current" /> +10 XP
                  </div>
                )}

                <FeedbackCard
                  result={feedback}
                  exerciseType={currentExercise.type}
                  originalSentence={currentExercise.vietnamese}
                />
              </div>
            )}

            {/* Physical Spacer tuned for optimal max-scroll depth */}
            <div className="h-24 pointer-events-none" />
          </div>
        )}
      </main>

      {/* Floating Pill Bottom Bar - Positioned closer to bottom */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-6 z-50">
        <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/60 p-5 rounded-[2.5rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] ring-1 ring-slate-950/5">
          <div className="flex gap-4">
            {appState === AppState.FEEDBACK && (() => {
              // PASS = score >= 70 OR AI marked as pass
              const isPassingScore = (feedback?.score ?? 0) >= 70 || feedback?.isPass;

              return isPassingScore ? (
                <>
                  <button
                    onClick={() => { setAppState(AppState.IDLE); setFeedback(null); setUserInput(''); }}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold py-5 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-[10px] border border-slate-200"
                  >
                    Xem lại
                  </button>
                  <button
                    onClick={finishQuestion}
                    className="flex-1 h-16 flex items-center justify-center gap-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl transition-all shadow-[0_8px_0_0_#059669] active:shadow-none active:translate-y-2 uppercase tracking-widest text-xs"
                  >
                    {isLastQuestion ? 'Hoàn thành' : 'Tiếp theo'} <ArrowRight className="w-5 h-5" />
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => { setAppState(AppState.IDLE); setFeedback(null); setUserInput(''); }}
                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold py-5 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-[10px] shadow-md"
                  >
                    Thử lại
                  </button>
                  <button
                    onClick={finishQuestion}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold py-5 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-[10px]"
                  >
                    Bỏ qua (+{feedback?.score || 0} điểm)
                  </button>
                </>
              );
            })()}
            {appState === AppState.ERROR && (
              <button
                onClick={() => { setAppState(AppState.IDLE); handleCheck(); }}
                className="w-full h-16 bg-rose-600 hover:bg-rose-700 text-white font-black py-5 rounded-2xl transition-all shadow-[0_8px_0_0_#be123c] active:shadow-none active:translate-y-2 flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-xs"
              >
                <RefreshCw className="w-5 h-5" /> Retry Investigation
              </button>
            )}
            {(appState === AppState.IDLE || appState === AppState.EVALUATING) && (
              <button
                onClick={handleCheck}
                disabled={!userInput.trim() || appState === AppState.EVALUATING}
                className="w-full h-16 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-50 disabled:text-slate-200 text-white font-black py-5 rounded-2xl transition-all shadow-[0_8px_0_0_#1e293b] active:shadow-none active:translate-y-2 flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-xs"
              >
                {appState === AppState.EVALUATING ? <><Loader2 className="w-5 h-5 animate-spin" /> Analyzing...</> : 'Check Accuracy'} <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div >
  );
};