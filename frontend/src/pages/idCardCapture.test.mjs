import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateGuideSourceCrop } from './idCardCapture.js';

test('crops a cover video to the visible ID-card guide', () => {
  const videoRect = { left: 269.484375, top: 226.265625, right: 995.5, bottom: 555.453125, width: 726.015625, height: 329.1875 };
  const guideRect = { left: 380.484375, top: 231.890625, right: 884.484375, bottom: 549.828125, width: 504, height: 317.9375 };

  const crop = calculateGuideSourceCrop({
    videoWidth: 1920,
    videoHeight: 1080,
    videoRect,
    guideRect,
    objectFit: 'cover'
  });

  assert.ok(crop.left >= 0);
  assert.ok(crop.top >= 0);
  assert.ok(crop.left + crop.width <= 1920);
  assert.ok(crop.top + crop.height <= 1080);
  assert.ok(Math.abs(crop.width / crop.height - 85.6 / 54) < 0.01);
});

test('keeps the crop inside a portrait camera source', () => {
  const crop = calculateGuideSourceCrop({
    videoWidth: 1080,
    videoHeight: 1920,
    videoRect: { left: 0, top: 0, right: 390, bottom: 360, width: 390, height: 360 },
    guideRect: { left: 29.25, top: 75.5, right: 360.75, bottom: 284.5, width: 331.5, height: 209 },
    objectFit: 'cover'
  });

  assert.ok(crop.left >= 0);
  assert.ok(crop.top >= 0);
  assert.ok(crop.left + crop.width <= 1080);
  assert.ok(crop.top + crop.height <= 1920);
  assert.ok(Math.abs(crop.width / crop.height - 85.6 / 54) < 0.01);
});
