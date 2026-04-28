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

async function renderHtmlImage(page, width, height, outputName, html, options = {}) {
  const { background = "transparent", omitBackground = background === "transparent" } = options;

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
          * {
            box-sizing: border-box;
          }
        </style>
      </head>
      <body>${html}</body>
    </html>
  `);
  await page.screenshot({
    path: resolve(publicDir, outputName),
    clip: { x: 0, y: 0, width, height },
    omitBackground
  });
  console.log(`${outputName} gerado`);
}

function notificationIconHtml(size) {
  const p = (value) => Math.round((value / 192) * size);

  return `
    <div style="
      width: ${size}px;
      height: ${size}px;
      display: grid;
      place-items: center;
      background: #40725a;
      border-radius: ${p(40)}px;
      position: relative;
      overflow: hidden;
      font-family: Arial, sans-serif;
    ">
      <div style="
        position: absolute;
        inset: ${p(18)}px;
        border: ${p(8)}px solid rgba(248, 200, 101, 0.86);
        border-radius: ${p(32)}px;
      "></div>
      <div style="
        position: absolute;
        left: ${p(39)}px;
        top: ${p(48)}px;
        width: ${p(26)}px;
        height: ${p(78)}px;
        border-radius: ${p(18)}px ${p(18)}px ${p(6)}px ${p(6)}px;
        background: #df6677;
      "></div>
      <div style="
        color: #f8c865;
        font-size: ${p(96)}px;
        font-weight: 900;
        line-height: 1;
        transform: translateX(${p(7)}px);
      ">R</div>
      <div style="
        position: absolute;
        right: ${p(30)}px;
        top: ${p(30)}px;
        width: ${p(36)}px;
        height: ${p(36)}px;
        border: ${p(6)}px solid #40725a;
        border-radius: 999px;
        background: #f8c865;
      "></div>
    </div>
  `;
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

  for (const [size, outputName] of [
    [32, "notification-icon-32.png"],
    [180, "notification-icon-180.png"],
    [192, "notification-icon-192.png"],
    [512, "notification-icon-512.png"]
  ]) {
    await renderHtmlImage(page, size, size, outputName, notificationIconHtml(size), {
      background: "transparent",
      omitBackground: true
    });
  }

  await renderHtmlImage(
    page,
    96,
    96,
    "notification-badge-96.png",
    `
      <div style="
        width: 96px;
        height: 96px;
        display: grid;
        place-items: center;
        background: transparent;
        position: relative;
        font-family: Arial, sans-serif;
      ">
        <div style="
          position: absolute;
          inset: 14px;
          border: 8px solid #ffffff;
          border-radius: 22px;
        "></div>
        <div style="
          position: absolute;
          left: 24px;
          top: 29px;
          width: 12px;
          height: 37px;
          border-radius: 10px 10px 4px 4px;
          background: #ffffff;
        "></div>
        <div style="
          color: #ffffff;
          font-size: 48px;
          font-weight: 900;
          line-height: 1;
          transform: translateX(4px);
        ">R</div>
      </div>
    `,
    { background: "transparent", omitBackground: true }
  );
} finally {
  await browser.close();
}
