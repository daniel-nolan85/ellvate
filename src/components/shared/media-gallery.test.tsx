import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { MediaGallery } from './media-gallery';

const TEST_SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const renderGallery = async (media: { url: string; filename: string }[]) =>
  render(
    <SafeAreaProvider initialMetrics={TEST_SAFE_AREA_METRICS}>
      <MediaGallery media={media} />
    </SafeAreaProvider>,
  );

describe('MediaGallery', () => {
  test('single image opens the full-screen viewer on tap', async () => {
    const view = await renderGallery([{ url: 'https://example.com/a.jpg', filename: 'a.jpg' }]);
    expect(view.queryByLabelText('Close')).toBeNull();
    await act(async () => {
      fireEvent.press(view.getByLabelText('View photo full screen'));
    });
    expect(view.getByLabelText('Close')).toBeTruthy();
  });

  test('multi-image gallery renders a page indicator and opens the tapped photo', async () => {
    const view = await renderGallery([
      { url: 'https://example.com/a.jpg', filename: 'a.jpg' },
      { url: 'https://example.com/b.jpg', filename: 'b.jpg' },
    ]);
    await act(async () => {
      fireEvent(view.getByTestId('media-gallery-multi'), 'layout', {
        nativeEvent: { layout: { height: 260, width: 390, x: 0, y: 0 } },
      });
    });
    expect(view.getByText('1/2')).toBeTruthy();
    await act(async () => {
      fireEvent.press(view.getByLabelText('View photo 2 of 2 full screen'));
    });
    expect(view.getByLabelText('Close')).toBeTruthy();
    expect(view.getByText('2/2')).toBeTruthy();
  });

  test('renders nothing for an empty media array', async () => {
    const view = await renderGallery([]);
    expect(view.queryByLabelText('View photo full screen')).toBeNull();
    expect(view.queryByText(/^\d\/\d$/)).toBeNull();
  });
});
