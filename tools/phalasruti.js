#!/usr/bin/env node
// Build Chapter III, the Phalaśruti, into a `const PHALA = ...` line in
// index.html — the English commentary keyed to verse, with the Devanagari of
// each verse set above it.
//
//   node tools/phalasruti.js --check     accounting, no write
//   node tools/phalasruti.js --write     regenerate the PHALA line
//   node tools/phalasruti.js --dump 7    show one verse as it will render
//
// Two sources, twenty-five scan pages apart. The English of the chapter runs
// ls_page_0375..0398, the Devanagari of the same verses ls_page_0423..0430.
// The scan stops at 0430, so the last verses have no Devanagari; they are
// emitted with the English alone rather than left out.
//
// This is a sibling of front-matter.js, not a part of it: FRONT is keyed by
// book page and this is keyed by verse, and the two write different lines.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OCR = path.resolve(ROOT, '../../ocr-out');
const FIX = path.join(ROOT, 'front-fix');
const HTML = path.join(ROOT, 'index.html');
const PREFIX = 'const PHALA = ';

const EN = { from: 375, to: 398 };          // English commentary
const DEV = { from: 423, to: 430 };         // Devanagari verses
const LAST = 86;                            // verses the English carries

// The book page is the scan index less the nineteen leaves of front matter,
// the same offset front-matter.js uses for its labels.
const bookPage = p => p - 19;

// ---- line furniture ---------------------------------------------------------
// The running heads differ between the two halves of the book, so both sets are
// listed; everything else is the same rules and page numbers front-matter.js
// throws away.
const FURNITURE = [
  /^_{5,}$/,
  /^lalita\s+sahasranama$/i,
  /^[0-9]{1,3}$/,
  /^[०-९]{1,3}$/,                       // a Devanagari page number
  /^(?:उत्तरभागः|तृतीयोऽध्यायः|द्वितीयोऽध्यायः)\s*।?$/,
  /^श्रीललितासहस्रनामस्तोत्रम्\s*।?$/,
  /^फलश्रुतिः?\s*।?$/,
  /^["'`“”]+$/,
  /^[-–—.,:;)}\]({\[*|/\\!?~^\s]+$/,
  /^[A-Za-z}]$/,
];

const isFurniture = l => FURNITURE.some(re => re.test(l));

// The scan breaks a word across a line and leaves the hyphen behind.
const joinHyphens = s => s.replace(/([\p{L}])-\s+(?=[\p{Ll}])/gu, '$1');

// The scan read most opening quotation marks as the digits 66, and joining the
// lines puts them inside the text where the furniture rules can no longer reach
// them. Restored only where a real number cannot stand — an opening quote is
// always followed by the first word of the quotation, so "from names 64 to 84"
// survives intact. Same rule front-matter.js applies line by line.
let quoteFixes = 0;
const restoreQuotes = s => s
  .replace(/(^|[\s(])(?:66|64)\s+(?=[A-Z“])/g, (m, b) => { quoteFixes++; return b + '“'; });

const curlyQuotes = s => s
  .replace(/(^|[\s(\[])"/g, '$1“').replace(/"/g, '”')
  .replace(/(^|[\s(\[])'/g, '$1‘').replace(/'/g, '’');

function readPage(p) {
  const name = 'ls_page_' + String(p).padStart(4, '0') + '.txt';
  const fixed = path.join(FIX, name);
  const src = fs.existsSync(fixed) ? fixed : path.join(OCR, name);
  return {
    fixed: fs.existsSync(fixed),
    lines: fs.readFileSync(src, 'utf8').replace(/\r/g, '')
      .split('\n').map(l => l.trim()).filter(Boolean).filter(l => !isFurniture(l)),
  };
}

// ---- the Devanagari ---------------------------------------------------------
// The verses run continuously across the eight pages, each closed by its number
// between double dandas. Text is gathered up to a marker and belongs to it, so
// where a marker was lost to the scan its verse merges with the next and the
// pair is labelled as a range.
const dev2 = s => s.replace(/[०-९]/g, c => String(c.charCodeAt(0) - 0x0966));

function devVerses(tally) {
  const units = [];
  let buf = [], first = 1, page = DEV.from;
  for (let p = DEV.from; p <= DEV.to; p++) {
    const { lines } = readPage(p);
    for (const line of lines) {
      let rest = line;
      const re = /॥\s*([०-९]{1,3})\s*॥/g;
      let m, at = 0;
      while ((m = re.exec(line))) {
        buf.push(line.slice(at, m.index));
        at = m.index + m[0].length;
        const n = +dev2(m[1]);
        const text = buf.join(' ').replace(/\s+/g, ' ').trim();
        if (text) {
          units.push({ lo: first, hi: n, page, dev: text + ' ॥ ' + m[1] + ' ॥' });
          if (n > first) tally.merged.push(first + '–' + n);
        }
        buf = []; first = n + 1; page = p;
        rest = line.slice(at);
      }
      if (at === 0) buf.push(line);
      else if (rest.trim()) buf.push(rest);
    }
  }
  if (buf.join('').trim()) tally.devTail = buf.join(' ').replace(/\s+/g, ' ').trim();
  return units;
}

// ---- the English ------------------------------------------------------------
// A verse opens with its number and a full stop. The printing groups verses
// freely and the groups overlap — "44-45.", then "45.", then "46-47.", then
// "47-48." — so the test cannot be "the next number in sequence". What does
// hold is that the opening number always advances, and never by much: that is
// enough to tell a verse mark from "1785 of the year" or "(Tai. Up., 2-6-1)",
// which the scan is full of.
const MARK = /(?:^|[\s"“(])(\d{1,2})(?:\s*(?:and|-|,|–)\s*(\d{1,2}))?\.\s/g;
const JUMP = 4;                             // furthest a real mark ever skips

function enVerses(tally) {
  const pages = [];
  for (let p = EN.from; p <= EN.to; p++) {
    const { lines, fixed } = readPage(p);
    if (fixed) tally.fixed.push(bookPage(p));
    pages.push({ p, text: curlyQuotes(restoreQuotes(joinHyphens(lines.join(" ")))) });
  }
  const units = [];
  let last = 0, open = null, preamble = [];
  for (const pg of pages) {
    let at = 0;
    MARK.lastIndex = 0;
    let m;
    while ((m = MARK.exec(pg.text))) {
      const lo = +m[1], hi = m[2] ? +m[2] : lo;
      if (hi < lo || hi > LAST) continue;
      if (lo <= last || lo > last + JUMP) continue;        // not a verse mark
      const before = pg.text.slice(at, m.index).trim();
      if (before) (open ? open.parts : preamble).push(before);
      at = m.index + m[0].length;
      open = { lo, hi, page: bookPage(pg.p), parts: [] };
      units.push(open);
      last = lo;
      MARK.lastIndex = at;
    }
    const tail = pg.text.slice(at).trim();
    if (tail) (open ? open.parts : preamble).push(tail);
  }
  tally.marks = units.map(u => u.lo === u.hi ? String(u.lo) : u.lo + '-' + u.hi);
  tally.enReached = units.reduce((a, u) => Math.max(a, u.hi), 0);
  return {
    preamble: preamble.join(' ').replace(/\s+/g, ' ').trim(),
    units: units.map(u => ({
      lo: u.lo, hi: u.hi, page: u.page,
      en: u.parts.join(' ').replace(/\s+/g, ' ').trim(),
    })),
  };
}

// ---- merge ------------------------------------------------------------------
// The two sides are keyed by verse, not by page, so a Devanagari unit is
// attached to the English unit whose range it opens.
function build() {
  const tally = { merged: [], fixed: [], devTail: '' };
  const dev = devVerses(tally);
  const en = enVerses(tally);
  // A group of English verses takes every Devanagari verse its range covers, so
  // "51-54." is set above all four, each still closed by its own number.
  const verses = en.units.map(u => {
    const hit = dev.filter(d => d.hi >= u.lo && d.lo <= u.hi);
    const out = { n: u.lo === u.hi ? String(u.lo) : u.lo + '–' + u.hi,
                  lo: u.lo, hi: u.hi, en: u.en, ep: u.page };
    if (hit.length) {
      out.dev = hit.map(d => d.dev).join(' ');
      out.dp = hit[0].page;
    }
    return out;
  });

  // The colophon closes the chapter and the commentary, and the footnote after
  // it is the most valuable line on the page: it is where the twelve-fold
  // division is referred to the twelve kalās of the Sun. Both are lifted out of
  // the last verse, and kept apart from each other.
  let colophon = '', colophonNote = '';
  const last = verses[verses.length - 1];
  if (last) {
    const m = /(Here ends the twelfth[\s\S]*?composed by \S+?)[.'’\s]*(Lately[\s\S]*)?$/.exec(last.en);
    if (m) {
      colophon = m[1].replace(/\s+/g, ' ').trim() + '.';
      colophonNote = (m[2] || '').replace(/^[\s\d'’]+/, '').replace(/\s+/g, ' ').trim();
      last.en = last.en.slice(0, m.index).trim();
    }
  }

  return {
    payload: {
      title: 'Chapter III',
      sub: 'the Phalaśruti — the twelfth kalā, Kṣamā',
      preamble: en.preamble,
      colophon, colophonNote,
      verses,
    },
    tally, dev,
  };
}

// ---- cli --------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);
  const { payload, tally, dev } = build();
  const V = payload.verses;

  console.log('English   scan ' + EN.from + '–' + EN.to +
              '  (book p. ' + bookPage(EN.from) + '–' + bookPage(EN.to) + ')');
  console.log('Devanagari scan ' + DEV.from + '–' + DEV.to);
  console.log('verses     ' + V.length + '  reaching ' + tally.enReached + ' of ' + LAST);
  console.log('with dev   ' + V.filter(v => v.dev).length +
              '   without ' + V.filter(v => !v.dev).map(v => v.n).join(', '));
  if (tally.merged.length) console.log('dev merged ' + tally.merged.join(', ') + '  (marker lost to the scan)');
  if (tally.devTail) console.log('dev tail   ' + tally.devTail.slice(0, 90) + '…');
  if (tally.fixed.length) console.log('front-fix  book p. ' + tally.fixed.join(', '));
  console.log('colophon   ' + (payload.colophon ? '✓ ' + payload.colophon.slice(0, 72) + '…' : '✗ not found'));
  console.log('preamble   ' + payload.preamble.length + ' chars');
  console.log('quotes     ' + quoteFixes + ' restored from 66/64');
  const gaps = [];
  for (let i = 1, seen = new Set(V.flatMap(v => { const a = []; for (let k = v.lo; k <= v.hi; k++) a.push(k); return a; })); i <= LAST; i++)
    if (!seen.has(i)) gaps.push(i);
  console.log("gaps       " + (gaps.length ? gaps.join(", ") : "none"));
  console.log("marks      " + tally.marks.join(" "));

  const d = argv.indexOf('--dump');
  if (d >= 0) {
    const want = argv[d + 1];
    const v = V.find(x => x.n === want || String(x.lo) === want);
    if (!v) { console.log('\nno verse ' + want); return; }
    console.log('\n--- verse ' + v.n + '  (book p. ' + v.ep +
                (v.dp ? ', Devanagari scan p. ' + v.dp : ', no Devanagari') + ') ---');
    if (v.dev) console.log(v.dev + '\n');
    console.log(v.en);
    return;
  }

  const line = PREFIX + JSON.stringify(payload) + ';';
  if (!argv.includes('--write')) {
    console.log('\n(dry run — pass --write to update index.html)');
    return;
  }
  const lines = fs.readFileSync(HTML, 'utf8').split('\n');
  const at = lines.findIndex(l => l.startsWith(PREFIX));
  if (at >= 0) lines[at] = line;
  else {
    const anchor = lines.findIndex(l => l.startsWith('const FRONT = '));
    if (anchor < 0) throw new Error('could not find the "const FRONT = " line in index.html');
    lines.splice(anchor + 1, 0, line);
  }
  fs.writeFileSync(HTML, lines.join('\n'));
  console.log('\nwrote PHALA (' + line.length + ' bytes) to index.html');
}

main();
