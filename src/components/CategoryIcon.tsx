import React from 'react';
import {
  Atom,
  Globe,
  Scroll,
  Cpu,
  Compass,
  Brain,
  Film,
  Trees,
  Trophy,
  Flame,
} from 'lucide-react';
import { CategoryId } from '../types/quiz';

interface CategoryIconProps {
  categoryId: CategoryId;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({ categoryId, className = 'w-5 h-5' }) => {
  switch (categoryId) {
    case 'science':
      return <Atom className={className} />;
    case 'general_knowledge':
      return <Globe className={className} />;
    case 'history':
      return <Scroll className={className} />;
    case 'technology':
      return <Cpu className={className} />;
    case 'geography':
      return <Compass className={className} />;
    case 'logic':
      return <Brain className={className} />;
    case 'entertainment':
      return <Film className={className} />;
    case 'nature':
      return <Trees className={className} />;
    case 'sports':
      return <Trophy className={className} />;
    case 'culture':
      return <Flame className={className} />;
    default:
      return <Globe className={className} />;
  }
};
