/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type QuestionType = 'pg' | 'pgk' | 'bs' | 'menjodohkan';

export interface QuestionOption {
  key: string; // 'A' | 'B' | 'C' | 'D'
  text: string;
}

export type SubtestPai = 
  | "Al-Qur'an dan Hadis"
  | 'Akidah'
  | 'Akhlak'
  | 'Fikih'
  | 'Sejarah Peradaban Islam (SPI)';

export interface StatementItem {
  id: string;
  text: string;
  correctAnswer: 'B' | 'S'; // Benar / Salah
}

export interface MatchingPremise {
  id: string;
  premise: string; // Kolom Kiri (Premis / Konsep)
  correctMatch: string; // Jawaban benar di Kolom Kanan
}

export const DEFAULT_PAI_BABS = [
  "Bab 1: Al-Qur'an dan Hadis",
  "Bab 2: Akidah",
  "Bab 3: Akhlak",
  "Bab 4: Fikih",
  "Bab 5: Sejarah Peradaban Islam (SPI)"
];

export interface ClassRombel {
  id: string;
  code: string; // e.g. 'VII-A'
  name: string; // e.g. 'Kelas VII-A'
  tingkat: string; // e.g. 'Kelas VII'
  isActive: boolean; // Status aktifasi ujian oleh guru
  token: string; // Token ujian khusus kelas atau warisan
  examTitle: string; // Judul mata uji kelas
  activatedAt?: number;
  totalStudents?: number;
  activeBabs?: string[]; // Bab yang diaktifkan untuk ujian rombel ini. Default: ['SEMUA']
}

export interface Question {
  id: number;
  number: number;
  bab?: string; // Bab materi e.g. "Bab 1: Al-Qur'an dan Hadis"
  subtest: string; // SubtestPai atau materi PAI & BP
  type: QuestionType;
  targetClass?: string; // e.g. 'SEMUA' atau gabungan 'Kelas VII-A, Kelas VII-B'
  targetClasses?: string[]; // Array rombel target e.g. ['Kelas VII-A', 'Kelas VII-B'] atau ['SEMUA']
  stimulus?: string; // Teks bacaan / studi kasus
  stimulusTitle?: string;
  questionText: string;
  svgDiagram?: string; // SVG inline illustration / diagram
  options?: QuestionOption[]; // for 'pg' and 'pgk'
  statements?: StatementItem[]; // for 'bs'
  matchingPremises?: MatchingPremise[]; // for 'menjodohkan' (Kolom Kiri)
  matchingChoices?: string[]; // for 'menjodohkan' (Pilihan Kolom Kanan)
  correctAnswer: string | string[]; // 'A', or ['A', 'C'], or map/serialized
  explanation: string; // Pembahasan detail
  difficulty: 'Mudah' | 'Sedang' | 'HOTS / Sulit';
  points: number;
}

export function getQuestionBab(q: Partial<Question>): string {
  if (q.bab && q.bab.trim()) return q.bab.trim();
  if (q.subtest && q.subtest.trim()) {
    const s = q.subtest.trim();
    if (s.toLowerCase().includes("qur'an") || s.toLowerCase().includes("hadis")) return "Bab 1: Al-Qur'an dan Hadis";
    if (s.toLowerCase().includes("akidah")) return "Bab 2: Akidah";
    if (s.toLowerCase().includes("akhlak")) return "Bab 3: Akhlak";
    if (s.toLowerCase().includes("fikih")) return "Bab 4: Fikih";
    if (s.toLowerCase().includes("sejarah") || s.toLowerCase().includes("spi")) return "Bab 5: Sejarah Peradaban Islam (SPI)";
    return s;
  }
  return "Bab 1: Al-Qur'an dan Hadis";
}

export function isQuestionInActiveBabs(question: Question, activeBabs?: string[]): boolean {
  if (!activeBabs || activeBabs.length === 0 || activeBabs.includes('SEMUA')) {
    return true;
  }
  const qBab = getQuestionBab(question).trim().toLowerCase();
  return activeBabs.some((b) => {
    const cleanB = b.trim().toLowerCase();
    return cleanB === 'semua' || cleanB === qBab || qBab.includes(cleanB) || cleanB.includes(qBab);
  });
}

/**
 * Batasan Kriteria Ketuntasan Minimum (KKM) Kurikulum:
 * - Kelas VII: 67
 * - Kelas VIII: 70
 * - Kelas IX: 73
 */
export const KKM_CONFIG = {
  VII: 67,
  VIII: 70,
  IX: 73
} as const;

export function getKkmForClass(classNameOrCode?: string): number {
  if (!classNameOrCode) return 67;
  const upper = classNameOrCode.toUpperCase().trim();
  if (upper.includes('IX') || upper.includes('9')) {
    return 73;
  }
  if (upper.includes('VIII') || upper.includes('8')) {
    return 70;
  }
  if (upper.includes('VII') || upper.includes('7')) {
    return 67;
  }
  return 67;
}

export function isStudentPassed(kelas: string, percentage: number): boolean {
  const kkm = getKkmForClass(kelas);
  return percentage >= kkm;
}

export function isQuestionAssignedToClass(question: Question, classNameOrCode?: string): boolean {
  if (!classNameOrCode) return true;
  const cleanTarget = classNameOrCode.trim().toLowerCase();

  // If question has targetClasses array
  if (question.targetClasses && question.targetClasses.length > 0) {
    if (question.targetClasses.includes('SEMUA')) return true;
    return question.targetClasses.some((tc) => {
      const cleanTc = tc.trim().toLowerCase();
      return (
        cleanTc === cleanTarget ||
        cleanTarget.includes(cleanTc) ||
        cleanTc.includes(cleanTarget)
      );
    });
  }

  // If question has legacy single or comma-separated targetClass
  if (!question.targetClass || question.targetClass === 'SEMUA') {
    return true;
  }

  const parts = question.targetClass.split(',').map((p) => p.trim().toLowerCase());
  if (parts.includes('semua')) return true;

  return parts.some((p) => p === cleanTarget || cleanTarget.includes(p) || p.includes(cleanTarget));
}

export interface Student {
  id: string;
  noPeserta: string;
  nama: string;
  nisn: string;
  sekolah: string;
  ruang: string;
  sesi: string;
  fotoUrl?: string;
  kelas: string;
}

export interface UserAnswer {
  questionId: number;
  selectedOption?: string; // 'A' | 'B' | 'C' | 'D' | 'E'
  selectedOptions?: string[]; // for PGK
  statementAnswers?: Record<string, 'B' | 'S'>; // for BS
  matchingAnswers?: Record<string, string>; // for Menjodohkan (premiseId -> choiceText)
  textAnswer?: string;
  isDoubtful: boolean; // Ragu-ragu checkbox
  answeredAt?: number;
}

export interface SubtestScoreSummary {
  subtest: string;
  correct: number;
  total: number;
  score: number;
}

export interface ExamResult {
  examId: string;
  examTitle: string;
  student: Student;
  startTime: number;
  endTime: number;
  durationSecondsUsed: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  doubtfulCount: number;
  rawScore: number;
  maxPoints?: number;
  scaleScore: number; // Skala UTBK/TKA 200 - 900
  percentage: number;
  isPassed: boolean;
  kkm?: number;
  subtestScores: SubtestScoreSummary[];
  answers: Record<number, UserAnswer>;
}

export interface ExamSession {
  examId: string;
  title: string;
  subtests: string[];
  durationMinutes: number;
  totalQuestions: number;
}

export interface ExamTokenState {
  token: string;
  generatedAt: number;
  expiresInMinutes: number;
}
