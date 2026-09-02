// Sastry's 1925 transliteration -> IAST, for the front matter.
//
// Hand-written, one entry per term, because it cannot be derived: the nama
// corpus holds compound-final forms (mantrā, japā) that are wrong as standalone
// words, and a few OCR-damaged ones (sivā, srividyā). Matching against it
// corrupted "Mantra" in 40 places, so every entry here was written out and
// checked against its occurrences instead.
//
// Keys are matched whole-word and case-insensitively; an initial capital in the
// text is preserved on the replacement. Add plurals as their own entries rather
// than stripping an "s" — "Saktis" is Śaktis but "Vedas" needs no change.
//
// A word absent from this table is left exactly as Sastry wrote it. Anything
// genuinely ambiguous belongs in ADJOURNED below, not here.

const LEXICON = {
  // deities, persons, places
  'devi': 'Devī',            'sridevi': 'Śrīdevī',
  'siva': 'Śiva',            'sadasiva': 'Sadāśiva',
  'sakti': 'Śakti',          'saktis': 'Śaktis',
  'parasakti': 'Paraśakti',  'saktas': 'Śāktas',
  'vishnu': 'Viṣṇu',         'brahma': 'Brahmā',
  'lalita': 'Lalitā',        'hayagriva': 'Hayagrīva',
  'maya': 'Māyā',            'uma': 'Umā',
  'lakshmi': 'Lakṣmī',       'sarasvati': 'Sarasvatī',
  'durga': 'Durgā',          'bhadrakali': 'Bhadrakālī',
  'kalika': 'Kālikā',        'ambika': 'Ambikā',
  'annada': 'Annadā',        'bala': 'Bālā',
  'nakuli': 'Nākulī',        'malini': 'Mālinī',
  'vasini': 'Vāsinī',        'vagvadini': 'Vāgvādinī',
  'mantrini': 'Mantriṇī',    'dandini': 'Daṇḍinī',
  'varahi': 'Vārāhī',        'yogini': 'Yoginī',
  'tripurasundari': 'Tripurasundarī',
  'sankara': 'Śaṅkara',      'garuda': 'Garuḍa',
  'vyasa': 'Vyāsa',          'surya': 'Sūrya',
  'vayu': 'Vāyu',            'jiva': 'Jīva',
  'lopamudra': 'Lopāmudrā',  'lopamudrā': 'Lopāmudrā',
  'bhaskararaya': 'Bhāskararāya', 'bhasurananda': 'Bhāsurānanda',
  'brahmana': 'Brāhmaṇa',    'brahmanis': 'Brāhmaṇīs',
  'brahmandas': 'Brahmāṇḍas',
  'gayatri': 'Gāyatrī',      'suta': 'Sūta',
  'upasaka': 'Upāsaka',      'rishis': 'Ṛṣis',
  'kasikhanda': 'Kāśīkhaṇḍa',

  // works and collections
  'sruti': 'Śruti',          'srutis': 'Śrutis',
  'sastras': 'Śāstras',      'sastra': 'Śāstra',
  'sutra': 'Sūtra',          'sutras': 'Sūtras',
  'purana': 'Purāṇa',        'puranas': 'Purāṇas',
  'samhita': 'Saṃhitā',      'agamas': 'Āgamas',
  'vedanta': 'Vedānta',      'gita': 'Gītā',
  'naradiya': 'Nāradīya',    'bhagavata': 'Bhāgavata',
  'sahasranama': 'Sahasranāma',
  'saundaryalahari': 'Saundaryalaharī',
  'prapanchasara': 'Prapañcasāra',
  'rudrayamala': 'Rudrayāmala',
  'lalitastavaratna': 'Lalitāstavaratna',
  'yoginihridaya': 'Yoginīhṛdaya',
  'saubhagyabhaskara': 'Saubhāgyabhāskara',
  'phalasruti': 'Phalaśruti',
  'arthavada': 'Arthavāda',
  'padarthadarsa': 'Padārthādarśa',

  // the vidyā and its terms
  'sri': 'Śrī',              'srividya': 'Śrīvidyā',
  'vidya': 'Vidyā',          'kadi': 'Kādi',
  'kadividya': 'Kādividyā',  'hadividya': 'Hādividyā',
  // kādi- and hādi-, the vidyās beginning with ka and with ha. The scan read
  // the ä as ü once, on book p. 9; the other five occurrences have it right.
  'hudividya': 'Hādividyā',
  'panchadasi': 'Pañcadaśī', 'panchadasī': 'Pañcadaśī',
  'shodasi': 'Ṣoḍaśī',       'trisati': 'Triśatī',
  'srichakra': 'Śrīcakra',   'sripura': 'Śrīpura',
  'chakra': 'cakra',         'chakras': 'cakras',
  'chakraraja': 'Cakrarāja', 'chakrarāja': 'Cakrarāja',
  'pranava': 'Praṇava',      'kundalini': 'Kuṇḍalinī',
  'muladhara': 'Mūlādhāra',  'sahasrara': 'Sahasrāra',
  // mūla + ādhāra. The scan read the u as an a once, on book p. 10; the three
  // other occurrences in the front matter have it right.
  'maladhara': 'Mūlādhāra',
  'ekara': 'Ekāra',          'nada': 'Nāda',

  // practice
  'nyasa': 'Nyāsa',          'nyasas': 'Nyāsas',
  'shodhanyasa': 'Ṣoḍhanyāsa',
  'samadhi': 'Samādhi',      'turiya': 'Turīya',
  'vasana': 'Vāsanā',        'vishuvas': 'Viṣuvas',
  'tatvavishuva': 'Tattvaviṣuva',
  'tadatmya': 'Tādātmya',    'ichcha': 'Icchā',
  'jnana': 'Jñāna',          'prakriti': 'Prakṛti',
  'atman': 'Ātman',
  'satva': 'Sattva',         'tatva': 'Tattva',
  'tatvas': 'Tattvas',
  'nirguna': 'Nirguṇa',      'nishkala': 'Niṣkala',
  'devata': 'Devatā',        'devatas': 'Devatās',
  'sloka': 'Śloka',          'slokas': 'Ślokas',
  'para': 'Parā',            'apara': 'Aparā',
  'akasa': 'Ākāśa',          'ākāsa': 'Ākāśa',
  'sabdas': 'Śabdas',        'pinda': 'Piṇḍa',
  'kartari': 'Kartarī',      'cha': 'ca',
  'dhyana': 'Dhyāna',        'sarvamangala': 'Sarvamaṅgala',
  'panchami': 'Pañcamī',     'stavaraja': 'Stavarāja',

  // the thirty-six tattvas, as the list stands on p. 17
  'isvara': 'Īśvara',        'sadasiva': 'Sadāśiva',
  'sādāsiva': 'Sadāśiva',    'suddhavidya': 'Śuddhavidyā',
  'raga': 'Rāga',            'purusha': 'Puruṣa',
  'ahankara': 'Ahaṅkāra',    'niyati': 'Niyati',

  // Compounds are matched whole-word, so each one needs its own entry: the
  // table never splits a word to convert a stem inside it.
  'padmapurana': 'Padmapurāṇa',
  'nyasakhanda': 'Nyāsakhaṇḍa',    'homakhanda': 'Homakhaṇḍa',
  'pujakhanda': 'Pūjākhaṇḍa',      'rahasyakhanda': 'Rahasyakhaṇḍa',
  'saktichakra': 'Śakticakra',     'adisakti': 'Ādiśakti',
  'mahasakti': 'Mahāśakti',        'parasiva': 'Paraśiva',
  'paramasiva': 'Paramaśiva',      'mantrasastra': 'Mantraśāstra',
  'antaryaga': 'Antaryāga',        'bahiryaga': 'Bahiryāga',
  'vidyaratna': 'Vidyāratna',      'vidyas': 'vidyās',
  'avidya': 'Avidyā',              'vidyadharas': 'Vidyādharas',
  'hiranyagarbha': 'Hiraṇyagarbha',
};

// Left as Sastry printed them, on purpose. Each of these has two defensible
// readings and the surrounding text does not settle which, so guessing would
// put a wrong long vowel into a scholarly page. Move an entry up into LEXICON
// once you have decided it.
const ADJOURNED = {
  'kala':   'kalā (a division) or kāla (time). p. 17 lists the thirty-six '
          + 'tattvas as "… Māyā, Kala, Kala, Vidyā …" — those two are kalā and '
          + 'kāla, two separate tattvas, and the scan cannot say which is which',
  'kalas':  'kalās or kālas, for the same reason',
  'sat':    'sat (being) — no diacritic either way, listed to note it was seen',
  'guru':   'guru / gurū in compounds; plain guru needs nothing',
  'mantra': 'mantra — needs no diacritic; recorded so it is never "mantrā"',
  'japa':   'japa — likewise never "japā"',
  'tantra': 'tantra — likewise never "tantrā"',
  'sarva':  'sarva — never "śarva", which is a name of Śiva',
};

// Gets the diacritics but stays upright. Checked before both italic tests, so
// it overrides even a macron — which is otherwise enough on its own to slant a
// word. This is also where proper names would go if the roman-for-names
// convention is ever wanted; for now it holds only what was asked for.
const UPRIGHT = new Set([
  // Empty: everything Sanskrit is italic. Pañcamī Stavarāja was briefly listed
  // here on a misreading; it takes the italics like the rest.
]);

// \p{L} rather than hand-picked ranges: ñ and Ñ live at U+00F1/U+00D1, in
// Latin-1 Supplement, outside Latin Extended-A and Additional. The old class
// split "Pañcadaśī" in two at the ñ, so the lexicon never saw it whole.
const WORD = /\p{L}+/gu;

// The accent repair runs first, so a word may already carry a macron by the
// time it reaches the table: "Kāsikhanda" must still find the "kasikhanda"
// entry. Both sides of the lookup are flattened to plain ASCII.
function flat(w) {
  return w.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
          .replace(/ṛ/g, 'r').replace(/ś/g, 's').replace(/ṣ/g, 's')
          .replace(/ṇ/g, 'n').replace(/ṭ/g, 't').replace(/ḍ/g, 'd')
          .replace(/ṃ/g, 'm').replace(/ḥ/g, 'h').replace(/ñ/g, 'n')
          .replace(/ṅ/g, 'n').replace(/ḷ/g, 'l');
}

// Built once, keyed on the flattened form. A collision between two entries that
// disagree is a mistake in the table, so it is shouted about rather than hidden.
const FLAT = new Map();

// Preserve the case the text used: a capital in equals a capital out. An
// all-caps source is a heading — THE NYASA, DHYANA SLOKA — and must come back
// as NYĀSA, not Nyāsa, or the run of small caps breaks mid-line.
function cased(src, repl) {
  if (src.length > 1 && src === src.toUpperCase() && src !== src.toLowerCase()) {
    return repl.toUpperCase();
  }
  if (/^[a-z]/.test(src)) return repl[0].toLowerCase() + repl.slice(1);
  return repl[0].toUpperCase() + repl.slice(1);
}

// Applies the table whole-word. Reports what it changed so every substitution
// stays auditable.
function toIast(s, tally) {
  if (!FLAT.size) {
    for (const [k, v] of Object.entries(LEXICON)) {
      const f = flat(k);
      if (FLAT.has(f) && FLAT.get(f) !== v) {
        throw new Error('lexicon conflict on "' + f + '": ' + FLAT.get(f) + ' vs ' + v);
      }
      FLAT.set(f, v);
    }
  }
  return s.replace(WORD, w => {
    const hit = FLAT.get(flat(w));
    if (!hit) return w;
    const out = cased(w, hit);
    if (out === w) return w;
    if (tally) tally.set(w + ' → ' + out, (tally.get(w + ' → ' + out) || 0) + 1);
    return out;
  });
}

// The vetted Sanskrit vocabulary, flattened to plain ASCII, for index.html to
// italicise with. Both sides of each entry count: "chakra" and "cakra" alike,
// and the adjourned words are Sanskrit too even though the table leaves them
// spelled as printed.
function terms() {
  const t = new Set();
  for (const [k, v] of Object.entries(LEXICON)) { t.add(flat(k)); t.add(flat(v)); }
  for (const k of Object.keys(ADJOURNED)) t.add(flat(k));
  return [...t].sort();
}

module.exports = { LEXICON, ADJOURNED, UPRIGHT, toIast, flat, terms,
                   // both the key and what it converts to, since "ch" and "ñ" flatten
                   // differently and only one of them would otherwise match
                   upright: () => [...new Set([...UPRIGHT].flatMap(k =>
                     [flat(k), LEXICON[k] ? flat(LEXICON[k]) : null].filter(Boolean)))].sort() };
