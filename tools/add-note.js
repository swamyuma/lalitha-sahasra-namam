#!/usr/bin/env node
// Load a Markdown file into the additional_notes field of one nama.
//
//   node tools/add-note.js 936 ../nama-936-visalakshi-diksha-comparison.md
//   node tools/add-note.js 936 ../nama-936-visalakshi-diksha-comparison.md --write
//   node tools/add-note.js 936 --clear --write
//   node tools/add-note.js --list
//
// The Markdown is stored verbatim, so the field stays hand-editable; index.html
// renders it as a collapsed block on the nama's card. md-from-run.js preserves
// additional_notes when it regenerates the word-by-word entries.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const PREFIX = 'const DATA = ';

function load() {
  const lines = fs.readFileSync(HTML, 'utf8').split('\n');
  const i = lines.findIndex(l => l.startsWith(PREFIX));
  if (i < 0) throw new Error('could not find the "' + PREFIX + '" line in index.html');
  return { lines, i, data: JSON.parse(lines[i].slice(PREFIX.length).replace(/;\s*$/, '')) };
}

function main() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const clear = args.includes('--clear');
  const rest = args.filter(a => !a.startsWith('--'));

  const { lines, i, data } = load();

  if (args.includes('--list')) {
    const held = data.namas.filter(x => (x.additional_notes || '').trim());
    console.log(held.length + ' nama(s) carry additional_notes:');
    for (const n of held) {
      const first = (n.additional_notes.match(/^#{1,6}\s+(.+)$/m) || [])[1] || '(no heading)';
      console.log('  ' + String(n.n).padStart(4) + '  ' + n.dev + '   '
        + n.additional_notes.length + ' chars   ' + first.slice(0, 60));
    }
    return 0;
  }

  const n = Number(rest[0]);
  if (!Number.isInteger(n) || n < 1 || n > 1000) {
    console.log('usage: node tools/add-note.js <nama 1-1000> <file.md> [--write]');
    console.log('       node tools/add-note.js <nama> --clear --write');
    console.log('       node tools/add-note.js --list');
    return 1;
  }
  const nama = data.namas[n - 1];
  if (!nama || nama.n !== n) throw new Error('nama ' + n + ' not found at the expected index');

  let text = '';
  if (!clear) {
    const file = rest[1];
    if (!file) { console.log('no markdown file given'); return 1; }
    text = fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')
             .replace(/\r\n?/g, '\n').trim();
  }

  const heading = (text.match(/^#{1,6}\s+(.+)$/m) || [])[1] || '(none)';
  console.log('nama ' + n + '  ' + nama.dev + '  (' + nama.iast + ')');
  console.log('  was: ' + ((nama.additional_notes || '').length) + ' chars');
  console.log('  now: ' + text.length + ' chars');
  console.log('  heading used as the collapsible label: ' + heading);

  if (!write) { console.log('\nreport only; pass --write to apply'); return 0; }

  nama.additional_notes = text;
  lines[i] = PREFIX + JSON.stringify(data) + ';';
  fs.writeFileSync(HTML, lines.join('\n'), 'utf8');
  console.log('\nwrote index.html');
  return 0;
}

process.exit(main());
