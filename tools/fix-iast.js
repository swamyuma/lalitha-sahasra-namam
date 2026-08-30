#!/usr/bin/env node
// Repair OCR-mangled IAST in the gloss and body fields of the DATA blob.
//
//   node tools/fix-iast.js            report every change it would make
//   node tools/fix-iast.js --words    list the distinct affected words only
//   node tools/fix-iast.js --write    apply the changes to index.html
//
// Deliberately conservative. It only touches transformations that are
// deterministic: a wrong diacritic on a vowel that must be a macron, the
// apostrophe-for-s convention, the slash that stands for ṭ, and the "66" that
// the scanner produced for an opening quote. It does NOT try to turn "Kshobhini"
// into "Kṣobhiṇī" or "Trilochana" into "Trilocanā" -- those need the Devanagari
// or a judgement per token, and getting them wrong would corrupt a text the
// word-by-word run quotes as evidence.

const fs = require('fs');
const path = require('path');

const HTML = path.join(path.resolve(__dirname, '..'), 'index.html');
const PREFIX = 'const DATA = ';

// Every one of these was checked against its occurrences in the corpus before
// being put here; see the --words report.
const CHAR = {
  'ä':'ā', 'ă':'ā', 'â':'ā', 'á':'ā', 'à':'ā', 'ã':'ā', 'å':'ā', 'ą':'ā',
  'Ä':'Ā', 'Â':'Ā', 'Á':'Ā', 'À':'Ā', 'Ã':'Ā', 'Å':'Ā',
  'î':'ī', 'í':'ī', 'ï':'ī', 'ì':'ī', 'ĩ':'ī', 'ı':'ī', 'Î':'Ī', 'İ':'Ī',
  'û':'ū', 'ú':'ū', 'ü':'ū', 'ů':'ū', 'ŭ':'ū', 'Ü':'Ū',
  'ë':'e', 'ɛ':'e', 'ɑ':'a', 'ʊ':'u',
  'š':'ś', 'ɗ':'ḍ',
};

// Explicit overrides, taken from a review of all 266 affected words (--words).
// These are the cases where the stray accent sits on an English word or on
// scanner noise, so a macron would be actively wrong.
const OVERRIDE = {
  'dívides': 'divides',
  'fivë': 'five',
  'bút': 'but',
  'ís': 'is',
  'conìpared': 'compared',
  'beconïe': 'become',
  'ɛays': 'says',
  'Atınan': 'Ātman',
  'äftyone': 'fiftyone',
};

const LETTER = /[A-Za-zÀ-ɏɐ-ʯḀ-ỿ]/;

function fixWordChars(w) {
  if (OVERRIDE[w]) return OVERRIDE[w];
  return [...w].map(c => CHAR[c] || c).join('');
}

// Walk the string a word at a time so the English exceptions can be applied per
// word rather than per character.
function mapWords(s) {
  let out = '', i = 0;
  while (i < s.length) {
    if (!LETTER.test(s[i])) { out += s[i++]; continue; }
    let j = i;
    while (j < s.length && LETTER.test(s[j])) j++;
    const w = s.slice(i, j);
    out += [...w].some(c => c in CHAR) ? fixWordChars(w) : w;
    i = j;
  }
  return out;
}

function fixText(s) {
  if (!s) return s;
  let t = s.normalize('NFC');

  t = mapWords(t);

  // S'iva -> Śiva. Only when the apostrophe is followed by a letter, so a
  // word-final possessive ("the Devas'", "this'") is left alone.
  t = t.replace(/([sS])['’](?=[A-Za-zÀ-ɏḀ-ỿ])/g,
                (m, c) => (c === 'S' ? 'Ś' : 'ś'));

  // Vasish/ha -> Vasishṭha. The scanner dropped ṭ to a slash; every intra-word
  // slash in the corpus is one of these.
  t = t.replace(/(?<=[A-Za-zÀ-ɏḀ-ỿ])\/(?=[A-Za-zÀ-ɏḀ-ỿ])/g, 'ṭ');

  // says, 66 The pure ... -> says, " The pure. The scanner read an opening
  // double quote as "66". Guarded against the four places where 66 is a real
  // number: (66 Slo.) and (66) are preceded by "(", and (IV, 47, 66) is
  // followed by ")".
  t = t.replace(/(?<!\()(['‘])?\b66\b(?=\s)(?!\s*\))(?!\s+Slo)/g, '"');

  t = t.replace(/&nga/g, 'ṅga');
  t = t.replace(/¿\.e\./g, 'i.e.');

  return t;
}

function main() {
  const mode = process.argv.includes('--write') ? 'write'
             : process.argv.includes('--words') ? 'words' : 'report';

  const lines = fs.readFileSync(HTML, 'utf8').split('\n');
  const di = lines.findIndex(l => l.startsWith(PREFIX));
  const data = JSON.parse(lines[di].slice(PREFIX.length).replace(/;\s*$/, ''));

  if (mode === 'words') {
    const txt = data.namas.map(x => (x.gloss || '') + ' ' + (x.body || '')).join('\n').normalize('NFC');
    const seen = new Map();
    let i = 0;
    while (i < txt.length) {
      if (!LETTER.test(txt[i])) { i++; continue; }
      let j = i;
      while (j < txt.length && LETTER.test(txt[j])) j++;
      const w = txt.slice(i, j);
      if ([...w].some(c => c in CHAR)) seen.set(w, (seen.get(w) || 0) + 1);
      i = j;
    }
    const rows = [...seen.entries()].sort((a, b) => b[1] - a[1]);
    console.log('distinct affected words: ' + rows.length
      + '   occurrences: ' + rows.reduce((a, r) => a + r[1], 0) + '\n');
    for (const [w, n] of rows) console.log('  ' + String(n).padStart(3) + 'x  ' + w + '  ->  ' + fixWordChars(w));
    return 0;
  }

  let changedNamas = 0;
  const counters = { chars: 0, sApos: 0, slash: 0, quote66: 0, misc: 0 };
  const samples = [];

  for (const nm of data.namas) {
    const g0 = nm.gloss || '', b0 = nm.body || '';
    const g1 = fixText(g0), b1 = fixText(b0);
    if (g1 === g0 && b1 === b0) continue;
    changedNamas++;

    for (const [a, b] of [[g0, g1], [b0, b1]]) {
      counters.chars += [...a].filter(c => c in CHAR).length;
      counters.sApos += (a.match(/([sS])['’](?=[A-Za-zÀ-ɏḀ-ỿ])/g) || []).length;
      counters.slash += (a.match(/(?<=[A-Za-zÀ-ɏḀ-ỿ])\/(?=[A-Za-zÀ-ɏḀ-ỿ])/g) || []).length;
      counters.quote66 += (a.match(/(?<!\()(['‘])?\b66\b(?=\s)(?!\s*\))(?!\s+Slo)/g) || []).length;
      counters.misc += (a.match(/&nga|¿\.e\./g) || []).length;
    }
    if (samples.length < 12 && g1 !== g0) samples.push('  ' + nm.n + ' gloss\n      - ' + g0 + '\n      + ' + g1);

    if (mode === 'write') { if (nm.gloss) nm.gloss = g1; if (nm.body) nm.body = b1; }
  }

  console.log('namas changed: ' + changedNamas
    + '\n  wrong diacritic -> macron : ' + counters.chars
    + "\n  s' -> ś                   : " + counters.sApos
    + '\n  / -> ṭ                    : ' + counters.slash
    + '\n  66 -> opening quote       : ' + counters.quote66
    + '\n  &nga, ¿.e.                : ' + counters.misc);
  if (samples.length) console.log('\nsample gloss changes:\n' + samples.join('\n'));

  if (mode !== 'write') { console.log('\nreport only; pass --write to apply'); return 0; }

  lines[di] = PREFIX + JSON.stringify(data) + ';';
  fs.writeFileSync(HTML, lines.join('\n'), 'utf8');
  console.log('\nwrote index.html');
  return 0;
}

process.exit(main());
