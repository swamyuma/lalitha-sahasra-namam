#!/usr/bin/env node
// Build the front matter (preface, benediction, chapter I) from the OCR pages
// into a `const FRONT = ...` line in index.html.
//
//   node tools/front-matter.js --check     accounting + audit ledger, no write
//   node tools/front-matter.js --write     regenerate the FRONT line
//   node tools/front-matter.js --dump 27   show one book page as it will render
//
// ocr-out/ls_page_00NN.txt is the source. To correct a page by hand, drop a
// fixed copy at front-fix/ls_page_00NN.txt and it is used instead; nothing in
// this script edits wording, so hand-fixes are the only place text changes.

const fs = require('fs');
const path = require('path');
// Same accent tables the nama corpus uses, so the two cannot drift apart.
const { repairAccents } = require('./fix-iast.js');
const { toIast, LEXICON, ADJOURNED, terms, upright } = require('./iast-lexicon.js');

const ROOT = path.resolve(__dirname, '..');
const OCR = path.resolve(ROOT, '../../ocr-out');
const FIX = path.join(ROOT, 'front-fix');
const HTML = path.join(ROOT, 'index.html');
const PREFIX = 'const FRONT = ';

const SECTIONS = [
  { id: 'preface',     title: 'Preface',     sub: 'to the Second Edition',            from: 10, to: 19, roman: true },
  { id: 'benediction', title: 'Benediction', sub: 'and the commentary’s opening', from: 20, to: 25 },
  { id: 'chapter-1',   title: 'Chapter I',   sub: 'the first kalā, Tapinī',  from: 26, to: 58, iast: true },
];

const ROMAN = ['', 'i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii'];

// ---- line classification -------------------------------------------------

const FURNITURE = [
  [/^_{5,}$/,                       'rule'],
  [/^lalita\s+sahasranama$/i,       'running head'],
  [/^(66|64|99|6-|8-)$/,            'misread quotation mark'],
  [/^[0-9]{1,3}$/,                  'page number / stray digit'],
  [/^[ivxl]{1,7}$/,                 'roman page number'],
  [/^["'`“”]+$/,          'stray quote'],
  [/^[-–—.,:;)}\]({\[*|/\\!?~^·•༄།\s]+$/, 'punctuation noise'],
  [/^[0-9]{1,3}[*):.]$/,            'footnote marker'],
  [/^[A-Z}]$/,                      'stray capital'],
];

function furniture(line) {
  for (const [re, why] of FURNITURE) if (re.test(line)) return why;
  return null;
}

const HEADING = /^[\p{Lu}][\p{Lu}\p{N} .,'’ʼ—-]{6,}$/u;

function isHeading(line) {
  return HEADING.test(line) && /[A-Z]{3}/.test(line) && line.length < 60;
}

const DEV = /[ऀ-ॿ]/;

// A verse line is Devanagari throughout. A line of English carrying one word or
// syllable of Devanagari inline — "four Ims (ईं)" — is still a prose line, and
// setting it as a centred verse would be wrong.
function isVerse(line) {
  const letters = (line.match(/[\p{L}]/gu) || []).length;
  const dev = (line.match(/[ऀ-ॿ]/g) || []).length;
  return letters > 0 && dev / letters > 0.5;
}

// A trailing run of lines is taken as footnotes only when at least one of them
// carries an explicit signal, so numbered verse lines are never swallowed.
// "^2 Initiation is of…" is the hand-written form: a front-fix page marks its
// notes with ^N, which index.html renders as a superscript.
// The period is the whole discriminator. A numbered verse of the samvada reads
// "41. Then Lalita addressed the assembly"; a footnote reads "1 Kundalini
// energy is said to sleep" or "1As voluminous a work as the Mahabharata".
// Matching the verse form swallowed the text of ten pages into their notes.
const SIGNAL = /^(\^\d{1,2}\s*[A-Z(]|\*\s*[A-Z(]|\d{1,2}\s+[A-Z(]|\d{1,2}(?=[A-Z]))/;

// Errs towards leaving a note in the body rather than demoting a paragraph
// into the notes: a full paragraph of Sastry's prose never runs this short.
const NOTE_MAX = 300;

// "41. Then Lalita addressed", "VII. With 1; with 19" — a numbered verse or an
// enumerated item. Always body, and the notes of a page never sit above body.
const VERSE = /^\*?(\d{1,2}|[IVXL]{1,6})\.\s/;

function splitNotes(body) {
  const run = [];
  while (body.length > 1) {
    const line = body[body.length - 1];
    if (isVerse(line) || isHeading(line) || VERSE.test(line)) break;
    // Length alone cannot end the run: a footnote carrying its own number runs
    // as long as it likes. Only an unmarked full paragraph closes the notes.
    if (line.length > NOTE_MAX && !SIGNAL.test(line)) break;
    run.unshift(body.pop());
  }
  if (!run.some(l => SIGNAL.test(l))) { body.push(...run); return []; }
  // Cut at the first marked line; anything above it is body text whose own
  // marker the scan lost, so it stays where it was printed.
  const first = run.findIndex(l => SIGNAL.test(l));
  body.push(...run.splice(0, first));
  // A crumb the scan shed — "Sacred", "names." — that no note claimed as a
  // continuation is not a note of its own. It goes back to the page.
  const notes = rejoin(run).filter(n => {
    if (SIGNAL.test(n) || n.length >= 25) return true;
    body.push(n);
    return false;
  });
  return notes;
}

// A note left hanging without closing punctuation is continued by the line
// under it — the scan broke "…based on this Sahasra-" from "nama." A note that
// closes cleanly is followed by a new note, even where its number was lost.
function rejoin(notes) {
  const out = [];
  for (const n of notes) {
    const prev = out[out.length - 1];
    // A line carrying its own number opens a note; it is never a continuation.
    if (prev && !SIGNAL.test(n) && !/[.!?:"”]$/.test(prev)) {
      out[out.length - 1] = /[\p{L}]-$/u.test(prev)
        ? prev.slice(0, -1) + n          // "Sahasra-" + "nama." -> "Sahasranama."
        : prev + ' ' + n;
    } else {
      out.push(n);
    }
  }
  return out;
}

// Notes are numbered from 1 on each page and printed in order, so a note whose
// number the scan lost is the one after its neighbour. Restored as ^N, the
// hand-written form, and counted on the ledger since it adds a digit.
function numberNotes(notes, p, ledger) {
  let last = 0;
  return notes.map(n => {
    const has = n.match(/^\^?(\d{1,2})/);
    if (has) { last = +has[1]; return n; }
    last += 1;
    ledger.push({ p, why: 'note number inferred from position', text: String(last), add: true });
    return '^' + last + ' ' + n;
  });
}


// Two passes, and they are different in kind. repairAccents is scan repair —
// a stray accent on a vowel that must be a macron, S'iva for Śiva, the slash
// left where ṭ belonged — and runs on every section. toIast is editorial, and
// runs only where a section asks for it.
const iastTally = new Map();

function iast(s, p, ledger, lex) {
  let out = repairAccents(s);
  if (lex) out = toIast(out, iastTally);
  if (out === s) return out;
  const delta = alnum(out) - alnum(s);
  if (delta > 0) ledger.push({ p, why: 'letters gained (slash → ṭ, IAST)', text: 'x'.repeat(delta), add: true });
  if (delta < 0) ledger.push({ p, why: 'letters dropped (ch → c, sh → ṣ)', text: 'x'.repeat(-delta) });
  return out;
}

// ---- page building -------------------------------------------------------

const alnum = s => (s.match(/[\p{L}\p{N}]/gu) || []).length;

function joinHyphens(s) {
  return s.replace(/([\p{L}])- (?=[\p{Ll}])/gu, '$1');
}

// Each restored quote consumes two digits, so it is counted for the accounting.
let quoteFixes = 0;

// Only where a real number cannot stand: an opening quote is always followed by
// the first word of the quotation. "from names 64 to 84" must survive intact.
function restoreQuotes(s) {
  return s.replace(/^(66|64)\s+(?=[A-Z“])/, () => { quoteFixes++; return '“'; })
          .replace(/ 66 (?=[A-Z])/g, () => { quoteFixes++; return ' “'; });
}

function pageLabel(p) {
  const s = SECTIONS.find(x => p >= x.from && p <= x.to);
  return s.roman ? ROMAN[p - 7] : String(p - 19);
}

function buildPage(p, ledger) {
  const lex = !!(SECTIONS.find(x => p >= x.from && p <= x.to) || {}).iast;
  const name = 'ls_page_' + String(p).padStart(4, '0') + '.txt';
  const fixed = path.join(FIX, name);
  const src = fs.existsSync(fixed) ? fixed : path.join(OCR, name);
  const raw = fs.readFileSync(src, 'utf8').replace(/\r/g, '');
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);

  const body = [];
  for (const line of lines) {
    const why = furniture(line);
    if (why) { ledger.push({ p, why, text: line }); continue; }
    body.push(line);
  }

  const notes = splitNotes(body);
  const blocks = body.map(line => ({
    t: isHeading(line) ? 'h' : isVerse(line) ? 'dev' : 'p',
    s: iast(restoreQuotes(joinHyphens(line)), p, ledger, lex),
  }));

  return {
    p,
    label: pageLabel(p),
    fixed: src === fixed,
    blocks,
    notes: numberNotes(notes.map(n => iast(restoreQuotes(joinHyphens(n)), p, ledger, lex)), p, ledger),
    inAlnum: alnum(lines.join('')),
  };
}

// Pages whose OCR reading order is visibly broken: a short paragraph line that
// does not close a sentence means the scan interleaved a column or a footnote.
function suspect(page) {
  let hits = 0;
  for (const b of page.blocks) {
    if (b.t !== 'p') continue;
    // A stranded fragment: "which", "very difficult." — the scan dropped these
    // out of the paragraph they belong to.
    if (b.s.length < 60) { hits++; continue; }
    if (b.s.length <= 300 && !/[.!?:;"”)]$/.test(b.s)) hits++;
  }
  return hits;
}

function build() {
  const ledger = [];
  const sections = SECTIONS.map(s => {
    const pages = [];
    for (let p = s.from; p <= s.to; p++) pages.push(buildPage(p, ledger));
    return { id: s.id, title: s.title, sub: s.sub, pages };
  });
  return { sections, ledger };
}

// ---- output --------------------------------------------------------------

function payload(sections) {
  return {
    // index.html italicises these; a diacritic alone is not enough, since
    // "cakra" and "mantra" carry none.
    terms: terms(),
    // Sanskrit that stays upright despite its diacritics.
    upright: upright(),
    sections: sections.map(s => ({
      id: s.id, title: s.title, sub: s.sub,
      pages: s.pages.map(p => ({ p: p.label, blocks: p.blocks, notes: p.notes })),
    })),
  };
}

function main() {
  const args = process.argv.slice(2);
  const { sections, ledger } = build();
  const pages = sections.flatMap(s => s.pages);

  if (args.includes('--dump')) {
    const want = String(args[args.indexOf('--dump') + 1]);
    const pg = pages.find(x => String(x.label) === want);
    if (!pg) throw new Error('no book page ' + want);
    console.log('--- scan ' + pg.p + ' = book p. ' + pg.label + ' ---');
    for (const b of pg.blocks) console.log('[' + b.t + '] ' + b.s);
    for (const n of pg.notes) console.log('[note] ' + n);
    return;
  }

  // accounting: every letter and digit of the input is either in the output or
  // named on the ledger.
  const outA = pages.reduce((a, p) =>
    a + p.blocks.reduce((b, x) => b + alnum(x.s), 0) + p.notes.reduce((b, x) => b + alnum(x), 0), 0);
  const inA = pages.reduce((a, p) => a + p.inAlnum, 0);
  const cutA = ledger.reduce((a, l) => a + (l.add ? -1 : 1) * alnum(l.text), 0) + quoteFixes * 2;

  console.log('pages          ' + pages.length + '  (' + sections.map(s => s.title + ' ' + s.pages.length).join(', ') + ')');
  console.log('alnum in       ' + inA);
  console.log('alnum out      ' + outA);
  console.log('alnum removed  ' + cutA + '  (incl. ' + quoteFixes + ' restored quotes)');
  console.log('balance        ' + (inA - outA - cutA) + (inA - outA - cutA === 0 ? '  OK' : '  *** MISMATCH ***'));
  console.log('footnotes      ' + pages.reduce((a, p) => a + p.notes.length, 0) + ' lifted from '
              + pages.filter(p => p.notes.length).length + ' pages');
  const clash = [];
  for (const pg of pages) {
    const seen = new Set();
    for (const n of pg.notes) {
      const k = (n.match(/^\^?(\d{1,2})/) || [])[1];
      if (k && seen.has(k)) clash.push(pg.label + ':' + k);
      if (k) seen.add(k);
    }
  }
  console.log('note numbers  ' + (clash.length ? '*** repeated on page(s) ' + clash.join(', ') + ' ***' : 'unique within every page'));

  const secs = SECTIONS.filter(x => x.iast).map(x => x.title).join(', ') || 'none';
  const subs = [...iastTally.values()].reduce((a, b) => a + b, 0);
  console.log('IAST lexicon   ' + subs + ' substitution(s) in ' + secs
              + '  (' + Object.keys(LEXICON).length + ' entries, '
              + Object.keys(ADJOURNED).length + ' adjourned)');

  if (args.includes('--iast')) {
    console.log('\nevery IAST substitution:');
    for (const [k, n] of [...iastTally].sort((a, b) => b[1] - a[1]))
      console.log('  ' + String(n).padStart(3) + '  ' + k);
    console.log('\nleft as printed, on purpose:');
    for (const k of Object.keys(ADJOURNED)) console.log('  ' + k.padEnd(9) + ADJOURNED[k]);
  }
  const fixed = pages.filter(p => p.fixed);
  console.log('front-fix      ' + (fixed.length
    ? fixed.length + ' page(s) read from front-fix/ instead of the OCR: book p. '
      + fixed.map(p => p.label).join(', ')
    : 'none — every page comes straight from the OCR'));

  const by = {};
  for (const l of ledger) by[l.why] = (by[l.why] || 0) + 1;
  console.log('\nremoved lines by kind:');
  for (const k of Object.keys(by).sort((a, b) => by[b] - by[a])) console.log('  ' + String(by[k]).padStart(3) + '  ' + k);

  if (args.includes('--ledger')) {
    console.log('\nfull removal ledger:');
    for (const l of ledger) console.log('  scan ' + l.p + '  ' + l.why.padEnd(26) + JSON.stringify(l.text));
  }

  if (args.includes('--notes')) {
    console.log('\nevery lifted footnote:');
    for (const pg of pages) {
      for (const n of pg.notes) console.log('  p.' + String(pg.label).padStart(4) + '  ' + n);
    }
  }

  const bad = pages.map(p => [p, suspect(p)]).filter(([, n]) => n >= 2)
                   .sort((a, b) => b[1] - a[1]);
  console.log('\npages with broken OCR reading order (hand-fix candidates):');
  for (const [p, n] of bad) {
    console.log('  scan ' + p.p + ' = book p. ' + p.label + '   ' + n + ' truncated lines'
                + (p.fixed ? '   [front-fix applied]' : ''));
  }
  if (!bad.length) console.log('  none');

  // Takes a page as it currently stands in index.html and writes it back out as
  // a front-fix source, so a hand edit made in the browser-facing file becomes
  // the thing the build reads. This is the way to keep an edit: without it, the
  // next --write rebuilds the page from the OCR and the edit is gone.
  //
  //   node tools/front-matter.js --freeze 11
  //
  if (args.includes('--freeze')) {
    const want = String(args[args.indexOf('--freeze') + 1]);
    const cur = fs.readFileSync(HTML, 'utf8').split('\n').find(l => l.startsWith(PREFIX));
    if (!cur) throw new Error('no FRONT line in index.html to freeze from');
    const live = JSON.parse(cur.slice(PREFIX.length).replace(/;\s*$/, ''));
    let found = null, scan = null;
    for (const s of live.sections) {
      for (const pg of s.pages) if (String(pg.p) === want) { found = pg; break; }
      if (found) break;
    }
    if (!found) throw new Error('no book page ' + want + ' in index.html');
    for (const s of SECTIONS) {
      for (let p = s.from; p <= s.to; p++) if (pageLabel(p) === want) scan = p;
    }
    const out = ['________________', '', 'LALITA SAHASRANAMA', want]
      .concat(found.blocks.map(b => b.s).filter(s => s.trim()))
      .concat(found.notes.filter(n => n.trim()));
    const dst = path.join(FIX, 'ls_page_' + String(scan).padStart(4, '0') + '.txt');
    fs.mkdirSync(FIX, { recursive: true });
    fs.writeFileSync(dst, out.join('\n') + '\n');
    console.log('froze book p. ' + want + ' (scan ' + scan + ') to ' + path.relative(ROOT, dst));
    console.log('  ' + found.blocks.filter(b => b.s.trim()).length + ' paragraph(s), '
                + found.notes.length + ' note(s)');
    console.log('\nRun --write to rebuild; the page now comes from this file.');
    return;
  }

  // The built line on stdout, touching nothing. For comparing against what is
  // in index.html without risking a write.
  if (args.includes('--print')) {
    process.stdout.write(PREFIX + JSON.stringify(payload(sections)) + ';\n');
    return;
  }

  if (args.includes('--write')) {
    const line = PREFIX + JSON.stringify(payload(sections)) + ';';
    const src = fs.readFileSync(HTML, 'utf8');
    const lines = src.split('\n');
    const at = lines.findIndex(l => l.startsWith(PREFIX));

    // The FRONT line in index.html is generated, and a hand edit to it is
    // destroyed by the next write. So: remember what we last wrote, and refuse
    // to overwrite anything else. An edit belongs in front-fix/ or the lexicon,
    // where it survives; this stops it being silently thrown away meanwhile.
    const STAMP = path.join(FIX, '.last-write');
    const hash = s => require('crypto').createHash('sha1').update(s).digest('hex');

    // First run: adopt whatever is in index.html as the thing to protect, and
    // stop. Writing now would overwrite an edit we have no record of.
    if (at >= 0 && !fs.existsSync(STAMP)) {
      fs.writeFileSync(STAMP, hash(lines[at]) + '\n');
      console.log('\nGuard armed. The FRONT line currently in index.html is now the');
      console.log('baseline, so a later hand edit to it cannot be overwritten silently.');
      console.log('Nothing was written. Run the same command again to build.');
      return;
    }

    if (at >= 0) {
      const was = fs.readFileSync(STAMP, 'utf8').trim();
      const now = hash(lines[at]);
      if (was !== now && !args.includes('--force')) {
        console.log('\n*** REFUSING TO WRITE ***');
        console.log('The FRONT line in index.html is not the one this tool last wrote,');
        console.log('so it has been edited by hand. Overwriting would discard that.\n');
        const mine = JSON.parse(line.slice(PREFIX.length).replace(/;$/, ''));
        const theirs = JSON.parse(lines[at].slice(PREFIX.length).replace(/;$/, ''));
        const words = F => {
          const m = new Map();
          for (const s of F.sections) for (const pg of s.pages)
            for (const t of [...pg.blocks.map(b => b.s), ...pg.notes])
              for (const w of t.match(/\p{L}+/gu) || []) m.set(w, (m.get(w) || 0) + 1);
          return m;
        };
        const T = words(theirs), M = words(mine);
        const lost = [...T.keys()].filter(w => !M.has(w));
        console.log('in index.html now, and NOT in what the build would produce:');
        if (!lost.length) console.log('  (nothing — the difference is only formatting)');
        for (const w of lost.slice(0, 60)) console.log('  ' + w);
        console.log('\nMove those into front-fix/ or tools/iast-lexicon.js and run again,');
        console.log('or pass --force to overwrite them deliberately.');
        return;
      }
    }
    fs.writeFileSync(STAMP, hash(line) + '\n');
    if (at >= 0) lines[at] = line;
    else {
      const anchor = lines.findIndex(l => l.startsWith('const DATA = '));
      if (anchor < 0) throw new Error('could not find the "const DATA = " line in index.html');
      lines.splice(anchor + 1, 0, line);
    }
    fs.writeFileSync(HTML, lines.join('\n'));
    console.log('\nwrote FRONT (' + line.length + ' bytes) to index.html');
  } else {
    console.log('\n(dry run — pass --write to update index.html)');
  }
}

main();
