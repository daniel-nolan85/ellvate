import { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/src/components/ui/icon';
import { Text } from '@/src/components/ui/text';

export interface MediaGalleryItem {
  readonly url: string;
  readonly filename: string;
}

interface MediaGalleryProps {
  readonly media: readonly MediaGalleryItem[];
}

const GALLERY_HEIGHT = 260;
// Every card hosting this component (post, event, mission, service listing)
// uses the same p-[18px] padding -- this negative margin cancels just that
// horizontal inset so photos bleed to the card's full width, Instagram/
// Facebook-style, while the rest of the card stays padded normally.
const BLEED = 18;

function PageIndicator({ index, total }: { readonly index: number; readonly total: number }) {
  if (total <= 1) {
    return null;
  }
  return (
    <View className='absolute bottom-2.5 right-3.5 rounded-full bg-[rgba(0,0,0,0.55)] px-2.5 py-1'>
      <Text className='text-[11px] font-inter-semibold' style={{ color: 'rgb(255,255,255)' }}>
        {index + 1}/{total}
      </Text>
    </View>
  );
}

// Full-screen tap-to-view lightbox: swipe between every photo in the
// gallery, starting on whichever one was tapped. Unmounts entirely when
// closed (rather than just hiding) so it always re-mounts at the correct
// starting page next time, with no imperative scroll-to-index needed.
export function MediaViewer({
  media,
  onClose,
  startIndex,
}: {
  readonly media: readonly MediaGalleryItem[];
  readonly onClose: () => void;
  readonly startIndex: number;
}) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [index, setIndex] = useState(startIndex);

  return (
    <Modal animationType='fade' onRequestClose={onClose} transparent visible>
      <View style={{ backgroundColor: 'rgb(8,6,15)', flex: 1 }}>
        <ScrollView
          contentOffset={{ x: startIndex * width, y: 0 }}
          horizontal
          onMomentumScrollEnd={(event: NativeSyntheticEvent<NativeScrollEvent>) => {
            const next = Math.round(event.nativeEvent.contentOffset.x / width);
            setIndex(Math.max(0, Math.min(media.length - 1, next)));
          }}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
        >
          {media.map((item) => (
            <View
              key={item.filename}
              style={{ alignItems: 'center', height, justifyContent: 'center', width }}
            >
              <Image
                resizeMode='contain'
                source={{ uri: item.url }}
                style={{ height: '100%', width: '100%' }}
              />
            </View>
          ))}
        </ScrollView>
        <Pressable
          accessibilityLabel='Close'
          accessibilityRole='button'
          hitSlop={12}
          onPress={onClose}
          style={{ position: 'absolute', right: 16, top: insets.top + 12 }}
        >
          <Icon color='rgb(255,255,255)' name='Close' size={26} />
        </Pressable>
        {media.length > 1 ? (
          <View
            className='absolute self-center rounded-full bg-[rgba(255,255,255,0.15)] px-3 py-1.5'
            style={{ bottom: insets.bottom + 20 }}
          >
            <Text className='text-[12px] font-inter-semibold' style={{ color: 'rgb(255,255,255)' }}>
              {index + 1}/{media.length}
            </Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

export function MediaGallery({ media }: MediaGalleryProps) {
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

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
      <>
        <Pressable
          accessibilityLabel='View photo full screen'
          accessibilityRole='button'
          onPress={() => setViewerIndex(0)}
          style={{ marginHorizontal: -BLEED }}
        >
          <Image
            source={{ uri: media[0].url }}
            className='w-full bg-secondary'
            resizeMode='cover'
            style={{ height: GALLERY_HEIGHT }}
          />
        </Pressable>
        {viewerIndex !== null && (
          <MediaViewer media={media} onClose={() => setViewerIndex(null)} startIndex={viewerIndex} />
        )}
      </>
    );
  }

  return (
    <>
      <View
        onLayout={handleLayout}
        style={{ marginHorizontal: -BLEED }}
        testID='media-gallery-multi'
      >
        {width > 0 && (
          <View>
            <ScrollView
              decelerationRate='fast'
              horizontal
              onScroll={handleScroll}
              pagingEnabled
              scrollEventThrottle={16}
              showsHorizontalScrollIndicator={false}
            >
              {media.map((item, index) => (
                <Pressable
                  accessibilityLabel={`View photo ${index + 1} of ${media.length} full screen`}
                  accessibilityRole='button'
                  key={item.filename}
                  onPress={() => setViewerIndex(index)}
                  style={{ width }}
                >
                  <Image
                    source={{ uri: item.url }}
                    className='bg-secondary'
                    resizeMode='cover'
                    style={{ height: GALLERY_HEIGHT, width }}
                  />
                </Pressable>
              ))}
            </ScrollView>
            <PageIndicator index={activeIndex} total={media.length} />
          </View>
        )}
      </View>
      {viewerIndex !== null && (
        <MediaViewer media={media} onClose={() => setViewerIndex(null)} startIndex={viewerIndex} />
      )}
    </>
  );
}
