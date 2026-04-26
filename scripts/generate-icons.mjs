import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const publicDir = resolve(rootDir, "public");
const sourceLogoPath = resolve(rootDir, "071d405f-eb46-4845-80c8-60d256531469.png");

if (!existsSync(sourceLogoPath)) {
  throw new Error(`Source logo not found: ${sourceLogoPath}`);
}

const sourceLogoUrl = `data:image/png;base64,${readFileSync(sourceLogoPath).toString("base64")}`;

async function renderImage(page, width, height, outputName, options = {}) {
  const {
    sourceWidth = width,
    sourceHeight = height,
    offsetX = 0,
    offsetY = 0,
    background = "#40725a"
  } = options;

  await page.setViewportSize({ width, height });
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <style>
          html, body {
            width: ${width}px;
            height: ${height}px;
            margin: 0;
            overflow: hidden;
            background: ${background};
          }
          img {
            position: absolute;
            left: ${offsetX}px;
            top: ${offsetY}px;
            width: ${sourceWidth}px;
            height: ${sourceHeight}px;
            display: block;
          }
        </style>
      </head>
      <body>
        <img src="${sourceLogoUrl}" alt="">
      </body>
    </html>
  `);
  await page.screenshot({
    path: resolve(publicDir, outputName),
    clip: { x: 0, y: 0, width, height },
    omitBackground: false
  });
  console.log(`${outputName} gerado`);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ deviceScaleFactor: 1 });

try {
  copyFileSync(sourceLogoPath, resolve(publicDir, "rayquaza-logo-source.png"));
  console.log("rayquaza-logo-source.png copiado");

  // Content bounds in the source image: x=101..1153, y=536..757.
  // The crop below keeps the original artwork untouched, only trimming empty green space.
  await renderImage(page, 1140, 360, "rayquaza-logo.png", {
    sourceWidth: 1254,
    sourceHeight: 1254,
    offsetX: -57,
    offsetY: -455
  });

  for (const [size, outputName] of [
    [32, "favicon-32.png"],
    [180, "apple-touch-icon.png"],
    [192, "icon-192.png"],
    [512, "icon-512.png"]
  ]) {
    await renderImage(page, size, size, outputName, {
      sourceWidth: size,
      sourceHeight: size
    });
  }
} finally {
  await browser.close();
}
