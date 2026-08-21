import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { NotificationsStep } from './notifications-step';

const chrome = <View testID="test-chrome" />;

const prefs = {
  digest: true,
  events: true,
  missions: false,
  petitions: true,
  replies: true,
};

describe('NotificationsStep', () => {
  test('renders a native Switch per preference, reflecting current value', async () => {
    const view = await render(
      <NotificationsStep
        chrome={chrome}
        onNext={jest.fn()}
        onToggle={jest.fn()}
        prefs={prefs}
      />,
    );

    expect(view.getByTestId('onboarding-notif-events').props.value).toBe(true);
    expect(view.getByTestId('onboarding-notif-replies').props.value).toBe(true);
    expect(view.getByTestId('onboarding-notif-missions').props.value).toBe(false);
    expect(view.getByTestId('onboarding-notif-digest').props.value).toBe(true);
  });

  test('toggling a switch calls onToggle with that preference key', async () => {
    const onToggle = jest.fn();
    const view = await render(
      <NotificationsStep
        chrome={chrome}
        onNext={jest.fn()}
        onToggle={onToggle}
        prefs={prefs}
      />,
    );

    fireEvent(view.getByTestId('onboarding-notif-missions'), 'valueChange', true);

    expect(onToggle).toHaveBeenCalledWith('missions');
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  test('continuing fires onNext', async () => {
    const onNext = jest.fn();
    const view = await render(
      <NotificationsStep
        chrome={chrome}
        onNext={onNext}
        onToggle={jest.fn()}
        prefs={prefs}
      />,
    );

    await fireEvent.press(view.getByTestId('onboarding-cta-continue'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
