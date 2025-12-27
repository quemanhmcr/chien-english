import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Loader2, RefreshCw, Trophy, Settings, Flag, ArrowRight, Book, Star,
  ChevronLeft, LogOut, Search, Filter, TrendingUp, CheckCircle2,
  Clock, Award, Sparkles, ChevronRight, MessageSquare
} from 'lucide-react';
import { AppState, EvaluationResult, Lesson, UserProfile as UserProfileType, UserProgress } from '../types';
import { evaluateExercise } from '../services/mimoService';
import { ProgressBar } from './ProgressBar';
import { FeedbackCard } from './FeedbackCard';
import { signOut } from '../services/authService';
import { saveProgress, saveExerciseProgress } from '../services/lessonService';

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

  const inputRef = useRef<HTMLTextAreaElement>(null);

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
    }
  }, [selectedLesson, exerciseProgress]);

  const currentExercise = selectedLesson ? selectedLesson.exercises[currentIndex] : null;
  const isLastQuestion = selectedLesson ? currentIndex === selectedLesson.exercises.length - 1 : false;

  useEffect(() => {
    if (appState === AppState.IDLE && inputRef.current) {
      inputRef.current.focus();
    }
  }, [appState, currentIndex]);

  const handleCheck = async () => {
    if (!userInput.trim() || !currentExercise) return;

    setAppState(AppState.EVALUATING);

    try {
      const result = await evaluateExercise(
        currentExercise.vietnamese,
        userInput,
        currentExercise.type || 'translation',
        (partial) => {
          setFeedback(partial);
          setAppState(AppState.FEEDBACK);
        }
      );
      setFeedback(result);
      if (result.isPass) {
        setSessionScore(prev => prev + result.score);
      }
      setAppState(AppState.FEEDBACK);
    } catch (error) {
      console.error(error);
      setAppState(AppState.ERROR);
    }
  };

  const finishQuestion = async () => {
    // Save current step progress before moving
    if (userProfile && currentExercise) {
      try {
        await saveExerciseProgress(userProfile.id, currentExercise.id, feedback?.score || 0);
        // We don't call onRefreshData here to avoid re-rendering the whole app on every step 
        // unless you want the menu to update in background.
      } catch (e) {
        console.error('Failed to save step progress', e);
      }
    }

    if (isLastQuestion) {
      setAppState(AppState.COMPLETED);
      // Save lesson completion progress to DB
      if (userProfile && selectedLesson) {
        const finalScore = Math.round((sessionScore + (feedback?.score || 0)) / selectedLesson.exercises.length);
        try {
          await saveProgress(userProfile.id, selectedLesson.id, finalScore);
          onRefreshData();
        } catch (e) {
          console.error('Failed to save progress', e);
        }
      }
    } else {
      setCurrentIndex(prev => prev + 1);
      setUserInput('');
      setFeedback(null);
      setAppState(AppState.IDLE);
    }
  };

  const handleBackToMenu = () => {
    setSelectedLesson(null);
    setAppState(AppState.IDLE);
    onRefreshData(); // Refresh to show latest step-by-step progress
  };

  const handleSignOut = async () => {
    if (confirm('Bạn có muốn đăng xuất không?')) {
      await signOut();
    }
  };

  // --- RENDER: LESSON MENU ---
  if (!selectedLesson) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] font-sans pb-20">
        <header className="bg-white/70 backdrop-blur-2xl border-b border-slate-200/60 px-6 py-4 sticky top-0 z-40">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative bg-white rounded-2xl p-2.5 shadow-sm border border-slate-100">
                  <Flag className="w-6 h-6 text-indigo-600 fill-current" />
                </div>
              </div>
              <div className="hidden sm:block">
                <h1 className="font-heading font-black text-2xl text-slate-900 tracking-tight">EngPractice <span className="text-indigo-600">Pro</span></h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Learning Management System</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {userProfile?.role === 'admin' && (
                <button
                  onClick={onOpenAdmin}
                  className="group flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-bold transition-all text-sm shadow-xl shadow-slate-200"
                >
                  <Settings className="w-4 h-4 group-hover:rotate-90 transition-transform duration-500" />
                  <span>Admin Panel</span>
                </button>
              )}

              <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden sm:block"></div>

              <div className="flex items-center gap-2">
                <button
                  onClick={onOpenProfile}
                  className="flex items-center gap-3 hover:bg-slate-50 p-1.5 pr-4 rounded-2xl transition-all border border-transparent hover:border-slate-200"
                >
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-indigo-100">
                    {userProfile?.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left hidden md:block">
                    <p className="text-xs font-black text-slate-900">{userProfile?.full_name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{userProfile?.role}</p>
                  </div>
                </button>
                <button
                  onClick={handleSignOut}
                  className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6 md:p-10">
          {/* Welcome Section */}
          <div className="mb-12 flex flex-col lg:flex-row gap-8 items-start lg:items-stretch">
            <div className="flex-1 bg-white rounded-[2.5rem] p-10 border border-slate-200/60 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] group-hover:opacity-[0.07] transition-all duration-700 -rotate-12 group-hover:rotate-0 translate-x-10 group-hover:translate-x-0">
                <Sparkles className="w-64 h-64" />
              </div>
              <div className="relative z-10">
                <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-black uppercase tracking-widest mb-6">
                  <TrendingUp className="w-3.5 h-3.5" /> Stats Overview
                </span>
                <h2 className="text-4xl font-heading font-black text-slate-900 mb-4 tracking-tight">
                  Chào mừng trở lại, {userProfile?.full_name ? userProfile.full_name.split(' ')[0] : 'bạn'}!
                </h2>
                <p className="text-lg text-slate-500 font-medium mb-8 max-w-lg leading-relaxed">Bạn đã hoàn thành <span className="text-indigo-600 font-black">{completedCount}</span> bài học với số điểm trung bình cực ấn tượng. Tiếp tục duy trì phong độ nhé!</p>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-colors">
                    <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Completed
                    </div>
                    <div className="text-2xl font-black text-slate-900">{completedCount} <span className="text-xs text-slate-400">Lessons</span></div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-colors">
                    <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <Award className="w-3 h-3 text-amber-500" /> Avg. Score
                    </div>
                    <div className="text-2xl font-black text-slate-900">{avgScore}%</div>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 hover:border-indigo-200 transition-colors col-span-2 sm:col-span-1">
                    <div className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1 flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-indigo-500" /> Active Streaks
                    </div>
                    <div className="text-2xl font-black text-slate-900">12 <span className="text-xs text-slate-400">Days</span></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-80 bg-indigo-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-indigo-200 flex flex-col justify-between relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none group-hover:scale-125 transition-transform duration-1000">
                <Trophy className="w-40 h-40" />
              </div>
              <div>
                <h3 className="text-xl font-heading font-black mb-2">Thử thách tuần</h3>
                <p className="text-indigo-100 text-sm font-medium leading-relaxed">Hoàn thành 5 bài học cấp độ Intermediate để nhận huy hiệu "Fluent Speaker".</p>
              </div>
              <div className="mt-8">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-xs font-black uppercase tracking-widest text-indigo-200">Progress</span>
                  <span className="text-lg font-black italic">60%</span>
                </div>
                <div className="h-3 bg-indigo-900/50 rounded-full overflow-hidden border border-white/10 p-0.5">
                  <div className="h-full bg-white rounded-full transition-all duration-1000" style={{ width: '60%' }}></div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
            <h3 className="text-2xl font-heading font-black text-slate-900 flex items-center gap-3">
              Explore Lessons <span className="px-2 py-0.5 bg-slate-200 text-slate-600 rounded-lg text-xs font-black">{filteredLessons.length}</span>
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Tiêu đề, chủ đề..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-white border border-slate-200 rounded-2xl py-3 pl-11 pr-4 text-sm font-medium w-full sm:w-64 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all shadow-sm"
                />
              </div>
              <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
                {['All', 'Beginner', 'Intermediate', 'Hard'].map(lvl => (
                  <button
                    key={lvl}
                    onClick={() => setLevelFilter(lvl)}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${levelFilter === lvl ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredLessons.length === 0 ? (
              <div className="col-span-full py-20 bg-white rounded-[3rem] border border-dashed border-slate-300 text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Book className="w-10 h-10 text-slate-300" />
                </div>
                <h4 className="text-xl font-black text-slate-800 mb-2">Không tìm thấy bài học nào</h4>
                <p className="text-slate-400 max-w-xs mx-auto text-sm font-medium">Thử thay đổi từ khóa tìm kiếm hoặc bộ lọc độ khó để tìm thấy nhiều nội dung hơn.</p>
              </div>
            ) : (
              filteredLessons.map((lesson) => {
                const isCompleted = userProgress.some(p => p.lesson_id === lesson.id);
                const bestScore = Math.max(...userProgress.filter(p => p.lesson_id === lesson.id).map(p => p.score), 0);

                // Calculate step-by-step progress
                const completedSteps = exerciseProgress.filter(ep =>
                  lesson.exercises.some(ex => ex.id === ep.exercise_id)
                ).length;
                const totalSteps = lesson.exercises.length;
                const isPartial = completedSteps > 0 && completedSteps < totalSteps;

                return (
                  <div
                    key={lesson.id}
                    onClick={() => setSelectedLesson(lesson)}
                    className={`bg-white rounded-[2.5rem] p-8 border hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all cursor-pointer group relative flex flex-col h-full overflow-hidden ${isCompleted ? 'border-emerald-100' : isPartial ? 'border-amber-100' : 'border-slate-200/60'}`}
                  >
                    {(isCompleted || isPartial) && (
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                        {isCompleted ? <CheckCircle2 className="w-40 h-40 text-emerald-600" /> : <Clock className="w-40 h-40 text-amber-600" />}
                      </div>
                    )}

                    <div className="mb-8 flex-1">
                      <div className="flex items-center justify-between mb-6">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 ${isCompleted ? 'bg-emerald-50 text-emerald-600' : isPartial ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white shadow-inner'}`}>
                          {isCompleted ? <Trophy className="w-7 h-7" /> : isPartial ? <TrendingUp className="w-7 h-7" /> : <Book className="w-7 h-7" />}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${lesson.level === 'Beginner' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            lesson.level === 'Intermediate' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                              'bg-rose-50 text-rose-600 border-rose-100'
                            }`}>
                            {lesson.level}
                          </div>
                          {isPartial && (
                            <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg uppercase tracking-wider border border-amber-100">
                              Đang học {completedSteps}/{totalSteps}
                            </span>
                          )}
                        </div>
                      </div>

                      <h3 className="text-2xl font-heading font-black text-slate-900 leading-tight mb-3 group-hover:text-indigo-600 transition-colors">
                        {lesson.title}
                      </h3>
                      <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 font-medium">
                        {lesson.description}
                      </p>
                    </div>

                    <div className="pt-6 border-t border-slate-50">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                          <Clock className="w-3.5 h-3.5" />
                          <span>~15 Mins</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-black text-sm text-slate-800">
                          {isCompleted ? (
                            <span className="flex items-center gap-1 text-emerald-600 font-black">
                              <Star className="w-4 h-4 fill-current" /> {bestScore}%
                            </span>
                          ) : isPartial ? (
                            <span className="text-amber-600 font-black text-xs uppercase tracking-wider">Tiếp tục</span>
                          ) : (
                            <span className="text-slate-400 italic font-medium">New Lesson</span>
                          )}
                        </div>
                      </div>

                      <button className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 font-black transition-all text-xs uppercase tracking-widest ${isCompleted ? 'bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700' : isPartial ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-slate-900 text-white hover:bg-indigo-600 shadow-xl shadow-slate-200'}`}>
                        {isCompleted ? 'Practice Again' : isPartial ? 'Resume Journey' : 'Start Journey'}
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
    const finalScore = Math.round(sessionScore / selectedLesson.exercises.length);
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
            {Math.round((currentIndex / selectedLesson.exercises.length) * 100)}%
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-4xl mx-auto p-6 sm:p-12 pb-40">
        <div className="mb-14">
          <ProgressBar current={currentIndex} total={selectedLesson.exercises.length} />
        </div>

        {currentExercise && (
          <div className="space-y-12 animate-fade-in">
            <div className="bg-slate-50/50 rounded-[3rem] p-10 sm:p-16 border border-slate-200/60 relative overflow-hidden group shadow-sm">
              <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                <Sparkles className="w-64 h-64" />
              </div>

              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <span className={`inline-flex items-center px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm
                    ${currentExercise.difficulty === 'Easy' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      currentExercise.difficulty === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        'bg-rose-50 text-rose-600 border-rose-100'}`}>
                    {currentExercise.difficulty} {currentExercise.type === 'roleplay' ? 'Conversation' : 'Challenge'}
                  </span>
                  {currentExercise.type === 'roleplay' && (
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 bg-indigo-50 text-indigo-600 shadow-sm">
                      <MessageSquare className="w-3 h-3 mr-2" /> Role-Play
                    </span>
                  )}
                  {currentExercise.type === 'detective' && (
                    <span className="inline-flex items-center px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-amber-100 bg-amber-50 text-amber-600 shadow-sm">
                      <Search className="w-3 h-3 mr-2" /> Detective Mode
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  {currentExercise.type === 'roleplay' && (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 block ml-1">Tình huống & Mục tiêu</span>
                  )}
                  {currentExercise.type === 'detective' && (
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-500 block ml-1">Tìm và sửa lỗi sai trong câu tiếng Anh dưới đây</span>
                  )}
                  <h2 className="text-4xl sm:text-5xl font-heading font-black text-slate-900 leading-[1.35] tracking-tight">
                    {currentExercise.vietnamese}
                  </h2>
                </div>

                {currentExercise.hint && (
                  <div className="mt-10 flex items-start gap-4 text-slate-600 bg-white/80 backdrop-blur-md p-5 rounded-3xl border border-white shadow-xl italic text-base leading-relaxed animate-slide-up-slight">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 block mb-1 not-italic">Quick Tip</span>
                      <p>{currentExercise.hint}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="relative">
              {appState === AppState.FEEDBACK && feedback ? (
                <div className="w-full bg-white px-2 py-8 rounded-[3rem] animate-fade-in">
                  <div className="flex flex-wrap items-end gap-x-6 gap-y-20 leading-[1.6] justify-center sm:justify-start">
                    {(feedback.detailedAnalysis || []).map((segment, idx) => {
                      const status = segment.status;
                      const isMissing = status === 'missing';
                      const isExtra = status === 'extra';

                      if (status === 'correct') {
                        return (
                          <div key={idx} className="relative transition-all duration-700 animate-slide-up-slight" style={{ animationDelay: `${idx * 40}ms` }}>
                            <span className="text-4xl text-slate-900 font-bold py-2 px-1 hover:text-indigo-600 transition-colors cursor-default select-none">
                              {segment.text}
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={idx}
                          className="relative transition-all duration-700 group/token animate-slide-up-slight"
                          style={{ animationDelay: `${idx * 40}ms` }}
                        >
                          <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none group-hover/token:pointer-events-auto transition-all duration-300">
                            <span className={`text-[10px] font-black px-4 py-2 rounded-2xl shadow-2xl uppercase tracking-tighter whitespace-nowrap border-2 border-white
                              ${isMissing ? 'bg-indigo-600 text-white' :
                                isExtra ? 'bg-amber-600 text-white' :
                                  'bg-rose-600 text-white'}`}>
                              {segment.errorType || (isMissing ? "Lược bỏ" : isExtra ? "Phụ" : "Sửa lại")}
                            </span>
                            <div className={`w-[3px] h-4 mt-1 rounded-full ${isMissing ? 'bg-indigo-300' : isExtra ? 'bg-amber-300' : 'bg-rose-300'}`}></div>
                          </div>

                          <div className={`flex flex-col items-center border-[4px] rounded-[2rem] px-8 py-4 min-w-[6rem] transition-all shadow-md group-hover/token:shadow-xl
                            ${isMissing ? 'bg-indigo-50 border-indigo-100 border-dashed hover:border-indigo-400' :
                              isExtra ? 'bg-amber-50/50 border-amber-100 hover:border-amber-400 opacity-60 grayscale' :
                                'bg-rose-50 border-rose-100 hover:border-rose-400'}`}>

                            {isMissing ? (
                              <span className="text-3xl text-indigo-700 font-black cursor-pointer transform active:scale-95 transition-transform"
                                onClick={() => { }}>
                                {segment.correction}
                              </span>
                            ) : isExtra ? (
                              <span className="text-3xl text-amber-800/50 font-bold line-through decoration-[4px] decoration-amber-400/20">
                                {segment.text}
                              </span>
                            ) : (
                              <>
                                <span className="text-xs text-rose-500 line-through decoration-[2px] mb-3 font-bold italic opacity-40">
                                  {segment.text}
                                </span>
                                <span className="text-3xl text-emerald-600 font-black cursor-pointer transform active:scale-95 transition-transform"
                                  onClick={() => { }}>
                                  {segment.correction}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[3.5rem] blur opacity-10 group-focus-within:opacity-25 transition duration-500"></div>
                  <textarea
                    ref={inputRef}
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    disabled={appState !== AppState.IDLE}
                    placeholder={
                      currentExercise.type === 'roleplay'
                        ? "Nhập câu nói của bạn trong tình huống này..."
                        : currentExercise.type === 'detective'
                          ? "Nhập câu đã sửa lỗi của bạn..."
                          : "Nhập phần dịch Tiếng Anh của bạn..."
                    }
                    spellCheck={false}
                    className={`relative w-full h-48 p-12 text-3xl font-bold bg-white border-4 rounded-[3.5rem] transition-all duration-500 resize-none outline-none
                      ${appState === AppState.IDLE ? 'border-slate-100 focus:bg-white focus:border-indigo-600 focus:ring-[20px] focus:ring-indigo-600/5 text-slate-900 shadow-xl shadow-slate-200' : 'border-transparent bg-slate-50 text-slate-400'}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        if (appState === AppState.IDLE) handleCheck();
                      }
                    }}
                  />
                </div>
              )}
            </div>

            {appState === AppState.FEEDBACK && feedback && (
              <div className="animate-slide-up-slight">
                <FeedbackCard result={feedback} onNext={finishQuestion} isLastQuestion={isLastQuestion} />
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
            {appState === AppState.FEEDBACK && (
              <>
                {!feedback?.isPass && (
                  <button onClick={() => { setAppState(AppState.IDLE); setFeedback(null); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-800 font-extrabold py-5 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-[10px] border border-slate-200 shadow-sm">Thử lại</button>
                )}
                {!feedback?.isPass ? (
                  <button onClick={finishQuestion} className="flex-1 bg-white border-2 border-slate-200 hover:border-slate-300 text-slate-500 font-extrabold py-5 rounded-2xl transition-all active:scale-95 uppercase tracking-widest text-[10px]">Bỏ qua</button>
                ) : (
                  <button
                    onClick={finishQuestion}
                    className="w-full h-16 flex items-center justify-center gap-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black py-5 rounded-2xl transition-all shadow-[0_8px_0_0_#059669] active:shadow-none active:translate-y-2 uppercase tracking-widest text-xs"
                  >
                    {isLastQuestion ? 'Hoàn thành bài học' : 'Sang câu tiếp theo'} <ArrowRight className="w-5 h-5" />
                  </button>
                )}
              </>
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
    </div>
  );
};