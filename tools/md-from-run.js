#!/usr/bin/env node
// Parse 50-60-namas-wbw.md -- the authored word-by-word run -- and merge every
// entry it holds into the DATA blob in index.html as nama.wbw.
//
//   node tools/md-from-run.js            parse and report, touch nothing
//   node tools/md-from-run.js --write    parse, then rewrite index.html
//
// This is the bulk counterpart of wbw-merge.js. That tool takes hand-written
// sidecars in wbw/*.json and validates them strictly; this one takes the prose
// run as the source and is deliberately tolerant, because the run is the thing
// that was actually authored and its entries vary in shape.
//
// Same convention as wbw-merge.js: authoring a wbw entry is also the authority
// on its pada-cheda, so a merged entry overwrites nama.pada from the split and
// sets pconf to 1.
//
// It also stamps an empty `additional_notes` on every nama, positioned directly
// after `body`, as a slot for later hand-written commentary.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const MD = path.join(ROOT, '50-60-namas-wbw.md');
const PREFIX = 'const DATA = ';

const DEVA = /[ऀ-ॿ]/;

/* ---------- Devanagari -> IAST ------------------------------------------ */

const CONS = {
  'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ṅ',
  'च':'c','छ':'ch','ज':'j','झ':'jh','ञ':'ñ',
  'ट':'ṭ','ठ':'ṭh','ड':'ḍ','ढ':'ḍh','ण':'ṇ',
  'त':'t','थ':'th','द':'d','ध':'dh','न':'n',
  'प':'p','फ':'ph','ब':'b','भ':'bh','म':'m',
  'य':'y','र':'r','ल':'l','व':'v',
  'श':'ś','ष':'ṣ','स':'s','ह':'h','ळ':'ḷ',
};
const VOWEL = {
  'अ':'a','आ':'ā','इ':'i','ई':'ī','उ':'u','ऊ':'ū',
  'ऋ':'ṛ','ॠ':'ṝ','ऌ':'ḷ','ॡ':'ḹ',
  'ए':'e','ऐ':'ai','ओ':'o','औ':'au',
};
const MATRA = {
  'ा':'ā','ि':'i','ी':'ī','ु':'u','ू':'ū',
  'ृ':'ṛ','ॄ':'ṝ','ॢ':'ḷ','ॣ':'ḹ',
  'े':'e','ै':'ai','ो':'o','ौ':'au',
};
const SIGN = { 'ं':'ṃ', 'ः':'ḥ', 'ँ':'m̐', 'ऽ':"'", '़':'' };
const VIRAMA = '्';

function iast(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (CONS[ch] !== undefined) {
      out += CONS[ch];
      const nx = s[i + 1];
      if (nx === VIRAMA) { i++; }
      else if (nx !== undefined && MATRA[nx] !== undefined) { out += MATRA[nx]; i++; }
      else { out += 'a'; }
      continue;
    }
    if (VOWEL[ch] !== undefined) { out += VOWEL[ch]; continue; }
    if (SIGN[ch] !== undefined) { out += SIGN[ch]; continue; }
    if (MATRA[ch] !== undefined) { out += MATRA[ch]; continue; }  // stray
    if (ch === VIRAMA) continue;
    out += ch;
  }
  return out;
}

/* ---------- markdown parsing -------------------------------------------- */

// A nama entry opens with "934. विश्वमाता → विश्व-माता" and runs until the next
// such heading or until a structural line -- a rule, a verse heading, a verse
// note or a textual note.
const HEAD = /^(\d{1,4})\.\s+(\S[^→]*?)\s+→\s+(\S+)\s*$/;
const STOP = /^(---\s*$|##\s|Verse \d|Textual note|Note on the verse|Note on verses|>\s)/;

const stripMd = s => s.replace(/\*\*/g, '').replace(/(^|\s)\*(\S[^*]*?)\*/g, '$1$2');

function parse(md) {
  const lines = md.split('\n');
  const out = new Map();
  const problems = [];

  for (let i = 0; i < lines.length; i++) {
    const m = HEAD.exec(lines[i]);
    if (!m) continue;
    const n = m[1], surface = m[2].trim(), split = m[3].trim();
    if (!DEVA.test(split)) continue;

    // gather the block
    const block = [];
    let j = i + 1;
    for (; j < lines.length; j++) {
      if (HEAD.test(lines[j]) || STOP.test(lines[j])) break;
      block.push(lines[j]);
    }

    const words = [], vigraha = [], notes = [];
    let meaning = '', seenBody = false;

    for (let k = 0; k < block.length; k++) {
      const raw = block[k];
      const line = raw.trim();
      if (!line) continue;

      // word-by-word lines come first and look like "विश्व = all, the whole"
      if (!seenBody && !meaning) {
        const eq = line.indexOf(' = ');
        if (eq > 0 && DEVA.test(line.slice(0, eq))) {
          words.push({ dev: line.slice(0, eq).trim(), gloss: stripMd(line.slice(eq + 3).trim()) });
          continue;
        }
      }
      // The overall meaning is the quoted line that closes the word list. A few
      // entries carry a trailing clause after the closing quote -- 92 is one --
      // so the quoted span is the meaning and the remainder falls to the note.
      if (!meaning && !seenBody) {
        const q = /^["“]([^"”]+)["”]\s*(.*)$/.exec(line);
        if (q) {
          meaning = q[1].trim();
          if (q[2].trim()) notes.push(stripMd(q[2].trim().replace(/^[—-]\s*/, '')));
          continue;
        }
      }
      if (/^Vigraha:/.test(line)) {
        // A vigraha line may carry more than one analysis, joined by "or" or
        // simply run on after a daṇḍa. The renderer prints one per line, so
        // they are split apart here.
        const v = line.replace(/^Vigraha:\s*/, '').trim();
        if (DEVA.test(v)) {
          v.split(/\s+or\s+/i)
            .reduce((a, s) => a.concat(s.split(/(?<=।)\s+/)), [])
            .map(x => x.trim())
            .filter(x => DEVA.test(x))
            .forEach(x => vigraha.push(x));
        }
        seenBody = true;
        continue;
      }
      seenBody = true;
      notes.push(stripMd(raw.replace(/\s+$/, '')));
    }

    const note = notes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    const parts = split.split('-');

    const entry = {
      split,
      splitIast: parts.map(iast).join('-'),
      words,
      meaning,
      vigraha,
      note,
    };
    if (!vigraha.length) delete entry.vigraha;
    if (!note) delete entry.note;

    if (out.has(n)) problems.push('nama ' + n + ' has two entries in the run');
    if (!words.length) problems.push('nama ' + n + ' (' + surface + '): no word-by-word lines');
    if (!meaning) problems.push('nama ' + n + ' (' + surface + '): no overall meaning');

    out.set(n, entry);
    i = j - 1;
  }
  return { entries: out, problems };
}

/* ---------- merge -------------------------------------------------------- */

// Rebuild a nama with additional_notes sitting directly after body. Key order in
// the emitted JSON is insertion order, so the field lands where it is wanted.
function withNotesSlot(nama) {
  const out = {};
  for (const k of Object.keys(nama)) {
    out[k] = nama[k];
    if (k === 'body') out.additional_notes = nama.additional_notes || '';
  }
  if (!('additional_notes' in out)) {
    // no body key on this nama -- put the slot straight after gloss
    const rebuilt = {};
    for (const k of Object.keys(out)) {
      rebuilt[k] = out[k];
      if (k === 'gloss') rebuilt.additional_notes = out.additional_notes || '';
    }
    if (!('additional_notes' in rebuilt)) rebuilt.additional_notes = '';
    return rebuilt;
  }
  return out;
}

function main() {
  const write = process.argv.includes('--write');

  const htmlLines = fs.readFileSync(HTML, 'utf8').split('\n');
  const di = htmlLines.findIndex(l => l.startsWith(PREFIX));
  if (di < 0) throw new Error('could not find the "' + PREFIX + '" line in index.html');
  const data = JSON.parse(htmlLines[di].slice(PREFIX.length).replace(/;\s*$/, ''));

  const { entries, problems } = parse(fs.readFileSync(MD, 'utf8'));

  const byN = new Map(data.namas.map(x => [String(x.n), x]));
  let merged = 0, kept = 0, orphan = 0;

  data.namas = data.namas.map(nama => {
    const w = entries.get(String(nama.n));
    const out = withNotesSlot(nama);
    if (w) {
      out.pada = w.split.split('-').map((p, k) => ({ dev: p, iast: w.splitIast.split('-')[k] }));
      out.pconf = 1;
      out.wbw = w;
      merged++;
    } else if (out.wbw) {
      kept++;
    }
    return out;
  });

  for (const n of entries.keys()) if (!byN.has(n)) { orphan++; problems.push('run has nama ' + n + ' but index.html does not'); }

  for (const p of problems.slice(0, 40)) console.log('  ' + p);
  if (problems.length > 40) console.log('  ... and ' + (problems.length - 40) + ' more');

  const total = data.namas.filter(x => x.wbw).length;
  console.log('\nrun entries parsed: ' + entries.size
    + '\nmerged into index:  ' + merged
    + '\nexisting wbw kept:  ' + kept
    + '\norphans:            ' + orphan
    + '\nnamas with wbw:     ' + total + ' / ' + data.namas.length);

  if (!write) { console.log('\nreport only; pass --write to update index.html'); return 0; }

  data.stats.wbw_done = total;
  htmlLines[di] = PREFIX + JSON.stringify(data) + ';';
  fs.writeFileSync(HTML, htmlLines.join('\n'), 'utf8');
  console.log('\nwrote index.html');
  return 0;
}

process.exit(main());
