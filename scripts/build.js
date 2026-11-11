'use strict';

/**
 * Build the macOS .app bundle.
 *
 *   npm run build            -> dist/DeepSeek Harness-darwin-<arch>/DeepSeek Harness.app
 *   npm run build -- --install -> also copies it to /Applications
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'dist');
const install = process.argv.includes('--install');
const archFlag = process.argv.indexOf('--arch');
const arch = archFlag > 0 ? process.argv[archFlag + 1] : process.arch;

(async () => {
  const { packager } = await import('@electron/packager');
  const appPath = path.join(out, `DeepSeek Harness-darwin-${arch}`, 'DeepSeek Harness.app');
  await packager({
    dir: root,
    out,
    name: 'DeepSeek Harness',
    platform: 'darwin',
    arch,
    icon: path.join(root, 'assets', 'icon.icns'),
    appBundleId: 'ai.deepseek.harness.desktop',
    appCategoryType: 'public.app-category.developer-tools',
    appVersion: require(path.join(root, 'package.json')).version,
    overwrite: true,
    prune: true,
    osxSign: false,
    download: { cacheRoot: path.join(root, '.cache', 'electron') },
    ignore: [
      /^\/\.cache/,
      /^\/dist/,
      /^\/scripts/,
      /^\/selftest\.png$/,
      /^\/\.git/,
    ],
  });

  if (!fs.existsSync(appPath)) throw new Error(`packaging produced no app bundle at ${appPath}`);

  // Give the bundled icon a proper name instead of Electron's default.
  const resources = path.join(appPath, 'Contents', 'Resources');
  fs.copyFileSync(path.join(root, 'assets', 'icon.icns'), path.join(resources, 'app.icns'));
  const plistPath = path.join(appPath, 'Contents', 'Info.plist');
  spawnSync('plutil', ['-replace', 'CFBundleIconFile', '-string', 'app.icns', plistPath], { stdio: 'inherit' });
  fs.rmSync(path.join(resources, 'electron.icns'), { force: true });

  // Ad-hoc signature: keeps macOS Gatekeeper and the Keychain happy for a
  // locally built bundle, no Apple developer identity required.
  const signed = spawnSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' });
  if (signed.status !== 0) console.warn('ad-hoc codesign failed; the app still runs unsigned.');

  console.log(`\nBuilt: ${appPath}`);

  if (install) {
    const target = path.join('/Applications', path.basename(appPath));
    fs.rmSync(target, { recursive: true, force: true });
    const copied = spawnSync('ditto', [appPath, target], { stdio: 'inherit' });
    if (copied.status !== 0) {
      console.error(`Could not copy to /Applications (permission denied?). Drag the app there yourself:\n  ${appPath}`);
      process.exitCode = 1;
    } else {
      console.log(`Installed: ${target}`);
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
