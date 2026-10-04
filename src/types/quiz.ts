export type OptionId = 'A' | 'B' | 'C' | 'D';

export type CategoryId =
  | 'science'
  | 'general_knowledge'
  | 'history'
  | 'technology'
  | 'geography'
  | 'logic'
  | 'entertainment'
  | 'nature'
  | 'sports'
  | 'culture';

export interface QuestionOption {
  id: OptionId;
  text: string;
}

export interface Question {
  id: string;
  categoryKey: CategoryId;
  categoryName: string;
  question: string;
  options: QuestionOption[];
  correctOptionId: OptionId;
  explanation: string;
  difficulty: 'Хөнгөн' | 'Дунд' | 'Хүнд';
}

export interface UserAnswer {
  questionIndex: number;
  question: Question;
  selectedOptionId: OptionId | null;
  isCorrect: boolean;
  awardedScore: number;
}

export type ScreenState = 'WELCOME' | 'PLAYING' | 'SUMMARY';

export interface CategoryInfo {
  id: CategoryId;
  name: string;
  description: string;
  iconName: string;
  color: string;
  accentBg: string;
}
