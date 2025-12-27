import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft, Plus, Trash2, LogOut, LayoutDashboard, Wand2, Loader2,
  Book, Edit3, ChevronRight, Hash, Users, Shield, User as UserIcon,
  Mail, Calendar, BarChart3, TrendingUp, PieChart, Activity, Search,
  ArrowUpRight, Filter, Download, Award, Clock, Star, Sparkles
} from 'lucide-react';
import { Lesson, Exercise, UserProfile, AdminStats } from '../types';
import { generateLessonContent } from '../services/mimoService';
import { LESSON_GENERATION_PROMPT } from '../services/prompts';
import { getAllProfiles, updateProfile, signOut, getUserDetailedProgress } from '../services/authService';
import { getAdminStats, getRecentActivity, updateLesson, updateExercise } from '../services/lessonService';

interface AdminPanelProps {
  lessons: Lesson[];
  profile: UserProfile | null;
  onAddLesson: (lesson: Lesson) => void;
  onUpdateLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: string) => void;
  onBack: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  lessons,
  profile,
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onBack
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'lessons' | 'students'>('overview');
  const [students, setStudents] = useState<UserProfile[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');

  // Student Detail View
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [studentHistory, setStudentHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Lesson Edit State
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Exercise Edit State
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);

  // UI Modals
  const [isArchitectOpen, setIsArchitectOpen] = useState(false);

  // View State
  const [viewingLessonId, setViewingLessonId] = useState<string | null>(null);

  // Generation State
  const [prompt, setPrompt] = useState('');
  const [generationCount, setGenerationCount] = useState<number | 'auto'>('auto');
  const [isGenerating, setIsGenerating] = useState(false);

  // Manual Exercise State
  const [newExercise, setNewExercise] = useState<Partial<Exercise>>({
    type: 'translation',
    difficulty: 'Medium',
    vietnamese: '',
    hint: ''
  });

  const [importJson, setImportJson] = useState('');
  const [architectMode, setArchitectMode] = useState<'internal' | 'external'>('internal');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsFetchingData(true);
    try {
      if (activeTab === 'students') {
        const data = await getAllProfiles();
        setStudents(data);
      } else if (activeTab === 'overview') {
        const [statsData, activityData] = await Promise.all([
          getAdminStats(),
          getRecentActivity()
        ]);
        setStats(statsData);
        setRecentActivity(activityData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingData(false);
    }
  };

  const filteredStudents = useMemo(() => {
    return students.filter(s =>
      s.full_name.toLowerCase().includes(studentSearch.toLowerCase()) ||
      s.id.includes(studentSearch)
    );
  }, [students, studentSearch]);

  const handleToggleRole = async (student: UserProfile) => {
    const newRole = student.role === 'admin' ? 'student' : 'admin';
    if (confirm(`Bạn có chắc chắn muốn chuyển vai trò của ${student.full_name} thành ${newRole}?`)) {
      try {
        await updateProfile(student.id, { role: newRole });
        setStudents(prev => prev.map(s => s.id === student.id ? { ...s, role: newRole } : s));
      } catch (err) {
        alert('Không thể cập nhật vai trò.');
      }
    }
  };

  const handleGenerateLesson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsGenerating(true);
    try {
      const generatedContent = await generateLessonContent(prompt, generationCount);
      const newLesson = {
        title: generatedContent.title,
        description: generatedContent.description,
        level: generatedContent.level,
        exercises: generatedContent.exercises
      };
      await onAddLesson(newLesson as any);
      setPrompt('');
      alert(`Đã tạo bài học thành công! Gồm ${generatedContent.exercises.length} câu hỏi.`);
    } catch (err) {
      console.error(err);
      alert('Có lỗi khi tạo bài học. Vui lòng thử lại.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyPrompt = () => {
    const fullPrompt = `${LESSON_GENERATION_PROMPT}\n\n[USER TOPIC]\nTopic: "${prompt}". Generate exactly ${generationCount === 'auto' ? '12' : generationCount} exercises.`;
    navigator.clipboard.writeText(fullPrompt);
    alert('Đã copy quy tắc và chủ đề! Hãy paste vào ChatGPT/Claude để tạo bài học.');
  };

  const handleImportJson = async () => {
    if (!importJson.trim()) return;
    try {
      const parsed = JSON.parse(importJson);
      if (!parsed.title || !parsed.exercises || !Array.isArray(parsed.exercises)) {
        throw new Error('Cấu trúc JSON không hợp lệ.');
      }
      await onAddLesson(parsed as any);
      setImportJson('');
      setIsArchitectOpen(false);
      alert('Đã nhập bài học thành công!');
    } catch (err) {
      alert('Lỗi: JSON không đúng định dạng hoặc thiếu trường bắt buộc.');
      console.error(err);
    }
  };

  const handleAddManualExercise = () => {
    if (!viewingLessonId || !newExercise.vietnamese) return;
    const currentLesson = lessons.find(l => l.id === viewingLessonId);
    if (!currentLesson) return;
    const exerciseToAdd: Exercise = {
      id: crypto.randomUUID ? crypto.randomUUID() : `ex-${Date.now()}`,
      type: newExercise.type as 'translation' | 'roleplay' || 'translation',
      vietnamese: newExercise.vietnamese,
      hint: newExercise.hint || undefined,
      difficulty: newExercise.difficulty as 'Easy' | 'Medium' | 'Hard'
    };
    const updatedLesson = {
      ...currentLesson,
      exercises: [...currentLesson.exercises, exerciseToAdd]
    };
    onUpdateLesson(updatedLesson);
    setNewExercise({ type: 'translation', difficulty: 'Medium', vietnamese: '', hint: '' });
  };

  const handleDeleteExercise = (exerciseId: string) => {
    if (!viewingLessonId) return;
    const currentLesson = lessons.find(l => l.id === viewingLessonId);
    if (!currentLesson) return;
    const updatedLesson = {
      ...currentLesson,
      exercises: currentLesson.exercises.filter(ex => ex.id !== exerciseId)
    };
    onUpdateLesson(updatedLesson);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  const handleUpdateLessonTitle = async (lessonId: string, updates: Partial<Lesson>) => {
    setIsUpdating(true);
    try {
      const success = await updateLesson(lessonId, updates);
      if (success) {
        onUpdateLesson({ ...lessons.find(l => l.id === lessonId)!, ...updates });
        setEditingLesson(null);
      } else {
        alert('Không thể cập nhật bài học.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateExerciseContent = async (exerciseId: string, updates: Partial<Exercise>) => {
    if (!viewingLessonId) return;
    setIsUpdating(true);
    try {
      const success = await updateExercise(exerciseId, updates);
      if (success) {
        const currentLesson = lessons.find(l => l.id === viewingLessonId);
        if (currentLesson) {
          const updatedExercises = currentLesson.exercises.map(ex =>
            ex.id === exerciseId ? { ...ex, ...updates } : ex
          );
          onUpdateLesson({ ...currentLesson, exercises: updatedExercises });
          setEditingExercise(null);
        }
      } else {
        alert('Không thể cập nhật câu hỏi.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleViewStudentDetails = async (student: UserProfile) => {
    setSelectedStudent(student);
    setIsLoadingHistory(true);
    try {
      const history = await getUserDetailedProgress(student.id);
      setStudentHistory(history);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Check if admin
  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 p-12 rounded-[2.5rem] border border-slate-800 text-center max-w-lg w-full shadow-2xl">
          <div className="w-24 h-24 bg-rose-500/10 rounded-3xl flex items-center justify-center mx-auto mb-8 border border-rose-500/20">
            <Shield className="w-12 h-12 text-rose-500" />
          </div>
          <h2 className="text-3xl font-heading font-black text-white mb-4 tracking-tight">Access Restricted</h2>
          <p className="text-slate-400 mb-10 leading-relaxed">Khu vực này chỉ dành cho quản trị viên. Vui lòng quay lại nếu bạn không có thẩm quyền.</p>
          <button
            onClick={onBack}
            className="w-full py-5 bg-white text-slate-900 font-black rounded-2xl transition-all hover:bg-slate-100 uppercase tracking-widest text-xs"
          >
            Quay lại trang chủ
          </button>
        </div>
      </div>
    );
  }

  // --- DETAIL VIEW: EXERCISE MANAGER ---
  if (viewingLessonId) {
    const lesson = lessons.find(l => l.id === viewingLessonId);
    if (!lesson) return null;

    return (
      <div className="min-h-screen bg-[#F8FAFC] font-sans p-6 md:p-12">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => setViewingLessonId(null)}
            className="group flex items-center gap-3 text-slate-500 hover:text-indigo-600 font-black mb-8 transition-colors transition-all active:scale-95"
          >
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-slate-100 group-hover:border-indigo-100 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </div>
            Quay lại dashboard
          </button>

          <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden">
            <div className="p-10 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border
                                    ${lesson.level === 'Beginner' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        lesson.level === 'Intermediate' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                          'bg-rose-50 text-rose-600 border-rose-100'
                      }`}>
                      {lesson.level}
                    </span>
                    <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest">• Exercise Manager</span>
                  </div>
                  <h1 className="text-4xl font-heading font-black text-slate-900 tracking-tight">{lesson.title}</h1>
                  <p className="text-slate-500 mt-2 font-medium max-w-2xl">{lesson.description}</p>
                </div>
                <div className="flex gap-3">
                  <button className="p-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl transition-all">
                    <Download className="w-5 h-5" />
                  </button>
                  <button className="px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-indigo-100 transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Add Questions
                  </button>
                </div>
              </div>
            </div>

            <div className="p-10">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-heading font-black text-slate-900 flex items-center gap-3">
                  <Book className="w-6 h-6 text-indigo-600" /> Questionnaire <span className="text-sm font-bold text-slate-400">({lesson.exercises.length})</span>
                </h3>
              </div>

              <div className="space-y-4 mb-12">
                {lesson.exercises.map((ex, idx) => (
                  <div key={ex.id} className="group flex items-center gap-6 p-6 bg-slate-50/50 rounded-3xl border border-slate-200/60 hover:border-indigo-500 hover:bg-white transition-all duration-300">
                    <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center font-black text-slate-900 text-sm shadow-sm border border-slate-100 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all duration-500">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">{ex.vietnamese}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border
                                                ${ex.difficulty === 'Easy' ? 'bg-emerald-50 border-emerald-100 text-emerald-600' :
                            ex.difficulty === 'Medium' ? 'bg-amber-50 border-amber-100 text-amber-600' :
                              'bg-rose-50 border-rose-100 text-rose-600'}`}>
                          {ex.difficulty}
                        </span>
                        {ex.hint && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium italic">
                            <TrendingUp className="w-3 h-3" /> Hint: {ex.hint}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => setEditingExercise(ex)}
                        className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl transition-all"
                      >
                        <Edit3 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteExercise(ex.id)}
                        className="p-3 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Manual Form */}
              <div className="bg-indigo-50/50 rounded-[2.5rem] p-10 border border-indigo-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
                  <Edit3 className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <h3 className="text-lg font-black text-indigo-900 uppercase tracking-widest mb-8 flex items-center gap-3">
                    <Activity className="w-5 h-5" /> Manual Entry
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-12">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block ml-1">Vietnamese Phrase</label>
                      <input
                        type="text"
                        placeholder="VD: Chào buổi sáng, rất vui được gặp bạn."
                        className="w-full p-4 rounded-2xl border border-indigo-100 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        value={newExercise.vietnamese}
                        onChange={(e) => setNewExercise({ ...newExercise, vietnamese: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-8">
                      <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block ml-1">Learning Hint (Optional)</label>
                      <input
                        type="text"
                        placeholder="VD: Sử dụng cấu trúc 'Nice to meet you'..."
                        className="w-full p-4 rounded-2xl border border-indigo-100 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all shadow-sm"
                        value={newExercise.hint}
                        onChange={(e) => setNewExercise({ ...newExercise, hint: e.target.value })}
                      />
                    </div>
                    <div className="md:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block ml-1">Exercise Type</label>
                        <select
                          className="w-full p-4 rounded-2xl border border-indigo-100 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-white cursor-pointer font-bold shadow-sm"
                          value={newExercise.type}
                          onChange={(e) => setNewExercise({ ...newExercise, type: e.target.value as any })}
                        >
                          <option value="translation">Translation (Dịch câu)</option>
                          <option value="roleplay">Role-play (Hội thoại)</option>
                          <option value="detective">Detective (Tìm lỗi sai)</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 block ml-1">Difficulty</label>
                        <select
                          className="w-full p-4 rounded-2xl border border-indigo-100 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-white cursor-pointer font-bold shadow-sm"
                          value={newExercise.difficulty}
                          onChange={(e) => setNewExercise({ ...newExercise, difficulty: e.target.value as any })}
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleAddManualExercise}
                    disabled={!newExercise.vietnamese}
                    className="mt-8 px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-2xl shadow-indigo-200 disabled:opacity-50 disabled:active:scale-100 active:scale-95 uppercase tracking-widest text-xs"
                  >
                    Save into lesson
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- DASHBOARD VIEW ---

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="bg-slate-950 w-full md:w-80 p-8 flex flex-col gap-10 sticky top-0 h-auto md:h-screen z-50 text-white overflow-y-auto">
        <div className="flex items-center gap-4 text-indigo-400 py-2 border-b border-slate-900 pb-10">
          <div className="bg-indigo-500 p-2.5 rounded-2xl shadow-2xl shadow-indigo-500/20"><LayoutDashboard className="w-8 h-8 text-white" /></div>
          <div>
            <span className="font-heading font-black text-2xl tracking-tighter block leading-none">Management</span>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.3em] mt-1 block">Control Center</span>
          </div>
        </div>

        <nav className="flex-1 space-y-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl font-black transition-all group ${activeTab === 'overview' ? 'bg-white text-slate-950 shadow-xl' : 'text-slate-500 hover:text-white hover:bg-slate-900'}`}
          >
            <div className="flex items-center gap-4">
              <BarChart3 className="w-5 h-5" /> Overview
            </div>
            {activeTab === 'overview' && <ArrowUpRight className="w-4 h-4 opacity-50" />}
          </button>
          <button
            onClick={() => setActiveTab('lessons')}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl font-black transition-all group ${activeTab === 'lessons' ? 'bg-white text-slate-950 shadow-xl' : 'text-slate-500 hover:text-white hover:bg-slate-900'}`}
          >
            <div className="flex items-center gap-4">
              <Book className="w-5 h-5" /> Content
            </div>
            {activeTab === 'lessons' && <ArrowUpRight className="w-4 h-4 opacity-50" />}
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl font-black transition-all group ${activeTab === 'students' ? 'bg-white text-slate-950 shadow-xl' : 'text-slate-500 hover:text-white hover:bg-slate-900'}`}
          >
            <div className="flex items-center gap-4">
              <Users className="w-5 h-5" /> Students
            </div>
            {activeTab === 'students' && <ArrowUpRight className="w-4 h-4 opacity-50" />}
          </button>
        </nav>

        <div className="space-y-2 pt-10 border-t border-slate-900">
          <div className="px-5 py-6 bg-slate-900/50 rounded-3xl border border-slate-900 mb-6 flex items-center gap-4">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-900 font-black border-2 border-slate-800 shadow-xl">
              {profile?.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-black text-white">{profile?.full_name}</p>
              <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Admin</span>
            </div>
          </div>
          <button
            onClick={onBack}
            className="w-full flex items-center gap-4 px-5 py-4 text-slate-500 hover:text-white hover:bg-slate-900 rounded-2xl font-black transition-all text-sm"
          >
            <ArrowLeft className="w-5 h-5" /> Return Home
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-4 px-5 py-4 text-rose-500/60 hover:text-rose-400 hover:bg-rose-500/10 rounded-2xl font-black transition-all text-sm"
          >
            <LogOut className="w-5 h-5" /> Terminate Session
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-14 overflow-y-auto max-w-7xl">
        {activeTab === 'overview' && (
          <div className="animate-fade-in space-y-12">
            <header>
              <h1 className="text-5xl font-heading font-black text-slate-900 tracking-tighter mb-4">Platform Intelligence</h1>
              <p className="text-slate-500 text-lg font-medium">Real-time learning metrics and user engagement tokens.</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[
                { label: 'Total Students', value: stats?.totalStudents || 0, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', status: 'Healthy' },
                { label: 'Active Lessons', value: stats?.totalLessons || 0, icon: Book, color: 'text-emerald-600', bg: 'bg-emerald-50', status: 'Active' },
                { label: 'Completions', value: stats?.totalCompletions || 0, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50', status: 'Growing' },
                { label: 'Avg Success', value: `${stats?.avgScore || 0}%`, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50', status: (stats?.avgScore || 0) > 70 ? 'High' : 'Needs Focus' },
              ].map((s, idx) => (
                <div key={idx} className="bg-white p-8 rounded-[2.25rem] border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className={`${s.bg} w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                    <s.icon className={`w-7 h-7 ${s.color}`} />
                  </div>
                  <p className="text-slate-400 font-black text-[10px] uppercase tracking-widest mb-1">{s.label}</p>
                  <p className="text-4xl font-black text-slate-900">{s.value}</p>
                  <div className="absolute top-8 right-8">
                    <span className={`text-[8px] font-black uppercase tracking-tighter px-2 py-1 rounded-md border 
                      ${s.status === 'Needs Focus' ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'}`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Center Column: Activity & Insights */}
              <div className="lg:col-span-2 space-y-10">
                <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="flex items-center justify-between mb-10">
                    <h3 className="text-xl font-black text-slate-900 flex items-center gap-3">
                      <Activity className="w-6 h-6 text-indigo-600" /> Recent Activity
                    </h3>
                  </div>

                  <div className="space-y-6">
                    {recentActivity.length === 0 ? (
                      <div className="py-20 text-center text-slate-400 font-medium">No activity recorded yet.</div>
                    ) : (
                      recentActivity.map((act) => (
                        <div key={act.id} className="flex items-center justify-between p-5 hover:bg-slate-50 rounded-2xl transition-all border border-transparent hover:border-slate-100">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white border border-slate-200 rounded-xl flex items-center justify-center text-indigo-600 font-black shadow-sm group-hover:bg-indigo-50 transition-colors">
                              {act.profiles?.full_name?.charAt(0) || act.user_id.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{act.profiles?.full_name || 'Anonymous'}</p>
                              <p className="text-xs text-slate-500">Mastered <span className="text-indigo-600 font-semibold">{act.lessons?.title || 'Unknown'}</span></p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-black ${act.score >= 80 ? 'text-emerald-500' : act.score >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>{act.score}%</span>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{new Date(act.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  {/* Difficult Lessons */}
                  <div className="bg-rose-50/30 rounded-[3rem] p-10 border border-rose-100 relative overflow-hidden group">
                    <h4 className="text-rose-900 font-black uppercase tracking-widest text-[10px] mb-8 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Curriculum Fragility
                    </h4>
                    <h3 className="text-xl font-black text-slate-900 mb-6 font-heading tracking-tight">Focus Required</h3>
                    <div className="space-y-4">
                      {stats?.difficultLessons?.length === 0 ? (
                        <p className="text-slate-400 text-sm">All units performing well.</p>
                      ) : (
                        stats?.difficultLessons.map(lesson => (
                          <div key={lesson.id} className="bg-white p-4 rounded-2xl border border-rose-100 shadow-sm flex items-center justify-between hover:scale-[1.02] transition-transform cursor-default">
                            <p className="font-bold text-slate-900 text-xs truncate pr-4">{lesson.title}</p>
                            <span className="text-rose-600 font-black text-xs bg-rose-50 px-2.5 py-1 rounded-lg">{lesson.avgScore}%</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Top Learners */}
                  <div className="bg-emerald-50/30 rounded-[3rem] p-10 border border-emerald-100 relative overflow-hidden group">
                    <h4 className="text-emerald-900 font-black uppercase tracking-widest text-[10px] mb-8 flex items-center gap-2">
                      <Star className="w-4 h-4" /> Community Leaders
                    </h4>
                    <h3 className="text-xl font-black text-slate-900 mb-6 font-heading tracking-tight">Active Power</h3>
                    <div className="space-y-4">
                      {stats?.topLearners?.length === 0 ? (
                        <p className="text-slate-400 text-sm">Awaiting first results.</p>
                      ) : (
                        stats?.topLearners.map(user => (
                          <div key={user.id} className="bg-white p-4 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between hover:scale-[1.02] transition-transform cursor-default">
                            <p className="font-bold text-slate-900 text-xs">{user.full_name}</p>
                            <div className="text-right">
                              <p className="text-emerald-600 font-black text-[10px]">{user.completions} units</p>
                              <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">{user.avgScore}% avg</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Platform Vitals */}
              <div className="bg-slate-950 rounded-[3rem] p-10 text-white shadow-3xl flex flex-col items-stretch">
                <h3 className="text-2xl font-black mb-10 flex items-center gap-3 font-heading tracking-tighter">
                  <TrendingUp className="w-6 h-6 text-indigo-400" /> Platform Vitals
                </h3>

                <div className="space-y-12 flex-1 flex flex-col">
                  <div className="group">
                    <div className="flex justify-between items-end mb-3">
                      <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Global Performance</p>
                      <span className="text-2xl font-black text-indigo-400">{stats?.avgScore || 0}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full transition-all duration-1000 group-hover:bg-indigo-400" style={{ width: `${stats?.avgScore || 0}%` }} />
                    </div>
                  </div>

                  <div className="p-8 bg-slate-900/50 rounded-3xl border border-slate-800/80 group hover:border-indigo-500/30 transition-colors">
                    <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mb-6">Execution Load</p>
                    <div className="flex items-center gap-6">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col items-center justify-center group-hover:scale-110 transition-transform">
                        <span className="text-xl font-black text-white">{stats?.totalCompletions || 0}</span>
                        <span className="text-[7px] font-black uppercase text-indigo-400">Fixed</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-slate-300">Total Exercises</p>
                        <p className="text-[10px] text-slate-500 mt-1 italic leading-relaxed">Platform throughput is nominal.</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[40px]" />

                  <button
                    onClick={() => setActiveTab('lessons')}
                    className="w-full py-5 bg-white text-slate-950 hover:bg-slate-100 rounded-2xl font-black flex items-center justify-center gap-3 transition-all active:scale-[0.98] uppercase tracking-widest text-[10px]"
                  >
                    <Book className="w-4 h-4" /> Content Strategy Management
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lessons' && (
          <div className="animate-fade-in space-y-12">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
              <div>
                <h1 className="text-5xl font-heading font-black text-slate-900 tracking-tighter mb-4">Curriculum Control</h1>
                <p className="text-slate-500 text-lg font-medium">Design and organize your learning modules.</p>
              </div>
              <div className="flex gap-4 w-full lg:w-auto">
                <button
                  onClick={() => setIsArchitectOpen(true)}
                  className="flex-1 lg:flex-none px-8 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-3xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95 transition-all text-xs uppercase tracking-widest"
                >
                  <Sparkles className="w-4 h-4" /> AI Architect
                </button>
                <button className="flex-1 lg:flex-none px-8 py-5 bg-white border border-slate-200 text-slate-900 font-black rounded-3xl shadow-sm flex items-center justify-center gap-3 active:scale-95 transition-all text-xs uppercase tracking-widest">
                  <Plus className="w-4 h-4" /> New Module
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-12 items-start">
              <div className="space-y-6">
                {lessons.length === 0 ? (
                  <div className="p-32 text-center bg-white rounded-[4rem] border-2 border-dashed border-slate-200">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
                      <Book className="w-12 h-12 opacity-20 text-indigo-400" />
                    </div>
                    <p className="font-black text-slate-800 text-xl">The curriculum is empty.</p>
                    <p className="text-slate-400 mt-2 font-medium">Use the generator or add a manual lesson to begin.</p>
                  </div>
                ) : (
                  lessons.map((lesson) => (
                    <div key={lesson.id} className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center gap-8 group hover:border-indigo-500 transition-all hover:shadow-2xl hover:shadow-indigo-500/5 cursor-pointer" onClick={() => setViewingLessonId(lesson.id)}>
                      <div className="w-20 h-20 bg-slate-50 text-slate-300 rounded-[1.5rem] flex-shrink-0 flex items-center justify-center font-black text-3xl group-hover:bg-indigo-600 group-hover:text-white transition-all duration-700 overflow-hidden relative">
                        <span className="relative z-10">{lesson.title.charAt(0)}</span>
                        <div className="absolute inset-0 bg-indigo-600 scale-0 group-hover:scale-110 transition-transform duration-700 rounded-full"></div>
                      </div>

                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-3 mb-3">
                          <span className={`text-[9px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full border
                                    ${lesson.level === 'Beginner' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                              lesson.level === 'Intermediate' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                'bg-rose-50 text-rose-600 border-rose-100'
                            }`}>
                            {lesson.level} Priority
                          </span>
                          <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5" /> High Engagement
                          </span>
                        </div>
                        <h3 className="text-3xl font-heading font-black text-slate-900 group-hover:text-indigo-600 transition-colors tracking-tight">{lesson.title}</h3>
                        <p className="text-slate-500 mt-1 font-medium italic text-sm">{lesson.exercises.length} Interactive Tasks</p>
                      </div>

                      <div className="flex items-center gap-3 self-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingLesson(lesson); }}
                          className="w-12 h-12 bg-slate-50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-2xl flex items-center justify-center transition-all border border-transparent hover:border-indigo-100"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); onDeleteLesson(lesson.id); }}
                          className="w-12 h-12 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-2xl flex items-center justify-center transition-all border border-transparent hover:border-rose-100"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'students' && (
          <div className="animate-fade-in space-y-12">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
              <div>
                <h1 className="text-5xl font-heading font-black text-slate-900 tracking-tighter mb-4">Identity Vault</h1>
                <p className="text-slate-500 text-lg font-medium">Manage permissions and monitor student engagement records.</p>
              </div>
              <div className="relative w-full lg:w-96 group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-indigo-600 transition-colors" />
                <input
                  type="text"
                  placeholder="ID or Full Name Search..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="w-full bg-white border border-slate-200 py-5 pl-16 pr-6 rounded-3xl font-black text-sm outline-none focus:ring-8 focus:ring-indigo-500/5 focus:border-indigo-500 transition-all shadow-sm"
                />
              </div>
            </header>

            <div className="bg-white rounded-[3.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50/50 border-b border-slate-100">
                      <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Học viên & Ngày tham gia</th>
                      <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Metadata ID</th>
                      <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">Permission Level</th>
                      <th className="px-10 py-8 text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {isFetchingData ? (
                      <tr>
                        <td colSpan={4} className="px-10 py-32 text-center">
                          <Loader2 className="w-12 h-12 animate-spin text-indigo-500 mx-auto mb-6" />
                          <p className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">Synchronizing Identity Records...</p>
                        </td>
                      </tr>
                    ) : filteredStudents.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-10 py-32 text-center text-slate-400 font-medium">No results found matching your criteria.</td>
                      </tr>
                    ) : (
                      filteredStudents.map((student) => (
                        <tr key={student.id} className="hover:bg-indigo-50/30 transition-all group">
                          <td className="px-10 py-8">
                            <div className="flex items-center gap-6">
                              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-[1.25rem] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-100 group-hover:scale-105 transition-transform duration-500">
                                {student.full_name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-black text-xl text-slate-900 tracking-tight">{student.full_name}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <div className="flex items-center gap-2 text-[10px] text-indigo-400 font-bold uppercase tracking-widest">
                                    <Calendar className="w-3.5 h-3.5" />
                                    {new Date(student.created_at).toLocaleDateString('vi-VN')}
                                  </div>
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
                                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-tighter">Verified</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-10 py-8">
                            <div className="flex flex-col">
                              <code className="text-xs font-mono font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg w-fit group-hover:bg-white transition-colors">{student.id}</code>
                            </div>
                          </td>
                          <td className="px-10 py-8">
                            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border
                              ${student.role === 'admin' ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-sm' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                              {student.role === 'admin' ? <Shield className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                              {student.role} Control
                            </span>
                          </td>
                          <td className="px-10 py-8 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button
                                onClick={() => handleViewStudentDetails(student)}
                                className="px-6 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-900 hover:bg-slate-50 transition-all shadow-sm active:scale-95"
                              >
                                View Progress
                              </button>
                              <button
                                onClick={() => handleToggleRole(student)}
                                className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border shadow-sm active:scale-95
                                  ${student.role === 'admin' ? 'bg-rose-50 border-rose-200 text-rose-600 hover:bg-rose-100' : 'bg-slate-900 border-slate-900 text-white hover:bg-indigo-600 shadow-xl shadow-slate-200'}`}
                              >
                                {student.role === 'admin' ? 'Revoke Admin' : 'Grant Admin'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lesson Edit Modal */}
      {editingLesson && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900">Edit Lesson Profile</h3>
              <button onClick={() => setEditingLesson(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Title</label>
                <input
                  type="text"
                  value={editingLesson.title}
                  onChange={(e) => setEditingLesson({ ...editingLesson, title: e.target.value })}
                  className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                <textarea
                  value={editingLesson.description}
                  onChange={(e) => setEditingLesson({ ...editingLesson, description: e.target.value })}
                  className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all h-32"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  disabled={isUpdating}
                  onClick={() => handleUpdateLessonTitle(editingLesson.id, { title: editingLesson.title, description: editingLesson.description })}
                  className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Exercise Edit Modal */}
      {editingExercise && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-900">Refine Question</h3>
              <button onClick={() => setEditingExercise(null)} className="p-2 hover:bg-slate-200 rounded-xl transition-colors">
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-10 space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vietnamese Phrase</label>
                <input
                  type="text"
                  value={editingExercise.vietnamese}
                  onChange={(e) => setEditingExercise({ ...editingExercise, vietnamese: e.target.value })}
                  className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Exercise Type</label>
                  <select
                    className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-white cursor-pointer font-bold shadow-sm"
                    value={editingExercise.type}
                    onChange={(e) => setEditingExercise({ ...editingExercise, type: e.target.value as any })}
                  >
                    <option value="translation">Translation</option>
                    <option value="roleplay">Role-play</option>
                    <option value="detective">Detective</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Learning Hint</label>
                  <input
                    type="text"
                    value={editingExercise.hint || ''}
                    onChange={(e) => setEditingExercise({ ...editingExercise, hint: e.target.value })}
                    className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  disabled={isUpdating}
                  onClick={() => handleUpdateExerciseContent(editingExercise.id, {
                    vietnamese: editingExercise.vietnamese,
                    hint: editingExercise.hint,
                    type: editingExercise.type
                  })}
                  className="flex-1 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-xl shadow-indigo-100 disabled:opacity-50"
                >
                  {isUpdating ? 'Saving...' : 'Apply Fixes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Student Detail Panel */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-end">
          <div className="bg-white w-full md:w-[600px] h-[90vh] md:h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-10 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-indigo-200">
                  {selectedStudent.full_name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tight">{selectedStudent.full_name}</h3>
                  <p className="text-indigo-600 font-bold uppercase tracking-widest text-xs mt-1">Learner Profile</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-12 h-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all hover:rotate-90"
              >
                <Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="flex-1 p-10 overflow-y-auto space-y-12">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Lessons</p>
                  <p className="text-3xl font-black text-slate-900">{studentHistory.length}</p>
                </div>
                <div className="p-6 bg-indigo-50 rounded-3xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-400 uppercase mb-1">Average Score</p>
                  <p className="text-3xl font-black text-indigo-600">
                    {studentHistory.length > 0
                      ? Math.round(studentHistory.reduce((acc, h) => acc + h.score, 0) / studentHistory.length)
                      : 0}%
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 flex items-center gap-3">
                  <Activity className="w-4 h-4 text-indigo-500" /> Learning Timeline
                </h4>
                <div className="space-y-6">
                  {isLoadingHistory ? (
                    <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-400" /></div>
                  ) : studentHistory.length === 0 ? (
                    <p className="text-center text-slate-400">No history available for this student.</p>
                  ) : (
                    studentHistory.map((h, i) => (
                      <div key={h.id} className="relative pl-8 before:content-[''] before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100 last:before:hidden">
                        <div className="absolute left-0 top-1.5 w-6 h-6 rounded-full bg-white border-4 border-indigo-500 z-10 shadow-sm" />
                        <div className="p-6 bg-white border border-slate-100 rounded-[2rem] shadow-sm hover:shadow-lg transition-all">
                          <div className="flex justify-between items-start mb-2">
                            <h5 className="font-black text-slate-900 text-lg leading-tight">{h.lessons?.title}</h5>
                            <span className="text-2xl font-black text-indigo-600">{h.score}%</span>
                          </div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase">{new Date(h.completed_at).toLocaleDateString('vi-VN')} • {new Date(h.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="p-10 border-t border-slate-100 bg-slate-50/50">
              <button
                onClick={() => setSelectedStudent(null)}
                className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl hover:bg-slate-800 transition-all active:scale-[0.98] uppercase tracking-widest text-xs"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Architect Modal */}
      {isArchitectOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-slate-900 w-full max-w-2xl rounded-[3.5rem] shadow-3xl border border-slate-800 overflow-hidden relative">
            <button
              onClick={() => setIsArchitectOpen(false)}
              className="absolute top-8 right-8 w-12 h-12 bg-white/5 hover:bg-white/10 rounded-2xl flex items-center justify-center text-slate-400 transition-all hover:rotate-90"
            >
              <Plus className="w-6 h-6 rotate-45" />
            </button>

            <div className="p-12">
              <div className="mb-10">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-500/20 mb-6 font-mono">
                  <Sparkles className="w-3.5 h-3.5" /> Intelligence Suite v5.0
                </div>
                <h3 className="text-4xl font-heading font-black text-white tracking-tighter mb-4">Lesson Architect</h3>
                <p className="text-slate-500 text-lg font-medium leading-relaxed">Choose your preferred engine to scaffold professional learning curriculum.</p>
              </div>

              {/* Tab Switcher */}
              <div className="flex bg-slate-800/50 p-1.5 rounded-2xl mb-12 border border-slate-700/50 w-full max-w-sm mx-auto">
                <button
                  onClick={() => setArchitectMode('internal')}
                  className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${architectMode === 'internal'
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                    : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  Internal Engine
                </button>
                <button
                  onClick={() => setArchitectMode('external')}
                  className={`flex-1 py-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${architectMode === 'external'
                    ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20'
                    : 'text-slate-500 hover:text-slate-300'
                    }`}
                >
                  External Support
                </button>
              </div>

              {architectMode === 'internal' ? (
                <form onSubmit={handleGenerateLesson} className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Learning Theme & Constraints</label>
                    <textarea
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      disabled={isGenerating}
                      placeholder="e.g. Master professional email etiquette for Gen Z workplaces..."
                      className="w-full bg-slate-800/40 border border-slate-700/50 rounded-[2rem] p-8 text-white placeholder:text-slate-700 outline-none focus:bg-slate-800 focus:border-indigo-500 transition-all resize-none h-48 text-lg font-medium shadow-inner"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Complexity</label>
                      <select
                        value={generationCount}
                        onChange={(e) => setGenerationCount(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
                        className="w-full bg-slate-800/40 border border-slate-700/50 rounded-2xl py-5 px-6 text-white text-xs outline-none focus:bg-slate-800 cursor-pointer appearance-none font-black tracking-widest"
                      >
                        <option value="auto">SMART OPTIMIZATION</option>
                        <option value="5">BASIC (05 TASKS)</option>
                        <option value="10">STANDARD (10 TASKS)</option>
                        <option value="15">ADVANCED (15 TASKS)</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={isGenerating || !prompt.trim()}
                      className="h-[68px] mt-auto bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl flex items-center justify-center gap-4 transition-all shadow-2xl shadow-indigo-600/20 active:scale-95 disabled:opacity-50 uppercase tracking-widest text-xs"
                    >
                      {isGenerating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Wand2 className="w-5 h-5" />}
                      {isGenerating ? 'Architecting...' : 'Build Module'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  <div className="p-8 bg-indigo-600/10 border border-indigo-500/20 rounded-[2.5rem] space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                        <Download className="w-6 h-6" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-white font-black text-lg mb-1 tracking-tight">Step 1: Export Instructions</h4>
                        <p className="text-slate-400 text-sm font-medium leading-relaxed">Copy our pedagogical rules and your current topic to use with ChatGPT or Claude.</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <input
                        type="text"
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="Current topic..."
                        className="flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-indigo-500 transition-all font-medium"
                      />
                      <button
                        onClick={handleCopyPrompt}
                        className="px-8 py-3 bg-white text-slate-950 font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-indigo-50 transition-all shadow-xl shadow-white/5 active:scale-95"
                      >
                        Copy Rules
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Step 2: Manual JSON Import</label>
                      <span className="flex items-center gap-2 text-[8px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">JSON PORTAL</span>
                    </div>
                    <div className="relative">
                      <textarea
                        value={importJson}
                        onChange={(e) => setImportJson(e.target.value)}
                        placeholder="Paste result from ChatGPT/Claude here..."
                        className="w-full bg-slate-800/20 border border-slate-700/30 rounded-[2rem] p-8 text-slate-400 placeholder:text-slate-800 outline-none focus:bg-slate-800/40 focus:border-indigo-500/50 transition-all resize-none h-56 text-xs font-mono shadow-inner"
                      />
                      <button
                        type="button"
                        disabled={!importJson.trim()}
                        onClick={handleImportJson}
                        className="absolute bottom-6 right-6 px-10 py-4 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black rounded-2xl transition-all shadow-2xl shadow-indigo-600/20 disabled:opacity-0 disabled:translate-y-4 uppercase tracking-widest"
                      >
                        Process & Save Lesson
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-12 pt-10 border-t border-slate-800 flex items-center gap-4 opacity-40">
                <Shield className="w-5 h-5 text-indigo-400" />
                <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tight leading-relaxed">Xiaomi MiMo-V2 Hybrid Core. Advanced content integrity verified.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};