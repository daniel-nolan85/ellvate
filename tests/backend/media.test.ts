import { describe, expect, test } from 'bun:test';

import {
  extractAvatarUpload,
  extractExistingMedia,
  extractMediaUploads,
} from '../../src/backend/media';

const DATA_URL = 'data:image/jpeg;base64,ZmFrZS1ieXRlcw==';

describe('extractMediaUploads', () => {
  test('returns an empty array when newMedia is missing', () => {
    expect(extractMediaUploads({})).toEqual([]);
    expect(extractMediaUploads(null)).toEqual([]);
    expect(extractMediaUploads('not-an-object')).toEqual([]);
  });

  test('returns an empty array when newMedia is not an array', () => {
    expect(extractMediaUploads({ newMedia: { dataUrl: DATA_URL } })).toEqual([]);
  });

  test('extracts valid data URL uploads with their filenames', () => {
    const result = extractMediaUploads({
      newMedia: [{ dataUrl: DATA_URL, filename: 'sunset.jpg' }],
    });

    expect(result).toEqual([{ dataUrl: DATA_URL, filename: 'sunset.jpg' }]);
  });

  test('defaults a missing filename to "upload"', () => {
    const result = extractMediaUploads({ newMedia: [{ dataUrl: DATA_URL }] });

    expect(result).toEqual([{ dataUrl: DATA_URL, filename: 'upload' }]);
  });

  test('drops items whose dataUrl does not start with "data:"', () => {
    const result = extractMediaUploads({
      newMedia: [
        { dataUrl: DATA_URL, filename: 'keep.jpg' },
        { dataUrl: 'https://example.com/not-inline.jpg', filename: 'drop.jpg' },
        { dataUrl: '', filename: 'drop-empty.jpg' },
      ],
    });

    expect(result).toEqual([{ dataUrl: DATA_URL, filename: 'keep.jpg' }]);
  });

  test('drops non-object entries within the array', () => {
    const result = extractMediaUploads({
      newMedia: [null, 'string-entry', 42, { dataUrl: DATA_URL, filename: 'ok.jpg' }],
    });

    expect(result).toEqual([{ dataUrl: DATA_URL, filename: 'ok.jpg' }]);
  });

  test('caps the result at 10 items', () => {
    const newMedia = Array.from({ length: 15 }, (_, index) => ({
      dataUrl: DATA_URL,
      filename: `image-${index}.jpg`,
    }));

    expect(extractMediaUploads({ newMedia })).toHaveLength(10);
  });
});

describe('extractExistingMedia', () => {
  test('returns an empty array when existingMedia is missing', () => {
    expect(extractExistingMedia({})).toEqual([]);
    expect(extractExistingMedia(null)).toEqual([]);
  });

  test('extracts valid existing media references', () => {
    const result = extractExistingMedia({
      existingMedia: [
        { filename: 'kept.jpg', url: 'https://cdn.example.com/kept.jpg' },
      ],
    });

    expect(result).toEqual([
      { filename: 'kept.jpg', url: 'https://cdn.example.com/kept.jpg' },
    ]);
  });

  test('drops items with an empty or missing url', () => {
    const result = extractExistingMedia({
      existingMedia: [
        { filename: 'no-url.jpg', url: '' },
        { filename: 'has-url.jpg', url: 'https://cdn.example.com/has-url.jpg' },
      ],
    });

    expect(result).toEqual([
      { filename: 'has-url.jpg', url: 'https://cdn.example.com/has-url.jpg' },
    ]);
  });

  test('caps the result at 10 items', () => {
    const existingMedia = Array.from({ length: 15 }, (_, index) => ({
      filename: `image-${index}.jpg`,
      url: `https://cdn.example.com/image-${index}.jpg`,
    }));

    expect(extractExistingMedia({ existingMedia })).toHaveLength(10);
  });
});

describe('extractAvatarUpload', () => {
  test('returns null when avatar is missing', () => {
    expect(extractAvatarUpload({})).toBeNull();
    expect(extractAvatarUpload(null)).toBeNull();
  });

  test('returns null when the dataUrl does not start with "data:"', () => {
    expect(
      extractAvatarUpload({
        avatar: { dataUrl: 'https://example.com/me.jpg', filename: 'me.jpg' },
      }),
    ).toBeNull();
  });

  test('extracts a valid single avatar upload', () => {
    const result = extractAvatarUpload({
      avatar: { dataUrl: DATA_URL, filename: 'me.jpg' },
    });

    expect(result).toEqual({ dataUrl: DATA_URL, filename: 'me.jpg' });
  });

  test('defaults a missing filename to "avatar"', () => {
    const result = extractAvatarUpload({ avatar: { dataUrl: DATA_URL } });

    expect(result).toEqual({ dataUrl: DATA_URL, filename: 'avatar' });
  });
});
