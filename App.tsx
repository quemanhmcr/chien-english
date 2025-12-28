import React, { useState, useEffect } from 'react';
import { Lesson, UserProfile as UserProfileType } from './types';
import { LearnerView } from './components/LearnerView';
import { AdminPanel } from './components/AdminPanel';
import { Auth } from './components/Auth';
import { UserProfile } from './components/UserProfile';
import { getLessons, saveLesson, deleteLesson, getUserProgress } from './services/lessonService';
import { supabase } from './services/supabaseClient';
import { getProfile, ensureProfile } from './services/authService';
import { Session } from '@supabase/supabase-js';

const App: React.FC = () => {
  const [view, setView] = useState<'learner' | 'admin'>('learner');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfileType | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [userProgress, setUserProgress] = useState<any[]>([]);
  const [exerciseProgress, setExerciseProgress] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showProfile, setShowProfile] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const fetchData = async (userId?: string) => {
    try {
      console.log('App: Fetching data for user:', userId || 'Guest');
      const lessonsData = await getLessons();
      setLessons(lessonsData);

      if (userId) {
        const [progressData, exProgressData] = await Promise.all([
          getUserProgress(userId),
          import('./services/lessonService').then(m => m.getExerciseProgress(userId))
        ]);
        setUserProgress(progressData);
        setExerciseProgress(exProgressData);
      }
    } catch (err) {
      console.error('App: Error in fetchData:', err);
    }
  };

  const fetchProfileData = async (userId: string, metadata?: any) => {
    try {
      console.log('App: Ensuring profile for user:', userId);
      const userProfile = await ensureProfile(userId, metadata);
      console.log('App: Profile result:', userProfile ? 'Found/Created' : 'Failed');
      setProfile(userProfile);
    } catch (err) {
      console.error('App: Error in fetchProfileData:', err);
    }
  };

  // Handle Data Fetching based on session changes
  useEffect(() => {
    const userId = session?.user?.id;

    if (userId) {
      console.log('App: Session detected for user:', userId);
      fetchProfileData(userId, session?.user?.user_metadata);
      fetchData(userId);
    } else if (!isLoading) {
      console.log('App: No session, fetching guest data');
      fetchData();
    }
  }, [session?.user?.id]);

  useEffect(() => {
    console.log('App: Mounting and setting up auth listener...');

    // Clear auth error fragments from URL to prevent loops
    const hash = window.location.hash;
    if (hash && (hash.includes('error=') || hash.includes('error_description='))) {
      console.warn('App: Auth error detected in URL, clearing hash.');
      const params = new URLSearchParams(hash.substring(1));
      const errorMsg = params.get('error_description') || params.get('error');
      if (errorMsg) setAuthError(decodeURIComponent(errorMsg.replace(/\+/g, ' ')));
      window.history.replaceState(null, '', window.location.pathname);
    }

    // Initial session check & Listener
    // Note: onAuthStateChange triggers INITIAL_SESSION or SIGNED_IN immediately on subscribe
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log(`App: Auth State Change [${event}]:`, currentSession ? 'Session Active' : 'Session Null');

      setSession(currentSession);
      setIsLoading(false);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setUserProgress([]);
      }
    });

    return () => {
      console.log('App: Unmounting component');
      subscription.unsubscribe();
    };
  }, []);

  const handleAddLesson = async (newLesson: Lesson) => {
    const saved = await saveLesson(
      { title: newLesson.title, description: newLesson.description, level: newLesson.level },
      newLesson.exercises.map(ex => ({ type: ex.type, vietnamese: ex.vietnamese, difficulty: ex.difficulty, hint: ex.hint }))
    );
    if (saved) {
      setLessons(prev => [saved, ...prev]);
    } else {
      throw new Error('Failed to save lesson to database');
    }
  };

  const handleUpdateLesson = (updatedLesson: Lesson) => {
    setLessons(prev => prev.map(l => l.id === updatedLesson.id ? updatedLesson : l));
  };

  const handleDeleteLesson = async (lessonId: string) => {
    const success = await deleteLesson(lessonId);
    if (success) {
      setLessons(prev => prev.filter(l => l.id !== lessonId));
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="relative">
        {authError && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md animate-slide-down">
            <div className="mx-4 p-4 bg-rose-500 text-white rounded-2xl shadow-2xl flex items-center gap-3 font-bold text-sm">
              <div className="bg-white/20 p-2 rounded-xl">
                <span className="text-lg">⚠️</span>
              </div>
              <p>{authError}</p>
              <button onClick={() => setAuthError(null)} className="ml-auto hover:bg-white/10 p-2 rounded-lg transition-colors">✕</button>
            </div>
          </div>
        )}
        <Auth onAuthComplete={() => { }} />
      </div>
    );
  }

  return (
    <>
      {view === 'learner' ? (
        <LearnerView
          lessons={lessons}
          onOpenAdmin={() => setView('admin')}
          userProfile={profile}
          onOpenProfile={() => setShowProfile(true)}
          userProgress={userProgress}
          exerciseProgress={exerciseProgress}
          onRefreshData={() => fetchData(session?.user?.id)}
        />
      ) : (
        <AdminPanel
          lessons={lessons}
          profile={profile}
          onAddLesson={handleAddLesson}
          onUpdateLesson={handleUpdateLesson}
          onDeleteLesson={handleDeleteLesson}
          onBack={() => setView('learner')}
        />
      )}

      {showProfile && profile && (
        <UserProfile
          profile={profile}
          onUpdate={(updated) => setProfile(updated)}
          onClose={() => setShowProfile(false)}
        />
      )}
    </>
  );
};

export default App;