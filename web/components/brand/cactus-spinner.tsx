import { CactusMark } from './cactus-mark';

// On-brand loading indicator for the waitlist/contact forms -- a CSS
// approximation of the mobile app's animated dancing-cactus spinner
// (../../../src/components/ui/spinner), since that one is built on
// react-native-reanimated and has no web equivalent here.
export function CactusSpinner({ className }: { className?: string }) {
  return <CactusMark className={`animate-cactus-bounce ${className ?? 'h-4 w-4'}`} />;
}
