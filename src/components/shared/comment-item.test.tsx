import { fireEvent, render } from '@testing-library/react-native';

import { CommentItem } from './comment-item';

const comment = {
  author: { id: 'user-mia', name: 'Mia Lake' },
  body: '@Jordan I launch before 7 AM.',
  createdAt: '2026-07-14T08:00:00.000Z',
  id: 'comment-1',
  postId: 'post-1',
} as const;

describe('CommentItem', () => {
  test('renders a complete comment and exposes its actions', async () => {
    const onActions = jest.fn();
    const onOpenAuthor = jest.fn();
    const onReply = jest.fn();
    const view = await render(
      <CommentItem
        comment={comment}
        onActions={onActions}
        onOpenAuthor={onOpenAuthor}
        onReply={onReply}
      />,
    );

    expect(view.getByTestId('comment-item-comment-1')).toBeTruthy();
    expect(view.getByText('Mia Lake')).toBeTruthy();

    await fireEvent.press(view.getByText('Reply'));
    await fireEvent.press(view.getByTestId('comment-actions-comment-1'));
    await fireEvent.press(view.getByText('Mia Lake'));

    expect(onReply).toHaveBeenCalledWith('Mia Lake');
    expect(onActions).toHaveBeenCalledWith(comment);
    expect(onOpenAuthor).toHaveBeenCalledWith('user-mia');
  });
});
