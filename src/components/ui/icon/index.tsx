import React from 'react';

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  AtSign,
  Bell,
  Bookmark,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ChevronUp,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleQuestionMark,
  Clock,
  Ellipsis,
  Eye,
  EyeOff,
  FileSignature,
  FileText,
  Flag,
  Footprints,
  Globe,
  Heart,
  Image,
  Laptop,
  Link2,
  Lock,
  Mail,
  MessageCircle,
  Moon,
  Newspaper,
  PawPrint,
  Pencil,
  Phone,
  Pin,
  Play,
  Plus,
  Search,
  Share2,
  Sparkles,
  Star,
  Store,
  Sun,
  Trophy,
  Users,
  UtensilsCrossed,
  WavesHorizontal,
  Wrench,
  X,
  type LucideProps,
} from 'lucide-react-native';
import { cssInterop } from 'nativewind';

type IconComponent = React.ComponentType<LucideProps & { className?: string }>;

export type AppIconName =
  | 'MessageCircle'
  | 'CalendarDays'
  | 'Star'
  | 'ChevronsUpDown'
  | 'Globe'
  | 'Circle'
  | 'Search'
  | 'Clock'
  | 'Check'
  | 'Lock'
  | 'Sun'
  | 'Moon'
  | 'ArrowUp'
  | 'ArrowDown'
  | 'ArrowLeft'
  | 'AtSign'
  | 'Play'
  | 'Mail'
  | 'Phone'
  | 'Edit'
  | 'ThreeDots'
  | 'Favourite'
  | 'Share'
  | 'Add'
  | 'Close'
  | 'CheckCircle'
  | 'HelpCircle'
  | 'ChevronLeft'
  | 'ChevronRight'
  | 'ChevronDown'
  | 'ChevronUp'
  | 'Bell'
  | 'AlertCircle'
  | 'Link'
  | 'Eye'
  | 'EyeOff'
  | 'FileSignature'
  | 'FileText'
  | 'Flag'
  | 'Image'
  | 'Bookmark'
  | 'Newspaper'
  | 'Trophy'
  | 'Pin'
  | 'Store'
  | 'PawPrint'
  | 'Wrench'
  | 'Car'
  | 'Waves'
  | 'Sparkles'
  | 'Laptop'
  | 'Utensils'
  | 'Footprints'
  | 'Users';

const ICON_MAP: Readonly<Record<AppIconName, IconComponent>> = {
  MessageCircle,
  CalendarDays,
  Star,
  ChevronsUpDown,
  Globe,
  Circle,
  Search,
  Clock,
  Check,
  Lock,
  Sun,
  Moon,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  AtSign,
  Play,
  Mail,
  Phone,
  Edit: Pencil,
  ThreeDots: Ellipsis,
  Favourite: Heart,
  Share: Share2,
  Add: Plus,
  Close: X,
  CheckCircle: CircleCheck,
  HelpCircle: CircleQuestionMark,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Bell,
  AlertCircle: CircleAlert,
  Link: Link2,
  Eye,
  EyeOff,
  FileSignature,
  FileText,
  Flag,
  Image,
  Bookmark,
  Newspaper,
  Trophy,
  Pin,
  Store,
  PawPrint,
  Wrench,
  Car,
  Waves: WavesHorizontal,
  Sparkles,
  Laptop,
  Utensils: UtensilsCrossed,
  Footprints,
  Users,
};

Object.values(ICON_MAP).forEach((component) => {
  cssInterop(component, {
    className: { target: 'style', nativeStyleToProp: { color: true } },
  });
});

const DEFAULT_COLOR = 'rgb(37,30,23)';

type IconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  fill?: string;
  strokeWidth?: number;
  className?: string;
};

const Icon = ({
  name,
  size = 20,
  color = DEFAULT_COLOR,
  fill = 'none',
  strokeWidth = 2,
  className,
}: IconProps) => {
  const IconGlyph = ICON_MAP[name];
  return (
    <IconGlyph
      size={size}
      color={color}
      fill={fill}
      strokeWidth={strokeWidth}
      className={className}
    />
  );
};

Icon.displayName = 'Icon';

export { Icon };
export type { IconProps };
