import fs from 'fs';
import path from 'path';
import type { Platform, Channel, Version } from './shared/types';
import { PLATFORMS, CHANNELS } from './shared/constants';

async function fetchVersions({
  channel,
  platform,
}: {
  channel: Channel;
  platform: Platform;
}): Promise<Version[]> {
  const limit = 200;
  let result: Version[] = [];

  for (let offset = 0; ; offset += limit) {
    const url = new URL('https://chromiumdash.appspot.com/fetch_releases');
    url.searchParams.set('channel', channel);
    url.searchParams.set('platform', platform);
    url.searchParams.set('num', String(limit));
    url.searchParams.set('offset', String(offset));

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(
        `Failed to fetch version mapping: ${response.statusText}`
      );
    }

    const data = await response.json();
    if (!Array.isArray(data) || !data.length) {
      break;
    }

    console.log('offset', offset, data.length);
    result = result.concat(data);
  }

  return result;
}

(async function main() {
  const ROOT_PATH = path.join(__dirname, '../../public/manifest/versions');
  fs.rmSync(ROOT_PATH, { recursive: true, force: true });

  for (const platform of PLATFORMS) {
    const finalPath = path.join(ROOT_PATH, platform.toLowerCase());
    fs.mkdirSync(finalPath, { recursive: true });

    for (const channel of CHANNELS) {
      console.log('fetching', platform, channel);
      const data = await fetchVersions({ channel, platform });

      fs.writeFileSync(
        path.join(finalPath, channel.toLowerCase() + '.json'),
        JSON.stringify(data, null, 2)
      );
    }
  }
})();
