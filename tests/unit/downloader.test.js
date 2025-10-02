import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import { join } from 'path';

let testDir;

describe('Unit: downloader module', () => {
  beforeEach(() => {
    testDir = fs.mkdtempSync(join(os.tmpdir(), 'chvm-download-test-'));
  });

  afterEach(() => {
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('getDownloadUrl', () => {
    it('should construct correct download URL for revision', async () => {
      const { getDownloadUrl } = await import('../../src/lib/downloader.js');
      
      const url = getDownloadUrl('882387');
      
      expect(url).toContain('chromium-browser-snapshots');
      expect(url).toContain('Mac_Arm');
      expect(url).toContain('882387');
    });

    it('should include chrome-mac.zip in the URL', async () => {
      const { getDownloadUrl } = await import('../../src/lib/downloader.js');
      
      const url = getDownloadUrl('882387');
      
      expect(url).toContain('chrome-mac.zip');
    });
  });

  describe('fetchRevisionMetadata', () => {
    it('should fetch metadata for a revision', async () => {
      const { fetchRevisionMetadata } = await import('../../src/lib/downloader.js');
      
      // Using a known revision
      const metadata = await fetchRevisionMetadata('882387');
      
      expect(metadata).toBeDefined();
      expect(metadata.items).toBeDefined();
      expect(Array.isArray(metadata.items)).toBe(true);
      
      // Should have chrome-mac.zip
      const chromeMacZip = metadata.items.find(item => 
        item.name && item.name.includes('chrome-mac.zip')
      );
      expect(chromeMacZip).toBeDefined();
      expect(chromeMacZip?.size).toBeDefined();
      expect(chromeMacZip?.mediaLink).toBeDefined();
    }, 30000);

    it('should throw error for non-existent revision', async () => {
      const { fetchRevisionMetadata } = await import('../../src/lib/downloader.js');
      
      await expect(
        fetchRevisionMetadata('99999999')
      ).rejects.toThrow();
    }, 30000);
  });

  describe('downloadWithProgress', () => {
    it('should download file and report progress', async () => {
      const { downloadWithProgress } = await import('../../src/lib/downloader.js');
      
      const outputPath = join(testDir, 'test-download.zip');
      const progressUpdates = [];
      
      // Use a small test file (REVISIONS file instead of full zip)
      const testUrl = 'https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Mac_Arm%2F882387%2FREVISIONS?generation=1620872146531390&alt=media';
      
      await downloadWithProgress(testUrl, outputPath, (progress) => {
        progressUpdates.push(progress);
      });
      
      // File should exist
      expect(fs.existsSync(outputPath)).toBe(true);
      
      // Should have received progress updates
      expect(progressUpdates.length).toBeGreaterThan(0);
      
      // Last progress should be complete
      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress.percent).toBeGreaterThanOrEqual(99);
    }, 60000);

    it('should handle download errors', async () => {
      const { downloadWithProgress } = await import('../../src/lib/downloader.js');
      
      const outputPath = join(testDir, 'test-download.zip');
      
      await expect(
        downloadWithProgress('http://invalid-url-xyz-123.com/file.zip', outputPath)
      ).rejects.toThrow();
    }, 30000);

    it('should report correct progress data structure', async () => {
      const { downloadWithProgress } = await import('../../src/lib/downloader.js');
      
      const outputPath = join(testDir, 'test-download.zip');
      let progressSample = null;
      
      const testUrl = 'https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Mac_Arm%2F882387%2FREVISIONS?generation=1620872146531390&alt=media';
      
      await downloadWithProgress(testUrl, outputPath, (progress) => {
        if (!progressSample) {
          progressSample = progress;
        }
      });
      
      expect(progressSample).toBeDefined();
      expect(progressSample).toHaveProperty('percent');
      expect(progressSample).toHaveProperty('transferred');
      expect(progressSample).toHaveProperty('total');
      
      expect(typeof progressSample.percent).toBe('number');
      expect(typeof progressSample.transferred).toBe('number');
    }, 60000);
  });

  describe('retryFetch', () => {
    it('should retry failed requests', async () => {
      const { retryFetch } = await import('../../src/lib/downloader.js');
      
      let attempts = 0;
      const fetchFn = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('Network error');
        }
        return { ok: true, data: 'success' };
      };
      
      const result = await retryFetch(fetchFn, { maxRetries: 3, delay: 100 });
      
      expect(result).toBeDefined();
      expect(result.ok).toBe(true);
      expect(attempts).toBe(3);
    }, 10000);

    it('should throw after max retries exceeded', async () => {
      const { retryFetch } = await import('../../src/lib/downloader.js');
      
      const fetchFn = async () => {
        throw new Error('Persistent error');
      };
      
      await expect(
        retryFetch(fetchFn, { maxRetries: 2, delay: 100 })
      ).rejects.toThrow('Persistent error');
    }, 10000);

    it('should use exponential backoff', async () => {
      const { retryFetch } = await import('../../src/lib/downloader.js');
      
      const delays = [];
      let attempts = 0;
      
      const fetchFn = async () => {
        const now = Date.now();
        if (attempts > 0) {
          delays.push(now);
        } else {
          delays.push(now);
        }
        attempts++;
        if (attempts < 3) {
          throw new Error('Retry');
        }
        return { ok: true };
      };
      
      await retryFetch(fetchFn, { maxRetries: 3, delay: 100 });
      
      // Should have increasing delays (exponential backoff)
      if (delays.length >= 3) {
        const delay1 = delays[1] - delays[0];
        const delay2 = delays[2] - delays[1];
        
        expect(delay2).toBeGreaterThanOrEqual(delay1);
      }
    }, 10000);
  });

  describe('streamDownload', () => {
    it('should stream download without saving complete file', async () => {
      const { streamDownload } = await import('../../src/lib/downloader.js');
      
      const testUrl = 'https://www.googleapis.com/download/storage/v1/b/chromium-browser-snapshots/o/Mac_Arm%2F882387%2FREVISIONS?generation=1620872146531390&alt=media';
      
      let chunks = [];
      const stream = await streamDownload(testUrl);
      
      for await (const chunk of stream) {
        chunks.push(chunk);
      }
      
      expect(chunks.length).toBeGreaterThan(0);
      
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      expect(totalSize).toBeGreaterThan(0);
    }, 60000);
  });

  describe('validateDownload', () => {
    it('should validate file size matches expected', async () => {
      const { validateDownload } = await import('../../src/lib/downloader.js');
      
      const testFile = join(testDir, 'test.txt');
      fs.writeFileSync(testFile, 'test content');
      
      const isValid = await validateDownload(testFile, { 
        expectedSize: fs.statSync(testFile).size 
      });
      
      expect(isValid).toBe(true);
    });

    it('should fail validation for wrong size', async () => {
      const { validateDownload } = await import('../../src/lib/downloader.js');
      
      const testFile = join(testDir, 'test.txt');
      fs.writeFileSync(testFile, 'test content');
      
      const isValid = await validateDownload(testFile, { 
        expectedSize: 99999 
      });
      
      expect(isValid).toBe(false);
    });

    it('should fail validation for non-existent file', async () => {
      const { validateDownload } = await import('../../src/lib/downloader.js');
      
      const isValid = await validateDownload(join(testDir, 'nonexistent.txt'), {
        expectedSize: 100
      });
      
      expect(isValid).toBe(false);
    });
  });
});


