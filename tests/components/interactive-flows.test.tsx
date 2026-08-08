import { fireEvent, render } from '@testing-library/react-native';
import { View } from 'react-native';

import { InterestsStep, NameStep, RoleStep } from '@/src/modules/onboarding';

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

  test('name step disables continue until a name is entered', async () => {
    const onNext = jest.fn();
    const onChange = jest.fn();
    const view = await render(
      <NameStep chrome={chrome} onChange={onChange} onNext={onNext} value="" />,
    );

    await fireEvent.press(view.getByTestId('onboarding-cta-continue'));
    expect(onNext).not.toHaveBeenCalled();

    await fireEvent.changeText(view.getByTestId('onboarding-name-input'), 'Daniel');
    expect(onChange).toHaveBeenCalledWith('Daniel');

    await view.rerender(
      <NameStep chrome={chrome} onChange={onChange} onNext={onNext} value="Daniel" />,
    );
    await fireEvent.press(view.getByTestId('onboarding-cta-continue'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
