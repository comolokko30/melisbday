import { Timestamp } from 'firebase/firestore';

export type GameStatus = 'waiting' | 'playing' | 'results' | 'leaderboard' | 'finished';

export interface GameSession {
  id: string;
  pin: string;
  status: GameStatus;
  currentQuestionIndex: number;
  questionStartTime: Timestamp | null;
  hostId: string;
  totalQuestions: number;
  createdAt: Timestamp;
}

export interface Participant {
  id: string;
  name: string;
  score: number;
  lastAnswer?: {
    questionIndex: number;
    choiceIndex: number;
    isCorrect: boolean;
    pointsEarned: number;
    timestamp: Timestamp;
  };
}

export interface Question {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  order: number;
}
