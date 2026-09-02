/* Schriften fuer das PDF — werden von wrangler als Data-Module gebuendelt
   (wrangler.toml: [[rules]] type = "Data" fuer *.ttf). Im Node-Test wird
   stattdessen setSchriften() aus zeichnungen.js benutzt. */
import regular from './assets/DejaVuSans.ttf';
import bold from './assets/DejaVuSans-Bold.ttf';
export const SCHRIFTEN = { regular, bold };
