import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { PublisherGithub } from '@electron-forge/publisher-github';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import * as fs from 'fs';
import * as path from 'path';

const config: ForgeConfig = {
  packagerConfig: {
    // Keep pdf-parse + pdf.js + the native canvas unpacked: their runtime
    // require / ESM import / native .node load must resolve from the real
    // filesystem rather than from inside the asar archive.
    asar: { unpack: '**/node_modules/{pdf-parse,pdfjs-dist,@napi-rs}/**' },
    // Notice there is NO file extension — Forge detects icon.ico for Windows.
    icon: './assets/icon'
  },
  rebuildConfig: {},
  // The webpack plugin ships only the .webpack bundle, so node_modules is
  // normally excluded. PDF import needs three packages present at runtime that
  // CANNOT be bundled (pdf.js is ESM-only, @napi-rs/canvas is a native addon
  // loaded dynamically). Copy them into the packaged app after the file copy so
  // they end up in the asar (unpacked, per packagerConfig.asar.unpack) where the
  // PDF engine resolves them.
  hooks: {
    packageAfterCopy: async (_config, buildPath) => {
      const runtimeModules = ['pdf-parse', 'pdfjs-dist', '@napi-rs'];
      for (const mod of runtimeModules) {
        const src = path.join(__dirname, 'node_modules', mod);
        const dest = path.join(buildPath, 'node_modules', mod);
        if (fs.existsSync(src)) fs.cpSync(src, dest, { recursive: true });
      }
    },
  },
  makers: [new MakerSquirrel({}), new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
  // --- Auto-update publishing -------------------------------------------
  // The app's updater (src/index.ts) pulls from update.electronjs.org, which
  // serves the public GitHub Releases of this repo. To ship an update users get
  // on next launch: bump `version` in package.json, then run `npm run publish`
  // with a GITHUB_TOKEN env var (a token with `repo` scope). The repo must be
  // public; macOS auto-update additionally requires a code-signing certificate.
  publishers: [
    new PublisherGithub({
      repository: { owner: 'Gus-Jacobs', name: 'Scribe' },
      prerelease: false,
      // draft:false publishes the release immediately so users get it on next
      // launch (your "seamless" goal). Flip to true if you'd rather review each
      // release on GitHub and click Publish manually before it goes live.
      draft: false,
    }),
  ],
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