import type { LandmarkSilhouetteType } from '../../lib/destinationMedia'

interface LandmarkWatermarkProps {
  type: LandmarkSilhouetteType
  className?: string
}

export default function LandmarkWatermark({
  type,
  className = '',
}: LandmarkWatermarkProps) {
  return (
    <svg
      viewBox="0 0 600 140"
      fill="currentColor"
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      preserveAspectRatio="xMidYMax meet"
    >
      {type === 'new_york' && (
        <g>
          {/* Horizon Base */}
          <rect x="0" y="134" width="600" height="6" opacity="0.5" />
          {/* Lower Manhattan Skyscrapers Left */}
          <rect x="28" y="84" width="22" height="50" />
          <rect x="54" y="68" width="26" height="66" />
          <polygon points="67,44 56,68 78,68" />
          <rect x="86" y="92" width="18" height="42" />
          {/* Empire State Building */}
          <rect x="114" y="54" width="32" height="80" />
          <rect x="120" y="38" width="20" height="16" />
          <rect x="126" y="26" width="8" height="12" />
          <rect x="129" y="8" width="2" height="18" />
          {/* Midtown Towers */}
          <rect x="154" y="74" width="24" height="60" />
          <rect x="184" y="62" width="28" height="72" />
          <rect x="218" y="88" width="20" height="46" />
          {/* Brooklyn Bridge cables center-right */}
          <rect x="330" y="72" width="14" height="62" />
          <rect x="420" y="72" width="14" height="62" />
          <path
            d="M300,120 Q337,76 337,76 Q382,118 427,76 Q427,76 465,120"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
          {/* Statue of Liberty Silhouette Right */}
          <rect x="488" y="96" width="36" height="38" />
          <rect x="494" y="82" width="24" height="14" />
          <polygon points="506,42 496,82 516,82" />
          {/* Raised Torch Arm */}
          <line x1="512" y1="54" x2="522" y2="26" stroke="currentColor" strokeWidth="4" />
          <circle cx="523" cy="22" r="5" />
          {/* Crown Rays */}
          <circle cx="506" cy="44" r="6" />
          <rect x="542" y="78" width="26" height="56" />
        </g>
      )}

      {type === 'bali' && (
        <g>
          <rect x="0" y="134" width="600" height="6" opacity="0.5" />
          {/* Sun disc behind Pura */}
          <circle cx="300" cy="70" r="42" opacity="0.25" />
          {/* Candi Bentar (Split Gate) Left */}
          <polygon points="95,134 95,46 65,134" />
          <rect x="83" y="64" width="12" height="70" />
          <rect x="77" y="84" width="18" height="8" />
          <rect x="72" y="104" width="23" height="8" />
          {/* Candi Bentar (Split Gate) Right */}
          <polygon points="125,134 125,46 155,134" />
          <rect x="125" y="64" width="12" height="70" />
          <rect x="125" y="84" width="18" height="8" />
          <rect x="125" y="104" width="23" height="8" />
          {/* Pura Ulun Danu Meru Pagoda Roofs (Right Side) */}
          <rect x="446" y="112" width="68" height="22" />
          <polygon points="434,112 480,96 526,112" />
          <polygon points="440,94 480,78 520,94" />
          <polygon points="446,76 480,62 514,76" />
          <polygon points="452,60 480,46 508,60" />
          <polygon points="460,44 480,30 500,44" />
          <polygon points="468,30 480,14 492,30" />
          {/* Secondary Small Meru */}
          <rect x="536" y="118" width="40" height="16" />
          <polygon points="528,118 556,104 584,118" />
          <polygon points="534,102 556,88 578,102" />
          <polygon points="542,86 556,72 570,86" />
        </g>
      )}

      {type === 'jakarta' && (
        <g>
          <rect x="0" y="134" width="600" height="6" opacity="0.5" />
          {/* Sudirman Towers Left */}
          <rect x="34" y="76" width="26" height="58" />
          <rect x="66" y="58" width="30" height="76" />
          {/* Wisma 46 Fountain Pen Peak */}
          <rect x="106" y="52" width="28" height="82" />
          <polygon points="120,20 106,52 134,52" />
          <rect x="142" y="84" width="24" height="50" />
          {/* Monas (Monumen Nasional) */}
          <polygon points="448,134 462,112 518,112 532,134" />
          <rect x="478" y="104" width="24" height="10" />
          <polygon points="460,104 474,90 506,90 520,104" />
          <rect x="485" y="32" width="10" height="58" />
          <rect x="480" y="26" width="20" height="6" />
          {/* Flame of Monas */}
          <circle cx="490" cy="18" r="7" />
          <polygon points="490,6 483,18 497,18" />
          {/* Right Skyscrapers */}
          <rect x="544" y="68" width="28" height="66" />
        </g>
      )}

      {type === 'yogyakarta' && (
        <g>
          <rect x="0" y="134" width="600" height="6" opacity="0.5" />
          {/* Tugu Jogja Left */}
          <rect x="76" y="114" width="36" height="20" />
          <rect x="84" y="92" width="20" height="22" />
          <rect x="80" y="86" width="28" height="6" />
          <polygon points="94,32 86,86 102,86" />
          <circle cx="94" cy="28" r="4" />
          {/* Prambanan / Borobudur Stupas Right */}
          <polygon points="420,134 445,68 470,134" />
          <polygon points="462,134 500,26 538,134" />
          <polygon points="530,134 555,68 580,134" />
        </g>
      )}

      {type === 'singapore' && (
        <g>
          <rect x="0" y="134" width="600" height="6" opacity="0.5" />
          {/* Marina Bay Sands 3 Towers + SkyPark */}
          <polygon points="420,134 428,44 446,44 442,134" />
          <polygon points="466,134 472,44 490,44 488,134" />
          <polygon points="512,134 516,44 534,44 534,134" />
          {/* SkyPark Boat Roof */}
          <path d="M412,44 Q480,34 556,42 L546,50 L416,50 Z" />
          {/* Singapore Flyer Wheel Left */}
          <circle cx="110" cy="84" r="42" fill="none" stroke="currentColor" strokeWidth="4" />
          <circle cx="110" cy="84" r="6" />
          <line x1="110" y1="84" x2="90" y2="134" stroke="currentColor" strokeWidth="4" />
          <line x1="110" y1="84" x2="130" y2="134" stroke="currentColor" strokeWidth="4" />
        </g>
      )}

      {type === 'kuala_lumpur' && (
        <g>
          <rect x="0" y="134" width="600" height="6" opacity="0.5" />
          {/* Petronas Twin Towers */}
          <rect x="440" y="56" width="28" height="78" />
          <rect x="445" y="36" width="18" height="20" />
          <polygon points="454,8 448,36 460,36" />
          {/* Skybridge */}
          <rect x="468" y="82" width="24" height="6" />
          {/* Tower 2 */}
          <rect x="492" y="56" width="28" height="78" />
          <rect x="497" y="36" width="18" height="20" />
          <polygon points="506,8 500,36 512,36" />
          {/* KL Tower Left */}
          <rect x="96" y="54" width="8" height="80" />
          <ellipse cx="100" cy="48" rx="16" ry="8" />
          <line x1="100" y1="16" x2="100" y2="40" stroke="currentColor" strokeWidth="3" />
        </g>
      )}

      {(type === 'island' || type === 'skyline') && (
        <g>
          <rect x="0" y="134" width="600" height="6" opacity="0.5" />
          {type === 'island' ? (
            <>
              <circle cx="490" cy="58" r="28" opacity="0.3" />
              <polygon points="30,134 115,62 210,134" />
              <polygon points="150,134 235,78 310,134" opacity="0.7" />
              <polygon points="390,134 475,54 575,134" />
            </>
          ) : (
            <>
              <rect x="36" y="78" width="26" height="56" />
              <rect x="68" y="54" width="32" height="80" />
              <rect x="108" y="70" width="24" height="64" />
              <rect x="430" y="64" width="28" height="70" />
              <rect x="466" y="42" width="34" height="92" />
              <polygon points="483,20 466,42 500,42" />
              <rect x="508" y="74" width="28" height="60" />
            </>
          )}
        </g>
      )}
    </svg>
  )
}

