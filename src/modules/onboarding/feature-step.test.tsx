import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { MomentStep, MOMENTS } from './feature-step';

const chrome = <View testID="test-chrome" />;

describe('MOMENTS', () => {
  // onboarding-flow.tsx hardcodes stepCount around this array's length —
  // a mismatch silently breaks the progress bar and back/skip navigation.
  test('has exactly eight moments, ending with the assistant intro', () => {
    expect(MOMENTS.map((moment) => moment.id)).toEqual([
      'forum',
      'events',
      'missions',
      'services',
      'leaderboard',
      'petitions',
      'digest',
      'assistant',
    ]);
  });

  test('every moment has non-empty eyebrow, title, and sub copy', () => {
    for (const moment of MOMENTS) {
      expect(moment.eyebrow.length).toBeGreaterThan(0);
      expect(moment.title.length).toBeGreaterThan(0);
      expect(moment.sub.length).toBeGreaterThan(0);
    }
  });
});

describe('MomentStep', () => {
  test.each(MOMENTS.map((moment) => [moment.id, moment] as const))(
    'renders the %s moment without crashing',
    async (_id, moment) => {
      const view = await render(
        <MomentStep chrome={chrome} moment={moment} onNext={jest.fn()} />,
      );
      expect(view.getByText(moment.eyebrow)).toBeTruthy();
    },
  );

  test('renders the moment copy and fires onNext', async () => {
    const onNext = jest.fn();
    const moment = MOMENTS.find((entry) => entry.id === 'assistant')!;
    const view = await render(
      <MomentStep chrome={chrome} moment={moment} onNext={onNext} />,
    );

    expect(view.getByText(moment.title)).toBeTruthy();
    expect(view.getByText(moment.sub)).toBeTruthy();
    await fireEvent.press(view.getByTestId('onboarding-cta-next'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
