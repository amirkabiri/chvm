import fs from 'fs';
import path from 'path';

interface Revision {
  name: string;
  size: `${number}`;
  updated: string;
}

const ROOT_PATH = path.join(__dirname, '../../public/manifest/revisions');
fs.rmSync(ROOT_PATH, { recursive: true, force: true });
fs.mkdirSync(ROOT_PATH, { recursive: true });

console.log('loading revisions');

const revisions: Revision[] = JSON.parse(
  fs
    .readFileSync(
      path.resolve(__dirname, '../../public/manifest/revisions.json')
    )
    .toString()
);

const keep = new Set([
  'chrome-mac.zip',
  'chrome-android.zip',
  'chrome-linux.zip',
  'chrome-android-desktop.zip',
  'chrome-chromeos.zip',
  'chrome-win.zip',
  'chrome-win32.zip',
]);

const processedRevisions: Record<string, Revision[]> = {};

console.log('processing revisions');
for (const revision of revisions) {
  const lastPartOfRevisionName = revision.name.split('/').slice(-1)[0];
  if (!keep.has(lastPartOfRevisionName)) {
    continue;
  }

  const platform = (() => {
    const name = revision.name
      .split('/')
      .filter(segment => !/^[0-9]+$/.test(segment))
      .join('/');

    const matchers: Record<string, string> = {
      'Android/chrome-android.zip': 'android',
      'Android_Arm64/chrome-android.zip': 'android_arm64',
      'Arm/chrome-linux.zip': 'linux_arm',
      'Linux/chrome-linux.zip': 'linux',
      'Linux_x64/chrome-linux.zip': 'linux_x64',
      'Mac/chrome-mac.zip': 'mac',
      'Mac_Arm/chrome-mac.zip': 'mac_arm',
      'Win/chrome-win.zip': 'win',
      'Win/chrome-win32.zip': 'win32',
      'Win_Arm64/chrome-win.zip': 'win_arm64',
      'Win_x64/chrome-win.zip': 'win_x64',
      'Win_x64/chrome-win32.zip': 'win32_x64',
    };

    return matchers[name];
  })();

  if (!platform) {
    continue;
  }

  if (processedRevisions[platform] === undefined) {
    processedRevisions[platform] = [];
  }
  processedRevisions[platform].push(revision);
}

console.log('saving revisions');
for (const platform in processedRevisions) {
  fs.writeFileSync(
    path.join(ROOT_PATH, `${platform}.json`),
    JSON.stringify(processedRevisions[platform])
  );
}

console.log('done');
