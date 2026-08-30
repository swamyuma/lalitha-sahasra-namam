#!/usr/bin/env node
// Validate the wbw/*.json sidecars and merge them into the DATA blob in index.html.
//
//   node tools/wbw-merge.js            validate only, report, touch nothing
//   node tools/wbw-merge.js --write    validate, then rewrite index.html
//
// Authoring a wbw entry is also the authority on its pada-cheda, so a merged
// entry overwrites nama.pada from wbw.split/splitIast and sets pconf to 1 --
// that is the convention the existing 50-106 entries already follow.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const SIDECARS = path.join(ROOT, 'wbw');
const PREFIX = 'const DATA = ';

const DEVA = /[ऀ-ॿ]/;
const LATIN = /[A-Za-z]/;

function loadHtml() {
  const lines = fs.readFileSync(HTML, 'utf8').split('\n');
  const i = lines.findIndex(l => l.startsWith(PREFIX));
  if (i < 0) throw new Error('could not find the "' + PREFIX + '" line in index.html');
  const json = lines[i].slice(PREFIX.length).replace(/;\s*$/, '');
  return { lines, i, data: JSON.parse(json) };
}

function loadSidecars() {
  if (!fs.existsSync(SIDECARS)) return {};
  const out = {};
  for (const f of fs.readdirSync(SIDECARS).filter(f => f.endsWith('.json')).sort()) {
    const obj = JSON.parse(fs.readFileSync(path.join(SIDECARS, f), 'utf8'));
    for (const [n, w] of Object.entries(obj)) {
      if (out[n]) throw new Error('nama ' + n + ' appears in two sidecars (' + out[n].file + ', ' + f + ')');
      out[n] = { file: f, wbw: w };
    }
  }
  return out;
}

// Strip the joints a pada-cheda marks so the split can be compared against the
// surface form: hyphens go, and so do the stem-final consonants and visargas
// that sandhi swallows. Only ever used for a soft comparison.
function bare(s) {
  return s.replace(/-/g, '').replace(/[्ः\s]/g, '');
}

// Trailing vowel-sign / anusvara / visarga run. A gloss is routinely written on
// the stem (वल्लभ) where the split carries the inflected form (वल्लभा), so
// endings are ignored when matching the two against each other.
const TAIL = /[ा-्ंः]+$/;
const stem = s => bare(s).replace(TAIL, '');
const sameWord = (a, b) => bare(a) === bare(b) || stem(a) === stem(b);

// words[] must cover the split in order, but it may subdivide a single pada --
// चक्रराज split as one pada, glossed as चक्र + राज. Walk the two in step and
// only complain when they cannot be lined up at all.
function alignWords(parts, words) {
  const errs = [];
  let wi = 0;
  for (const p of parts) {
    let acc = '', used = 0;
    while (wi < words.length) {
      acc += bare(words[wi].dev || '');
      wi++; used++;
      if (sameWord(acc, p)) break;
      if (stem(acc).length >= stem(p).length) break;
    }
    if (!sameWord(acc, p)) {
      errs.push('split pada "' + p + '" is not covered by words[] (got "'
              + (acc || '—') + '" from ' + used + ' entr' + (used === 1 ? 'y' : 'ies') + ')');
      return errs;
    }
  }
  if (wi < words.length)
    errs.push((words.length - wi) + ' words[] entr'
            + (words.length - wi === 1 ? 'y is' : 'ies are')
            + ' left over after the last split pada');
  return errs;
}

function validate(nama, wbw, where) {
  const errs = [], warns = [];
  const at = where + ' (nama ' + nama.n + ' ' + nama.dev + ')';

  for (const k of ['split', 'splitIast', 'words', 'meaning']) {
    if (!wbw[k] || (Array.isArray(wbw[k]) && !wbw[k].length)) errs.push(at + ': missing ' + k);
  }
  if (errs.length) return { errs, warns };

  const parts = wbw.split.split('-');
  const iparts = wbw.splitIast.split('-');

  if (parts.length !== iparts.length)
    errs.push(at + ': split has ' + parts.length + ' parts but splitIast has ' + iparts.length);

  parts.forEach((p, k) => {
    if (!DEVA.test(p)) errs.push(at + ': split part ' + (k + 1) + ' "' + p + '" has no Devanagari');
    if (LATIN.test(p)) errs.push(at + ': split part ' + (k + 1) + ' "' + p + '" contains Latin letters');
  });
  for (const e of alignWords(parts, wbw.words)) errs.push(at + ': ' + e);

  wbw.words.forEach((w, k) => {
    if (!w.dev) errs.push(at + ': words[' + k + '] missing dev');
    if (!w.gloss || !w.gloss.trim()) errs.push(at + ': words[' + k + '] missing gloss');
  });

  if (LATIN.test(wbw.split)) errs.push(at + ': split contains Latin letters');
  if (DEVA.test(wbw.splitIast)) errs.push(at + ': splitIast contains Devanagari');
  if (wbw.vigraha && !Array.isArray(wbw.vigraha)) errs.push(at + ': vigraha must be an array');
  (wbw.vigraha || []).forEach((v, k) => {
    if (!DEVA.test(v)) errs.push(at + ': vigraha[' + k + '] has no Devanagari');
  });

  // The split rejoined should look like the surface nama once joints are
  // stripped. A mismatch means sandhi happened -- fine, but it wants a note.
  const joined = bare(wbw.split), surface = bare(nama.dev);
  if (joined !== surface && !wbw.note)
    warns.push(at + ': split does not rejoin to dev, so sandhi is at work -- no note explains it');
  if (joined.length && surface.length && Math.abs(joined.length - surface.length) > 4)
    warns.push(at + ': split "' + wbw.split + '" is far from dev "' + nama.dev + '" -- check the analysis');

  return { errs, warns };
}

function main() {
  const write = process.argv.includes('--write');
  const { lines, i, data } = loadHtml();
  const byN = new Map(data.namas.map(x => [String(x.n), x]));
  const side = loadSidecars();

  const errs = [], warns = [];
  const merged = [], skipped = [];

  for (const [n, { file, wbw }] of Object.entries(side)) {
    const nama = byN.get(n);
    if (!nama) { errs.push(file + ': no nama numbered ' + n); continue; }
    const r = validate(nama, wbw, file);
    errs.push(...r.errs); warns.push(...r.warns);
    if (r.errs.length) { skipped.push(n); continue; }
    merged.push({ nama, wbw });
  }

  for (const w of warns) console.log('WARN  ' + w);
  for (const e of errs) console.log('ERROR ' + e);

  console.log('\nsidecar entries: ' + Object.keys(side).length
            + '   clean: ' + merged.length
            + '   rejected: ' + skipped.length
            + (skipped.length ? ' (' + skipped.join(',') + ')' : ''));

  if (!write) {
    console.log('validate-only; pass --write to merge into index.html');
    return errs.length ? 1 : 0;
  }
  // A rejected entry is left out of the write rather than blocking the batch --
  // it is reported above and whatever index.html already holds for it stands.
  if (skipped.length)
    console.log('leaving ' + skipped.length + ' rejected entr'
      + (skipped.length === 1 ? 'y' : 'ies') + ' out of the write: ' + skipped.join(','));

  for (const { nama, wbw } of merged) {
    const parts = wbw.split.split('-');
    const iparts = wbw.splitIast.split('-');
    nama.pada = parts.map((p, k) => ({ dev: p, iast: iparts[k] }));
    nama.pconf = 1;
    nama.wbw = wbw;
  }

  const total = data.namas.filter(x => x.wbw).length;
  data.stats.wbw_done = total;

  lines[i] = PREFIX + JSON.stringify(data) + ';';
  fs.writeFileSync(HTML, lines.join('\n'), 'utf8');
  console.log('wrote index.html -- ' + total + ' / ' + data.namas.length + ' namas now carry wbw');
  return 0;
}

process.exit(main());
