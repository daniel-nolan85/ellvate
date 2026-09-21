import { fireEvent, render } from '@testing-library/react-native';

import { LevelUpCelebrationModal } from './level-up-celebration-modal';

describe('LevelUpCelebrationModal', () => {
  test('is hidden when newLevel is null', async () => {
    const view = await render(
      <LevelUpCelebrationModal newLevel={null} onClose={() => undefined} title="" />,
    );

    expect(view.queryByText(/You reached Level/)).toBeNull();
  });

  test('shows the reached level and current rank when newLevel is set', async () => {
    const view = await render(
      <LevelUpCelebrationModal newLevel={7} onClose={() => undefined} title="Lake Regular" />,
    );

    expect(view.getByText('You reached Level 7')).toBeTruthy();
    expect(view.getByText('Lake Regular')).toBeTruthy();
  });

  test('calls onClose when the acknowledge button is pressed', async () => {
    const onClose = jest.fn();
    const view = await render(
      <LevelUpCelebrationModal newLevel={3} onClose={onClose} title="Lake Local" />,
    );

    fireEvent.press(view.getByText('Nice!'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
