/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Clock, 
  HelpCircle, 
  CheckCircle, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight, 
  Grid, 
  Maximize2, 
  Minimize2, 
  X, 
  Send, 
  Flag, 
  User, 
  Check, 
  ZoomIn, 
  ZoomOut, 
  AlertTriangle,
  Sparkles,
  ArrowRight,
  RotateCcw
} from 'lucide-react';
import { Question, Student, UserAnswer, ExamResult, getKkmForClass, isStudentPassed } from '../types/cbt';
import { MOCK_EXAM_INFO } from '../data/mockQuestions';

interface TkaExamViewProps {
  student: Student;
  questions: Question[];
  durationMinutes: number;
  onFinishExam: (result: ExamResult) => void;
  onCancelToDashboard: () => void;
}

export const TkaExamView: React.FC<TkaExamViewProps> = ({
  student,
  questions,
  durationMinutes = 60,
  onFinishExam,
  onCancelToDashboard
}) => {
  // Current question index (0-based)
  const [currentIndex, setCurrentIndex] = useState(0);

  // User answers map: questionId -> UserAnswer
  const [answers, setAnswers] = useState<Record<number, UserAnswer>>({});

  // Total countdown timer in seconds (60 minutes default or passed prop, ample time for students)
  const examDurationSeconds = Math.max((durationMinutes || 60) * 60, questions.length * 180);
  const [totalSecondsRemaining, setTotalSecondsRemaining] = useState(examDurationSeconds);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Font size state: 'sm' | 'base' | 'lg'
  const [fontSize, setFontSize] = useState<'sm' | 'base' | 'lg'>('base');

  // Question list drawer toggle (mobile / popup)
  const [showQuestionPalette, setShowQuestionPalette] = useState(false);

  // Finish exam confirmation dialog (only confirmed by user on last question or intentional submit)
  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [confirmAgreed, setConfirmAgreed] = useState(false);

  // Modal if student clicks finish from sidebar when not on the last question yet
  const [showEarlyFinishNotice, setShowEarlyFinishNotice] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Time-up modal state (if the full 60 minutes expire)
  const [isTimeUp, setIsTimeUp] = useState(false);

  const startTime = useMemo(() => Date.now(), []);

  const totalCount = questions.length;
  const isLastQuestion = currentIndex === totalCount - 1;
  const isFirstQuestion = currentIndex === 0;

  const currentQ = questions[currentIndex];
  const currentAnswer = answers[currentQ?.id] || {
    questionId: currentQ?.id,
    isDoubtful: false
  };

  // Timer countdown effect: decrements total remaining seconds every second
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
      setTotalSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setIsTimeUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Format seconds to HH:MM:SS
  const formatTime = (totalSec: number) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${h > 0 ? String(h).padStart(2, '0') + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Answer handler for Single Choice (PG)
  const handleSelectOption = (key: string) => {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        questionId: currentQ.id,
        selectedOption: key,
        isDoubtful: prev[currentQ.id]?.isDoubtful || false,
        answeredAt: Date.now()
      }
    }));
  };

  // Answer handler for Multi Choice (PGK)
  const handleToggleMultiOption = (key: string) => {
    if (!currentQ) return;
    const existing = currentAnswer.selectedOptions || [];
    const updated = existing.includes(key)
      ? existing.filter((k) => k !== key)
      : [...existing, key];

    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        questionId: currentQ.id,
        selectedOptions: updated,
        isDoubtful: prev[currentQ.id]?.isDoubtful || false,
        answeredAt: Date.now()
      }
    }));
  };

  // Answer handler for Benar / Salah (BS)
  const handleStatementAnswer = (statementId: string, value: 'B' | 'S') => {
    if (!currentQ) return;
    const existing = currentAnswer.statementAnswers || {};
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        questionId: currentQ.id,
        statementAnswers: {
          ...existing,
          [statementId]: value
        },
        isDoubtful: prev[currentQ.id]?.isDoubtful || false,
        answeredAt: Date.now()
      }
    }));
  };

  // Answer handler for Menjodohkan (Matching)
  const handleMatchAnswer = (premiseId: string, choiceText: string) => {
    if (!currentQ) return;
    const existing = currentAnswer.matchingAnswers || {};
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        questionId: currentQ.id,
        matchingAnswers: {
          ...existing,
          [premiseId]: choiceText
        },
        isDoubtful: prev[currentQ.id]?.isDoubtful || false,
        answeredAt: Date.now()
      }
    }));
  };

  // Toggle Ragu-Ragu
  const handleToggleDoubtful = () => {
    if (!currentQ) return;
    setAnswers((prev) => {
      const existing = prev[currentQ.id] || { questionId: currentQ.id, isDoubtful: false };
      return {
        ...prev,
        [currentQ.id]: {
          ...existing,
          isDoubtful: !existing.isDoubtful
        }
      };
    });
  };

  // Check if a question is answered
  const isQuestionAnswered = (q: Question) => {
    const ans = answers[q.id];
    if (!ans) return false;
    if (q.type === 'pg') {
      return !!ans.selectedOption;
    }
    if (q.type === 'pgk') {
      return (ans.selectedOptions && ans.selectedOptions.length > 0);
    }
    if (q.type === 'bs') {
      return ans.statementAnswers && Object.keys(ans.statementAnswers).length === (q.statements?.length || 0);
    }
    if (q.type === 'menjodohkan') {
      const totalPremises = q.matchingPremises?.length || 0;
      const answeredPremises = ans.matchingAnswers ? Object.keys(ans.matchingAnswers).filter(k => !!ans.matchingAnswers![k]).length : 0;
      return totalPremises > 0 && answeredPremises === totalPremises;
    }
    return false;
  };

  // Calculate summaries
  const answeredCount = questions.filter((q) => isQuestionAnswered(q)).length;
  const doubtfulCount = questions.filter((q) => answers[q.id]?.isDoubtful).length;
  const unansweredCount = totalCount - answeredCount;

  // Toggle fullscreen mode
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  // Final calculate and submit handler
  const handleFinalSubmit = () => {
    const endTime = Date.now();
    const durationSecondsUsed = Math.floor((endTime - startTime) / 1000);

    let correctCount = 0;
    let wrongCount = 0;
    let totalPoints = 0;
    let maxPossiblePoints = 0;

    const subtestMap: Record<string, { correct: number; total: number; score: number }> = {};

    questions.forEach((q) => {
      maxPossiblePoints += q.points;
      const ans = answers[q.id];

      if (!subtestMap[q.subtest]) {
        subtestMap[q.subtest] = { correct: 0, total: 0, score: 0 };
      }
      subtestMap[q.subtest].total += 1;

      let isCorrect = false;

      if (ans) {
        if (q.type === 'pg' && ans.selectedOption === q.correctAnswer) {
          isCorrect = true;
        } else if (q.type === 'pgk' && Array.isArray(q.correctAnswer) && ans.selectedOptions) {
          const sortedUser = [...ans.selectedOptions].sort();
          const sortedCorrect = [...q.correctAnswer].sort();
          if (
            sortedUser.length === sortedCorrect.length &&
            sortedUser.every((val, index) => val === sortedCorrect[index])
          ) {
            isCorrect = true;
          }
        } else if (q.type === 'bs' && q.statements && ans.statementAnswers) {
          const allStatementsCorrect = q.statements.every(
            (stmt) => ans.statementAnswers?.[stmt.id] === stmt.correctAnswer
          );
          if (allStatementsCorrect) {
            isCorrect = true;
          }
        } else if (q.type === 'menjodohkan' && q.matchingPremises && ans.matchingAnswers) {
          const allMatchedCorrectly = q.matchingPremises.every(
            (premise) => ans.matchingAnswers?.[premise.id] === premise.correctMatch
          );
          if (allMatchedCorrectly) {
            isCorrect = true;
          }
        }
      }

      if (isCorrect) {
        correctCount += 1;
        totalPoints += q.points;
        subtestMap[q.subtest].correct += 1;
      } else if (isQuestionAnswered(q)) {
        wrongCount += 1;
      }
    });

    const percentage = maxPossiblePoints > 0
      ? Math.round((totalPoints / maxPossiblePoints) * 100)
      : Math.round((correctCount / totalCount) * 100);
    // Skala nilai CBT: rentang 200 s/d 900
    const scaleScore = Math.round(200 + (percentage / 100) * 700);

    const kkm = getKkmForClass(student.kelas);
    const isPassed = percentage >= kkm;

    const result: ExamResult = {
      examId: MOCK_EXAM_INFO.id,
      examTitle: MOCK_EXAM_INFO.title,
      student,
      startTime,
      endTime,
      durationSecondsUsed,
      totalQuestions: totalCount,
      correctCount,
      wrongCount,
      unansweredCount,
      doubtfulCount,
      rawScore: totalPoints,
      maxPoints: maxPossiblePoints,
      scaleScore,
      percentage,
      kkm,
      isPassed,
      subtestScores: Object.entries(subtestMap).map(([subtest, stat]) => ({
        subtest,
        correct: stat.correct,
        total: stat.total,
        score: Math.round((stat.correct / stat.total) * 100)
      })),
      answers
    };

    onFinishExam(result);
  };

  // Font class dynamic
  const contentFontSizeClass = {
    sm: 'text-sm',
    base: 'text-base',
    lg: 'text-lg'
  }[fontSize];

  if (!currentQ || questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-800">Tidak Ada Soal Ujian yang Aktif</h3>
          <p className="text-xs text-slate-600">
            Guru pengawas belum mengaktifkan Bab materi soal untuk kelas Anda. Silakan hubungi pengawas ujian.
          </p>
          <button
            type="button"
            onClick={onCancelToDashboard}
            className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold cursor-pointer transition"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-200 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] select-none">
      
      {/* 1. TOP HEADER KHAS CBT RESMI */}
      <header className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-950 text-white shadow-lg sticky top-0 z-40 border-b-2 border-amber-400">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 flex items-center justify-between">
          
          {/* Logo Kemdikbud / CBT Logo Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-400 flex items-center justify-center text-blue-950 font-black text-xl shadow-md border-2 border-white">
              CBT
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider font-extrabold text-amber-300 flex items-center gap-1.5">
                <span>CBT PAI & BP 2026</span>
                <span className="hidden sm:inline bg-emerald-700/80 px-2 py-0.5 rounded text-[10px] text-white">RESMI</span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-white truncate max-w-xs sm:max-w-md">
                {currentQ.subtest}
              </h1>
            </div>
          </div>

          {/* Center & Right Controls: Font Zoom, Fullscreen, Timer, Profile */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Font Zoom Controls (A- / A / A+) */}
            <div className="hidden md:flex items-center bg-blue-950/70 border border-blue-700 rounded-lg p-1 text-xs font-bold">
              <span className="text-[11px] text-slate-300 px-2">Font:</span>
              <button
                type="button"
                onClick={() => setFontSize('sm')}
                className={`px-2 py-1 rounded transition cursor-pointer ${fontSize === 'sm' ? 'bg-amber-400 text-slate-900 font-extrabold' : 'text-slate-200 hover:bg-blue-800'}`}
                title="Font Kecil"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => setFontSize('base')}
                className={`px-2 py-1 rounded transition cursor-pointer ${fontSize === 'base' ? 'bg-amber-400 text-slate-900 font-extrabold' : 'text-slate-200 hover:bg-blue-800'}`}
                title="Font Sedang"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => setFontSize('lg')}
                className={`px-2 py-1 rounded transition cursor-pointer ${fontSize === 'lg' ? 'bg-amber-400 text-slate-900 font-extrabold' : 'text-slate-200 hover:bg-blue-800'}`}
                title="Font Besar"
              >
                A+
              </button>
            </div>

            {/* Fullscreen Button */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="hidden lg:flex p-2 rounded-lg bg-blue-950/70 hover:bg-blue-800 border border-blue-700 text-slate-200 transition cursor-pointer"
              title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* SISA WAKTU UJIAN */}
            <div className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl border-2 shadow-inner transition ${
              totalSecondsRemaining < 300 
                ? 'bg-rose-950/95 border-rose-500 text-rose-200 animate-pulse' 
                : 'bg-slate-900/90 border-amber-400 text-amber-300'
            }`}>
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-[9px] uppercase tracking-wider font-extrabold text-slate-300 leading-none">
                  SISA WAKTU UJIAN
                </div>
                <div className="text-sm sm:text-base font-mono font-black tracking-widest leading-tight">
                  {formatTime(totalSecondsRemaining)}
                </div>
              </div>
            </div>

            {/* Student Profile Info */}
            <div className="flex items-center gap-2.5 pl-2 sm:pl-3 border-l border-blue-700/60">
              <img
                src={student.fotoUrl}
                alt={student.nama}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg object-cover border-2 border-white shadow-sm"
              />
              <div className="hidden xl:block text-left text-xs">
                <div className="font-bold text-white truncate max-w-[140px]">{student.nama}</div>
                <div className="text-[10px] text-blue-200 font-mono">{student.noPeserta} &bull; {student.kelas}</div>
              </div>
            </div>

          </div>

        </div>
      </header>

      {/* 2. SUB-HEADER BAR: INFO SOAL & TOMBOL DAFTAR SOAL */}
      <div className="bg-white border-b border-slate-300 shadow-sm sticky top-[62px] z-30">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
          
          {/* Question Indicator Badge */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <span className="px-3 py-1 bg-blue-700 text-white font-extrabold text-sm sm:text-base rounded-md tracking-wide shadow-sm">
              SOAL NO. {currentIndex + 1}
            </span>
            <span className="text-xs sm:text-sm text-slate-600 font-bold">
              dari {totalCount} butir soal
            </span>
            {isLastQuestion && (
              <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse">
                ★ SOAL TERAKHIR
              </span>
            )}
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 hidden md:inline">
              Tipe: {currentQ.type === 'pg' ? 'Pilihan Ganda (PG)' : currentQ.type === 'pgk' ? 'Pilihan Ganda Kompleks (PGK)' : currentQ.type === 'bs' ? 'Benar / Salah (B/S)' : 'Menjodohkan (Matching)'}
            </span>
          </div>

          {/* Quick Summary Badges & Drawer Button */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex items-center gap-2 text-xs font-semibold">
              <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Dijawab: {answeredCount}
              </span>
              <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Ragu: {doubtfulCount}
              </span>
              <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Belum: {unansweredCount}
              </span>
            </div>

            {/* TOMBOL DAFTAR SOAL (Khas CBT ANBK/UTBK) */}
            <button
              type="button"
              onClick={() => setShowQuestionPalette(!showQuestionPalette)}
              className="px-3.5 py-1.5 rounded-lg bg-blue-900 hover:bg-blue-800 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow transition active:scale-95 cursor-pointer"
            >
              <Grid className="w-4 h-4 text-amber-400" />
              <span>DAFTAR SOAL ({totalCount})</span>
            </button>
          </div>

        </div>
      </div>

      {/* 3. MAIN EXAM CONTENT AREA */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full flex flex-col">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1">
          
          {/* Main Question Box */}
          <div className="xl:col-span-9 flex flex-col">
            <div className="bg-white rounded-xl shadow-md border border-slate-300 p-5 sm:p-8 flex-1 flex flex-col justify-between">
              
              <div className="space-y-6">
                {/* Stimulus / Reading Text if available */}
                {currentQ.stimulus && (
                  <div className="bg-blue-50/70 border-l-4 border-blue-600 p-4 sm:p-5 rounded-r-xl text-slate-800">
                    {currentQ.stimulusTitle && (
                      <h3 className="font-bold text-blue-950 text-sm sm:text-base mb-2">
                        {currentQ.stimulusTitle}
                      </h3>
                    )}
                    <p className={`${contentFontSizeClass} leading-relaxed whitespace-pre-line text-slate-700 font-normal`}>
                      {currentQ.stimulus}
                    </p>
                  </div>
                )}

                {/* SVG Visual Diagram if available */}
                {currentQ.svgDiagram && (
                  <div className="flex justify-center my-4 p-4 bg-slate-50 border border-slate-200 rounded-xl overflow-x-auto">
                    <div dangerouslySetInnerHTML={{ __html: currentQ.svgDiagram }} />
                  </div>
                )}

                {/* Question Text */}
                <div className="pt-2">
                  <h2 className={`${contentFontSizeClass} font-bold text-slate-900 leading-snug`}>
                    {currentQ.questionText}
                  </h2>
                </div>

                {/* OPTIONS RENDERING BASED ON QUESTION TYPE */}
                <div className="pt-3">
                  {/* TIPE 1: PILIHAN GANDA BIASA (PG A, B, C, D) */}
                  {currentQ.type === 'pg' && currentQ.options && (
                    <div className="space-y-3">
                      {currentQ.options.map((opt) => {
                        const isSelected = currentAnswer.selectedOption === opt.key;
                        return (
                          <div
                            key={opt.key}
                            onClick={() => handleSelectOption(opt.key)}
                            className={`group flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-blue-50/80 border-blue-600 text-blue-950 shadow-sm font-semibold'
                                : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/70 text-slate-800'
                            }`}
                          >
                            {/* Bulat Radio Opsi A, B, C, D */}
                            <div
                              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center font-bold text-xs sm:text-sm shrink-0 transition-colors ${
                                isSelected
                                  ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                  : 'border-slate-400 group-hover:border-blue-500 text-slate-700 bg-slate-100'
                              }`}
                            >
                              {opt.key}
                            </div>
                            <div className={`${contentFontSizeClass} pt-0.5 leading-relaxed`}>
                              {opt.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* TIPE 2: PILIHAN GANDA KOMPLEKS (PGK - Multi Choice) */}
                  {currentQ.type === 'pgk' && currentQ.options && (
                    <div className="space-y-3">
                      <div className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">
                        * Pilihlah semua jawaban yang menurut Anda benar dengan mencentang kotak.
                      </div>
                      {currentQ.options.map((opt) => {
                        const isChecked = currentAnswer.selectedOptions?.includes(opt.key) || false;
                        return (
                          <div
                            key={opt.key}
                            onClick={() => handleToggleMultiOption(opt.key)}
                            className={`group flex items-start gap-3.5 p-3.5 sm:p-4 rounded-xl border-2 cursor-pointer transition ${
                              isChecked
                                ? 'bg-indigo-50/90 border-indigo-600 text-indigo-950 font-semibold'
                                : 'bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50/70 text-slate-800'
                            }`}
                          >
                            <div
                              className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition ${
                                isChecked
                                  ? 'bg-indigo-600 border-indigo-600 text-white'
                                  : 'border-slate-400 group-hover:border-indigo-500 bg-white'
                              }`}
                            >
                              {isChecked && <Check className="w-4 h-4 stroke-[3]" />}
                            </div>
                            <div className={`${contentFontSizeClass} leading-relaxed`}>
                              <span className="font-bold mr-2">{opt.key}.</span>
                              {opt.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* TIPE 3: BENAR / SALAH (BS - Tabel Pernyataan) */}
                  {currentQ.type === 'bs' && currentQ.statements && (
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse border border-slate-300 text-left rounded-lg overflow-hidden">
                        <thead className="bg-slate-100 text-xs font-bold text-slate-700 uppercase">
                          <tr>
                            <th className="p-3 border border-slate-300">Pernyataan</th>
                            <th className="p-3 border border-slate-300 text-center w-24 bg-emerald-50 text-emerald-800">
                              Benar
                            </th>
                            <th className="p-3 border border-slate-300 text-center w-24 bg-rose-50 text-rose-800">
                              Salah
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 text-xs sm:text-sm">
                          {currentQ.statements.map((stmt) => {
                            const val = currentAnswer.statementAnswers?.[stmt.id];
                            return (
                              <tr key={stmt.id} className="hover:bg-slate-50/80">
                                <td className="p-3 border border-slate-300 text-slate-800 leading-relaxed">
                                  {stmt.text}
                                </td>
                                <td
                                  onClick={() => handleStatementAnswer(stmt.id, 'B')}
                                  className={`p-3 border border-slate-300 text-center cursor-pointer transition ${
                                    val === 'B' ? 'bg-emerald-100 font-bold' : 'hover:bg-emerald-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-center">
                                    <div
                                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                        val === 'B'
                                          ? 'border-emerald-600 bg-emerald-600 text-white font-bold text-xs'
                                          : 'border-slate-400 bg-white'
                                      }`}
                                    >
                                      {val === 'B' && '✓'}
                                    </div>
                                  </div>
                                </td>
                                <td
                                  onClick={() => handleStatementAnswer(stmt.id, 'S')}
                                  className={`p-3 border border-slate-300 text-center cursor-pointer transition ${
                                    val === 'S' ? 'bg-rose-100 font-bold' : 'hover:bg-rose-50'
                                  }`}
                                >
                                  <div className="flex items-center justify-center">
                                    <div
                                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                        val === 'S'
                                          ? 'border-rose-600 bg-rose-600 text-white font-bold text-xs'
                                          : 'border-slate-400 bg-white'
                                      }`}
                                    >
                                      {val === 'S' && '✓'}
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TIPE 4: SOAL MENJODOHKAN (MATCHING) */}
                  {currentQ.type === 'menjodohkan' && currentQ.matchingPremises && (
                    <div className="space-y-4">
                      <div className="text-xs font-semibold text-blue-900 bg-blue-50/80 p-3.5 rounded-xl border border-blue-200 flex items-start gap-2.5">
                        <Sparkles className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <strong className="block text-blue-950 font-bold mb-0.5">Petunjuk Mengerjakan Soal Menjodohkan:</strong>
                          <span>Pasangkanlah setiap konsep pada <strong>Kolom Kiri</strong> dengan pilihan yang tepat pada <strong>Kolom Kanan</strong> menggunakan pilihan dropdown.</span>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {currentQ.matchingPremises.map((item, pIdx) => {
                          const currentMatch = currentAnswer.matchingAnswers?.[item.id] || '';
                          return (
                            <div
                              key={item.id}
                              className={`p-4 rounded-xl border-2 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                                currentMatch
                                  ? 'bg-blue-50/70 border-blue-400 shadow-xs'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3 flex-1">
                                <span className="w-7 h-7 rounded-lg bg-blue-900 text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                                  {pIdx + 1}
                                </span>
                                <span className={`${contentFontSizeClass} font-bold text-slate-900`}>
                                  {item.premise}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 md:w-1/2">
                                <span className="text-xs font-extrabold text-blue-700 shrink-0 flex items-center gap-1">
                                  <span>➔</span>
                                  <span>Pasangan:</span>
                                </span>
                                <select
                                  value={currentMatch}
                                  onChange={(e) => handleMatchAnswer(item.id, e.target.value)}
                                  className={`w-full p-2.5 rounded-xl border text-xs sm:text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-blue-600 ${
                                    currentMatch
                                      ? 'bg-white border-blue-500 text-blue-950 shadow-xs'
                                      : 'bg-slate-50 border-slate-300 text-slate-600'
                                  }`}
                                >
                                  <option value="">-- Pilih Jawaban yang Sesuai --</option>
                                  {(currentQ.matchingChoices || []).map((choice, cIdx) => (
                                    <option key={cIdx} value={choice}>
                                      {choice}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Info Pengerjaan Soal */}
              <div className="mt-8 pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Status Soal:</span>
                  {isQuestionAnswered(currentQ) ? (
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center gap-1 border border-emerald-300">
                      <Check className="w-3 h-3 text-emerald-600" />
                      Sudah Dijawab
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold border border-slate-300">
                      Belum Dijawab
                    </span>
                  )}
                  {currentAnswer.isDoubtful && (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold border border-amber-300">
                      Ditandai Ragu-Ragu
                    </span>
                  )}
                </div>
                <div className="text-slate-500 font-medium">
                  Nomor {currentIndex + 1} dari {totalCount} butir soal
                </div>
              </div>

              {/* 4. FOOTER BAR NAVIGASI CBT (SEBELUMNYA - RAGU-RAGU - BERIKUTNYA / SELESAI UJIAN) */}
              <div className="pt-5 mt-3 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                
                {/* Tombol Soal Sebelumnya */}
                <button
                  type="button"
                  disabled={isFirstQuestion}
                  onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                  className={`py-3 px-5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 border transition ${
                    isFirstQuestion
                      ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                      : 'bg-blue-900 hover:bg-blue-800 text-white border-blue-900 shadow-sm cursor-pointer active:scale-95'
                  }`}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>SOAL SEBELUMNYA</span>
                </button>

                {/* TOMBOL / CHECKBOX RAGU - RAGU */}
                <button
                  type="button"
                  onClick={handleToggleDoubtful}
                  className={`py-3 px-5 rounded-xl font-extrabold text-xs sm:text-sm flex items-center gap-2.5 border-2 transition shadow-sm cursor-pointer active:scale-95 ${
                    currentAnswer.isDoubtful
                      ? 'bg-amber-400 text-amber-950 border-amber-500 ring-2 ring-amber-300'
                      : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={currentAnswer.isDoubtful}
                    readOnly
                    className="w-4 h-4 accent-amber-600 cursor-pointer pointer-events-none"
                  />
                  <span>RAGU - RAGU</span>
                </button>

                {/* TOMBOL SOAL BERIKUTNYA ATAU SELESAI UJIAN (DI SOAL TERAKHIR) */}
                {isLastQuestion ? (
                  // PAS SOAL TERAKHIR: Tombol Berwarna Hijau "SELESAI UJIAN" yang membuka dialog konfirmasi
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAgreed(false);
                      setShowFinishConfirm(true);
                    }}
                    className="py-3 px-6 rounded-xl font-black text-xs sm:text-sm bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-700 hover:to-teal-800 text-white border border-emerald-500 shadow-lg shadow-emerald-700/30 flex items-center gap-2 cursor-pointer transition active:scale-95 ring-2 ring-emerald-400/50"
                  >
                    <CheckCircle className="w-4 h-4 text-amber-300" />
                    <span>SELESAI UJIAN</span>
                  </button>
                ) : (
                  // BUKAN SOAL TERAKHIR: Tombol Lanjut ke Soal Berikutnya (Bebas diklik kapan saja)
                  <button
                    type="button"
                    onClick={() => setCurrentIndex((prev) => Math.min(totalCount - 1, prev + 1))}
                    className="py-3 px-5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white border border-blue-600 shadow-sm flex items-center gap-2 cursor-pointer transition active:scale-95"
                  >
                    <span>SOAL BERIKUTNYA</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}

              </div>

            </div>
          </div>

          {/* PALETTE / SIDEBAR NOMOR SOAL (Desktop View in XL) */}
          <div className="hidden xl:block xl:col-span-3">
            <div className="bg-white rounded-xl shadow-md border border-slate-300 p-5 sticky top-28">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <Grid className="w-4 h-4 text-blue-700" />
                  Daftar Nomor Soal
                </h3>
                <span className="text-xs font-semibold text-slate-500">
                  {totalCount} Butir
                </span>
              </div>

              {/* Status Legend */}
              <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-600 mb-4 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-medium">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-emerald-600" />
                  <span>Sudah dijawab</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-amber-400" />
                  <span>Ragu-ragu</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-white border border-slate-400" />
                  <span>Belum dijawab</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-100 border border-blue-600 text-[8px] font-black text-blue-900 flex items-center justify-center">
                    ★
                  </span>
                  <span>Soal Terakhir</span>
                </div>
              </div>

              {/* Grid 1 to N: Siswa bebas klik nomor berapa saja untuk berpindah soal */}
              <div className="grid grid-cols-5 gap-2 max-h-[380px] overflow-y-auto p-1">
                {questions.map((q, idx) => {
                  const ans = answers[q.id];
                  const answered = isQuestionAnswered(q);
                  const doubtful = ans?.isDoubtful;
                  const isActive = idx === currentIndex;
                  const isItemLast = idx === totalCount - 1;

                  let bgClass = 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100';
                  if (doubtful) {
                    bgClass = 'bg-amber-400 text-amber-950 border-amber-500 font-extrabold';
                  } else if (answered) {
                    bgClass = 'bg-emerald-600 text-white border-emerald-700 font-bold';
                  }

                  let selectedLetter = '';
                  if (ans?.selectedOption) {
                    selectedLetter = ans.selectedOption;
                  } else if (ans?.selectedOptions && ans.selectedOptions.length > 0) {
                    selectedLetter = '✓';
                  } else if (ans?.statementAnswers && Object.keys(ans.statementAnswers).length > 0) {
                    selectedLetter = '✓';
                  }

                  return (
                    <button
                      type="button"
                      key={q.id}
                      onClick={() => setCurrentIndex(idx)}
                      title={`Pindah ke Soal No. ${idx + 1}${isItemLast ? ' (Soal Terakhir)' : ''}`}
                      className={`relative h-11 rounded-lg border-2 text-xs font-bold transition flex flex-col items-center justify-center cursor-pointer ${bgClass} ${
                        isActive ? 'ring-2 ring-blue-600 ring-offset-2 scale-105 z-10' : ''
                      }`}
                    >
                      <span className="leading-none text-[11px]">{idx + 1}</span>
                      {selectedLetter && (
                        <span className={`text-[9px] font-black leading-none mt-0.5 ${
                          doubtful ? 'text-amber-950' : answered ? 'text-white' : 'text-blue-800'
                        }`}>
                          {selectedLetter}
                        </span>
                      )}
                      {isItemLast && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full border border-white" title="Soal Terakhir" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Selesai Button in Sidebar */}
              <div className="pt-4 mt-4 border-t border-slate-200">
                {isLastQuestion ? (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAgreed(false);
                      setShowFinishConfirm(true);
                    }}
                    className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                  >
                    <CheckCircle className="w-4 h-4 text-amber-300" />
                    <span>Selesai & Kumpulkan Ujian</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowEarlyFinishNotice(true)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowRight className="w-3.5 h-3.5 text-amber-400" />
                    <span>Ke Soal Terakhir & Selesai</span>
                  </button>
                )}
              </div>

            </div>
          </div>

        </div>
      </main>

      {/* DRAWER / POPUP MODAL DAFTAR SOAL (Mobile & Responsive Trigger) */}
      {showQuestionPalette && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 px-5 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Grid className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base">Navigasi Nomor Soal</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQuestionPalette(false)}
                className="p-1 rounded-md text-white/80 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              {/* Legend */}
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-700 mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-emerald-600" />
                  <span>Dijawab ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-amber-400" />
                  <span>Ragu-ragu ({doubtfulCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-white border border-slate-400" />
                  <span>Belum ({unansweredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 rounded bg-blue-100 border border-blue-600 text-[8px] font-black text-blue-900 flex items-center justify-center">★</span>
                  <span>Soal Terakhir (No. {totalCount})</span>
                </div>
              </div>

              {/* Grid 1 to N */}
              <div className="grid grid-cols-5 gap-2.5 max-h-[300px] overflow-y-auto p-1">
                {questions.map((q, idx) => {
                  const ans = answers[q.id];
                  const answered = isQuestionAnswered(q);
                  const doubtful = ans?.isDoubtful;
                  const isActive = idx === currentIndex;

                  let bgClass = 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100';
                  if (doubtful) {
                    bgClass = 'bg-amber-400 text-amber-950 border-amber-500 font-extrabold';
                  } else if (answered) {
                    bgClass = 'bg-emerald-600 text-white border-emerald-700 font-bold';
                  }

                  let selectedLetter = '';
                  if (ans?.selectedOption) {
                    selectedLetter = ans.selectedOption;
                  } else if (ans?.selectedOptions && ans.selectedOptions.length > 0) {
                    selectedLetter = '✓';
                  } else if (ans?.statementAnswers && Object.keys(ans.statementAnswers).length > 0) {
                    selectedLetter = '✓';
                  }

                  return (
                    <button
                      type="button"
                      key={q.id}
                      onClick={() => {
                        setCurrentIndex(idx);
                        setShowQuestionPalette(false);
                      }}
                      title={`Pindah ke Soal No. ${idx + 1}`}
                      className={`h-12 rounded-xl border-2 text-xs font-bold flex flex-col items-center justify-center transition cursor-pointer ${bgClass} ${
                        isActive ? 'ring-2 ring-blue-600 ring-offset-2 scale-105' : ''
                      }`}
                    >
                      <span className="text-xs">{idx + 1}</span>
                      {selectedLetter && (
                        <span className={`text-[10px] font-black ${doubtful ? 'text-amber-950' : 'text-white'}`}>
                          {selectedLetter}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-200 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuestionPalette(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentIndex(totalCount - 1);
                    setShowQuestionPalette(false);
                  }}
                  className="py-2.5 px-3 bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Ke Soal Terakhir (No. {totalCount})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PERINGATAN JIKA INGIN SELESAI SEBELUM MENCAPAI SOAL TERAKHIR */}
      {showEarlyFinishNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-200" />
                <h3 className="font-bold text-base">Belum di Soal Terakhir</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowEarlyFinishNotice(false)}
                className="text-white/80 hover:text-white font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                Anda saat ini masih berada di <strong>Soal No. {currentIndex + 1}</strong> dari total <strong>{totalCount} butir soal</strong>.
              </p>
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs">
                Sesuai arahan, silakan lanjutkan pengerjaan hingga butir soal terakhir (No. {totalCount}) untuk memastikan semua pertanyaan telah terjawab dengan baik.
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEarlyFinishNotice(false);
                    setCurrentIndex(totalCount - 1);
                  }}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs transition cursor-pointer"
                >
                  Menuju Soal Terakhir (No. {totalCount})
                </button>
                <button
                  type="button"
                  onClick={() => setShowEarlyFinishNotice(false)}
                  className="w-full sm:w-auto py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  Lanjut Mengerjakan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI RESMI SELESAI UJIAN (PAS SOAL TERAKHIR & SISWA KONFIRMASI DULU) */}
      {showFinishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-emerald-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle className="w-5 h-5 text-amber-300" />
                <div>
                  <h3 className="font-bold text-base leading-tight">Konfirmasi Selesai & Kirim Ujian</h3>
                  <div className="text-[11px] text-emerald-200 font-medium">Butir Soal Terakhir (No. {totalCount}) Tercapai</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowFinishConfirm(false)}
                className="text-white/80 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Peserta:</span>
                  <span className="font-bold text-slate-800">{student.nama}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Kelas:</span>
                  <span className="font-bold text-blue-700">{student.kelas}</span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                Anda telah menyelesaikan pengerjaan butir soal hingga nomor terakhir. Berikut adalah rekapitulasi jawaban Anda:
              </p>

              {/* Rincian Jawaban */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 text-center">
                  <div className="text-[10px] font-bold text-emerald-800 uppercase">Sudah Dijawab</div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">{answeredCount}</div>
                  <div className="text-[10px] text-emerald-600">dari {totalCount} soal</div>
                </div>
                <div className={`border rounded-xl p-3 text-center ${
                  doubtfulCount > 0 ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="text-[10px] font-bold uppercase">Ragu-Ragu</div>
                  <div className="text-2xl font-black text-amber-700 mt-1">{doubtfulCount}</div>
                  <div className="text-[10px] text-slate-500">butir</div>
                </div>
                <div className={`border rounded-xl p-3 text-center ${
                  unansweredCount > 0 ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-600'
                }`}>
                  <div className="text-[10px] font-bold uppercase">Belum Dijawab</div>
                  <div className="text-2xl font-black text-rose-700 mt-1">{unansweredCount}</div>
                  <div className="text-[10px] text-slate-500">butir</div>
                </div>
              </div>

              {/* Warning if still doubtful or unanswered */}
              {(doubtfulCount > 0 || unansweredCount > 0) && (
                <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Perhatian:</span> Masih terdapat{' '}
                    {unansweredCount > 0 && <span className="font-bold underline">{unansweredCount} butir soal yang belum dijawab</span>}
                    {unansweredCount > 0 && doubtfulCount > 0 && ' dan '}
                    {doubtfulCount > 0 && <span className="font-bold underline">{doubtfulCount} butir soal dengan status ragu-ragu</span>}.
                    <p className="mt-1 text-slate-700">
                      Anda dapat menekan tombol <strong>"Periksa Kembali Jawaban"</strong> untuk melengkapi atau merevisi soal sebelum mengirim.
                    </p>
                  </div>
                </div>
              )}

              {/* Checkbox Konfirmasi Wajib dari Siswa */}
              <label className="flex items-start gap-3 p-3.5 bg-blue-50/70 rounded-xl border-2 border-blue-200 cursor-pointer hover:bg-blue-50 transition">
                <input
                  type="checkbox"
                  checked={confirmAgreed}
                  onChange={(e) => setConfirmAgreed(e.target.checked)}
                  className="w-5 h-5 mt-0.5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer shrink-0"
                />
                <span className="text-xs text-slate-800 font-bold leading-relaxed">
                  Saya telah memeriksa seluruh jawaban hingga butir soal terakhir (No. {totalCount}), dan menyatakan secara sadar untuk mengakhiri serta mengirimkan lembar ujian ini.
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowFinishConfirm(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-100 transition cursor-pointer"
                >
                  « Periksa Kembali Jawaban
                </button>
                <button
                  type="button"
                  disabled={!confirmAgreed}
                  onClick={handleFinalSubmit}
                  className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs shadow-md flex items-center justify-center gap-2 transition ${
                    confirmAgreed
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95 shadow-emerald-600/30 ring-2 ring-emerald-400'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  <span>Ya, Akhiri & Kirim Ujian</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL WAKTU UJIAN TELAH HABIS (JIKA DURASI PENUH 60 MENIT TELAH SELESAI) */}
      {isTimeUp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-300 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-red-700 to-rose-800 px-6 py-4 text-white flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-300" />
              <h3 className="font-bold text-base">Waktu Ujian Telah Habis</h3>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                Alokasi waktu ujian resmi telah selesai. Seluruh jawaban yang telah Anda pilih telah tersimpan dengan aman di sistem.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Soal Terjawab:</span>
                  <span className="font-bold text-emerald-700">{answeredCount} butir</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Soal Belum Dijawab:</span>
                  <span className="font-bold text-rose-700">{unansweredCount} butir</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleFinalSubmit}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
              >
                <Send className="w-4 h-4" />
                <span>Kirim Jawaban & Lihat Hasil</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
