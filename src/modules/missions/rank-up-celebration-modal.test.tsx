import { fireEvent, render } from '@testing-library/react-native';

import { RankUpCelebrationModal } from './rank-up-celebration-modal';

describe('RankUpCelebrationModal', () => {
  test('is hidden when newTitle is null', async () => {
    const view = await render(
      <RankUpCelebrationModal newTitle={null} onClose={() => undefined} />,
    );

    expect(view.queryByText('RANK UP')).toBeNull();
  });

  test('shows the new rank title when set', async () => {
    const view = await render(
      <RankUpCelebrationModal newTitle="Lake Regular" onClose={() => undefined} />,
    );

    expect(view.getByText('RANK UP')).toBeTruthy();
    expect(view.getByText('Lake Regular')).toBeTruthy();
  });

  test('calls onClose when the acknowledge button is pressed', async () => {
    const onClose = jest.fn();
    const view = await render(
      <RankUpCelebrationModal newTitle="Lake Regular" onClose={onClose} />,
    );

    fireEvent.press(view.getByText('Amazing!'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
