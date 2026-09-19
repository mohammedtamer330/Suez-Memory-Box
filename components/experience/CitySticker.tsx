import type { City } from "@/lib/types";

/**
 * Six travel artifacts, each with its own object type, shape and printing style:
 *   Cairo – die-cut luggage decal · Giza – passport stamp on a paper tag · Dahab – faded beach sticker
 *   Alexandria – coastal postcard label (perforated) · Suez – shipping/port decal · Sharm – faded resort decal
 * Inline SVG (no images), one shared "worn" filter for imperfect edges + scuffs.
 */
export function StickerDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden focusable="false">
      <defs>
        {/* wobbly die-cut edge + scratched-off print */}
        <filter id="s26-worn" x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" result="warp" />
          <feDisplacementMap in="SourceGraphic" in2="warp" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="edge" />
          <feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="9" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -30 23.4" result="holes" />
          <feComposite in="edge" in2="holes" operator="in" />
        </filter>
        <filter id="s26-ink" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves="2" seed="2" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -30 23.0" result="m" />
          <feComposite in="SourceGraphic" in2="m" operator="in" />
        </filter>
      </defs>
    </svg>
  );
}

const F = "var(--font-display), Georgia, serif";
const cream = "#ecdfc2";

function Pyramids({ x = 0, y = 0, s = 1, c1 = "#c88a4f", c2 = "#a96c3c" }: { x?: number; y?: number; s?: number; c1?: string; c2?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M0 60 L38 4 L76 60Z" fill={c1} /><path d="M38 4 L76 60 L48 60Z" fill={c2} />
      <path d="M58 60 L86 22 L114 60Z" fill={c1} /><path d="M86 22 L114 60 L94 60Z" fill={c2} />
    </g>
  );
}

function Cairo() {
  return (
    <svg viewBox="0 0 220 170" role="img" aria-label="Cairo">
      <g filter="url(#s26-worn)">
        <rect x="4" y="4" width="212" height="162" rx="26" fill={cream} />
        <rect x="13" y="13" width="194" height="144" rx="19" fill="#e0a565" />
        <rect x="13" y="13" width="194" height="70" rx="19" fill="#eab777" />
        <circle cx="150" cy="52" r="20" fill="#f3d49a" />
        <path d="M13 108 Q60 92 110 104 T207 100 V157 H13Z" fill="#c98a4a" />
        <Pyramids x={26} y={58} s={1.05} />
        <g fill="#6d4a30">
          <rect x="154" y="62" width="7" height="46" /><path d="M152 62 Q157.5 46 163 62Z" /><rect x="151" y="72" width="13" height="3" />
          <rect x="176" y="76" width="6" height="34" /><path d="M174.5 76 Q179 64 183.5 76Z" />
        </g>
        <path d="M13 118 H207 V157 H13Z" fill="#33485a" />
        <text x="110" y="145" textAnchor="middle" fontFamily={F} fontWeight="800" fontSize="34" letterSpacing="4" fill={cream}>CAIRO</text>
        <path d="M30 124 H190" stroke={cream} strokeWidth="1.2" strokeDasharray="2 4" opacity=".7" />
      </g>
    </svg>
  );
}

function Giza() {
  // a paper luggage tag with an ink passport stamp
  const ink = "#3d5f78";
  return (
    <svg viewBox="0 0 190 230" role="img" aria-label="Giza">
      <g filter="url(#s26-worn)">
        <path d="M30 6 H160 Q184 6 184 30 V204 Q184 224 164 224 H26 Q6 224 6 204 V30 Q6 6 30 6Z" fill="#e4d4b2" />
        <circle cx="95" cy="24" r="8" fill="#15110c" />
        <path d="M95 24 Q40 -6 24 42" fill="none" stroke="#a47c4d" strokeWidth="2.4" />
      </g>
      <g filter="url(#s26-ink)" transform="rotate(-9 95 130)" fill="none" stroke={ink} strokeLinecap="round">
        <circle cx="95" cy="132" r="72" strokeWidth="4" /><circle cx="95" cy="132" r="63" strokeWidth="1.5" />
        <g fill={ink} stroke="none"><path d="M58 150 L92 96 L126 150Z" /><path d="M96 150 L120 116 L144 150Z" opacity=".75" /><rect x="52" y="152" width="86" height="3" /></g>
        <path id="s26-giza-top" d="M40 132 A55 55 0 0 1 150 132" stroke="none" />
        <text fontFamily={F} fontWeight="800" fontSize="15" letterSpacing="3" fill={ink} stroke="none"><textPath href="#s26-giza-top" startOffset="50%" textAnchor="middle">EXPEDITION</textPath></text>
        <path id="s26-giza-bot" d="M38 132 A57 57 0 0 0 152 132" stroke="none" />
        <text fontFamily={F} fontWeight="700" fontSize="12" letterSpacing="4" fill={ink} stroke="none"><textPath href="#s26-giza-bot" startOffset="50%" textAnchor="middle">ADMITTED</textPath></text>
        <text x="95" y="182" textAnchor="middle" fontFamily={F} fontWeight="900" fontSize="26" letterSpacing="5" fill={ink} stroke="none">GIZA</text>
        <rect x="22" y="196" width="146" height="20" rx="3" strokeWidth="2.2" transform="rotate(4 95 206)" />
      </g>
    </svg>
  );
}

function Dahab() {
  return (
    <svg viewBox="0 0 190 230" role="img" aria-label="Dahab">
      <g filter="url(#s26-worn)">
        <path d="M6 224 V88 Q6 6 95 6 Q184 6 184 88 V224Z" fill={cream} />
        <path d="M16 214 V90 Q16 16 95 16 Q174 16 174 90 V214Z" fill="#7fb0b8" />
        <path d="M16 16 H174 V120 H16Z" fill="#cfe0d4" opacity=".0" />
        <circle cx="95" cy="88" r="44" fill="#f0c87a" opacity=".92" />
        <circle cx="95" cy="88" r="32" fill="#ecae5f" />
        <path d="M16 128 Q55 112 95 128 T174 126 V214 H16Z" fill="#5f9fab" />
        <path d="M16 150 Q55 136 95 150 T174 148 V214 H16Z" fill="#478d9c" />
        <path d="M16 172 Q55 160 95 172 T174 170 V214 H16Z" fill="#387b8c" />
        <g fill="#2e3a34">
          <path d="M42 200 Q47 150 50 116 L54 116 Q54 150 52 200Z" /><path d="M50 118 Q30 100 14 112 Q34 104 50 122 Q40 96 24 92 Q46 96 52 118 Q66 92 86 96 Q62 100 54 122 Q78 110 92 128 Q68 114 54 124Z" />
          <path d="M142 200 Q140 158 138 130 L142 130 Q146 160 148 200Z" /><path d="M140 132 Q124 116 108 124 Q126 118 140 136 Q134 112 120 106 Q140 112 142 132 Q154 112 170 116 Q150 118 143 136Z" />
        </g>
        <text x="95" y="206" textAnchor="middle" fontFamily={F} fontWeight="800" fontSize="34" letterSpacing="3" fill={cream}>DAHAB</text>
      </g>
    </svg>
  );
}

function Alexandria() {
  const holes = Array.from({ length: 11 }, (_, i) => 14 + i * 18.5);
  const side = Array.from({ length: 8 }, (_, i) => 14 + i * 18.5);
  return (
    <svg viewBox="0 0 220 210" role="img" aria-label="Alexandria">
      <g filter="url(#s26-worn)">
        <rect x="4" y="4" width="212" height="202" fill={cream} />
        <g fill="#0e1622">
          {holes.map((x) => <circle key={"t" + x} cx={x + 4} cy="4" r="4.4" />)}
          {holes.map((x) => <circle key={"b" + x} cx={x + 4} cy="206" r="4.4" />)}
          {side.map((y) => <circle key={"l" + y} cx="4" cy={y + 6} r="4.4" />)}
          {side.map((y) => <circle key={"r" + y} cx="216" cy={y + 6} r="4.4" />)}
        </g>
        <rect x="18" y="18" width="184" height="174" fill="#dccb9f" />
        <rect x="24" y="24" width="172" height="112" fill="#8fb1bf" />
        <rect x="24" y="24" width="172" height="52" fill="#b9d0d2" />
        <circle cx="160" cy="46" r="15" fill="#f1dca6" />
        <path d="M24 100 Q60 90 100 100 T196 98 V136 H24Z" fill="#5e8fa6" />
        <path d="M24 114 Q60 106 100 114 T196 112 V136 H24Z" fill="#457b95" />
        <g fill="#f0e6cc">
          <path d="M86 122 L90 70 H120 L124 122Z" /><rect x="94" y="52" width="22" height="20" /><rect x="98" y="40" width="14" height="14" /><path d="M96 40 L105 28 L114 40Z" />
        </g>
        <g fill="#b98a55"><rect x="94" y="76" width="22" height="2.5" /><rect x="92" y="94" width="26" height="2.5" /><rect x="102" y="44" width="6" height="8" fill="#e7b05a" /></g>
        <path d="M60 124 H150 L158 136 H52Z" fill="#8a6a49" />
        <text x="110" y="162" textAnchor="middle" fontFamily={F} fontStyle="italic" fontWeight="500" fontSize="13" letterSpacing="2" fill="#5b4632">Greetings from</text>
        <text x="110" y="184" textAnchor="middle" fontFamily={F} fontWeight="800" fontSize="24" letterSpacing="2.5" fill="#a8482f">ALEXANDRIA</text>
      </g>
    </svg>
  );
}

function Suez() {
  return (
    <svg viewBox="0 0 200 220" role="img" aria-label="Suez">
      <g filter="url(#s26-worn)">
        <path d="M22 4 H178 Q196 4 196 22 V198 Q196 216 178 216 H22 Q4 216 4 198 V22 Q4 4 22 4Z" fill={cream} />
        <path d="M18 18 H182 V202 H18Z" fill="#274a63" />
        <path d="M18 18 H182 V64 H18Z" fill="#d0653f" />
        <g fill="#f2e5c6" opacity=".95">{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${14 + i * 16} 18 l10 0 l-22 46 l-10 0Z`} opacity=".16" />)}</g>
        <text x="100" y="52" textAnchor="middle" fontFamily={F} fontWeight="900" fontSize="34" letterSpacing="7" fill={cream}>SUEZ</text>
        <circle cx="146" cy="86" r="15" fill="#e8b866" opacity=".9" />
        <path d="M18 128 Q50 118 84 128 T150 126 T182 128 V202 H18Z" fill="#1d3a50" />
        <g fill="#f0e4c4">
          <path d="M40 132 H150 L138 152 H54Z" /><rect x="66" y="112" width="60" height="20" /><rect x="112" y="98" width="12" height="16" /><rect x="116" y="88" width="5" height="10" />
        </g>
        <g><rect x="70" y="116" width="10" height="12" fill="#d0653f" /><rect x="82" y="116" width="10" height="12" fill="#6b91a6" /><rect x="94" y="116" width="10" height="12" fill="#d4b15a" /></g>
        <path d="M18 156 Q50 148 84 156 T150 154 T182 156 V202 H18Z" fill="#2f5d7a" />
        <path d="M18 176 Q50 168 84 176 T150 174 T182 176 V202 H18Z" fill="#3b7391" opacity=".8" />
        <text x="100" y="196" textAnchor="middle" fontFamily={F} fontWeight="700" fontSize="14" letterSpacing="5" fill={cream}>PORT · CANAL</text>
      </g>
    </svg>
  );
}

function Sharm() {
  return (
    <svg viewBox="0 0 200 230" role="img" aria-label="Sharm El Sheikh">
      <g filter="url(#s26-worn)">
        <path d="M6 224 V96 Q6 6 100 6 Q194 6 194 96 V224Z" fill={cream} />
        <path d="M16 214 V98 Q16 16 100 16 Q184 16 184 98 V214Z" fill="#7fb9c9" />
        <circle cx="100" cy="96" r="50" fill="#f3d38e" />
        <g stroke="#f3d38e" strokeWidth="5" strokeLinecap="round">{Array.from({ length: 14 }, (_, i) => { const a = (i / 14) * Math.PI - Math.PI; const r = (n: number) => Math.round(n * 100) / 100; const x1 = r(100 + Math.cos(a) * 58), y1 = r(96 + Math.sin(a) * 58), x2 = r(100 + Math.cos(a) * 72), y2 = r(96 + Math.sin(a) * 72); return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />; })}</g>
        <circle cx="100" cy="96" r="38" fill="#ef9f5a" />
        <path d="M16 118 Q58 100 100 118 T184 116 V214 H16Z" fill="#4c9bb5" />
        <path d="M16 146 Q58 130 100 146 T184 144 V214 H16Z" fill="#2f86a5" />
        <path d="M16 174 Q58 160 100 174 T184 172 V214 H16Z" fill="#1f708f" />
        <g fill="#204a4a"><path d="M98 172 Q102 140 104 108 L108 108 Q108 140 106 172Z" /><path d="M104 110 Q82 90 60 102 Q84 96 104 116 Q96 84 74 80 Q102 84 106 110 Q124 82 148 90 Q118 94 108 114 Q134 104 152 122 Q124 108 108 116Z" /></g>
        <path id="s26-sharm-arc" d="M34 100 A66 66 0 0 1 166 100" fill="none" />
        <text fontFamily={F} fontWeight="800" fontSize="17" letterSpacing="2" fill="#1c3f52"><textPath href="#s26-sharm-arc" startOffset="50%" textAnchor="middle">SHARM EL SHEIKH</textPath></text>
        <text x="100" y="204" textAnchor="middle" fontFamily={F} fontWeight="700" fontSize="11" letterSpacing="5" fill={cream}>RED SEA</text>
      </g>
    </svg>
  );
}

const MAP: Record<City["id"], () => React.JSX.Element> = { cairo: Cairo, giza: Giza, dahab: Dahab, alexandria: Alexandria, suez: Suez, sharm: Sharm };

export function CitySticker({ id, className = "" }: { id: City["id"]; className?: string }) {
  const C = MAP[id];
  return <span className={`sticker sticker--${id} ${className}`}><C /></span>;
}
