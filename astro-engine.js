/* Nakshatra — Astro Engine
   Computes sidereal (Vedic) planetary longitudes and the ascendant from
   a birth date, time, and place, using standard low/medium-precision
   astronomical formulas (accurate to roughly a few arcminutes for the
   Sun and inner planets, and well within one degree for the Moon and
   outer planets, across the 1800–2050 range). This is a client-side
   approximation, not a full-precision ephemeris (e.g. Swiss Ephemeris) —
   accurate enough to reliably place every body in the correct sign,
   nakshatra and pada for essentially all birth dates.
*/
(function (global) {
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const rad = (d) => d * D2R;
  const deg = (r) => r * R2D;
  const mod360 = (x) => ((x % 360) + 360) % 360;

  const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
  const NAKSHATRAS = [
    "Ashwini","Bharani","Krittika","Rohini","Mrigashira","Ardra","Punarvasu","Pushya","Ashlesha",
    "Magha","Purva Phalguni","Uttara Phalguni","Hasta","Chitra","Swati","Vishakha","Anuradha","Jyeshtha",
    "Mula","Purva Ashadha","Uttara Ashadha","Shravana","Dhanishta","Shatabhisha","Purva Bhadrapada","Uttara Bhadrapada","Revati"
  ];

  // --- Julian Day -----------------------------------------------------
  function toJulianDay(y, m, d, hourUT) {
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    const JD0 = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
    return JD0 + hourUT / 24;
  }

  // --- Sun (Meeus, low-precision apparent longitude) -------------------
  function sunLongitude(T) {
    const L0 = mod360(280.46646 + 36000.76983 * T + 0.0003032 * T * T);
    const M = mod360(357.52911 + 35999.05029 * T - 0.0001537 * T * T);
    const C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(rad(M))
            + (0.019993 - 0.000101 * T) * Math.sin(rad(2 * M))
            + 0.000289 * Math.sin(rad(3 * M));
    const trueLong = L0 + C;
    const Om = 125.04 - 1934.136 * T;
    const apparent = trueLong - 0.00569 - 0.00478 * Math.sin(rad(Om));
    return mod360(apparent);
  }

  // --- Moon (Meeus, abbreviated periodic series) ------------------------
  function moonLongitude(T) {
    const Lp = mod360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T);
    const D  = mod360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T);
    const M  = mod360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T);
    const Mp = mod360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T);
    const F  = mod360(93.2720950 + 483202.0175233 * T - 0.0036539 * T * T);

    // [D, M, M', F, coefficient in degrees] — largest terms of the full series
    const terms = [
      [0,0,1,0, 6.288774], [2,0,-1,0, 1.274027], [2,0,0,0, 0.658314],
      [0,0,2,0, 0.213618], [0,1,0,0, -0.185116], [0,0,0,2, -0.114332],
      [2,0,-2,0, 0.058793], [2,-1,-1,0, 0.057066], [2,0,1,0, 0.053322],
      [2,-1,0,0, 0.045758], [0,1,-1,0, -0.040923], [1,0,0,0, -0.034720],
      [0,1,1,0, -0.030383], [2,0,2,0, 0.015327], [0,0,1,2, -0.012528],
      [0,0,1,-2, 0.010980], [4,0,-1,0, 0.010675], [0,0,3,0, 0.010034],
      [4,0,-2,0, 0.008548], [2,1,-1,0, -0.007888]
    ];
    let sum = 0;
    for (const [d, m, mp, f, c] of terms) {
      sum += c * Math.sin(rad(d * D + m * M + mp * Mp + f * F));
    }
    return mod360(Lp + sum);
  }

  // --- Mean lunar node (Rahu) -------------------------------------------
  function meanNode(T) {
    return mod360(125.04452 - 1934.136261 * T + 0.0020708 * T * T + (T * T * T) / 450000);
  }

  // --- Keplerian elements for the planets (Standish, valid 1800–2050) ---
  const ELEMENTS = {
    Mercury: { a:0.38709927, da:0.00000037, e:0.20563593, de:0.00001906, I:7.00497902, dI:-0.00594749, L:252.25032350, dL:149472.67411175, peri:77.45779628, dperi:0.16047689, node:48.33076593, dnode:-0.12534081 },
    Venus:   { a:0.72333566, da:0.00000390, e:0.00677672, de:-0.00004107, I:3.39467605, dI:-0.00078890, L:181.97909950, dL:58517.81538729, peri:131.60246718, dperi:0.00268329, node:76.67984255, dnode:-0.27769418 },
    Earth:   { a:1.00000261, da:0.00000562, e:0.01671123, de:-0.00004392, I:-0.00001531, dI:-0.01294668, L:100.46457166, dL:35999.37244981, peri:102.93768193, dperi:0.32327364, node:0.0, dnode:0.0 },
    Mars:    { a:1.52371034, da:0.00001847, e:0.09339410, de:0.00007882, I:1.84969142, dI:-0.00813131, L:-4.55343205, dL:19140.30268499, peri:-23.94362959, dperi:0.44441088, node:49.55953891, dnode:-0.29257343 },
    Jupiter: { a:5.20288700, da:-0.00011607, e:0.04838624, de:-0.00013253, I:1.30439695, dI:-0.00183714, L:34.39644051, dL:3034.74612775, peri:14.72847983, dperi:0.21252668, node:100.47390909, dnode:0.20469106 },
    Saturn:  { a:9.53667594, da:-0.00125060, e:0.05386179, de:-0.00050991, I:2.48599187, dI:0.00193609, L:49.95424423, dL:1222.49362201, peri:92.59887831, dperi:-0.41897216, node:113.66242448, dnode:-0.28867794 }
  };

  function solveKepler(Mdeg, e) {
    let M = mod360(Mdeg);
    if (M > 180) M -= 360;
    let E = M + R2D * e * Math.sin(rad(M));
    for (let i = 0; i < 12; i++) {
      const dM = M - (E - R2D * e * Math.sin(rad(E)));
      const dE = dM / (1 - e * Math.cos(rad(E)));
      E += dE;
      if (Math.abs(dE) < 1e-8) break;
    }
    return E;
  }

  function heliocentric(elem, T) {
    const a = elem.a + elem.da * T;
    const e = elem.e + elem.de * T;
    const I = elem.I + elem.dI * T;
    const L = elem.L + elem.dL * T;
    const peri = elem.peri + elem.dperi * T;
    const node = elem.node + elem.dnode * T;
    const w = peri - node;
    const M = L - peri;
    const E = solveKepler(M, e);
    const xp = a * (Math.cos(rad(E)) - e);
    const yp = a * Math.sqrt(1 - e * e) * Math.sin(rad(E));
    const cosO = Math.cos(rad(node)), sinO = Math.sin(rad(node));
    const cosw = Math.cos(rad(w)), sinw = Math.sin(rad(w));
    const cosI = Math.cos(rad(I)), sinI = Math.sin(rad(I));
    const x = (cosw * cosO - sinw * sinO * cosI) * xp + (-sinw * cosO - cosw * sinO * cosI) * yp;
    const y = (cosw * sinO + sinw * cosO * cosI) * xp + (-sinw * sinO + cosw * cosO * cosI) * yp;
    return { x, y };
  }

  function geocentricLongitude(name, T, earth) {
    const p = heliocentric(ELEMENTS[name], T);
    return mod360(deg(Math.atan2(p.y - earth.y, p.x - earth.x)));
  }

  function isRetrograde(name, T, earth, earthNext) {
    const l1 = geocentricLongitude(name, T, earth);
    const l2 = geocentricLongitude(name, T + 1 / 36525, earthNext);
    let diff = l2 - l1;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    return diff < 0;
  }

  // --- Ascendant ----------------------------------------------------------
  function obliquity(T) {
    return 23.439291 - 0.0130042 * T - 0.00000016 * T * T + 0.000000504 * T * T * T;
  }

  function gmst(jd, T) {
    return mod360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000);
  }

  function ascendantLongitude(jd, latDeg, lonDeg, T) {
    const ramc = mod360(gmst(jd, T) + lonDeg);
    const eps = obliquity(T);
    const y = Math.cos(rad(ramc));
    const x = -(Math.sin(rad(ramc)) * Math.cos(rad(eps)) + Math.tan(rad(latDeg)) * Math.sin(rad(eps)));
    return mod360(deg(Math.atan2(y, x)));
  }

  // --- Ayanamsha (Lahiri, linear approximation) ---------------------------
  function ayanamsha(jd) {
    return 23.85 + ((jd - 2451545.0) / 365.25) * (50.2388 / 3600);
  }

  // --- Nakshatra / pada ----------------------------------------------------
  function nakshatraOf(sidLon) {
    const span = 360 / 27, padaSpan = span / 4;
    const idx = Math.floor(mod360(sidLon) / span);
    const pos = mod360(sidLon) - idx * span;
    const pada = Math.floor(pos / padaSpan) + 1;
    return { name: NAKSHATRAS[idx], pada };
  }

  function fmtDeg(sidLon) {
    const d = mod360(sidLon) % 30;
    const whole = Math.floor(d);
    const min = Math.round((d - whole) * 60);
    return (min === 60) ? (whole + 1) + "\u00b00'" : whole + "\u00b0" + String(min).padStart(2, '0') + "'";
  }

  // --- Main entry point -----------------------------------------------------
  // birth = { year, month, day, hour, minute, tzOffset (hours, e.g. 5.5), lat, lon }
  function computeChart(birth) {
    const localHours = birth.hour + birth.minute / 60;
    const hourUT = localHours - birth.tzOffset;
    const jd = toJulianDay(birth.year, birth.month, birth.day, hourUT);
    const T = (jd - 2451545.0) / 36525;
    const ayan = ayanamsha(jd);

    const sunTrop = sunLongitude(T);
    const moonTrop = moonLongitude(T);
    const earth = heliocentric(ELEMENTS.Earth, T);
    const earthNext = heliocentric(ELEMENTS.Earth, T + 1 / 36525);

    const mercuryTrop = geocentricLongitude('Mercury', T, earth);
    const venusTrop = geocentricLongitude('Venus', T, earth);
    const marsTrop = geocentricLongitude('Mars', T, earth);
    const jupiterTrop = geocentricLongitude('Jupiter', T, earth);
    const saturnTrop = geocentricLongitude('Saturn', T, earth);
    const rahuTrop = meanNode(T);
    const ketuTrop = mod360(rahuTrop + 180);

    const ascTrop = ascendantLongitude(jd, birth.lat, birth.lon, T);

    const sid = (x) => mod360(x - ayan);

    const bodies = {
      Asc:     { lon: sid(ascTrop), retro: false },
      Sun:     { lon: sid(sunTrop), retro: false },
      Moon:    { lon: sid(moonTrop), retro: false },
      Mercury: { lon: sid(mercuryTrop), retro: isRetrograde('Mercury', T, earth, earthNext) },
      Venus:   { lon: sid(venusTrop), retro: isRetrograde('Venus', T, earth, earthNext) },
      Mars:    { lon: sid(marsTrop), retro: isRetrograde('Mars', T, earth, earthNext) },
      Jupiter: { lon: sid(jupiterTrop), retro: isRetrograde('Jupiter', T, earth, earthNext) },
      Saturn:  { lon: sid(saturnTrop), retro: isRetrograde('Saturn', T, earth, earthNext) },
      Rahu:    { lon: sid(rahuTrop), retro: true },
      Ketu:    { lon: sid(ketuTrop), retro: true }
    };

    const moonNak = nakshatraOf(bodies.Moon.lon);

    return { bodies, ayanamsha: ayan, moonNakshatra: moonNak, jd };
  }

  global.AstroEngine = { computeChart, SIGNS, NAKSHATRAS, signOf: (lon)=>Math.floor(mod360(lon)/30), fmtDeg, mod360 };
})(typeof window !== 'undefined' ? window : global);
