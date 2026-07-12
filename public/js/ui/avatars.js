// Avatars cartoon dessinés en SVG, déterministes à partir du pseudo.
// Les bots ont une tête de robot.

const PEAUX = ['#f5cba7', '#eab98c', '#d9a066', '#c68642', '#a56a3f'];
const CHEVEUX = ['#2c222b', '#5a3825', '#8c5a1e', '#b8860b', '#4a4a4a', '#7b3f00'];
const HAUTS = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#2ecc71', '#e67e22', '#1abc9c'];

function hash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

function coiffure(style, cheveux) {
  switch (style) {
    case 0: // casque court
      return `<path d="M20 38 a20 20 0 0 1 40 0 l-4 0 a16 17 0 0 0 -32 0 z" fill="${cheveux}"/>`;
    case 1: // carré / bob
      return `<path d="M18 48 a22 25 0 0 1 44 0 l-7 3 a16 19 0 0 0 -30 0 z" fill="${cheveux}"/>`;
    case 2: // bouclé
      return ['24,26', '32,20', '40,18', '48,20', '56,26']
        .map((p) => `<circle cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="8" fill="${cheveux}"/>`)
        .join('');
    case 3: // chapeau
      return `<rect x="18" y="24" width="44" height="6" rx="3" fill="#3a3a3a"/>
              <path d="M26 26 a14 12 0 0 1 28 0 z" fill="#4a4a4a"/>`;
    default: // mèche
      return `<path d="M20 36 a20 20 0 0 1 40 0 q-10 -8 -20 -6 q-12 2 -20 6 z" fill="${cheveux}"/>`;
  }
}

export function renderAvatar(name, isBot) {
  const wrap = document.createElement('div');
  wrap.className = 'avatar';
  const h = hash(name || '?');
  if (isBot) {
    const teinte = HAUTS[h % HAUTS.length];
    wrap.innerHTML = `
    <svg viewBox="0 0 80 80" aria-hidden="true">
      <rect width="80" height="80" fill="#dfe8f2"/>
      <line x1="40" y1="8" x2="40" y2="17" stroke="#7d8b9c" stroke-width="3"/>
      <circle cx="40" cy="7" r="3.5" fill="${teinte}"/>
      <rect x="18" y="17" width="44" height="36" rx="9" fill="#a9bccf"/>
      <rect x="22" y="21" width="36" height="28" rx="6" fill="#8ba3ba"/>
      <rect x="27" y="27" width="9" height="9" rx="2" fill="#173042"/>
      <rect x="44" y="27" width="9" height="9" rx="2" fill="#173042"/>
      <rect x="31" y="42" width="18" height="4" rx="2" fill="#173042"/>
      <rect x="22" y="57" width="36" height="20" rx="7" fill="${teinte}"/>
    </svg>`;
    return wrap;
  }
  const peau = PEAUX[h % PEAUX.length];
  const cheveux = CHEVEUX[(h >> 3) % CHEVEUX.length];
  const haut = HAUTS[(h >> 6) % HAUTS.length];
  const style = (h >> 9) % 5;
  const fond = HAUTS[(h >> 12) % HAUTS.length];
  wrap.innerHTML = `
  <svg viewBox="0 0 80 80" aria-hidden="true">
    <rect width="80" height="80" fill="${fond}" opacity="0.25"/>
    <ellipse cx="40" cy="82" rx="27" ry="19" fill="${haut}"/>
    <circle cx="40" cy="38" r="20" fill="${peau}"/>
    ${coiffure(style, cheveux)}
    <circle cx="33" cy="38" r="2.4" fill="#26221f"/>
    <circle cx="47" cy="38" r="2.4" fill="#26221f"/>
    <path d="M34 47 q6 5 12 0" stroke="#8a4b2d" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`;
  return wrap;
}
