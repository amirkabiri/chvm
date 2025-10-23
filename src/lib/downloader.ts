/**
 * Downloader module - Streaming download with progress
 */

import { createWriteStream, existsSync, statSync } from 'fs';

export interface RevisionMetadata {
  items: Array<{
    kind: string;
    mediaLink: string;
    metadata?: Record<string, unknown>;
    name: string;
    size: string;
    updated: string;
  }>;
  kind: string;
  prefixes?: string[];
  nextPageToken?: string;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percentage: number;
}

export interface RetryOptions {
  retries?: number;
  delay?: number;
  backoff?: number;
}

export interface ValidationOptions {
  expectedSize?: number;
}

export interface ValidationResult {
  valid: boolean;
  size: number;
}

export function getDownloadUrl(revision: string): string {
  return `https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Mac_Arm%2F${revision}%2Fchrome-mac.zip?alt=media`;
}

export async function fetchRevisionMetadata(
  revision: string
): Promise<RevisionMetadata> {
  const url = `https://www.googleapis.com/storage/v1/b/chromium-browser-snapshots/o?delimiter=/&prefix=Mac_Arm/${revision}/&fields=items(kind,mediaLink,metadata,name,size,updated),kind,prefixes,nextPageToken`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Failed to fetch metadata for revision ${revision}: ${response.statusText}`
    );
  }

  const data = (await response.json()) as RevisionMetadata;

  if (!data.items || data.items.length === 0) {
    throw new Error(`No files found for revision ${revision}`);
  }

  return data;
}

export async function downloadWithProgress(
  url: string,
  outputPath: string,
  onProgress?: (progress: DownloadProgress) => void
): Promise<void> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  const totalSize = parseInt(response.headers.get('content-length') || '0', 10);
  let downloadedSize = 0;

  const fileStream = createWriteStream(outputPath);

  if (!response.body) {
    throw new Error('Response body is null');
  }

  const reader = response.body.getReader();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      fileStream.write(value);
      downloadedSize += value.length;

      if (onProgress && totalSize > 0) {
        const progress: DownloadProgress = {
          downloaded: downloadedSize,
          total: totalSize,
          percentage: Math.round((downloadedSize / totalSize) * 100),
        };
        onProgress(progress);
      }
    }

    fileStream.end();

    // Wait for file stream to finish
    await new Promise<void>((resolve, reject) => {
      fileStream.on('finish', () => resolve());
      fileStream.on('error', reject);
    });
  } catch (error) {
    fileStream.close();
    throw error;
  }
}

export async function retryFetch<T>(
  fetchFn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { retries = 3, delay = 1000, backoff = 2 } = options;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < retries) {
        const waitTime = delay * Math.pow(backoff, attempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  throw lastError;
}

export async function streamDownload(
  url: string
): Promise<ReadableStream<Uint8Array> | null> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  return response.body;
}

export async function validateDownload(
  filePath: string,
  options: ValidationOptions = {}
): Promise<ValidationResult> {
  const { expectedSize } = options;

  if (!existsSync(filePath)) {
    throw new Error('Downloaded file does not exist');
  }

  const stats = statSync(filePath);

  if (expectedSize && stats.size !== expectedSize) {
    throw new Error(
      `File size mismatch: expected ${expectedSize}, got ${stats.size}`
    );
  }

  return {
    valid: true,
    size: stats.size,
  };
}
