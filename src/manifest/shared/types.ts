import type { CHANNELS, PLATFORMS } from './constants';

export interface Revision {
  name: string;
  size: `${number}`;
  updated: string;
}

export type Platform = (typeof PLATFORMS)[number];
export type Channel = (typeof CHANNELS)[number];

export interface Version {
  channel: Channel;
  chromium_main_branch_position: null | number;
  hashes: {
    angle: string;
    chromium: string;
    devtools: string;
    pdfium: string;
    skia: string;
    v8: string;
    webrtc: string;
  };
  milestone: number;
  platform: Platform;
  previous_version: string;
  time: number;
  version: string;
}
