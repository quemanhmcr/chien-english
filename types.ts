export interface Exercise {
  id: string;
  type: 'translation' | 'roleplay' | 'detective';
  vietnamese: string; // For translation: the sentence. For roleplay: the situation/goal.
  difficulty: 'Easy' | 'Medium' | 'Hard';
  hint?: string;
}

export interface Lesson {
  id: string;
  title: string;
  description: string;
  level: string; // e.g., "Beginner", "Intermediate"
  exercises: Exercise[];
}

export interface AnalysisToken {
  text: string;
  status: 'correct' | 'error' | 'missing' | 'extra';
  correction?: string;
  errorType?: string;
  explanation?: string;
}

export interface AlternativeOption {
  type: 'Formal' | 'Casual' | 'Native';
  text: string;
  context: string;
}

export interface VocabularyItem {
  word: string;
  type: string;
  meaning: string;
  example: string;
}

export interface EvaluationResult {
  score: number;
  correction: string;
  explanation: string;
  isPass: boolean;
  improvedVersion?: string;
  detailedAnalysis: AnalysisToken[];
  alternatives?: AlternativeOption[];
  keyTakeaway: string;
  relatedVocabulary?: VocabularyItem[];
  // Role-play specific
  rolePlayMetrics?: {
    taskAchievement?: number;
    coherence?: number;
    lexicalResource?: number;
    grammar?: number;
  };
  toneType?: 'Aggressive' | 'Blunt' | 'Casual' | 'Neutral' | 'Warm' | 'Polite' | 'Formal' | 'OverlyFormal';
  toneValue?: number; // -100 (Rude) to 100 (Too Formal)
  modelSentence?: string; // Model answer for comparison
  suggestionPhrases?: string[]; // Suggested phrases to improve
  // Detective specific
  originalError?: string; // The original error segment
  userCaughtError?: boolean; // Did user catch the right error?
  verdict?: 'Case Closed' | 'Good Lead' | 'Wrong Suspect' | 'Cold Case'; // Detective verdict
}

export interface PronunciationWord {
  word: string;
  isCorrect: boolean;
  ipa?: string;
  errorType?: string;
}

export interface PronunciationResult {
  score: number;
  generalFeedback: string;
  words: PronunciationWord[];
}

export enum AppState {
  IDLE = 'IDLE',
  EVALUATING = 'EVALUATING',
  FEEDBACK = 'FEEDBACK',
  COMPLETED = 'COMPLETED',
  ERROR = 'ERROR'
}

export interface UserProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  role: 'student' | 'admin';
  created_at: string;
  updated_at?: string;
  xp: number;
  level: number;
  streak_current: number;
  last_active_at?: string;
}

export interface UserProgress {
  id: string;
  user_id: string;
  lesson_id: string;
  score: number;
  completed_at: string;
}

export interface AdminStats {
  totalStudents: number;
  totalLessons: number;
  totalCompletions: number;
  avgScore: number;
  difficultLessons: { id: string, title: string, avgScore: number, attempts?: number }[];
  topLearners: { id: string, full_name: string, completions: number, avgScore: number }[];
  atRiskStudents?: { id: string, full_name: string, avgScore: number, daysSinceActive: number, reason: string }[];
  weeklyGrowth?: number;
  activeToday?: number;
  thisWeekCompletions?: number;
}
