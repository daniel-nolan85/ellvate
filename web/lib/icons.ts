import {
  Car,
  CalendarDays,
  ConciergeBell,
  FileSignature,
  Flag,
  Home,
  Laptop,
  MessagesSquare,
  Newspaper,
  PawPrint,
  ShoppingBag,
  Sparkles,
  Store,
  Trophy,
  Utensils,
  Waves,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

// Shared name -> component lookup for icon names stored as strings in
// lib/content.ts (features, serviceCategories) -- keeps that file pure data
// instead of importing React components into it.
export const ICONS: Record<string, LucideIcon> = {
  Car,
  CalendarDays,
  ConciergeBell,
  FileSignature,
  Flag,
  Home,
  Laptop,
  MessagesSquare,
  Newspaper,
  PawPrint,
  ShoppingBag,
  Sparkles,
  Store,
  Trophy,
  Utensils,
  Waves,
  Wrench,
};
