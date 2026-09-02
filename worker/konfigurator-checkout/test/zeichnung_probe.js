/* Sichtprobe: erzeugt SVG + DXF fuer die echte Testbestellung KP-2026-1034 und
   ein paar Sonderfaelle nach /tmp/zprobe. Kein Test im engeren Sinn — die
   Bilder werden angeschaut. */
import fs from 'node:fs';
import { konfigAusAttributen, konfigZuZeichnung } from '../src/zeichnung/adapter.js';
import { zeichnung } from '../src/zeichnung/zeichnung.js';
import { dxf } from '../src/zeichnung/dxf.js';

const out = process.argv[2] || '/tmp/zprobe';
fs.mkdirSync(out, { recursive: true });

const attr1034 = [
  { key: '_kfg_konfig_1', value: '{"mat":"dekor","dekor":"sonoma-eiche","thick":"25","form":"rect","L":40,"B":40,"D":"80","lf":{"L":180,"B":120,"aw":90,"ah":60,"pos":null,"schnitt":"gerade"},"edges":["abs","abs","abs","abs"],"cornerR":[0,0,30,30],"lfR":[0,0,0,0,0],"absColor":"schwarz","lack":false,' },
  { key: '_kfg_konfig_2', value: '"bohr":true,"massband":"none","massbandNull":"links","maschineMass":"52x18.1","cuts":[{"t":"c","cx":20,"cy":9,"d":8.5,"w":8.5,"h":8.5}]}' },
];
const meta = (extra) => ({ bestellnummer: 'KP-2026-1034', kunde: 'Alexander Sobkow', datum: '2026-09-02', position: 1, positionen: 1, menge: 1,
  sku: 'nach Maß', zeichnungsnummer: 'Z-1034-1', version: 1, freigabe: null, ...extra });

const faelle = {
  '1034_kunde_de': [konfigAusAttributen(attr1034), 'de', { exemplar: 'kunde' }],
  '1034_werkstatt_pl': [konfigAusAttributen(attr1034), 'pl', { exemplar: 'produktion' }],
  'lform_gerade_hr': [{ mat: 'dekor', dekor: 'buk', thick: '25', form: 'lform', lf: { L: 180, B: 120, aw: 90, ah: 60, pos: 'hr', schnitt: 'gerade' },
    edges: ['abs', 'abs', 'abs', 'abs'], lfR: [30, 0, 40, 30, 0], absColor: 'dekor', bohr: true,
    cuts: [{ t: 'c', cx: 30, cy: 20, d: 6, preset: 'kabel' }, { t: 'r', cx: 120, cy: 95, w: 26.5, h: 10, preset: 'usb', r: 5 }] }, 'de', { exemplar: 'kunde' }],
  'naehtisch_schraeg_vl': [{ mat: 'szwal', dekor: 'sz-gewebe', thick: '21', form: 'lform', lf: { L: 160, B: 90, aw: 50, ah: 30, pos: 'vl', schnitt: 'schraeg' },
    edges: ['f45', 'f45', 'f45', 'f45'], lfR: [10, 10, 0, 0, 0], lack: true, massband: 'laser', massbandNull: 'rechts', maschineMass: '52x18.1',
    cuts: [{ t: 'r', cx: 100, cy: 75, w: 52, h: 18.1, preset: 'maschine' }] }, 'pl', { exemplar: 'produktion', maschine: 'Juki TL-2200' }],
  'rund_mpx': [{ mat: 'mpx', dekor: 'sperrholz-natur', thick: '21', form: 'round', D: 90, edges: ['halbrund', 'halbrund', 'halbrund', 'halbrund'], bohr: true,
    cuts: [{ t: 'c', cx: 45, cy: 45, d: 8, preset: 'kabel80' }] }, 'en', { exemplar: 'kunde', freigabe: { name: 'J. Smith', zeit: '2026-09-03 10:12' } }],
  'rect_kanal_poly': [{ mat: 'compact', dekor: 'marmor-weiss', thick: '12', form: 'rect', L: 200, B: 80, edges: ['fase', 'fase', 'fase', 'fase'], cornerR: [20, 20, 20, 20],
    cuts: [{ t: 'k', cx: 100, cy: 40, len: 120, dir: 'laengs', w: 60, dp: 10, seite: 'unten', enden: 'e' },
           { t: 'p', cx: 40, cy: 30, w: 20, h: 16, r: 10, pts: [[-10, -8], [10, -8], [6, 8], [-10, 8]] },
           { t: 'r', cx: 160, cy: 5, w: 30, h: 10, r: 0 }] }, 'de', { exemplar: 'kunde' }],
};

for (const [name, [S0, spr, extra]] of Object.entries(faelle)) {
  const S = S0.extras ? S0 : (await import('../src/zeichnung/adapter.js')).konfigAusRoh(S0);
  const k = konfigZuZeichnung(S, meta(extra));
  const svg = zeichnung(k, spr);
  fs.writeFileSync(`${out}/${name}.svg`, svg);
  fs.writeFileSync(`${out}/${name}.dxf`, dxf(k, { sprache: 'pl' }));
  fs.writeFileSync(`${out}/${name}.k.json`, JSON.stringify(k, null, 1));
  console.log(name, 'svg', svg.length, 'B');
}
