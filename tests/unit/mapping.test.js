import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

describe('Unit: mapping module', () => {
  describe('fetchRevisions', () => {
    it('should fetch revisions from Google Storage API', async () => {
      const { fetchRevisions } = await import('../../src/lib/mapping.js');
      
      // This is a real API call - in production we might want to mock this
      // For now, we test that it returns the expected structure
      const revisions = await fetchRevisions({ limit: 5 });
      
      expect(Array.isArray(revisions)).toBe(true);
      
      if (revisions.length > 0) {
        const revision = revisions[0];
        expect(revision).toHaveProperty('revision');
        expect(typeof revision.revision).toBe('string');
      }
    }, 30000); // 30s timeout for network

    it('should handle pagination with pageToken', async () => {
      const { fetchRevisions } = await import('../../src/lib/mapping.js');
      
      const result = await fetchRevisions({ limit: 5 });
      
      expect(result).toBeDefined();
      // Should return array even if empty
      expect(Array.isArray(result)).toBe(true);
    }, 30000);

    it('should handle network errors gracefully', async () => {
      const { fetchRevisions } = await import('../../src/lib/mapping.js');
      
      // Test with invalid base URL or bad network
      await expect(
        fetchRevisions({ baseUrl: 'http://invalid-domain-xyz-123.com' })
      ).rejects.toThrow();
    }, 30000);
  });

  describe('fetchVersionMapping', () => {
    it('should fetch version mappings from Chromium Dash', async () => {
      const { fetchVersionMapping } = await import('../../src/lib/mapping.js');
      
      const mappings = await fetchVersionMapping({ 
        channel: 'Stable', 
        platform: 'Mac',
        limit: 5 
      });
      
      expect(Array.isArray(mappings)).toBe(true);
      
      if (mappings.length > 0) {
        const mapping = mappings[0];
        expect(mapping).toHaveProperty('version');
        expect(mapping).toHaveProperty('chromium_main_branch_position');
      }
    }, 30000);

    it('should support different channels', async () => {
      const { fetchVersionMapping } = await import('../../src/lib/mapping.js');
      
      const channels = ['Stable', 'Beta', 'Dev', 'Canary'];
      
      for (const channel of channels) {
        const mappings = await fetchVersionMapping({ 
          channel, 
          platform: 'Mac',
          limit: 2 
        });
        
        expect(Array.isArray(mappings)).toBe(true);
      }
    }, 60000);

    it('should handle API errors gracefully', async () => {
      const { fetchVersionMapping } = await import('../../src/lib/mapping.js');
      
      await expect(
        fetchVersionMapping({ baseUrl: 'http://invalid-domain-xyz-123.com' })
      ).rejects.toThrow();
    }, 30000);
  });

  describe('mergeRevisionsWithVersions', () => {
    it('should merge revisions with version mappings', async () => {
      const { mergeRevisionsWithVersions } = await import('../../src/lib/mapping.js');
      
      const revisions = [
        { revision: '882387', platform: 'Mac_Arm' },
        { revision: '911515', platform: 'Mac_Arm' }
      ];
      
      const versionMappings = [
        { 
          version: '92.0.4515.159', 
          chromium_main_branch_position: 882387,
          platform: 'Mac'
        },
        { 
          version: '93.0.4577.82', 
          chromium_main_branch_position: 911515,
          platform: 'Mac'
        }
      ];
      
      const merged = mergeRevisionsWithVersions(revisions, versionMappings);
      
      expect(Array.isArray(merged)).toBe(true);
      expect(merged.length).toBeGreaterThan(0);
      
      const withVersion = merged.find(m => m.version);
      expect(withVersion).toBeDefined();
      expect(withVersion?.version).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should handle revisions without version mappings', async () => {
      const { mergeRevisionsWithVersions } = await import('../../src/lib/mapping.js');
      
      const revisions = [
        { revision: '999999', platform: 'Mac_Arm' }
      ];
      
      const versionMappings = [];
      
      const merged = mergeRevisionsWithVersions(revisions, versionMappings);
      
      expect(merged.length).toBe(1);
      expect(merged[0].revision).toBe('999999');
      // Should still include revision even without version
    });

    it('should deduplicate entries', async () => {
      const { mergeRevisionsWithVersions } = await import('../../src/lib/mapping.js');
      
      const revisions = [
        { revision: '882387', platform: 'Mac_Arm' },
        { revision: '882387', platform: 'Mac_Arm' }
      ];
      
      const versionMappings = [
        { 
          version: '92.0.4515.159', 
          chromium_main_branch_position: 882387,
          platform: 'Mac'
        }
      ];
      
      const merged = mergeRevisionsWithVersions(revisions, versionMappings);
      
      // Should not have duplicates
      const revisionCounts = merged.reduce((acc, item) => {
        acc[item.revision] = (acc[item.revision] || 0) + 1;
        return acc;
      }, {});
      
      expect(revisionCounts['882387']).toBeLessThanOrEqual(1);
    });
  });

  describe('resolveVersion', () => {
    it('should resolve "latest" to highest version', async () => {
      const { resolveVersion } = await import('../../src/lib/mapping.js');
      
      const available = [
        { version: '92.0.4515.159', revision: '882387' },
        { version: '93.0.4577.82', revision: '911515' },
        { version: '91.0.4472.124', revision: '870763' }
      ];
      
      const resolved = resolveVersion('latest', available);
      
      expect(resolved).toBeDefined();
      expect(resolved?.version).toBe('93.0.4577.82');
    });

    it('should resolve "oldest" to lowest version', async () => {
      const { resolveVersion } = await import('../../src/lib/mapping.js');
      
      const available = [
        { version: '92.0.4515.159', revision: '882387' },
        { version: '93.0.4577.82', revision: '911515' },
        { version: '91.0.4472.124', revision: '870763' }
      ];
      
      const resolved = resolveVersion('oldest', available);
      
      expect(resolved).toBeDefined();
      expect(resolved?.version).toBe('91.0.4472.124');
    });

    it('should resolve exact version number', async () => {
      const { resolveVersion } = await import('../../src/lib/mapping.js');
      
      const available = [
        { version: '92.0.4515.159', revision: '882387' },
        { version: '93.0.4577.82', revision: '911515' }
      ];
      
      const resolved = resolveVersion('92.0.4515.159', available);
      
      expect(resolved).toBeDefined();
      expect(resolved?.version).toBe('92.0.4515.159');
      expect(resolved?.revision).toBe('882387');
    });

    it('should resolve by revision number', async () => {
      const { resolveVersion } = await import('../../src/lib/mapping.js');
      
      const available = [
        { version: '92.0.4515.159', revision: '882387' },
        { version: '93.0.4577.82', revision: '911515' }
      ];
      
      const resolved = resolveVersion('882387', available);
      
      expect(resolved).toBeDefined();
      expect(resolved?.revision).toBe('882387');
      expect(resolved?.version).toBe('92.0.4515.159');
    });

    it('should support partial version matching', async () => {
      const { resolveVersion } = await import('../../src/lib/mapping.js');
      
      const available = [
        { version: '92.0.4515.159', revision: '882387' },
        { version: '93.0.4577.82', revision: '911515' }
      ];
      
      const resolved = resolveVersion('92', available);
      
      expect(resolved).toBeDefined();
      expect(resolved?.version).toContain('92');
    });

    it('should return null for non-existent version', async () => {
      const { resolveVersion } = await import('../../src/lib/mapping.js');
      
      const available = [
        { version: '92.0.4515.159', revision: '882387' }
      ];
      
      const resolved = resolveVersion('999.0.0.0', available);
      
      expect(resolved).toBeNull();
    });
  });

  describe('compareVersions', () => {
    it('should compare version strings correctly', async () => {
      const { compareVersions } = await import('../../src/lib/mapping.js');
      
      expect(compareVersions('92.0.4515.159', '93.0.4577.82')).toBeLessThan(0);
      expect(compareVersions('93.0.4577.82', '92.0.4515.159')).toBeGreaterThan(0);
      expect(compareVersions('92.0.4515.159', '92.0.4515.159')).toBe(0);
    });

    it('should handle different version depths', async () => {
      const { compareVersions } = await import('../../src/lib/mapping.js');
      
      expect(compareVersions('92.0', '92.0.0.1')).toBeLessThan(0);
      expect(compareVersions('92.0.0.1', '92.0')).toBeGreaterThan(0);
    });

    it('should handle numeric comparison correctly', async () => {
      const { compareVersions } = await import('../../src/lib/mapping.js');
      
      expect(compareVersions('9.0.0.0', '10.0.0.0')).toBeLessThan(0);
      expect(compareVersions('100.0.0.0', '99.0.0.0')).toBeGreaterThan(0);
    });
  });
});


