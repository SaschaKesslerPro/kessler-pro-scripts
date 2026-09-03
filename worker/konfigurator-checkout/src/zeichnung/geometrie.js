/*
 * Gemeinsame Konturmathematik fuer Zeichnung (SVG/PDF) und Fraesdatei (DXF).
 *
 * Alle Masse in mm. Plattenkoordinaten wie im Konfigurator: Ursprung hinten
 * links, x nach rechts, y nach VORN (in der Draufsicht also nach unten).
 * Das DXF spiegelt y selbst (dort zeigt y nach hinten).
 */

const EPS = 1e-9;

/** Aussenkontur der Platte als Eckenliste {x,y,r}. r = Radius an dieser Ecke. */
export function kontur(k) {
  if (k.form === 'rund') {
    return null;                                  // Kreis — kein Polygon
  }
  const E = k.eckradien_mm || {};
  if (k.form === 'lform') {
    const lf = k.lform;                           // { L, B, aw, ah, pos, schraeg, innenradius, radien:[5] }
    const L = lf.L, B = lf.B;
    const aw = Math.max(1, Math.min(lf.aw, L - 1)), ah = Math.max(1, Math.min(lf.ah, B - 1));
    // gebaut fuer "hinten rechts", danach gespiegelt — genau wie lfPts() im Konfigurator
    let pts, ord;
    const sb = lf.schraeg ? Math.max(0, Math.min(+lf.sb || 0, ah - 1)) : 0;   // Punkt B (v1.17.3)
    if (lf.schraeg && sb > 0) { pts = [[0, 0], [L - aw, 0], [L - aw, sb], [L, ah], [L, B], [0, B]]; ord = [0, 1, -1, 2, 3, 4]; }
    else if (lf.schraeg) { pts = [[0, 0], [L - aw, 0], [L, ah], [L, B], [0, B]]; ord = [0, 1, 2, 3, 4]; }
    else { pts = [[0, 0], [L - aw, 0], [L - aw, ah], [L, ah], [L, B], [0, B]]; ord = [0, 1, -1, 2, 3, 4]; }
    // Radius je Punkt: Innenecke = Fertigungsradius; bei der Schraege bekommen beide
    // Endpunkte (A aussen, B innen) mindestens den Fertigungsradius (Senior 03.09.).
    const radK = lf.radien || [], rmin = lf.innenradius || 0;
    const diag = lf.schraeg ? (sb > 0 ? [2, 3] : [1, 2]) : [];
    let rad = pts.map((_, i) => ord[i] < 0 ? rmin : (diag.indexOf(i) >= 0 ? Math.max(rmin, +radK[ord[i]] || 0) : (+radK[ord[i]] || 0)));
    let auto = pts.map((_, i) => ord[i] < 0 || (diag.indexOf(i) >= 0 && (+radK[ord[i]] || 0) < rmin));   // Radius aus der Fertigungsregel
    const mx = lf.pos === 'hl' || lf.pos === 'vl', my = lf.pos === 'vr' || lf.pos === 'vl';
    pts = pts.map(([x, y]) => [mx ? L - x : x, my ? B - y : y]);
    if (mx !== my) { pts.reverse(); ord.reverse(); rad.reverse(); auto.reverse(); }
    return pts.map(([x, y], i) => ({ x, y, r: rad[i], ord: ord[i], auto: auto[i] }));
  }
  const B = k.laenge_mm, H = k.breite_mm;
  return [
    { x: 0, y: 0, r: E.hl || 0, ord: 0 }, { x: B, y: 0, r: E.hr || 0, ord: 1 },
    { x: B, y: H, r: E.vr || 0, ord: 2 }, { x: 0, y: H, r: E.vl || 0, ord: 3 },
  ];
}

/** Umschliessendes Rechteck der Platte (mm). */
export function huelle(k) {
  if (k.form === 'rund') return { B: k.durchmesser_mm, H: k.durchmesser_mm };
  if (k.form === 'lform') return { B: k.lform.L, H: k.lform.B };
  return { B: k.laenge_mm, H: k.breite_mm };
}

/**
 * Ecken verrunden. Aus einer geschlossenen Eckenliste wird eine Folge von
 * Elementen, jede Ecke mit Tangentenpunkten t1 (Ankunft) und t2 (Abfahrt),
 * Radius r (auf die halbe Kantenlaenge begrenzt), Mittelpunkt c und dem
 * Vorzeichen der Drehung (cross > 0 = Linksdrehung im gegebenen System —
 * in Bildkoordinaten mit y nach unten ist das optisch eine Rechtskurve).
 * theta = Innenwinkel der Ecke, sweep = Bogenwinkel = PI - theta.
 */
export function verrunden(pts) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const p = pts[(i + n - 1) % n], c = pts[i], q = pts[(i + 1) % n];
    const v1 = norm(p.x - c.x, p.y - c.y), v2 = norm(q.x - c.x, q.y - c.y);
    const d1 = Math.hypot(p.x - c.x, p.y - c.y), d2 = Math.hypot(q.x - c.x, q.y - c.y);
    let dot = v1.x * v2.x + v1.y * v2.y; dot = Math.max(-1, Math.min(1, dot));
    const theta = Math.acos(dot);                  // Innenwinkel
    let r = Math.max(0, c.r || 0);
    if (r > EPS && theta > 1e-6 && Math.abs(theta - Math.PI) > 1e-6) {
      const tanHalb = Math.tan(theta / 2);
      let dist = r / tanHalb;                       // Ecke -> Tangentenpunkt
      const maxDist = Math.min(d1, d2) / 2 - 1e-6;
      if (dist > maxDist) { dist = Math.max(0, maxDist); r = dist * tanHalb; }
      const t1 = { x: c.x + v1.x * dist, y: c.y + v1.y * dist };
      const t2 = { x: c.x + v2.x * dist, y: c.y + v2.y * dist };
      const bis = norm(v1.x + v2.x, v1.y + v2.y);
      const cm = { x: c.x + bis.x * (r / Math.sin(theta / 2)), y: c.y + bis.y * (r / Math.sin(theta / 2)) };
      const dIn = { x: c.x - p.x, y: c.y - p.y }, dOut = { x: q.x - c.x, y: q.y - c.y };
      const cross = dIn.x * dOut.y - dIn.y * dOut.x;
      out.push({ ecke: c, t1, t2, r, c: cm, cross, sweep: Math.PI - theta, ord: c.ord, auto: !!c.auto });
    } else {
      out.push({ ecke: c, t1: { x: c.x, y: c.y }, t2: { x: c.x, y: c.y }, r: 0, c: null, cross: 0, sweep: 0, ord: c.ord, auto: !!c.auto });
    }
  }
  return out;
}

function norm(x, y) { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; }

/** SVG-Pfad aus verrundeten Ecken; S = Massstabsfunktion, ox/oy = Blattversatz. */
export function pfadSVG(ecken, S, ox, oy) {
  const n3 = (v) => Math.round(v * 1000) / 1000;
  const P = (p) => `${n3(ox + S(p.x))} ${n3(oy + S(p.y))}`;
  let d = `M ${P(ecken[0].t2)} `;
  for (let i = 1; i <= ecken.length; i++) {
    const e = ecken[i % ecken.length];
    d += `L ${P(e.t1)} `;
    if (e.r > EPS) d += `A ${n3(S(e.r))} ${n3(S(e.r))} 0 0 ${e.cross > 0 ? 1 : 0} ${P(e.t2)} `;
  }
  return d + 'Z';
}

/**
 * DXF-Polylinie (Punkte mit Bulge) aus verrundeten Ecken. y wird gespiegelt
 * (H - y), damit y nach hinten zeigt. Das Bild bleibt dabei dasselbe — nur
 * die Vorzeichen drehen sich: eine Linkskurve im Bild (cross < 0 bei y nach
 * unten) ist im DXF ein Bogen gegen den Uhrzeigersinn = POSITIVER Bulge.
 */
export function polylinieDXF(ecken, H, dx = 0, dy = 0) {
  const out = [];
  for (const e of ecken) {
    if (e.r > EPS) {
      out.push({ x: e.t1.x + dx, y: H - e.t1.y + dy, bulge: (e.cross < 0 ? 1 : -1) * Math.tan(e.sweep / 4) });
      out.push({ x: e.t2.x + dx, y: H - e.t2.y + dy, bulge: 0 });
    } else {
      out.push({ x: e.t1.x + dx, y: H - e.t1.y + dy, bulge: 0 });
    }
  }
  return out;
}

/** Rechteck mit gleichem Radius an allen Ecken als Eckenliste. */
export function rechteck(x, y, b, h, r) {
  const rr = Math.min(r || 0, b / 2, h / 2);
  return [{ x, y, r: rr }, { x: x + b, y, r: rr }, { x: x + b, y: y + h, r: rr }, { x, y: y + h, r: rr }];
}

/** Umlauf: Flaeche > 0 heisst im Bildsystem (y nach unten) im Uhrzeigersinn. */
export function flaeche2(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; a += p.x * q.y - q.x * p.y; }
  return a / 2;
}

/**
 * Abstand von einem Punkt in Richtung (dx,dy) bis zur Kontur (nur Geraden,
 * Radien bleiben unberuecksichtigt) — fuer die Abstandsmasse der Ausschnitte.
 */
export function konturAbstand(pts, px, py, dx, dy) {
  const n = pts.length; let best = Infinity;
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[(i + 1) % n];
    const ex = b.x - a.x, ey = b.y - a.y, den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a.x - px) * ey - (a.y - py) * ex) / den, u = ((a.x - px) * dy - (a.y - py) * dx) / den;
    if (t > 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) best = Math.min(best, t);
  }
  return isFinite(best) ? best : 0;
}
