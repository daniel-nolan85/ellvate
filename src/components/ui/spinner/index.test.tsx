import { render } from '@testing-library/react-native';

import { CactusMascot, Spinner } from './index';

describe('Spinner', () => {
  test('renders the dancing cactus glyph with a default accessible label', async () => {
    const view = await render(<Spinner />);

    expect(view.getByLabelText('loading')).toBeTruthy();

    const tree = JSON.stringify(view.toJSON());
    // Sunglasses lenses (2) + shine highlights (2) + ground shadow (1).
    expect((tree.match(/RNSVGCircle/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect((tree.match(/RNSVGEllipse/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(tree).toContain('RNSVGPath');
    // Body + both arm groups each carry an animated rotation matrix.
    expect((tree.match(/"matrix":/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  test('accepts a custom size, color, and aria-label', async () => {
    const view = await render(
      <Spinner aria-label="submitting" color="rgb(255,0,0)" size="large" />,
    );

    expect(view.getByLabelText('submitting')).toBeTruthy();
  });

  test('renders larger for the xlarge size used on full-screen and comment-loading states', async () => {
    const view = await render(<Spinner size="xlarge" />);

    const root = view.toJSON();
    expect(root?.props.style).toMatchObject({ height: 96, width: 96 });
  });
});

describe('CactusMascot', () => {
  test('renders the same glyph as Spinner, standing still at a default size', async () => {
    const view = await render(<CactusMascot />);

    const root = view.toJSON();
    expect(root?.props.style).toMatchObject({ height: 96, width: 96 });
    const tree = JSON.stringify(root);
    expect(tree).toContain('RNSVGPath');
  });

  test('accepts a custom size and color', async () => {
    const view = await render(<CactusMascot color="rgb(255,0,0)" size={64} />);

    const root = view.toJSON();
    expect(root?.props.style).toMatchObject({ height: 64, width: 64 });
  });
});
