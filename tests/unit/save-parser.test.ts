import { describe, it, expect } from 'vitest';
import {
  detectFormat,
  mapToDisplayNames,
  extractCharacterIds,
  parsePlZSave,
} from '../../src/save-parser.js';
import type { SaveFormat } from '../../src/save-parser.js';

/** Create a Uint8Array from hex-encoded magic bytes followed by zero fill */
function makeHeader(hexMagic: string, size = 64): Uint8Array {
  const bytes = new Uint8Array(size);
  const magic = hexMagic.match(/.{1,2}/g)!.map((b: string) => parseInt(b, 16));
  for (let i = 0; i < magic.length; i++) {
    bytes[i] = magic[i];
  }
  return bytes;
}

/** Encode a UE FString: 4-byte signed int32 LE length, then ASCII data */
function encodeFString(str: string): Uint8Array {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const len = data.length;
  const buf = new Uint8Array(4 + len);
  // Little-endian 32-bit signed integer
  buf[0] = len & 0xff;
  buf[1] = (len >> 8) & 0xff;
  buf[2] = (len >> 16) & 0xff;
  buf[3] = (len >> 24) & 0xff;
  buf.set(data, 4);
  return buf;
}

/** Build a minimal GVAS-like buffer with CharacterID markers */
function buildGvasWithCharacterIds(ids: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const marker = encoder.encode('CharacterID');
  // Padding between marker end and the start of FString scanning
  const padding = new Uint8Array(50);

  const parts: Uint8Array[] = [];
  for (const id of ids) {
    parts.push(marker);
    parts.push(padding);
    parts.push(encodeFString(id));
    // Some extra bytes to separate entries
    parts.push(new Uint8Array(10));
  }

  // Concatenate all parts
  const totalLen = parts.reduce((sum, p) => sum + p.length, 0);
  const result = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

describe('save-parser', () => {
  describe('detectFormat()', () => {
    it('detects PlZ format (0x506c5a00)', () => {
      const bytes = makeHeader('506c5a00');
      expect(detectFormat(bytes)).toBe<SaveFormat>('PlZ');
    });

    it('detects PlM format (0x506c4d00)', () => {
      const bytes = makeHeader('506c4d00');
      expect(detectFormat(bytes)).toBe<SaveFormat>('PlM');
    });

    it('detects unknown format for random bytes', () => {
      const bytes = makeHeader('deadbeef');
      expect(detectFormat(bytes)).toBe<SaveFormat>('unknown');
    });

    it('returns unknown for empty buffer', () => {
      const bytes = new Uint8Array(0);
      expect(detectFormat(bytes)).toBe<SaveFormat>('unknown');
    });

    it('returns unknown for buffer smaller than 4 bytes', () => {
      const bytes = new Uint8Array([0x50, 0x6c]);
      expect(detectFormat(bytes)).toBe<SaveFormat>('unknown');
    });
  });

  describe('mapToDisplayNames()', () => {
    const idMap: Record<string, string> = {
      Kitsunebi: 'Foxparks',
      Anubis: 'Anubis',
      AmaterasuWolf: 'Kitsun',
    };

    it('maps known internal IDs to display names', () => {
      const result = mapToDisplayNames(['Kitsunebi', 'Anubis'], idMap);
      expect(result).toEqual(['Foxparks', 'Anubis']);
    });

    it('maps multiple known IDs', () => {
      const result = mapToDisplayNames(
        ['Kitsunebi', 'AmaterasuWolf', 'Anubis'],
        idMap,
      );
      expect(result).toEqual(['Foxparks', 'Kitsun', 'Anubis']);
    });

    it('falls back to underscore→space for unknown IDs', () => {
      const result = mapToDisplayNames(['Unknown_Pal', 'Mystery_Beast'], idMap);
      expect(result).toEqual(['Unknown Pal', 'Mystery Beast']);
    });

    it('passes through unknown IDs without underscores', () => {
      const result = mapToDisplayNames(['SomeUnknownPal'], idMap);
      expect(result).toEqual(['SomeUnknownPal']);
    });

    it('returns empty array for empty input', () => {
      const result = mapToDisplayNames([], idMap);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty input with empty idMap', () => {
      const result = mapToDisplayNames([], {});
      expect(result).toEqual([]);
    });
  });

  describe('extractCharacterIds()', () => {
    it('extracts CharacterID markers from GVAS-like data', () => {
      const data = buildGvasWithCharacterIds(['Kitsunebi', 'PinkCat']);
      const ids = extractCharacterIds(data);
      expect(ids).toContain('Kitsunebi');
      expect(ids).toContain('PinkCat');
    });

    it('extracts internal IDs with underscores', () => {
      const data = buildGvasWithCharacterIds(['Yeti_Grass', 'Deer_Ground']);
      const ids = extractCharacterIds(data);
      expect(ids).toContain('Yeti_Grass');
      expect(ids).toContain('Deer_Ground');
    });

    it('returns empty array for data without CharacterID markers', () => {
      const data = new TextEncoder().encode('Some random data without the marker');
      const ids = extractCharacterIds(data);
      expect(ids).toEqual([]);
    });

    it('returns empty array for empty buffer', () => {
      const ids = extractCharacterIds(new Uint8Array(0));
      expect(ids).toEqual([]);
    });

    it('deduplicates identical CharacterIDs', () => {
      const data = buildGvasWithCharacterIds([
        'Kitsunebi',
        'Kitsunebi',
        'PinkCat',
      ]);
      const ids = extractCharacterIds(data);
      expect(ids.filter((id) => id === 'Kitsunebi')).toHaveLength(1);
    });

    it('returns sorted results', () => {
      const data = buildGvasWithCharacterIds(['Kitsunebi', 'Anubis', 'PinkCat']);
      const ids = extractCharacterIds(data);
      expect(ids).toEqual([...ids].sort());
    });

    it('filters out UE property type false positives', () => {
      // Building synthetic data with "StrProperty" which should be filtered
      const data = buildGvasWithCharacterIds(['StrProperty', 'Kitsunebi']);
      const ids = extractCharacterIds(data);
      // StrProperty should be filtered out; Kitsunebi should remain
      expect(ids).not.toContain('StrProperty');
      expect(ids).toContain('Kitsunebi');
    });

    it('handles single CharacterID', () => {
      const data = buildGvasWithCharacterIds(['Kitsunebi']);
      const ids = extractCharacterIds(data);
      expect(ids).toEqual(['Kitsunebi']);
    });
  });

  describe('parsePlZSave()', () => {
    const idMap: Record<string, string> = {
      Kitsunebi: 'Foxparks',
    };

    it('returns error for PlM format', async () => {
      const bytes = makeHeader('506c4d00', 64);
      const result = await parsePlZSave(bytes, idMap);
      expect(result.format).toBe<SaveFormat>('PlM');
      expect(result.palNames).toEqual([]);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('PlM');
    });

    it('returns error for unknown format', async () => {
      const bytes = makeHeader('deadbeef', 64);
      const result = await parsePlZSave(bytes, idMap);
      expect(result.format).toBe<SaveFormat>('unknown');
      expect(result.palNames).toEqual([]);
      expect(result.error).toBeDefined();
      expect(result.error).toContain('Unknown');
    });

    it('returns error for corrupt PlZ data', async () => {
      // Valid PlZ magic but garbage after header
      const bytes = makeHeader('506c5a00', 64);
      // Fill the header area and beyond with non-deflate garbage
      bytes.fill(0xff, 4);
      const result = await parsePlZSave(bytes, idMap);
      expect(result.format).toBe<SaveFormat>('PlZ');
      expect(result.error).toBeDefined();
    });
  });
});
