import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // Add this line! Notice there is NO file extension.
    // Forge automatically detects icon.ico for Windows.
    icon: './assets/icon'
  },
  rebuildConfig: {},
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  plugins: [
    new WebpackPlugin({
      devContentSecurityPolicy: "default-src 'self' 'unsafe-inline' data: *; script-src 'self' 'unsafe-eval' 'unsafe-inline' data: *",
      mainConfig: {
        entry: './src/index.ts',
        module: {
          rules: [
            {
              test: /\.tsx?$/,
              exclude: /(node_modules|\.webpack)/,
              use: {
                loader: 'ts-loader',
                options: {
                  transpileOnly: true,
                },
              },
            },
          ],
        },
        resolve: {
          extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
        },
      },
      renderer: {
        config: {
          module: {
            rules: [
              {
                test: /\.tsx?$/,
                exclude: /(node_modules|\.webpack)/,
                use: {
                  loader: 'ts-loader',
                  options: {
                    transpileOnly: true,
                  },
                },
              },
              {
                test: /\.css$/,
                use: [{ loader: 'style-loader' }, { loader: 'css-loader' }, { loader: 'postcss-loader' }],
              },
            ],
          },
          plugins: [new ForkTsCheckerWebpackPlugin({
            logger: 'webpack-infrastructure',
          })],
          resolve: {
            extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
            fallback: {
              "fs": false,
              "path": require.resolve("path-browserify"),
              "vm": require.resolve("vm-browserify")
            }
          },
        },
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.tsx',
            name: 'main_window',
            preload: {
              config: {
                module: {
                  rules: [
                    {
                      test: /\.tsx?$/,
                      exclude: /(node_modules|\.webpack)/,
                      use: {
                        loader: 'ts-loader',
                        options: {
                          transpileOnly: true,
                        },
                      },
                    },
                  ],
                },
                resolve: {
                  extensions: ['.js', '.ts', '.json'],
                },
              },
              js: './src/preload.ts',
            },
          },
        ],
      },
    }),
  ],
};

export default config;