import React from 'react';

import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  AtSign,
  Bell,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronsUpDown,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleQuestionMark,
  Clock,
  Ellipsis,
  Eye,
  EyeOff,
  Globe,
  Heart,
  Link2,
  Lock,
  Mail,
  MessageCircle,
  Moon,
  Pencil,
  Phone,
  Play,
  Plus,
  Search,
  Share2,
  Star,
  Sun,
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
  | 'Bell'
  | 'AlertCircle'
  | 'Link'
  | 'Eye'
  | 'EyeOff';

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
  Bell,
  AlertCircle: CircleAlert,
  Link: Link2,
  Eye,
  EyeOff,
};

Object.values(ICON_MAP).forEach((component) => {
  cssInterop(component, {
    className: { target: 'style', nativeStyleToProp: { color: true } },
  });
});

const DEFAULT_COLOR = 'rgb(10,10,10)';

type IconProps = {
  name: AppIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
};

const Icon = ({
  name,
  size = 20,
  color = DEFAULT_COLOR,
  strokeWidth = 2,
  className,
}: IconProps) => {
  const IconGlyph = ICON_MAP[name];
  return (
    <IconGlyph
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
    />
  );
};

Icon.displayName = 'Icon';

export { Icon };
export type { IconProps };
