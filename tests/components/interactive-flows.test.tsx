import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { InterestsStep, RoleStep } from '@/src/modules/onboarding';

const chrome = <View testID="test-chrome" />;

describe('onboarding controls', () => {
  test('role selection is exposed and enables continue', async () => {
    const onNext = jest.fn();
    const onPick = jest.fn();
    const view = await render(
      <RoleStep
        chrome={chrome}
        onNext={onNext}
        onPick={onPick}
        value={null}
      />,
    );

    await fireEvent.press(view.getByTestId('onboarding-role-resident'));
    expect(onPick).toHaveBeenCalledWith('resident');
    expect(view.getByTestId('onboarding-cta-continue')).toBeTruthy();
    expect(view.getByText('Who are you here as?')).toBeTruthy();
  });

  test('interests enforce the minimum before continuing', async () => {
    const onNext = jest.fn();
    const onToggle = jest.fn();
    const view = await render(
      <InterestsStep
        chrome={chrome}
        onNext={onNext}
        onToggle={onToggle}
        picks={[]}
      />,
    );

    expect(view.getByText('Pick 3 more')).toBeTruthy();
    await fireEvent.press(view.getByTestId('onboarding-interest-boating-marina'));
    await fireEvent.press(view.getByTestId('onboarding-interest-trails-fitness'));
    await fireEvent.press(view.getByTestId('onboarding-interest-dining-out'));
    expect(onToggle).toHaveBeenCalledTimes(3);
  });
});
