import { useState } from 'react';
import {
  Image,
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Text } from '@/src/components/ui/text';

interface MediaGalleryItem {
  readonly url: string;
  readonly filename: string;
}

interface MediaGalleryProps {
  readonly media: readonly MediaGalleryItem[];
}

const GALLERY_HEIGHT = 220;
const GAP = 8;

export function MediaGallery({ media }: MediaGalleryProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (width === 0) {
      return;
    }
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setActiveIndex(Math.max(0, Math.min(media.length - 1, index)));
  };

  if (media.length === 0) {
    return null;
  }

  if (media.length === 1) {
    return (
      <Image
        source={{ uri: media[0].url }}
        className='w-full rounded-lg bg-secondary'
        resizeMode='cover'
        style={{ height: GALLERY_HEIGHT }}
      />
    );
  }

  return (
    <View onLayout={handleLayout}>
      {width > 0 && (
        <View>
          <ScrollView
            decelerationRate='fast'
            horizontal
            onScroll={handleScroll}
            pagingEnabled
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            snapToAlignment='start'
            snapToInterval={width}
          >
            {media.map((item) => (
              <View key={item.filename} style={{ paddingHorizontal: GAP / 2, width }}>
                <Image
                  source={{ uri: item.url }}
                  className='rounded-lg bg-secondary'
                  resizeMode='cover'
                  style={{ height: GALLERY_HEIGHT, width: width - GAP }}
                />
              </View>
            ))}
          </ScrollView>
          <View className='absolute bottom-2.5 right-3.5 rounded-full bg-[rgba(0,0,0,0.55)] px-2.5 py-1'>
            <Text
              className='text-[11px] font-inter-semibold'
              style={{ color: 'rgb(255,255,255)' }}
            >
              {activeIndex + 1}/{media.length}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
