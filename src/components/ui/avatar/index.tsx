import React from 'react';
import { Text, View, type ViewProps } from 'react-native';

import { Image } from 'expo-image';

const AVATAR_SIZES = {
  'xs': 24,
  'sm': 32,
  'md': 40,
  'lg': 48,
  'xl': 64,
  '2xl': 96,
} as const;

type AvatarSize = keyof typeof AVATAR_SIZES;
type AvatarStatus = 'online' | 'busy' | 'offline';

type AvatarProps = Omit<ViewProps, 'children'> & {
  name?: string;
  src?: string;
  size?: AvatarSize;
  status?: AvatarStatus;
  className?: string;
};

const statusClassNames: Record<AvatarStatus, string> = {
  online: 'bg-success',
  busy: 'bg-destructive',
  offline: 'bg-muted-foreground',
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
  return initials || '?';
}

function getDotSize(px: number): number {
  if (px <= 32) return 10;
  if (px <= 48) return 14;
  return 18;
}

const Avatar = React.forwardRef<View, AvatarProps>(function Avatar(
  { name, src, size = 'lg', status, className, style, ...props },
  ref
) {
  const px = AVATAR_SIZES[size];
  const fontSize = Math.round(px * 0.4);
  const dotSize = getDotSize(px);

  return (
    <View
      ref={ref}
      {...props}
      className={`relative shrink-0 ${className ?? ''}`}
      style={[{ width: px, height: px }, style]}
    >
      <View className="h-full w-full items-center justify-center overflow-hidden rounded-full bg-muted">
        {src ? (
          <Image
            source={{ uri: src }}
            accessibilityLabel={name}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <Text
            className="text-content"
            style={{
              fontFamily: 'Inter_500Medium',
              fontSize,
              lineHeight: fontSize,
            }}
          >
            {getInitials(name)}
          </Text>
        )}
      </View>
      {status ? (
        <View
          className={`absolute bottom-0 right-0 rounded-full border-2 border-white ${statusClassNames[status]}`}
          style={{ width: dotSize, height: dotSize }}
        />
      ) : null}
    </View>
  );
});

Avatar.displayName = 'Avatar';

export { Avatar, AVATAR_SIZES };
export type { AvatarProps, AvatarSize, AvatarStatus };
