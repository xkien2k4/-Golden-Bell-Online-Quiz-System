export type UserRole = 'ADMIN' | 'TEACHER' | 'STUDENT' | 'DISPLAY';

export type CompetitionStatus = 'DRAFT' | 'WAITING' | 'LIVE' | 'PAUSED' | 'FINISHED';

export type GameState =
  | 'WAITING'
  | 'QUESTION_READY'
  | 'ANSWERING'
  | 'LOCKED'
  | 'ANSWER_REVEALED'
  | 'RESULT'
  | 'INTERMISSION'
  | 'RESCUE'
  | 'TIEBREAKER'
  | 'FINISHED';

export type ParticipantStatus = 'ACTIVE' | 'ELIMINATED' | 'RESCUED' | 'SPECTATOR';

export type QuestionType = 'ABCD' | 'TRUE_FALSE' | 'SHORT_ANSWER' | 'NUMERIC' | 'IMAGE';

export const THPT_2510_CLASSES = [
  // Khối 10: 14 lớp (10A1 -> 10A14)
  '10A1', '10A2', '10A3', '10A4', '10A5', '10A6', '10A7', '10A8', '10A9', '10A10', '10A11', '10A12', '10A13', '10A14',
  // Khối 11: 11 lớp (11A1 -> 11A11)
  '11A1', '11A2', '11A3', '11A4', '11A5', '11A6', '11A7', '11A8', '11A9', '11A10', '11A11',
  // Khối 12: 8 lớp (12A1 -> 12A8)
  '12A1', '12A2', '12A3', '12A4', '12A5', '12A6', '12A7', '12A8',
] as const;

export const THPT_2510_CLASSES_BY_GRADE = {
  'Khối 10 (14 lớp: 10A1 - 10A14)': [
    '10A1', '10A2', '10A3', '10A4', '10A5', '10A6', '10A7', '10A8', '10A9', '10A10', '10A11', '10A12', '10A13', '10A14',
  ],
  'Khối 11 (11 lớp: 11A1 - 11A11)': [
    '11A1', '11A2', '11A3', '11A4', '11A5', '11A6', '11A7', '11A8', '11A9', '11A10', '11A11',
  ],
  'Khối 12 (8 lớp: 12A1 - 12A8)': [
    '12A1', '12A2', '12A3', '12A4', '12A5', '12A6', '12A7', '12A8',
  ],
} as const;

export type THPTClass = (typeof THPT_2510_CLASSES)[number];

export interface QuestionOption {
  id: string; // 'A', 'B', 'C', 'D'
  text: string;
}

export interface Question {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  correctAnswer: string;
  acceptedAnswers?: string[];
  caseSensitive?: boolean;
  ignoreDiacritics?: boolean;
  ignoreSpaces?: boolean;
  explanation?: string;
  timeLimitSeconds: number;
  subject?: string;
  gradeLevel?: string;
  imageUrl?: string;
  isTieBreaker?: boolean;
  isActive: boolean;
}

export interface Participant {
  id: string;
  sessionId: string;
  name: string;
  className: string; // One of 33 classes
  grade?: string; // Optional (e.g. 10, 11, 12 from class name)
  studentCode?: string; // SBD 01 -> 66
  status: ParticipantStatus;
  eliminatedAtQuestionIndex: number | null;
  eliminatedAtQuestionOrder: number | null;
  rescuedAtQuestionIndex?: number | null;
  isOnline: boolean;
  lastSeenAt: number;
  joinedAt: number;
  totalCorrect: number;
  totalWrong: number;
  totalResponseTimeMs: number;
  violations: string[];
}

export interface AnswerSubmission {
  participantId: string;
  questionId: string;
  answer: string;
  submittedAtServer: number;
  clientResponseTimeMs: number;
  isCorrect?: boolean;
}

export interface CompetitionRules {
  eliminateOnWrong: boolean;
  eliminateOnNoAnswer: boolean;
  allowAnswerChange: boolean;
  showCorrectAnswer: boolean;
  showExplanation: boolean;
  autoNextQuestion: boolean;
  allowRescue: boolean;
  allowTiebreaker: boolean;
  requirePreRegistration: boolean;
  lockRoomOnStart: boolean;
}

export interface RescueEvent {
  id: string;
  timestamp: number;
  type: 'ALL' | 'RANDOM' | 'CLASS' | 'SPECIFIC_QUESTION' | 'MANUAL';
  description: string;
  count: number;
  rescuedParticipantIds: string[];
}

export interface SystemLog {
  id: string;
  timestamp: number;
  action: string;
  performedBy: string;
  details?: string;
}

export interface Competition {
  id: string;
  roomCode: string;
  title: string;
  schoolName: string;
  slogan: string;
  organizer: string;
  totalExpectedParticipants?: number; // 66 thí sinh
  totalClasses?: number; // 33 lớp
  grades?: string[];
  date: string;
  time: string;
  location: string;
  status: CompetitionStatus;
  gameState: GameState;
  currentQuestionIndex: number;
  questionStartTime: number | null;
  questionEndTime: number | null;
  serverTime?: number;
  rules: CompetitionRules;
  questions: Question[];
  participants: Participant[];
  answers: Record<string, Record<string, AnswerSubmission>>;
  rescues: RescueEvent[];
  logs: SystemLog[];
  winnerId: string | null;
  ceremonyMode?: 'CHAMPION' | 'TOP3' | 'TOP5';
  createdAt: number;
  updatedAt: number;
}

export interface ClientQuestionState {
  id: string;
  order: number;
  type: QuestionType;
  prompt: string;
  options?: QuestionOption[];
  timeLimitSeconds: number;
  subject?: string;
  imageUrl?: string;
  isTieBreaker?: boolean;
  correctAnswer?: string;
  acceptedAnswers?: string[];
  explanation?: string;
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  className: string;
  studentCode?: string;
  totalCorrect: number;
  totalWrong: number;
  totalResponseTimeMs: number;
  avgResponseTimeMs: number;
  status: ParticipantStatus;
}

export interface ClientGameState {
  competitionId: string;
  roomCode: string;
  title: string;
  schoolName: string;
  slogan: string;
  status: CompetitionStatus;
  gameState: GameState;
  currentQuestionIndex: number;
  totalQuestions: number;
  currentQuestion: ClientQuestionState | null;
  questionStartTime: number | null;
  questionEndTime: number | null;
  serverTime: number;
  timeRemaining: number;
  winner: Participant | null;
  ceremonyMode?: 'CHAMPION' | 'TOP3' | 'TOP5';
  leaderboard?: LeaderboardEntry[];
  stats: {
    totalParticipants: number;
    activeCount: number;
    eliminatedCount: number;
    rescuedCount: number;
    onlineCount: number;
    answeredCount: number;
    totalClassesCount?: number;
    byGrade?: {
      '10': number;
      '11': number;
      '12': number;
    };
    currentAnswersCount?: {
      A?: number;
      B?: number;
      C?: number;
      D?: number;
      correct?: number;
      wrong?: number;
    };
  };
  rules: CompetitionRules;
  participantStatuses?: Record<
    string,
    {
      status: ParticipantStatus;
      isOnline?: boolean;
      totalCorrect: number;
      totalWrong: number;
      eliminatedAtQuestionOrder: number | null;
    }
  >;
}
