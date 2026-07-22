import { describe, expect, test } from 'bun:test';

import {
  extractAvatarUpload,
  extractExistingMedia,
  extractMediaUploads,
  MediaValidationError,
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

  test('rejects a request with more than 10 items', () => {
    const newMedia = Array.from({ length: 15 }, (_, index) => ({
      dataUrl: DATA_URL,
      filename: `image-${index}.jpg`,
    }));

    expect(() => extractMediaUploads({ newMedia })).toThrow(MediaValidationError);
  });

  test('rejects an unsupported MIME type', () => {
    const newMedia = [
      { dataUrl: 'data:application/pdf;base64,ZmFrZQ==', filename: 'doc.pdf' },
    ];

    expect(() => extractMediaUploads({ newMedia })).toThrow(MediaValidationError);
  });

  test('rejects a data URL with invalid base64 characters', () => {
    const newMedia = [
      { dataUrl: 'data:image/jpeg;base64,not!valid$base64', filename: 'bad.jpg' },
    ];

    expect(() => extractMediaUploads({ newMedia })).toThrow(MediaValidationError);
  });

  test('rejects an oversized image', () => {
    const oversizedBase64 = 'A'.repeat(12 * 1024 * 1024);
    const newMedia = [
      { dataUrl: `data:image/jpeg;base64,${oversizedBase64}`, filename: 'huge.jpg' },
    ];

    expect(() => extractMediaUploads({ newMedia })).toThrow(MediaValidationError);
  });

  test('rejects an aggregate request over the total size cap', () => {
    // ~7MB decoded per item (under the 8MB per-file cap), 6 items ≈ 42MB
    // decoded total (over the 40MB aggregate cap).
    const largeBase64 = 'A'.repeat(9_800_000);
    const newMedia = Array.from({ length: 6 }, (_, index) => ({
      dataUrl: `data:image/jpeg;base64,${largeBase64}`,
      filename: `image-${index}.jpg`,
    }));

    expect(() => extractMediaUploads({ newMedia })).toThrow(MediaValidationError);
  });

  test('rejects an unsafe filename', () => {
    const newMedia = [{ dataUrl: DATA_URL, filename: '../../etc/passwd' }];

    expect(() => extractMediaUploads({ newMedia })).toThrow(MediaValidationError);
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

  test('rejects a request with more than 10 items', () => {
    const existingMedia = Array.from({ length: 15 }, (_, index) => ({
      filename: `image-${index}.jpg`,
      url: `https://cdn.example.com/image-${index}.jpg`,
    }));

    expect(() => extractExistingMedia({ existingMedia })).toThrow(
      MediaValidationError,
    );
  });

  test('rejects an unsafe filename', () => {
    const existingMedia = [
      { filename: '../../etc/passwd', url: 'https://cdn.example.com/x.jpg' },
    ];

    expect(() => extractExistingMedia({ existingMedia })).toThrow(
      MediaValidationError,
    );
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

  test('rejects an unsupported MIME type', () => {
    expect(() =>
      extractAvatarUpload({
        avatar: { dataUrl: 'data:application/pdf;base64,ZmFrZQ==', filename: 'me.pdf' },
      }),
    ).toThrow(MediaValidationError);
  });

  test('rejects an oversized avatar', () => {
    const oversizedBase64 = 'A'.repeat(12 * 1024 * 1024);
    expect(() =>
      extractAvatarUpload({
        avatar: { dataUrl: `data:image/jpeg;base64,${oversizedBase64}`, filename: 'me.jpg' },
      }),
    ).toThrow(MediaValidationError);
  });
});
