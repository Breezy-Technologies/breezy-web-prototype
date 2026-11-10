// Records version D's main column of the Underbuilt report export (Claude design
// artifact, design-reference/underbuilt-report/), with every interaction state,
// into public/ub-report/{report.json,report.css} for components/report/UBReport.tsx.
//
// Usage (needs `npm i playwright` somewhere on the path, and a Chromium):
//   F="design-reference/underbuilt-report/Underbuilt Report Versions.html" \
//   OUT=public/ub-report CHROME=<chromium binary> node scripts/extract-ub-report.mjs
//
// The export doesn't bundle the rule icons (assets/icons-v3/*.svg); they were
// taken from the published artifact (claude.ai/artifact/6tDhxvianA9DP2mqEaJKUL,
// project/assets/icons-v3/) into public/ub-report/icons-v3/.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const OUT = process.env.OUT;
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
const b = await chromium.launch({ executablePath: process.env.CHROME });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', e => console.log('PAGEERR', e.message.slice(0, 160)));
await p.addInitScript(() => { try { localStorage.setItem('ubr-version', 'D'); } catch {} });
await p.goto('file://' + process.env.F, { waitUntil: 'load', timeout: 120000 });
await p.waitForTimeout(6000);
const wait = ms => p.waitForTimeout(ms);
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 10);

// ---- helpers in page ----
await p.evaluate(() => {
  window.__ub = {
    main: () => document.querySelector('main'),
    // visible fixed-position layers (modals, drawers), minus the dots rail and glossary button
    layers: () => [...document.querySelectorAll('body *')].filter(e => {
      const cs = getComputedStyle(e);
      if (cs.position !== 'fixed' || cs.visibility === 'hidden' || +cs.opacity === 0 || cs.display === 'none') return false;
      if (e.closest('.d-dots') || e.tagName === 'NAV') return false;
      if (e.tagName === 'BUTTON' && /Glossary/.test(e.innerText)) return false;
      const r = e.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.left >= innerWidth || r.right <= 0) return false;
      // outermost fixed only
      let a = e.parentElement; while (a) { if (getComputedStyle(a).position === 'fixed') return false; a = a.parentElement; }
      return true;
    }),
    // tag modal-opening buttons with a stable label key
    label: e => (e.getAttribute('aria-label') || e.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80),
  };
});

const modals = {};      // key -> html
const capturedBy = {};  // section|label -> key (skip repeats)
const isModalBtn = l => /: what this means$/.test(l) || /^§/.test(l);

// Click every modal button inside `scopeSel` that has no data-ubm yet; record its modal.
async function captureModals(scopeSel) {
  const n = await p.evaluate(sel => [...document.querySelectorAll(sel + ' button')].length, scopeSel);
  for (let i = 0; i < n; i++) {
    const info = await p.evaluate(([sel, i]) => {
      const btn = [...document.querySelectorAll(sel + ' button')][i]; if (!btn || btn.dataset.ubm) return null;
      const l = __ub.label(btn); const sec = btn.closest('section')?.id || '';
      btn.dataset.ubi = 'cur'; return { l, sec };
    }, [scopeSel, i]);
    if (!info || !isModalBtn(info.l)) { await p.evaluate(() => document.querySelector('[data-ubi=cur]')?.removeAttribute('data-ubi')); continue; }
    const ck = info.sec + '|' + info.l;
    if (capturedBy[ck]) { await p.evaluate(k => { const b = document.querySelector('[data-ubi=cur]'); b.dataset.ubm = k; b.removeAttribute('data-ubi'); }, capturedBy[ck]); continue; }
    const before = await p.evaluate(() => __ub.layers().length);
    await p.evaluate(() => { const b = document.querySelector('[data-ubi=cur]'); b.scrollIntoView({ block: 'center' }); b.click(); });
    await wait(350);
    const html = await p.evaluate(() => __ub.layers().map(e => e.outerHTML).join(''));
    const after = await p.evaluate(() => __ub.layers().length);
    if (after > before && html) {
      const k = hash(html); modals[k] = html; capturedBy[ck] = k;
      await p.evaluate(k => { const b = document.querySelector('[data-ubi=cur]'); b.dataset.ubm = k; b.removeAttribute('data-ubi'); }, k);
    } else await p.evaluate(() => document.querySelector('[data-ubi=cur]')?.removeAttribute('data-ubi'));
    await p.keyboard.press('Escape'); await wait(150);
    if (await p.evaluate(() => __ub.layers().length) > before) {
      // close via the modal's close button, else click the backdrop corner
      await p.evaluate(() => { const L = __ub.layers().pop(); const c = L && [...L.querySelectorAll('button')].find(x => /close|×/i.test(x.getAttribute('aria-label') || x.innerText)); if (c) c.click(); });
      await wait(250);
      if (await p.evaluate(() => __ub.layers().length) > before) { await p.mouse.click(8, 450); await wait(250); }
    }
  }
}

// ---- 1. expandable rows: record each open, with its own modals ----
const rows = {};
const rowsInitOpen = [];
const nExp = await p.evaluate(() => __ub.main().querySelectorAll('button[aria-expanded]').length);
for (let i = 0; i < nExp; i++) {
  const key = 'r' + i;
  // find the smallest ancestor whose text grows when opened
  await p.evaluate(([i, key]) => {
    const btn = __ub.main().querySelectorAll('button[aria-expanded]')[i];
    btn.dataset.ubrowbtn = key;
    const anc = []; let a = btn.parentElement; while (a && a !== __ub.main()) { anc.push([a, a.innerText.length]); a = a.parentElement; }
    window.__anc = anc; btn.scrollIntoView({ block: 'center' }); btn.click();
  }, [i, key]);
  await wait(450);
  // rows open by default are recorded closed (text shrinks); the rest open (text grows)
  const startOpen = await p.evaluate(key => document.querySelector(`[data-ubrowbtn="${key}"]`).getAttribute('aria-expanded') === 'false', key);
  await p.evaluate(([key, startOpen]) => { const hit = window.__anc.find(([a, n]) => a.isConnected && (startOpen ? a.innerText.length < n - 20 : a.innerText.length > n + 20)); if (hit) hit[0].dataset.ubrow = key; }, [key, startOpen]);
  if (!startOpen) await captureModals(`[data-ubrow="${key}"]`);
  rows[key] = await p.evaluate(key => document.querySelector(`[data-ubrow="${key}"]`)?.outerHTML || '', key);
  if (startOpen) rowsInitOpen.push(key);
  await p.evaluate(key => document.querySelector(`[data-ubrowbtn="${key}"]`).click(), key);
  await wait(350);
  console.log('row', key, rows[key].length);
}

// ---- 2. build options: every option × view × roof ----
const groups = { opt: ['As is', 'Add on', 'Rebuild', 'Add an ADU'], view: ['Plan', 'Section'], roof: ['Pitched', 'Flat'] };
const optSec = await p.evaluate(() => [...__ub.main().querySelectorAll('button')].find(b => b.innerText.trim() === 'Add on')?.closest('section')?.id);
const clickIn = (sec, t) => p.evaluate(([sec, t]) => [...document.querySelectorAll('#' + sec + ' button')].find(b => b.innerText.trim() === t)?.click(), [sec, t]);
const secHtml = sec => p.evaluate(sec => document.getElementById(sec).outerHTML, sec);
const initialOpt = await secHtml(optSec);
const options = {};
let optInit = null;
for (const o of groups.opt) for (const v of groups.view) for (const r of groups.roof) {
  await clickIn(optSec, o); await clickIn(optSec, v); await clickIn(optSec, r); await wait(250);
  await captureModals('#' + optSec);
  // tag the controls so the runtime knows which group/value each is
  await p.evaluate(([sec, groups]) => { for (const [g, vals] of Object.entries(groups)) for (const b of document.querySelectorAll('#' + sec + ' button')) if (vals.includes(b.innerText.trim())) { b.dataset.ubgrp = g; b.dataset.ubval = b.innerText.trim(); } }, [optSec, groups]);
  options[`${o}|${v}|${r}`] = await secHtml(optSec);
}
// the state the page opened in: the variant whose text matches the initial render
const strip = h => h.replace(/<[^>]+>/g, '');
optInit = Object.keys(options).find(k => strip(options[k]) === strip(initialOpt)) || 'As is|Plan|Pitched';
const [io, iv, ir] = optInit.split('|');
await clickIn(optSec, io); await clickIn(optSec, iv); await clickIn(optSec, ir); await wait(250);
console.log('options', Object.keys(options).length, 'init', optInit, 'in', optSec);

// ---- 3. the rest of the main column's modals ----
await captureModals('main');
await p.evaluate(() => { for (const a of __ub.main().querySelectorAll('a')) if (/Get Comps/i.test(a.innerText)) a.dataset.ubact = 'comps'; });

// ---- 4. glossary drawer ----
const before = await p.evaluate(() => __ub.layers().length);
await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Glossary' && getComputedStyle(b).position === 'fixed').click());
await wait(600);
const glossary = await p.evaluate(() => __ub.layers().map(e => e.outerHTML).join(''));
console.log('glossary layers', (await p.evaluate(() => __ub.layers().length)) - before, glossary.length);
await p.keyboard.press('Escape'); await wait(300);

// ---- 5. table of contents (dots rail) ----
const toc = await p.evaluate(() => [...document.querySelectorAll('.d-dots a')].map(a => ({ id: (a.getAttribute('href') || '').replace('#', ''), label: a.innerText.trim() })));
const glossaryBtn = await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Glossary' && getComputedStyle(b).position === 'fixed').outerHTML);

// ---- 6. main column + page background ----
await p.evaluate(() => scrollTo(0, 0));
const main = await p.evaluate(() => __ub.main().outerHTML);
const bg = await p.evaluate(() => { let a = __ub.main(); while (a) { const c = getComputedStyle(a).backgroundColor; if (c && c !== 'rgba(0, 0, 0, 0)') return c; a = a.parentElement; } return getComputedStyle(document.body).backgroundColor; });

// ---- 7. images: blob / uuid / data urls → files ----
let all = JSON.stringify({ main, rows, options, modals, glossary, glossaryBtn });
const refs = [...new Set([...all.matchAll(/(blob:file:[^"'\\) ]+|blob:null\/[^"'\\) ]+|blob:[^"'\\) ]+)/g)].map(m => m[1]))];
const fileOf = {};
for (const u of refs) {
  const r = await p.evaluate(async u => { try { const res = await fetch(u); const t = res.headers.get('content-type') || ''; const buf = new Uint8Array(await res.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000)); return { t, b: btoa(s) }; } catch (e) { return null; } }, u);
  if (!r) { console.log('could not fetch', u); continue; }
  const ext = /png/.test(r.t) ? 'png' : /jpe?g/.test(r.t) ? 'jpg' : /svg/.test(r.t) ? 'svg' : /gif/.test(r.t) ? 'gif' : /webp/.test(r.t) ? 'webp' : 'bin';
  const buf = Buffer.from(r.b, 'base64'); const name = hash(buf.toString('base64')) + '.' + ext;
  fs.writeFileSync(path.join(OUT, 'assets', name), buf); fileOf[u] = '/ub-report/assets/' + name;
}
for (const [u, f] of Object.entries(fileOf)) all = all.split(u).join(f);
// post-process: drop template bookkeeping attributes; unwrap the runtime's
// text wrappers (a <span> inside SVG <text> breaks the HTML parser out of SVG
// when the markup is re-parsed); point the rule icons at the app's copy
all = all.replace(/\s(data-dc-tpl|data-ubi)=\\"[^"\\]*\\"/g, '')
  .replace(/<span class=\\"sc-interp\\">([^<]*)<\/span>/g, '$1')
  .replace(/(?<![\w/])assets\/icons-v3\//g, '/ub-report/icons-v3/');
const data = JSON.parse(all);
const out = { rowsInitOpen, source: 'Underbuilt Report Versions (Claude design), version D "Property", main column', bg, toc, optSec, optInit, ...data };
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(out));

// ---- 8. the page's global CSS, scoped under .ubr ----
const tpl = fs.readFileSync(process.env.F, 'utf8');
const tplJson = JSON.parse(tpl.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/)[1]);
const st = [...tplJson.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]);
const dropDark = c => c.replace(/\[data-theme="dark"\][^{]*\{[^}]*\}/g, '');
const tokens = [1, 2, 3].map(i => dropDark(st[i])).join('').replaceAll(':root', '.ubr').replace(/@kind[^;{]*;/g, '');
let page = st[6].replace(':root{', '.ubr{').replace(/\n\s*body\{margin:0;background:#efe5e2;/, '\n    .ubr{background:#efe5e2;')
  .replace('\n    a{', '\n    .ubr a{').replace('\n    a:hover{', '\n    .ubr a:hover{').replace('\n    p,h1,h2,h3,h4{', '\n    .ubr p,.ubr h1,.ubr h2,.ubr h3,.ubr h4{')
  .replace(/(\n\s*)\.d-dots/g, '$1.ubr .d-dots').replaceAll(',.d-dots', ',.ubr .d-dots');
const fonts = [[300, 'Light'], [400, 'Regular'], [700, 'Bold']].map(([w, n]) => `@font-face{font-family:"Akkurat LL TT";font-weight:${w};font-style:normal;font-display:swap;src:url("/fonts/AkkuratLLTT-${n}.ttf") format("truetype")}`).join('\n') + '\n';
const base = '.ubr,.ubr *,.ubr *::before,.ubr *::after{box-sizing:border-box}\n.ubr{font-family:"Akkurat LL TT",ui-sans-serif,system-ui,sans-serif;color:var(--breezy-color-foreground-primary);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}\n.ubr em{font-style:italic}\n.ubr .breezy-eyebrow{font-size:var(--breezy-text-eyebrow-size);line-height:var(--breezy-text-eyebrow-line);letter-spacing:var(--breezy-text-eyebrow-tracking);font-weight:var(--breezy-font-weight-bold);text-transform:uppercase}\n';
fs.writeFileSync(path.join(OUT, 'report.css'), "/* Generated by scripts/extract-ub-report.mjs from the Underbuilt Report Versions export (Claude design).\n   The report page's global styles, scoped under .ubr so they never touch the app. */\n" + fonts + tokens + base + page);
console.log('modals', Object.keys(modals).length, 'rows', Object.keys(rows).length, 'images', Object.keys(fileOf).length, 'refs', refs.length, 'toc', toc.length, 'bg', bg, 'KB', Math.round(fs.statSync(path.join(OUT, 'report.json')).size / 1024));
await b.close();
