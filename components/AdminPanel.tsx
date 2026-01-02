import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft, Plus, Trash2, LogOut, LayoutDashboard, Wand2, Loader2,
  Book, Edit3, ChevronRight, Hash, Users, Shield, User as UserIcon,
  Mail, Calendar, BarChart3, TrendingUp, PieChart, Activity, Search,
  ArrowUpRight, Filter, Download, Award, Clock, Star, Sparkles, AlertCircle
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { Lesson, Exercise, UserProfile, AdminStats } from '../types';
import { getAllProfiles, updateProfile, signOut, getUserDetailedProgress } from '../services/authService';
import { getAdminStats, getRecentActivity, updateLesson, updateExercise, insertExercise, deleteExercise, updateExerciseOrder } from '../services/lessonService';
import { LessonWizard } from './LessonWizard';
import { SortableExerciseItem } from './SortableExerciseItem';
import { InsertionZone } from './InsertionZone';
import { useToast } from './Toast';

interface AdminPanelProps {
  lessons: Lesson[];
  profile: UserProfile | null;
  onAddLesson: (lesson: Lesson) => void;
  onUpdateLesson: (lesson: Lesson) => void;
  onDeleteLesson: (id: string) => void;
  onBack: () => void;
  onRefreshData?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  lessons,
  profile,
  onAddLesson,
  onUpdateLesson,
  onDeleteLesson,
  onBack,
  onRefreshData
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

  // Manual Exercise State
  const [newExercise, setNewExercise] = useState<Partial<Exercise>>({
    type: 'translation',
    difficulty: 'Medium',
    vietnamese: '',
    hint: ''
  });

  // Inline Editing State
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineEditValue, setInlineEditValue] = useState('');

  // Insertion State for Cell-style
  const [insertAtIndex, setInsertAtIndex] = useState<number | null>(null);

  // Drag & Drop Sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Toast notifications
  const { showToast } = useToast();

  // Throttle mechanism to prevent excessive API calls
  const lastFetchTimeRef = React.useRef<Record<string, number>>({});
  const FETCH_THROTTLE_MS = 5000; // 5 seconds minimum between fetches for same tab

  useEffect(() => {
    const now = Date.now();
    const lastFetch = lastFetchTimeRef.current[activeTab] || 0;

    // Skip if we fetched this tab within throttle window
    if (now - lastFetch < FETCH_THROTTLE_MS) {
      return;
    }

    fetchData();
  }, [activeTab]);

  const fetchData = async (forceRefresh = false) => {
    const now = Date.now();
    const lastFetch = lastFetchTimeRef.current[activeTab] || 0;

    // Double-check throttle (for manual refresh calls)
    if (!forceRefresh && now - lastFetch < FETCH_THROTTLE_MS) {
      return;
    }

    lastFetchTimeRef.current[activeTab] = now;
    setIsFetchingData(true);

    try {
      if (activeTab === 'students') {
        const data = await getAllProfiles({ useCache: !forceRefresh, forceRefresh });
        setStudents(data);
      } else if (activeTab === 'overview') {
        const [statsData, activityData] = await Promise.all([
          getAdminStats({ useCache: !forceRefresh, forceRefresh }),
          getRecentActivity({ useCache: !forceRefresh, forceRefresh })
        ]);
        setStats(statsData);
        setRecentActivity(activityData);
      } else if (activeTab === 'lessons' && onRefreshData) {
        onRefreshData();
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
    try {
      await updateProfile(student.id, { role: newRole });
      setStudents(prev => prev.map(s => s.id === student.id ? { ...s, role: newRole } : s));
      showToast(`Đã cập nhật vai trò thành ${newRole}`, 'success');
    } catch (err) {
      showToast('Không thể cập nhật vai trò.', 'error');
    }
  };

  // Drag & Drop Handler
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !viewingLessonId) return;

    const currentLesson = lessons.find(l => l.id === viewingLessonId);
    if (!currentLesson) return;

    const oldIndex = currentLesson.exercises.findIndex(e => e.id === active.id);
    const newIndex = currentLesson.exercises.findIndex(e => e.id === over.id);

    if (oldIndex !== -1 && newIndex !== -1) {
      const newExercises = arrayMove(currentLesson.exercises, oldIndex, newIndex);
      onUpdateLesson({ ...currentLesson, exercises: newExercises });

      // Persist new order
      const orderUpdates = newExercises.map((ex, index) => ({
        id: ex.id,
        order_index: index
      }));
      updateExerciseOrder(orderUpdates)
        .then(() => showToast('Đã sắp xếp lại thứ tự', 'success', 2000))
        .catch(err => {
          console.error('Failed to update order:', err);
          showToast('Không thể lưu thứ tự mới', 'error');
        });
    }
  }, [viewingLessonId, lessons, onUpdateLesson, showToast]);

  // Inline Editing Handlers
  const startInlineEdit = useCallback((exercise: Exercise) => {
    setInlineEditId(exercise.id);
    setInlineEditValue(exercise.vietnamese);
  }, []);

  const saveInlineEdit = useCallback(async () => {
    if (!inlineEditId || !viewingLessonId) {
      setInlineEditId(null);
      return;
    }
    const trimmed = inlineEditValue.trim();
    if (!trimmed) {
      showToast('Nội dung không được để trống', 'error');
      setInlineEditId(null);
      return;
    }
    try {
      const success = await updateExercise(inlineEditId, { vietnamese: trimmed });
      if (success) {
        const currentLesson = lessons.find(l => l.id === viewingLessonId);
        if (currentLesson) {
          const updatedExercises = currentLesson.exercises.map(ex =>
            ex.id === inlineEditId ? { ...ex, vietnamese: trimmed } : ex
          );
          onUpdateLesson({ ...currentLesson, exercises: updatedExercises });
        }
        showToast('Đã lưu thay đổi', 'success', 2000);
      } else {
        showToast('Không thể lưu thay đổi', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Có lỗi xảy ra khi lưu', 'error');
    }
    setInlineEditId(null);
  }, [inlineEditId, inlineEditValue, viewingLessonId, lessons, onUpdateLesson, showToast]);

  // Insert Exercise at Index
  const handleInsertExerciseAt = useCallback((index: number) => {
    setInsertAtIndex(index);
    setNewExercise({ type: 'translation', difficulty: 'Medium', vietnamese: '', hint: '' });
  }, []);

  const [isInsertingExercise, setIsInsertingExercise] = useState(false);

  const confirmInsertExercise = useCallback(async () => {
    if (!viewingLessonId || !newExercise.vietnamese || insertAtIndex === null || isInsertingExercise) return;
    const currentLesson = lessons.find(l => l.id === viewingLessonId);
    if (!currentLesson) return;

    setIsInsertingExercise(true);
    try {
      // Save to database first
      const savedExercise = await insertExercise(viewingLessonId, {
        type: newExercise.type as 'translation' | 'roleplay' | 'detective' || 'translation',
        vietnamese: newExercise.vietnamese,
        hint: newExercise.hint || undefined,
        difficulty: newExercise.difficulty as 'Easy' | 'Medium' | 'Hard'
      });

      if (!savedExercise) {
        showToast('Không thể lưu câu hỏi. Vui lòng thử lại.', 'error');
        return;
      }

      // Update local state with the DB-returned exercise (has proper ID)
      const newExercises = [...currentLesson.exercises];
      newExercises.splice(insertAtIndex, 0, savedExercise);
      onUpdateLesson({ ...currentLesson, exercises: newExercises });

      showToast('Đã thêm câu hỏi mới', 'success');
      setInsertAtIndex(null);
      setNewExercise({ type: 'translation', difficulty: 'Medium', vietnamese: '', hint: '' });
    } catch (err) {
      console.error('Error inserting exercise:', err);
      showToast('Có lỗi xảy ra khi lưu câu hỏi.', 'error');
    } finally {
      setIsInsertingExercise(false);
    }
  }, [viewingLessonId, lessons, newExercise, insertAtIndex, onUpdateLesson, isInsertingExercise, showToast]);

  const handleAddManualExercise = async () => {
    if (!viewingLessonId || !newExercise.vietnamese || isInsertingExercise) return;
    const currentLesson = lessons.find(l => l.id === viewingLessonId);
    if (!currentLesson) return;

    setIsInsertingExercise(true);
    try {
      // Save to database first
      const savedExercise = await insertExercise(viewingLessonId, {
        type: newExercise.type as 'translation' | 'roleplay' | 'detective' || 'translation',
        vietnamese: newExercise.vietnamese,
        hint: newExercise.hint || undefined,
        difficulty: newExercise.difficulty as 'Easy' | 'Medium' | 'Hard'
      });

      if (!savedExercise) {
        showToast('Không thể lưu câu hỏi. Vui lòng thử lại.', 'error');
        return;
      }

      // Update local state with the DB-returned exercise
      const updatedLesson = {
        ...currentLesson,
        exercises: [...currentLesson.exercises, savedExercise]
      };
      onUpdateLesson(updatedLesson);
      showToast('Đã thêm câu hỏi mới', 'success');
      setNewExercise({ type: 'translation', difficulty: 'Medium', vietnamese: '', hint: '' });
    } catch (err) {
      console.error('Error adding manual exercise:', err);
      showToast('Có lỗi xảy ra khi lưu câu hỏi.', 'error');
    } finally {
      setIsInsertingExercise(false);
    }
  };

  const handleDeleteExercise = async (exerciseId: string) => {
    if (!viewingLessonId) return;

    const currentLesson = lessons.find(l => l.id === viewingLessonId);
    if (!currentLesson) return;

    // Store for potential rollback
    const previousExercises = [...currentLesson.exercises];

    // Optimistically update UI
    const updatedLesson = {
      ...currentLesson,
      exercises: currentLesson.exercises.filter(ex => ex.id !== exerciseId)
    };
    onUpdateLesson(updatedLesson);

    try {
      const success = await deleteExercise(exerciseId);
      if (!success) {
        throw new Error('Failed to delete');
      }
      showToast('Đã xóa câu hỏi', 'success');
    } catch (err) {
      console.error(err);
      // Rollback on failure
      onUpdateLesson({ ...currentLesson, exercises: previousExercises });
      showToast('Không thể xóa câu hỏi. Vui lòng thử lại.', 'error');
    }
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
        showToast('Đã cập nhật bài học', 'success');
      } else {
        showToast('Không thể cập nhật bài học.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Có lỗi xảy ra khi cập nhật.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateExerciseContent = async (exerciseId: string, updates: Partial<Exercise>) => {
    // Input validation
    if (updates.vietnamese !== undefined && !updates.vietnamese.trim()) {
      showToast('Nội dung câu hỏi không được để trống.', 'error');
      return;
    }

    // Store previous state for rollback
    const targetLesson = viewingLessonId
      ? lessons.find(l => l.id === viewingLessonId)
      : lessons.find(l => l.exercises.some(ex => ex.id === exerciseId));
    const previousExercise = targetLesson?.exercises.find(ex => ex.id === exerciseId);

    setIsUpdating(true);
    try {
      const success = await updateExercise(exerciseId, updates);
      if (success) {
        if (targetLesson) {
          const updatedExercises = targetLesson.exercises.map(ex =>
            ex.id === exerciseId ? { ...ex, ...updates } : ex
          );
          onUpdateLesson({ ...targetLesson, exercises: updatedExercises });
        }
        setEditingExercise(null);
        showToast('Đã cập nhật câu hỏi', 'success');
      } else {
        showToast('Không thể cập nhật câu hỏi.', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Có lỗi xảy ra khi cập nhật.', 'error');
      // Rollback UI state on failure
      if (previousExercise && targetLesson) {
        const revertedExercises = targetLesson.exercises.map(ex =>
          ex.id === exerciseId ? previousExercise : ex
        );
        onUpdateLesson({ ...targetLesson, exercises: revertedExercises });
      }
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

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={lesson.exercises.map(e => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1 mb-12">
                    {lesson.exercises.map((ex, idx) => (
                      <React.Fragment key={ex.id}>
                        {/* Cell-style insertion zone */}
                        <InsertionZone
                          index={idx}
                          onInsert={() => handleInsertExerciseAt(idx)}
                        />

                        {/* Inline Insert Form - M3 Eye-Comfort Design */}
                        {insertAtIndex === idx && (
                          <div
                            className="p-6 rounded-3xl mb-3 animate-scale-in shadow-lg"
                            style={{
                              backgroundColor: 'var(--md-sys-color-surface-container-low)',
                              border: '1px solid var(--md-sys-color-outline-variant)'
                            }}
                          >
                            {/* Header */}
                            <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                              <div
                                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md"
                                style={{ backgroundColor: 'var(--md-sys-color-primary)' }}
                              >
                                <Plus className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-bold text-base" style={{ color: 'var(--md-sys-color-on-surface)' }}>Thêm câu hỏi mới</h4>
                                <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Vị trí: #{idx + 1}</p>
                              </div>
                            </div>

                            <div className="space-y-5">
                              {/* Vietnamese Input */}
                              <div>
                                <label className="text-[11px] font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                                  Nội dung câu hỏi
                                </label>
                                <input
                                  type="text"
                                  autoFocus
                                  placeholder="Nhập nội dung tiếng Việt..."
                                  value={newExercise.vietnamese || ''}
                                  onChange={(e) => setNewExercise({ ...newExercise, vietnamese: e.target.value })}
                                  className="w-full p-4 rounded-2xl outline-none transition-all text-base"
                                  style={{
                                    backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                                    border: '1px solid var(--md-sys-color-outline-variant)',
                                    color: 'var(--md-sys-color-on-surface)'
                                  }}
                                />
                              </div>

                              {/* Type & Difficulty Row */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[11px] font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                                    Loại bài tập
                                  </label>
                                  <select
                                    value={newExercise.type || 'translation'}
                                    onChange={(e) => setNewExercise({ ...newExercise, type: e.target.value as any })}
                                    className="w-full p-3.5 rounded-2xl outline-none font-medium text-sm cursor-pointer transition-all"
                                    style={{
                                      backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                                      border: '1px solid var(--md-sys-color-outline-variant)',
                                      color: 'var(--md-sys-color-on-surface)'
                                    }}
                                  >
                                    <option value="translation">📝 Translation</option>
                                    <option value="roleplay">💬 Role-play</option>
                                    <option value="detective">🔍 Detective</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="text-[11px] font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                                    Độ khó
                                  </label>
                                  <select
                                    value={newExercise.difficulty || 'Medium'}
                                    onChange={(e) => setNewExercise({ ...newExercise, difficulty: e.target.value as any })}
                                    className="w-full p-3.5 rounded-2xl outline-none font-medium text-sm cursor-pointer transition-all"
                                    style={{
                                      backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                                      border: '1px solid var(--md-sys-color-outline-variant)',
                                      color: 'var(--md-sys-color-on-surface)'
                                    }}
                                  >
                                    <option value="Easy">🟢 Easy</option>
                                    <option value="Medium">🟡 Medium</option>
                                    <option value="Hard">🔴 Hard</option>
                                  </select>
                                </div>
                              </div>

                              {/* Hint (Optional) */}
                              <div>
                                <label className="text-[11px] font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                                  Gợi ý <span className="font-normal opacity-60">(tùy chọn)</span>
                                </label>
                                <input
                                  type="text"
                                  placeholder="VD: Chú ý thì của động từ..."
                                  value={newExercise.hint || ''}
                                  onChange={(e) => setNewExercise({ ...newExercise, hint: e.target.value })}
                                  className="w-full p-3.5 rounded-2xl outline-none text-sm transition-all"
                                  style={{
                                    backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                                    border: '1px solid var(--md-sys-color-outline-variant)',
                                    color: 'var(--md-sys-color-on-surface)'
                                  }}
                                />
                              </div>
                            </div>

                            {/* Action Buttons - M3 Filled & Outlined */}
                            <div className="flex gap-3 mt-6 pt-5" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                              <button
                                onClick={confirmInsertExercise}
                                disabled={!newExercise.vietnamese || isInsertingExercise}
                                className="flex-1 px-5 py-3.5 text-white font-bold rounded-2xl text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                                style={{ backgroundColor: 'var(--md-sys-color-primary)' }}
                              >
                                {isInsertingExercise ? (
                                  <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</>
                                ) : (
                                  '✓ Thêm câu hỏi'
                                )}
                              </button>
                              <button
                                onClick={() => setInsertAtIndex(null)}
                                className="px-5 py-3.5 font-bold rounded-2xl text-sm transition-all hover:opacity-80"
                                style={{
                                  backgroundColor: 'var(--md-sys-color-surface-container)',
                                  color: 'var(--md-sys-color-on-surface-variant)',
                                  border: '1px solid var(--md-sys-color-outline-variant)'
                                }}
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Sortable Exercise Item */}
                        <SortableExerciseItem
                          exercise={ex}
                          index={idx}
                          onEdit={() => setEditingExercise(ex)}
                          onDelete={() => handleDeleteExercise(ex.id)}
                          onInlineEdit={() => startInlineEdit(ex)}
                          isInlineEditing={inlineEditId === ex.id}
                          inlineValue={inlineEditValue}
                          onInlineChange={setInlineEditValue}
                          onInlineSave={saveInlineEdit}
                        />
                      </React.Fragment>
                    ))}

                    {/* Final insertion zone at end */}
                    <InsertionZone
                      index={lesson.exercises.length}
                      onInsert={() => handleInsertExerciseAt(lesson.exercises.length)}
                    />

                    {insertAtIndex === lesson.exercises.length && (
                      <div
                        className="p-6 rounded-3xl animate-scale-in shadow-lg"
                        style={{
                          backgroundColor: 'var(--md-sys-color-surface-container-low)',
                          border: '1px solid var(--md-sys-color-outline-variant)'
                        }}
                      >
                        {/* Header */}
                        <div className="flex items-center gap-3 mb-5 pb-4" style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
                          <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-md"
                            style={{ backgroundColor: 'var(--md-sys-color-primary)' }}
                          >
                            <Plus className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="font-bold text-base" style={{ color: 'var(--md-sys-color-on-surface)' }}>Thêm câu hỏi mới</h4>
                            <p className="text-xs" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>Vị trí cuối cùng</p>
                          </div>
                        </div>

                        <div className="space-y-5">
                          {/* Vietnamese Input */}
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                              Nội dung câu hỏi
                            </label>
                            <input
                              type="text"
                              autoFocus
                              placeholder="Nhập nội dung tiếng Việt..."
                              value={newExercise.vietnamese || ''}
                              onChange={(e) => setNewExercise({ ...newExercise, vietnamese: e.target.value })}
                              className="w-full p-4 rounded-2xl outline-none transition-all text-base"
                              style={{
                                backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                                border: '1px solid var(--md-sys-color-outline-variant)',
                                color: 'var(--md-sys-color-on-surface)'
                              }}
                            />
                          </div>

                          {/* Type & Difficulty Row */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-[11px] font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                                Loại bài tập
                              </label>
                              <select
                                value={newExercise.type || 'translation'}
                                onChange={(e) => setNewExercise({ ...newExercise, type: e.target.value as any })}
                                className="w-full p-3.5 rounded-2xl outline-none font-medium text-sm cursor-pointer transition-all"
                                style={{
                                  backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                                  border: '1px solid var(--md-sys-color-outline-variant)',
                                  color: 'var(--md-sys-color-on-surface)'
                                }}
                              >
                                <option value="translation">📝 Translation</option>
                                <option value="roleplay">💬 Role-play</option>
                                <option value="detective">🔍 Detective</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[11px] font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                                Độ khó
                              </label>
                              <select
                                value={newExercise.difficulty || 'Medium'}
                                onChange={(e) => setNewExercise({ ...newExercise, difficulty: e.target.value as any })}
                                className="w-full p-3.5 rounded-2xl outline-none font-medium text-sm cursor-pointer transition-all"
                                style={{
                                  backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                                  border: '1px solid var(--md-sys-color-outline-variant)',
                                  color: 'var(--md-sys-color-on-surface)'
                                }}
                              >
                                <option value="Easy">🟢 Easy</option>
                                <option value="Medium">🟡 Medium</option>
                                <option value="Hard">🔴 Hard</option>
                              </select>
                            </div>
                          </div>

                          {/* Hint (Optional) */}
                          <div>
                            <label className="text-[11px] font-bold uppercase tracking-wide mb-2 block" style={{ color: 'var(--md-sys-color-on-surface-variant)' }}>
                              Gợi ý <span className="font-normal opacity-60">(tùy chọn)</span>
                            </label>
                            <input
                              type="text"
                              placeholder="VD: Chú ý thì của động từ..."
                              value={newExercise.hint || ''}
                              onChange={(e) => setNewExercise({ ...newExercise, hint: e.target.value })}
                              className="w-full p-3.5 rounded-2xl outline-none text-sm transition-all"
                              style={{
                                backgroundColor: 'var(--md-sys-color-surface-container-lowest)',
                                border: '1px solid var(--md-sys-color-outline-variant)',
                                color: 'var(--md-sys-color-on-surface)'
                              }}
                            />
                          </div>
                        </div>

                        {/* Action Buttons - M3 Filled & Outlined */}
                        <div className="flex gap-3 mt-6 pt-5" style={{ borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
                          <button
                            onClick={confirmInsertExercise}
                            disabled={!newExercise.vietnamese || isInsertingExercise}
                            className="flex-1 px-5 py-3.5 text-white font-bold rounded-2xl text-sm transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                            style={{ backgroundColor: 'var(--md-sys-color-primary)' }}
                          >
                            {isInsertingExercise ? (
                              <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</>
                            ) : (
                              '✓ Thêm câu hỏi'
                            )}
                          </button>
                          <button
                            onClick={() => setInsertAtIndex(null)}
                            className="px-5 py-3.5 font-bold rounded-2xl text-sm transition-all hover:opacity-80"
                            style={{
                              backgroundColor: 'var(--md-sys-color-surface-container)',
                              color: 'var(--md-sys-color-on-surface-variant)',
                              border: '1px solid var(--md-sys-color-outline-variant)'
                            }}
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </SortableContext>
              </DndContext>

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
                    disabled={!newExercise.vietnamese || isInsertingExercise}
                    className="mt-8 px-10 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl transition-all shadow-2xl shadow-indigo-200 disabled:opacity-50 disabled:active:scale-100 active:scale-95 uppercase tracking-widest text-xs flex items-center justify-center gap-2"
                  >
                    {isInsertingExercise ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Đang lưu...</>
                    ) : (
                      'Save into lesson'
                    )}
                  </button>
                </div>
              </div>
            </div >
          </div >
        </div >

        {/* Exercise Edit Modal - Inside viewingLessonId block */}
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
                      value={editingExercise.type || 'translation'}
                      onChange={(e) => setEditingExercise({ ...editingExercise, type: e.target.value as any })}
                    >
                      <option value="translation">📝 Translation</option>
                      <option value="roleplay">💬 Role-play</option>
                      <option value="detective">🔍 Detective</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Difficulty</label>
                    <select
                      className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none bg-white cursor-pointer font-bold shadow-sm"
                      value={editingExercise.difficulty || 'Medium'}
                      onChange={(e) => setEditingExercise({ ...editingExercise, difficulty: e.target.value as any })}
                    >
                      <option value="Easy">🟢 Easy</option>
                      <option value="Medium">🟡 Medium</option>
                      <option value="Hard">🔴 Hard</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Learning Hint <span className="font-normal opacity-60">(optional)</span></label>
                  <input
                    type="text"
                    placeholder="VD: Chú ý thì của động từ..."
                    value={editingExercise.hint || ''}
                    onChange={(e) => setEditingExercise({ ...editingExercise, hint: e.target.value })}
                    className="w-full p-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    disabled={isUpdating}
                    onClick={() => handleUpdateExerciseContent(editingExercise.id, {
                      vietnamese: editingExercise.vietnamese,
                      hint: editingExercise.hint,
                      type: editingExercise.type,
                      difficulty: editingExercise.difficulty
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
      </div >
    );
  }

  // --- DASHBOARD VIEW ---

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans flex flex-col md:flex-row">
      {/* Sidebar - M3 Clean */}
      <div className="bg-slate-900 w-full md:w-72 p-6 flex flex-col gap-8 sticky top-0 h-auto md:h-screen z-50 text-white overflow-y-auto">
        <div className="flex items-center gap-3 py-2 border-b border-slate-800 pb-6">
          <div className="bg-indigo-600 p-2 rounded-xl"><LayoutDashboard className="w-6 h-6 text-white" /></div>
          <div>
            <span className="font-semibold text-lg block">Admin Panel</span>
            <span className="text-xs text-slate-500">Quản lý hệ thống</span>
          </div>
        </div>

        <nav className="flex-1 space-y-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'overview' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5" /> Tổng quan
            </div>
          </button>
          <button
            onClick={() => setActiveTab('lessons')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'lessons' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <div className="flex items-center gap-3">
              <Book className="w-5 h-5" /> Bài học
            </div>
          </button>
          <button
            onClick={() => setActiveTab('students')}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'students' ? 'bg-white text-slate-900' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
          >
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5" /> Học viên
            </div>
          </button>
        </nav>

        <div className="space-y-1 pt-6 border-t border-slate-800">
          <div className="px-4 py-4 bg-slate-800/50 rounded-xl mb-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-white flex items-center justify-center text-slate-900 font-semibold">
                  {profile?.full_name?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-white">{profile?.full_name}</p>
              <span className="text-xs text-indigo-400">Admin</span>
            </div>
          </div>
          <button
            onClick={onBack}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl font-medium transition-all text-sm"
          >
            <ArrowLeft className="w-5 h-5" /> Trang chủ
          </button>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl font-medium transition-all text-sm"
          >
            <LogOut className="w-5 h-5" /> Đăng xuất
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 md:p-8 overflow-y-auto max-w-7xl">
        {activeTab === 'overview' && (
          <div className="animate-fade-in space-y-12">
            <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-semibold text-slate-800 mb-1">Tổng quan</h1>
                <p className="text-slate-500 text-sm">Theo dõi tiến độ học viên và hiệu quả giảng dạy</p>
              </div>
              <button
                onClick={() => fetchData(true)}
                disabled={isFetchingData}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium rounded-xl transition-all text-sm"
              >
                {isFetchingData ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Đang tải...</>
                ) : (
                  <><Activity className="w-4 h-4" /> Làm mới</>
                )}
              </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                { label: 'Tổng học viên', value: stats?.totalStudents || 0, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50', status: 'Ổn định' },
                { label: 'Số bài học', value: stats?.totalLessons || 0, icon: Book, color: 'text-emerald-600', bg: 'bg-emerald-50', status: 'Hoạt động' },
                { label: 'Lượt hoàn thành', value: stats?.totalCompletions || 0, icon: Activity, color: 'text-purple-600', bg: 'bg-purple-50', status: `+${stats?.thisWeekCompletions || 0} tuần này` },
                { label: 'Điểm TB', value: `${stats?.avgScore || 0}%`, icon: Award, color: 'text-amber-600', bg: 'bg-amber-50', status: (stats?.avgScore || 0) > 70 ? 'Tốt' : 'Cần cải thiện' },
                { label: 'Hoạt động hôm nay', value: stats?.activeToday || 0, icon: Clock, color: 'text-cyan-600', bg: 'bg-cyan-50', status: 'học viên' },
              ].map((s, idx) => (
                <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:shadow-lg transition-all">
                  <div className={`${s.bg} w-12 h-12 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <s.icon className={`w-6 h-6 ${s.color}`} />
                  </div>
                  <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-1">{s.label}</p>
                  <p className="text-3xl font-black text-slate-900">{s.value}</p>
                  <div className="absolute top-6 right-6">
                    <span className={`text-[8px] font-bold uppercase tracking-tight px-2 py-1 rounded-md border 
                      ${s.status === 'Cần cải thiện' ? 'bg-rose-50 text-rose-500 border-rose-100' : 'bg-emerald-50 text-emerald-500 border-emerald-100'}`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              {/* Center Column: Hoạt động gần đây */}
              <div className="lg:col-span-2 space-y-8">
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-3">
                      <Activity className="w-5 h-5 text-indigo-600" /> Hoạt động gần đây
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {recentActivity.length === 0 ? (
                      <div className="py-16 text-center text-slate-400 font-medium">Chưa có hoạt động nào được ghi nhận.</div>
                    ) : (
                      recentActivity.map((act) => (
                        <div key={act.id} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-all border border-transparent hover:border-slate-100">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm overflow-hidden ${act.score >= 80 ? 'bg-emerald-500' : act.score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}>
                              {act.profiles?.avatar_url ? (
                                <img src={act.profiles.avatar_url} alt={act.profiles.full_name} className="w-full h-full object-cover" />
                              ) : (
                                act.profiles?.full_name?.charAt(0) || '?'
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{act.profiles?.full_name || 'Ẩn danh'}</p>
                              <p className="text-xs text-slate-500">Hoàn thành <span className="text-indigo-600 font-semibold">{act.lessons?.title || 'Bài học'}</span></p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-sm font-black ${act.score >= 80 ? 'text-emerald-500' : act.score >= 50 ? 'text-amber-500' : 'text-rose-500'}`}>{act.score}%</span>
                            <p className="text-[9px] text-slate-400 font-medium mt-0.5">{new Date(act.completed_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Bài học cần chú ý */}
                  <div className="bg-rose-50/30 rounded-[2.5rem] p-8 border border-rose-100 relative overflow-hidden">
                    <h4 className="text-rose-900 font-bold uppercase tracking-widest text-[10px] mb-6 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Bài học cần chú ý
                    </h4>
                    <h3 className="text-lg font-black text-slate-900 mb-4">Cần cải thiện nội dung</h3>
                    <div className="space-y-3">
                      {!stats?.difficultLessons?.length ? (
                        <p className="text-slate-400 text-sm italic">Tất cả bài học đang hoạt động tốt! ✨</p>
                      ) : (
                        stats?.difficultLessons.map(lesson => (
                          <div key={lesson.id} className="bg-white p-4 rounded-xl border border-rose-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                            <div>
                              <p className="font-bold text-slate-900 text-sm truncate pr-4">{lesson.title}</p>
                              <p className="text-[10px] text-slate-400">{lesson.attempts || 0} lượt làm</p>
                            </div>
                            <span className="text-rose-600 font-black text-sm bg-rose-50 px-3 py-1.5 rounded-lg">{lesson.avgScore}%</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Học viên xuất sắc */}
                  <div className="bg-emerald-50/30 rounded-[2.5rem] p-8 border border-emerald-100 relative overflow-hidden">
                    <h4 className="text-emerald-900 font-bold uppercase tracking-widest text-[10px] mb-6 flex items-center gap-2">
                      <Star className="w-4 h-4" /> Học viên xuất sắc
                    </h4>
                    <h3 className="text-lg font-black text-slate-900 mb-4">Top 5 chăm chỉ nhất</h3>
                    <div className="space-y-3">
                      {!stats?.topLearners?.length ? (
                        <p className="text-slate-400 text-sm italic">Đang chờ kết quả đầu tiên...</p>
                      ) : (
                        stats?.topLearners.map((user, idx) => (
                          <div key={user.id} className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm flex items-center gap-3 hover:shadow-md transition-shadow">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${idx === 0 ? 'bg-amber-100 text-amber-600' : idx === 1 ? 'bg-slate-100 text-slate-600' : 'bg-orange-50 text-orange-600'
                              }`}>
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <p className="font-bold text-slate-900 text-sm">{user.full_name}</p>
                              <p className="text-[10px] text-slate-400">{user.completions} bài • {user.avgScore}% TB</p>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Tổng quan & Học viên cần hỗ trợ */}
              <div className="space-y-8">
                {/* At-Risk Students */}
                <div className="bg-amber-50/50 rounded-[2.5rem] p-8 border border-amber-200 relative overflow-hidden">
                  <h4 className="text-amber-800 font-bold uppercase tracking-widest text-[10px] mb-6 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Học viên cần hỗ trợ
                  </h4>
                  <h3 className="text-lg font-black text-slate-900 mb-4">Điểm thấp hoặc không hoạt động</h3>
                  <div className="space-y-3">
                    {!stats?.atRiskStudents?.length ? (
                      <p className="text-slate-400 text-sm italic">Tất cả học viên đang hoạt động tốt! 🎉</p>
                    ) : (
                      stats?.atRiskStudents.map(student => (
                        <div key={student.id} className="bg-white p-4 rounded-xl border border-amber-200 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{student.full_name}</p>
                            <p className="text-[10px] text-amber-600 font-medium">{student.reason}</p>
                          </div>
                          <div className="text-right">
                            <span className={`font-black text-sm ${student.avgScore < 50 ? 'text-rose-500' : 'text-slate-600'}`}>
                              {student.avgScore}%
                            </span>
                            {student.daysSinceActive > 0 && (
                              <p className="text-[9px] text-slate-400">{student.daysSinceActive} ngày trước</p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Tổng quan hiệu suất */}
                <div className="bg-slate-950 rounded-[2.5rem] p-8 text-white shadow-xl flex flex-col">
                  <h3 className="text-xl font-black mb-8 flex items-center gap-3">
                    <TrendingUp className="w-5 h-5 text-indigo-400" /> Tổng quan hiệu suất
                  </h3>

                  <div className="space-y-8 flex-1 flex flex-col">
                    <div>
                      <div className="flex justify-between items-end mb-3">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Điểm trung bình</p>
                        <span className="text-2xl font-black text-indigo-400">{stats?.avgScore || 0}%</span>
                      </div>
                      <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-1000" style={{ width: `${stats?.avgScore || 0}%` }} />
                      </div>
                    </div>

                    <div className="p-6 bg-slate-900/50 rounded-2xl border border-slate-800">
                      <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-4">Xu hướng tuần này</p>
                      <div className="flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center ${(stats?.weeklyGrowth || 0) >= 0 ? 'bg-emerald-500/20 border border-emerald-500/30' : 'bg-rose-500/20 border border-rose-500/30'
                          }`}>
                          <span className={`text-lg font-black ${(stats?.weeklyGrowth || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {(stats?.weeklyGrowth || 0) >= 0 ? '+' : ''}{stats?.weeklyGrowth || 0}%
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-slate-200">{stats?.thisWeekCompletions || 0} lượt hoàn thành</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">so với tuần trước</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setActiveTab('lessons')}
                      className="w-full py-4 bg-white text-slate-950 hover:bg-slate-100 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] text-sm"
                    >
                      <Book className="w-4 h-4" /> Quản lý bài học
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lessons' && (
          <div className="animate-fade-in space-y-12">
            <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-8">
              <div>
                <h1 className="text-3xl font-heading font-black text-slate-900 tracking-tighter mb-4">Curriculum Control</h1>
                <p className="text-slate-500 text-lg font-medium">Design and organize your learning modules.</p>
              </div>
              <div className="flex gap-4 w-full lg:w-auto">
                <button
                  onClick={() => setIsArchitectOpen(true)}
                  className="flex-1 lg:flex-none px-8 py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-3xl shadow-xl shadow-indigo-100 flex items-center justify-center gap-3 active:scale-95 transition-all text-xs uppercase tracking-widest"
                >
                  <Sparkles className="w-4 h-4" /> AI Architect
                </button>
                <button
                  onClick={() => fetchData(true)}
                  disabled={isFetchingData}
                  className="flex items-center gap-2 px-8 py-5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-black rounded-3xl transition-all text-xs uppercase tracking-widest active:scale-95"
                >
                  {isFetchingData ? (
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  ) : (
                    <Activity className="w-4 h-4 text-indigo-600" />
                  )}
                  Làm mới
                </button>
              </div>
            </header>

            <div className="grid grid-cols-1 gap-8 items-start">
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
                    <div key={lesson.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row sm:items-center gap-6 group hover:border-indigo-500 transition-all hover:shadow-2xl hover:shadow-indigo-500/5 cursor-pointer" onClick={() => setViewingLessonId(lesson.id)}>
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
                <h1 className="text-3xl font-heading font-black text-slate-900 tracking-tighter mb-4">Identity Vault</h1>
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
              <button
                onClick={() => fetchData(true)}
                disabled={isFetchingData}
                className="flex items-center gap-2 px-8 py-5 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-800 font-black rounded-3xl transition-all text-xs uppercase tracking-widest active:scale-95"
              >
                {isFetchingData ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                ) : (
                  <Activity className="w-4 h-4 text-indigo-600" />
                )}
                Làm mới
              </button>
            </header>

            <div className="bg-white rounded-[2.5rem] border border-slate-200/60 shadow-xl shadow-slate-200/30 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[800px]">
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
                              <div className="w-16 h-16 rounded-[1.25rem] flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-100 group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                                {student.avatar_url ? (
                                  <img src={student.avatar_url} alt={student.full_name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                                    {student.full_name?.charAt(0).toUpperCase()}
                                  </div>
                                )}
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

      {/* Student Detail Panel */}
      {selectedStudent && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex items-end md:items-center justify-end">
          <div className="bg-white w-full md:w-[600px] h-[90vh] md:h-screen shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-10 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-3xl flex items-center justify-center text-white font-black text-3xl shadow-2xl shadow-indigo-200 overflow-hidden">
                  {selectedStudent.avatar_url ? (
                    <img src={selectedStudent.avatar_url} alt={selectedStudent.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-indigo-600 flex items-center justify-center">
                      {selectedStudent.full_name?.charAt(0).toUpperCase()}
                    </div>
                  )}
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

      {/* Lesson Wizard Modal */}
      <LessonWizard
        isOpen={isArchitectOpen}
        onClose={() => setIsArchitectOpen(false)}
        onAddLesson={onAddLesson}
      />
    </div>
  );
};