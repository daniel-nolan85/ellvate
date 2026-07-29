import React from 'react';

import Svg, { Path } from 'react-native-svg';

const DEFAULT_COLOR = 'rgb(37,30,23)';

type AiMarkProps = {
  size?: number;
  color?: string;
};

const AiMark = ({ size = 20, color = DEFAULT_COLOR }: AiMarkProps) => {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      accessibilityRole="image"
      accessibilityLabel="AI assistant"
    >
      <Path
        fill={color}
        d="M11 2c.55 4.4 2.93 6.78 7.33 7.33-4.4.55-6.78 2.93-7.33 7.33-.55-4.4-2.93-6.78-7.33-7.33C8.07 8.78 10.45 6.4 11 2z"
      />
      <Path
        fill={color}
        opacity={0.75}
        d="M18.5 14.5c.3 2.4 1.6 3.7 4 4-2.4.3-3.7 1.6-4 4-.3-2.4-1.6-3.7-4-4 2.4-.3 3.7-1.6 4-4z"
      />
    </Svg>
  );
};

AiMark.displayName = 'AiMark';

export { AiMark };
export type { AiMarkProps };
