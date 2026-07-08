// Adds transparent padding to adaptive-icon.png so the icon content fits within
// Android's adaptive icon safe zone (center ~65% of the canvas).
// Without this, Android crops the icon to a circle/shape and the content appears zoomed in.
//
// Usage (from project root):
//   node pad-icon.js
//
// After running:
//   1. Delete android/app/src/main/res/mipmap-* directories
//   2. Run: npx expo prebuild (from project root)
//   3. Rebuild: cd android && .\gradlew assembleRelease

const path = require('path');
const Jimp = require('jimp');

const SRC = path.join(__dirname, 'assets', 'adaptive-icon.png');
const CANVAS_SIZE = 1024;
const CONTENT_SCALE = 0.65; // icon content occupies 65% of canvas; rest is transparent padding
const CONTENT_SIZE = Math.round(CANVAS_SIZE * CONTENT_SCALE); // ~666px
const PAD = Math.round((CANVAS_SIZE - CONTENT_SIZE) / 2);    // ~179px each side

async function run() {
  console.log('Reading', SRC);
  const img = await Jimp.read(SRC);
  console.log(`Original size: ${img.getWidth()}x${img.getHeight()}`);

  img.resize(CONTENT_SIZE, CONTENT_SIZE, Jimp.RESIZE_BICUBIC);

  const canvas = new Jimp(CANVAS_SIZE, CANVAS_SIZE, 0x00000000);
  canvas.composite(img, PAD, PAD);

  await canvas.writeAsync(SRC);
  console.log(`Done! adaptive-icon.png is now ${CANVAS_SIZE}x${CANVAS_SIZE}`);
  console.log(`Content: ${CONTENT_SIZE}x${CONTENT_SIZE} centered with ${PAD}px transparent padding.`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Delete: android/app/src/main/res/mipmap-hdpi');
  console.log('             android/app/src/main/res/mipmap-mdpi');
  console.log('             android/app/src/main/res/mipmap-xhdpi');
  console.log('             android/app/src/main/res/mipmap-xxhdpi');
  console.log('             android/app/src/main/res/mipmap-xxxhdpi');
  console.log('  2. Run from project root: npx expo prebuild');
  console.log('  3. Rebuild: cd android && .\\gradlew assembleRelease');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
