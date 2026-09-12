import { dirname } from 'node:path';

// WHY two separate tf imports: @vladmandic/face-api's own flattened type
// declarations don't expose setBackend/ready (only @tensorflow/tfjs does),
// but its Tensor3D is its own nominal type distinct from
// @tensorflow/tfjs's -- so setup goes through the directly-imported tfjs,
// and the tensor fed into face-api's own functions is built via its own
// `faceapi.tf.tensor3d` so the types line up. Both resolve to the same
// underlying tfjs-core module at runtime (face-api's Node-WASM build
// requires the identical packages this file imports), so this is a type-only
// split, not two different runtime instances.
import * as coreTf from '@tensorflow/tfjs';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import * as faceapi from '@vladmandic/face-api/dist/face-api.node-wasm.js';
import { decode as decodeJpeg } from 'jpeg-js';
import { PNG } from 'pngjs';

// WHY two loading modes: by default this reads the WASM binary and model
// weights straight off local disk (node_modules) -- fast, and matches every
// other backend test in this repo never touching the network (see
// tests/setup-env.ts). But each app/api/**/*+api.ts route is bundled as its
// own independent serverless function for deployment (see
// scripts/deploy-backend.ts); there's no guarantee node_modules' binary
// assets survive whatever bundling step packages each route, since neither
// the .wasm binary nor the model's .bin weights are a JS module a bundler
// would trace through a require()/import -- both are read via a
// runtime-computed file path deep inside these libraries. Setting these two
// env vars (done for production only, via .env.production.local -- see
// .env.production.local.example) switches to fetching them over HTTPS from
// a CDN instead, sidestepping that risk entirely. Pin any URL used here to
// an exact package version, matching package.json's exact (non-`^`) pins
// for these two packages, so it can't silently drift out of sync with
// what's actually installed.
const WASM_URL_PREFIX = process.env.FACE_DETECTION_WASM_URL_PREFIX;
const MODEL_URL = process.env.FACE_DETECTION_MODEL_URL;

// Detection-only, never identity matching -- this answers "is a face
// present," never "whose face is this." The tiny model is intentionally the
// smallest/fastest of face-api's detectors: good enough for a presence
// check, not meant to be a precise instrument. See the model catalog at
// https://github.com/vladmandic/face-api for the tradeoffs against the
// larger detectors.
const MIN_SCORE = 0.5;

// Cached across warm invocations of the same function instance so a check-in
// doesn't re-fetch/re-read the WASM binary and model weights every time --
// set up once, reused for the lifetime of the process.
let readyPromise: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = (async () => {
      if (WASM_URL_PREFIX) {
        setWasmPaths(WASM_URL_PREFIX, true);
      }
      await coreTf.setBackend('wasm');
      await coreTf.ready();
      if (MODEL_URL) {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      } else {
        const modelDir = `${dirname(require.resolve('@vladmandic/face-api/package.json'))}/model`;
        await faceapi.nets.tinyFaceDetector.loadFromDisk(modelDir);
      }
    })().catch((error: unknown) => {
      // A failed cold start must not wedge every future call in this warm
      // instance -- clear the cache so the next detectFace() retries setup
      // from scratch instead of forever replaying the same rejection.
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

export type FaceDetectionOutcome =
  | 'face_detected'
  | 'no_face_detected'
  | 'undecodable_image';

const DATA_URL_PATTERN = /^data:([^;]+);base64,(.+)$/;

interface DecodedPixels {
  readonly width: number;
  readonly height: number;
  readonly rgb: Uint8Array;
}

// Decodes a base64 data URL into plain RGB pixel data -- jpeg-js/pngjs are
// pure-JS decoders (no native binary, no canvas/Image DOM dependency),
// matching the WASM backend's own zero-native-dependency footprint. Returns
// null for anything that isn't a jpeg/png data URL or that fails to decode,
// which the caller treats as "couldn't check this photo," not "no face."
// Deliberately has no tfjs dependency -- callable before the backend is
// ready, so an unreadable image never pays for backend/model setup.
function decodePixels(dataUrl: string): DecodedPixels | null {
  const match = DATA_URL_PATTERN.exec(dataUrl);
  if (!match) {
    return null;
  }
  const [, contentType, base64] = match;
  const buffer = Buffer.from(base64, 'base64');

  let width: number;
  let height: number;
  let rgba: Uint8Array | Buffer;
  try {
    if (contentType === 'image/jpeg') {
      const decoded = decodeJpeg(buffer, { useTArray: true });
      width = decoded.width;
      height = decoded.height;
      rgba = decoded.data;
    } else if (contentType === 'image/png') {
      const decoded = PNG.sync.read(buffer);
      width = decoded.width;
      height = decoded.height;
      rgba = decoded.data;
    } else {
      return null;
    }
  } catch {
    return null;
  }

  // Both decoders emit 4 channels (RGBA); face detection only wants RGB.
  const rgb = new Uint8Array(width * height * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    rgb[j] = rgba[i];
    rgb[j + 1] = rgba[i + 1];
    rgb[j + 2] = rgba[i + 2];
  }
  return { width, height, rgb };
}

// Scans a photo (a base64 data URL) for the presence of a human face.
// Decoded and scanned entirely in memory -- never written to disk or any
// persistent store. The caller owns not persisting the source photo either;
// this function only ever returns a yes/no/unreadable outcome, never the
// image itself.
export async function detectFace(dataUrl: string): Promise<FaceDetectionOutcome> {
  const pixels = decodePixels(dataUrl);
  if (!pixels) {
    return 'undecodable_image';
  }

  // Backend must be ready before building a tensor at all, not just before
  // running detection -- tensor3d() itself is a backend-dependent op. Held
  // off until here so a request with an unreadable image never pays for it.
  await ensureReady();
  const tensor = faceapi.tf.tensor3d(
    pixels.rgb,
    [pixels.height, pixels.width, 3],
    'int32',
  );
  try {
    const options = new faceapi.TinyFaceDetectorOptions({
      scoreThreshold: MIN_SCORE,
    });
    const result = await faceapi.detectSingleFace(tensor, options);
    return result ? 'face_detected' : 'no_face_detected';
  } finally {
    tensor.dispose();
  }
}
