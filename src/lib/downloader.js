/**
 * Downloader module - Streaming download with progress
 */

import fs from 'fs';
import { pipeline } from 'stream/promises';
import { createWriteStream, existsSync, statSync } from 'fs';

export function getDownloadUrl(revision) {
  return `https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Mac_Arm%2F${revision}%2Fchrome-mac.zip?alt=media`;
}

export async function fetchRevisionMetadata(revision) {
  const url = `https://www.googleapis.com/storage/v1/b/chromium-browser-snapshots/o?delimiter=/&prefix=Mac_Arm/${revision}/&fields=items(kind,mediaLink,metadata,name,size,updated),kind,prefixes,nextPageToken`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch metadata for revision ${revision}: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (!data.items || data.items.length === 0) {
    throw new Error(`No files found for revision ${revision}`);
  }

  return data;
}

export async function downloadWithProgress(url, outputPath, onProgress) {
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
        const progress = {
          downloaded: downloadedSize,
          total: totalSize,
          percentage: Math.round((downloadedSize / totalSize) * 100)
        };
        onProgress(progress);
      }
    }
    
    fileStream.end();
    
    // Wait for file stream to finish
    await new Promise((resolve, reject) => {
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
    });
    
  } catch (error) {
    fileStream.close();
    throw error;
  }
}

export async function retryFetch(fetchFn, options = {}) {
  const { retries = 3, delay = 1000, backoff = 2 } = options;
  
  let lastError;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchFn();
    } catch (error) {
      lastError = error;
      
      if (attempt < retries) {
        const waitTime = delay * Math.pow(backoff, attempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }
  
  throw lastError;
}

export async function streamDownload(url) {
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.statusText}`);
  }

  return response.body;
}

export async function validateDownload(filePath, options = {}) {
  const { expectedSize } = options;
  
  if (!existsSync(filePath)) {
    throw new Error('Downloaded file does not exist');
  }

  const stats = statSync(filePath);
  
  if (expectedSize && stats.size !== expectedSize) {
    throw new Error(`File size mismatch: expected ${expectedSize}, got ${stats.size}`);
  }

  return {
    valid: true,
    size: stats.size
  };
}


