/**
 * Mapping module - Revision to Version mapping
 */
import fs from 'fs';

export async function fetchRevisions(options = {}) {
  const {
    baseUrl = 'https://www.googleapis.com/storage/v1/b/chromium-browser-snapshots/o',
    limit = null // null means fetch all
  } = options;

  let allRevisions = [];
  let pageToken = null;

  do {
    const url = new URL(baseUrl);
    url.searchParams.set('delimiter', '/');
    url.searchParams.set('prefix', 'Mac_Arm/');
    url.searchParams.set('fields', 'items(kind,mediaLink,metadata,name,size,updated),kind,prefixes,nextPageToken');

    if (pageToken) {
      url.searchParams.set('pageToken', pageToken);
    }

    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Failed to fetch revisions: ${response.statusText}`);
    }

    const data = await response.json();

    const revisions = (data.prefixes || [])
      .map(prefix => {
        const match = prefix.match(/Mac_Arm\/(\d+)\//);
        return match ? { revision: match[1], platform: 'Mac_Arm' } : null;
      })
      .filter(Boolean);

    allRevisions = allRevisions.concat(revisions);
    pageToken = data.nextPageToken;

    // If limit is set and we have enough, stop
    if (limit && allRevisions.length >= limit) {
      allRevisions = allRevisions.slice(0, limit);
      break;
    }

  } while (pageToken);

  return allRevisions;
}

export async function fetchVersionMapping(options = {}) {
  const {
    baseUrl = 'https://chromiumdash.appspot.com/fetch_releases',
    channel = 'Stable',
    platform = 'Mac',
    limit = 100,
    offset = 0
  } = options;

  const url = new URL(baseUrl);
  url.searchParams.set('channel', channel);
  url.searchParams.set('platform', platform);
  url.searchParams.set('num', String(limit));
  url.searchParams.set('offset', String(offset));

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Failed to fetch version mapping: ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchMilestones() {
  const url = 'https://chromiumdash.appspot.com/fetch_milestones';

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch milestones: ${response.statusText}`);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export function mergeRevisionsWithVersions(revisions, versionMappings) {
  const versionMap = new Map();

  // Build map from revision to version info
  for (const mapping of versionMappings) {
    const position = mapping.chromium_main_branch_position;
    if (position) {
      versionMap.set(String(position), {
        version: mapping.version,
        channel: mapping.channel,
        platform: mapping.platform || 'Mac'
      });
    }
  }

  // Merge revisions with version info
  return revisions.map(rev => {
    const versionInfo = versionMap.get(rev.revision);

    return {
      revision: rev.revision,
      version: versionInfo?.version || null,
      channel: versionInfo?.channel || null,
      platform: rev.platform
    };
  }).filter(item => item.version !== null);
}

export async function buildAvailableVersions() {
  // FINAL STRATEGY: Get actual Mac_Arm revisions, then find versions for them

  // Step 1: Fetch Mac_Arm revisions from Google Storage
  // Limit to 2000 for performance (still covers several years of builds)
  const revisions = await fetchRevisions({ limit: 9999992000 });

  // Step 2: Fetch version mappings from ALL channels with higher limits
  const [stableReleases, betaReleases, devReleases, canaryReleases] = await Promise.all([
    fetchVersionMapping({ channel: 'Stable', limit: 999999500 }).catch(() => []),
    fetchVersionMapping({ channel: 'Beta', limit: 999999500 }).catch(() => []),
    fetchVersionMapping({ channel: 'Dev', limit: 999999500 }).catch(() => []),
    fetchVersionMapping({ channel: 'Canary', limit: 999999500 }).catch(() => [])
  ]);

  const allReleases = [...stableReleases, ...betaReleases, ...devReleases, ...canaryReleases];

  // Step 3: Build a map of position -> version info (for lookup)
  // Mac_Arm revisions are in range 1000000-1011781
  const positionMap = new Map();
  for (const release of allReleases) {
    const position = release.chromium_main_branch_position;
    if (position) {
      const key = String(position);
      if (!positionMap.has(key)) {
        positionMap.set(key, {
          version: release.version,
          channel: release.channel
        });
      }
    }
  }

  // Step 4: Match Mac_Arm revisions with versions
  // Build reverse map: revisionNum -> revisionStr
  const revisionNums = new Map();
  for (const rev of revisions) {
    revisionNums.set(parseInt(rev.revision), rev.revision);
  }

  const available = [];
  const versioned = [];
  const unversioned = [];

  for (const rev of revisions) {
    let versionInfo = positionMap.get(rev.revision);

    // If no exact match, try to find closest within ±50
    if (!versionInfo) {
      const revNum = parseInt(rev.revision);
      for (let offset = 1; offset <= 50 && !versionInfo; offset++) {
        versionInfo = positionMap.get(String(revNum + offset)) || positionMap.get(String(revNum - offset));
      }
    }

    if (versionInfo) {
      versioned.push({
        version: versionInfo.version,
        revision: rev.revision,
        channel: versionInfo.channel,
        platform: 'Mac_Arm',
        hasVersion: true
      });
    } else {
      unversioned.push({
        version: null, // No version available
        revision: rev.revision,
        channel: null,
        platform: 'Mac_Arm',
        hasVersion: false
      });
    }
  }

  // Sort versioned by version (newest first)
  versioned.sort((a, b) => compareVersions(b.version, a.version));

  // Sort unversioned by revision (newest first)
  unversioned.sort((a, b) => parseInt(b.revision) - parseInt(a.revision));

  // Return versioned first, then unversioned
  return [...versioned, ...unversioned];
}

export function resolveVersion(query, available) {
  if (!available || available.length === 0) {
    return null;
  }

  // Handle special keywords
  if (query === 'latest') {
    // Return first versioned item, or first unversioned if none have versions
    const versioned = available.filter(item => item.hasVersion);
    if (versioned.length > 0) {
      return versioned[0];
    }
    return available[0];
  }

  if (query === 'oldest') {
    // Return last item
    return available[available.length - 1];
  }

  // Try exact version match
  let match = available.find(item => item.version === query);
  if (match) return match;

  // Try exact revision match
  match = available.find(item => item.revision === query);
  if (match) return match;

  // Try partial version match (e.g., "92" matches "92.0.4515.159")
  match = available.find(item => item.version && item.version.startsWith(query));
  if (match) return match;

  return null;
}

export function compareVersions(v1, v2) {
  if (!v1) return -1;
  if (!v2) return 1;

  const parts1 = String(v1).split('.').map(Number);
  const parts2 = String(v2).split('.').map(Number);

  const maxLength = Math.max(parts1.length, parts2.length);

  for (let i = 0; i < maxLength; i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;

    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }

  return 0;
}


