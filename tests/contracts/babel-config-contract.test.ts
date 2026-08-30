import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dir, '../..');

// Regression guard for a real bug: babel-preset-expo already adds
// react-native-worklets/plugin automatically whenever react-native-worklets
// is installed (see node_modules/babel-preset-expo/build/index.js). Manually
// adding it a second time in this file's own `plugins` array silently
// double-transforms every Reanimated worklet in the app -- the animation
// renders its first frame correctly and then never moves again. This once
// broke the boot splash's dancing-cactus Spinner and, very likely, every
// other Reanimated-driven animation (e.g. the Sheet component's slide
// transitions) across the whole app. A static check here catches a
// reintroduction immediately, instead of only on a real device.
describe('babel.config.js contract', () => {
  test('does not manually register react-native-worklets/plugin a second time', () => {
    const source = readFileSync(resolve(root, 'babel.config.js'), 'utf8');
    expect(source).not.toContain("'react-native-worklets/plugin'");
    expect(source).not.toContain('"react-native-worklets/plugin"');
  });
});
