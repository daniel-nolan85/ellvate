module.exports = function (api) {
  api.cache(true);

  return {
    presets: [['babel-preset-expo'], 'nativewind/babel'],

    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],

          alias: {
            '@': './',
            'tailwind.config': './tailwind.config.js',
          },
        },
      ],
      // Not added here: babel-preset-expo already adds
      // react-native-worklets/plugin automatically whenever
      // react-native-worklets is installed. Adding it again here ran every
      // Reanimated worklet in the app (including the dancing-cactus Spinner)
      // through the transform twice, which silently produced a worklet that
      // never re-executes on the UI thread -- the animation still rendered
      // its first static frame correctly, but never moved after that.
    ],
  };
};
