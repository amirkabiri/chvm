import fs from 'fs';
import path from 'path';

interface Revision {
  name: string;
  size: `${number}`;
  updated: string;
}

async function fetchRevisions(): Promise<Revision[]> {
  let allRevisions: Revision[] = [];
  let pageToken: string = fs.readFileSync('cursor.json').toString();
  let i = 0;

  do {
    const url = new URL(
      'https://www.googleapis.com/storage/v1/b/chromium-browser-snapshots/o'
    );
    url.searchParams.set('fields', 'items(name,size,updated),nextPageToken');
    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch revisions: ${response.statusText}`);
    }

    const data = (await response.json()) as {
      items: Revision[];
      nextPageToken?: string;
    };

    allRevisions = allRevisions.concat(data.items);

    pageToken = data.nextPageToken || '';
    console.log('page: ', i++);
  } while (pageToken);

  return allRevisions;
}

(async function main() {
  const revisions = await fetchRevisions();
  fs.writeFileSync(
    path.join(__dirname, '../../public/manifest/revisions.json'),
    JSON.stringify(revisions)
  );
})();
