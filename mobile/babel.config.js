module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin',
      [
        'module-resolver',
        {
          root: ['./src'],
          alias: {
            '@': './src',
            '@components': './src/components',
            '@hooks':      './src/hooks',
            '@lib':        './src/lib',
            '@constants':  './src/constants',
            '@services':   './src/services',
            '@store':      './src/store',
          },
        },
      ],
    ],
  }
}
