import path from 'path';
import fs from 'fs';
import type { Channel, Platform, Version } from './shared/types';
import { CHANNELS } from './shared/constants';

const PUBLIC_MANIFEST_PATH = path.join(__dirname, '../../public/manifest');
const FINAL_PATH = path.join(PUBLIC_MANIFEST_PATH, 'final');
const REVISIONS_PATH = path.join(PUBLIC_MANIFEST_PATH, 'revisions');
const VERSIONS_PATH = path.join(PUBLIC_MANIFEST_PATH, 'versions');

fs.rmSync(FINAL_PATH, { recursive: true, force: true });
fs.mkdirSync(FINAL_PATH, { recursive: true });

function makeRevisionNumberToVersionsMap(
  platform: Platform
): Record<string, Version[]> {
  const platformPath = path.join(VERSIONS_PATH, platform.toLowerCase());
  const map: Record<string, Version[]> = {};

  for (const channel of CHANNELS) {
    const versions: Version[] = JSON.parse(
      fs
        .readFileSync(path.join(platformPath, `${channel.toLowerCase()}.json`))
        .toString()
    );

    for (const version of versions) {
      if (!version.chromium_main_branch_position) {
        continue;
      }
      if (!map[version.chromium_main_branch_position]) {
        map[version.chromium_main_branch_position] = [];
      }
      map[version.chromium_main_branch_position].push(version);

      if (map[version.chromium_main_branch_position].length > 1) {
        map[version.chromium_main_branch_position].sort(
          (a, b) => CHANNELS.indexOf(a.channel) - CHANNELS.indexOf(b.channel)
        );
        map[version.chromium_main_branch_position] = map[
          version.chromium_main_branch_position
        ].slice(0, 1);
      }
    }
  }

  return map;
}

(async function main() {
  const revisionFiles = fs.readdirSync(REVISIONS_PATH);
  const final: Record<string, Record<string, Version>> = {};

  for (const revisionFile of revisionFiles) {
    final[revisionFile] = {};

    const revisions = JSON.parse(
      fs.readFileSync(path.join(REVISIONS_PATH, revisionFile)).toString()
    );

    const platform = ((): Platform => {
      if (revisionFile.startsWith('android')) return 'Android';
      if (revisionFile.startsWith('linux')) return 'Linux';
      if (revisionFile.startsWith('mac')) return 'Mac';
      if (revisionFile.startsWith('win')) return 'Windows';
      throw new Error('Unsupported platform');
    })();

    const revisionNumberToVersionsMap =
      makeRevisionNumberToVersionsMap(platform);

    const local: Record<string, Version[]> = {};

    for (const revision of revisions) {
      const revisionNumber = revision.name.split('/')[1];

      if (!/^[0-9]+$/.test(revisionNumber)) {
        throw new Error(`Invalid revision number: ${revisionNumber}`);
      }

      const version = revisionNumberToVersionsMap[revisionNumber];
      if (!version) {
        continue;
      }

      const major = version[0].version.split('.')[0];
      if (!local[major]) {
        local[major] = [];
      }
      local[major].push(version[0]);
      if (local[major].length > 1) {
        local[major] = local[major].sort(
          (a, b) => CHANNELS.indexOf(a.channel) - CHANNELS.indexOf(b.channel)
        );
        local[major] = [local[major][0]];
        final[revisionFile][major] = local[major][0];
      }
    }
  }

  for (const revisionFile in final) {
    const versions = Object.values(final[revisionFile]).sort((a, b) => {
      return Number(b.version.split('.')[0]) - Number(a.version.split('.')[0]);
    });

    fs.writeFileSync(
      path.resolve(FINAL_PATH, revisionFile),
      JSON.stringify(versions, null, 2)
    );
  }

  console.log('Done');
})();
