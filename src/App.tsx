/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from 'react';
import { ScreenState, Question, UserAnswer, OptionId } from './types/quiz';
import { generateQuizSession } from './data/quizData';
import { Header } from './components/Header';
import { BackgroundEffects } from './components/BackgroundEffects';
import { WelcomeScreen } from './components/WelcomeScreen';
import { QuestionCard } from './components/QuestionCard';
import { ResultsScreen } from './components/ResultsScreen';
import { RulesModal } from './components/RulesModal';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('WELCOME');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [score, setScore] = useState<number>(0);
  const [streak, setStreak] = useState<number>(0);
  const [timedMode, setTimedMode] = useState<boolean>(false);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [isRulesOpen, setIsRulesOpen] = useState<boolean>(false);

  // Start a new 10-question game session
  const handleStartGame = useCallback((isTimed: boolean) => {
    const sessionQuestions = generateQuizSession();
    setQuestions(sessionQuestions);
    setCurrentIndex(0);
    setScore(0);
    setStreak(0);
    setUserAnswers([]);
    setTimedMode(isTimed);
    setScreen('PLAYING');
  }, []);

  // Answer handler
  const handleAnswerSelected = useCallback(
    (selectedId: OptionId, isCorrect: boolean) => {
      const currentQ = questions[currentIndex];
      if (!currentQ) return;

      const pointsEarned = isCorrect ? 10 : 0;

      if (isCorrect) {
        setScore((prev) => prev + pointsEarned);
        setStreak((prev) => prev + 1);
      } else {
        setStreak(0);
      }

      setUserAnswers((prev) => [
        ...prev,
        {
          questionIndex: currentIndex,
          question: currentQ,
          selectedOptionId: selectedId,
          isCorrect,
          awardedScore: pointsEarned,
        },
      ]);
    },
    [questions, currentIndex]
  );

  // Navigate to next question or summary
  const handleNextQuestion = useCallback(() => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setScreen('SUMMARY');
    }
  }, [currentIndex, questions.length]);

  // Restart / Play Again
  const handlePlayAgain = useCallback(() => {
    handleStartGame(timedMode);
  }, [handleStartGame, timedMode]);

  const handleReturnToHome = useCallback(() => {
    setScreen('WELCOME');
  }, []);

  return (
    <div className="min-h-screen flex flex-col relative text-slate-100 selection:bg-amber-500 selection:text-slate-950 font-sans">
      {/* Visual Animated Background & Ambient Glow */}
      <BackgroundEffects />

      {/* Header Bar */}
      <Header
        score={score}
        questionIndex={currentIndex}
        totalQuestions={questions.length || 10}
        isPlaying={screen === 'PLAYING'}
        onRestart={handleReturnToHome}
        onOpenRules={() => setIsRulesOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col justify-center relative z-10 py-4 sm:py-8">
        {screen === 'WELCOME' && (
          <WelcomeScreen
            onStart={handleStartGame}
            timedMode={timedMode}
            setTimedMode={setTimedMode}
          />
        )}

        {screen === 'PLAYING' && questions[currentIndex] && (
          <QuestionCard
            key={questions[currentIndex].id}
            question={questions[currentIndex]}
            questionIndex={currentIndex}
            totalQuestions={questions.length}
            score={score}
            streak={streak}
            timedMode={timedMode}
            onAnswerSelected={handleAnswerSelected}
            onNextQuestion={handleNextQuestion}
          />
        )}

        {screen === 'SUMMARY' && (
          <ResultsScreen
            score={score}
            userAnswers={userAnswers}
            onPlayAgain={handlePlayAgain}
          />
        )}
      </main>

      {/* Footer Info */}
      <footer className="w-full border-t border-slate-900/80 py-4 text-center text-xs text-slate-500 relative z-10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Мэдлэгийн Цом — 10 Асуулт, 10 Сэдэв, 100 Оноо</span>
          <span className="text-slate-600">Эх хэлээрээ мэдлэгээ баталгаажуулъя</span>
        </div>
      </footer>

      {/* Rules Modal */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
}
