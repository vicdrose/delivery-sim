const path = require('path');
const fs = require('fs');
const puppeteer = require(path.join('C:/Users/MASTER~1/AppData/Local/Temp/opencode/snaprun/node_modules', 'puppeteer-core'));

const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>
  <rect width='512' height='512' rx='90' fill='#ffb43a'/>
  <rect x='120' y='210' width='272' height='160' rx='30' fill='#241c15'/>
  <circle cx='185' cy='385' r='38' fill='#241c15'/>
  <circle cx='327' cy='385' r='38' fill='#241c15'/>
  <path d='M155 210v-20a100 100 0 0 1 200 0v20' stroke='#241c15' stroke-width='38' fill='none' stroke-linecap='round'/>
</svg>`;

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  await page.setViewport({ width: 512, height: 512 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  const buf512 = await page.screenshot({ omitBackground: true });
  fs.writeFileSync('public/icon-512.png', buf512);

  await page.setViewport({ width: 192, height: 192 });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  const buf192 = await page.screenshot({ omitBackground: true });
  fs.writeFileSync('public/icon-192.png', buf192);

  await browser.close();
  console.log('icons generated: ' + buf192.length + ' / ' + buf512.length + ' bytes');
})();
