import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import path from 'path';

const URL = 'http://localhost:8765/social4.html';
const OUT = '/Users/jordanrowe/Developer/roweOS/launch-assets/brilliance-social4';

const SCENES = [
  { name: '01-cold-open',         scrollTo: 0,        wait: 6500 },
  { name: '02-hero-wordmark',     scrollTo: 0,        wait: 7500 },
  { name: '03-manifesto-beats',   scrollTo: 'scene2', wait: 1800 },
  { name: '04-without-noise',     scrollTo: 'scene3', wait: 1800 },
  { name: '05-tagline-cycle',     scrollTo: 'scene4', wait: 2000 },
  { name: '06-features-grid',     scrollTo: 'scene5', wait: 1800 },
  { name: '07-vs-competitors',    scrollTo: 'scene6', wait: 1800 },
  { name: '08-tagline-wall',      scrollTo: 'scene7', wait: 1800 },
  { name: '09-lives-here-orb',    scrollTo: 'scene8', wait: 1800 },
  { name: '10-final-cta',         scrollTo: 'scene9', wait: 1800 },
];

const VIEWPORTS = [
  { name: 'desktop',  width: 1440, height: 900,  dsf: 2 },
  { name: 'mobile',   width: 390,  height: 844,  dsf: 3 },
];

function pad(n){ return String(n).padStart(2,'0'); }

async function shoot(){
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--font-render-hinting=none','--disable-font-subpixel-positioning'],
  });

  for (const vp of VIEWPORTS){
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
      userAgent: vp.name === 'mobile'
        ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
        : 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0 Safari/537.36',
      reducedMotion: 'no-preference',
      colorScheme: 'dark',
    });
    const page = await ctx.newPage();
    await page.goto(URL, { waitUntil: 'networkidle' });

    // Locate scenes by selector once
    const sceneSelectors = [
      null, // 0 placeholder
      '.b-scene-intro',    // not used by index but reserved
      '.b-scene-beats',
      '.b-scene-noise',
      '.b-scene-cycle',
      '.b-scene-features',
      '.b-scene-vs',
      '.b-scene-wall',
      '.b-scene-lives',
      '.b-scene-final',
    ];

    // Per-scene screenshots
    for (let i = 0; i < SCENES.length; i++){
      const s = SCENES[i];
      let scrollY = 0;

      if (typeof s.scrollTo === 'number'){
        scrollY = s.scrollTo;
      } else if (typeof s.scrollTo === 'string' && s.scrollTo.startsWith('scene')){
        const num = parseInt(s.scrollTo.replace('scene',''), 10);
        const sel = sceneSelectors[num];
        if (sel){
          const el = await page.$(sel);
          if (el){
            const box = await el.boundingBox();
            if (box) scrollY = Math.max(0, box.y + (await page.evaluate(() => window.scrollY)));
          }
        }
      }

      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), scrollY);
      await page.waitForTimeout(s.wait);

      const file = path.join(OUT, `${vp.name}-${pad(i+1)}-${s.name}.png`);
      await page.screenshot({ path: file, fullPage: false });
      console.log('saved', file);
    }

    // Full-page deliverable
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await page.waitForTimeout(800);
    const fullFile = path.join(OUT, `${vp.name}-FULL-PAGE.png`);
    await page.screenshot({ path: fullFile, fullPage: true });
    console.log('saved', fullFile);

    await ctx.close();
  }

  await browser.close();
}

shoot().then(() => { console.log('DONE'); process.exit(0); })
  .catch(err => { console.error(err); process.exit(1); });
