import type { Configuration } from 'webpack';
import { rules } from './webpack.rules';

export const preloadConfig: Configuration = {
  entry: './src/preload.ts',
  output: {
    path: '.webpack/renderer/main_window',
    filename: 'preload.js'
  },
  module: {
    rules,
  },
  node: false,
  resolve: {
    extensions: ['.js', '.ts', '.json'],
  },
 
};
