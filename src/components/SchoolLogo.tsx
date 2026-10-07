import React from 'react';

interface SchoolLogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

/**
 * Biểu trưng chính thức TRƯỜNG TRUNG HỌC PHỔ THÔNG 25-10
 * Giữ nguyên bản gốc: Hình tròn xanh, đài đuốc đỏ rực, cuốn sách mở trắng viền đỏ và số 25 - 10 đỏ viền trắng.
 */
export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  className = '',
  size = 56,
  showText = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 240 240"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 drop-shadow-md select-none transition-transform hover:scale-105"
      >
        {/* Outer Dark Ring */}
        <circle cx="120" cy="120" r="118" fill="#000000" stroke="#000000" strokeWidth="2" />

        {/* Circular Solid Blue Background */}
        <circle cx="120" cy="120" r="116" fill="#0060b2" />

        {/* White Concentric Sun / Globe Arches Behind Book */}
        <path
          d="M 40 126 A 82 82 0 0 1 200 126"
          stroke="#ffffff"
          strokeWidth="6"
          fill="none"
          strokeLinecap="round"
        />
        <path
          d="M 52 126 A 70 70 0 0 1 188 126"
          stroke="#ffffff"
          strokeWidth="4"
          fill="none"
        />
        <path
          d="M 68 126 A 54 54 0 0 1 172 126"
          stroke="#ffffff"
          strokeWidth="4"
          strokeDasharray="5 7"
          fill="none"
        />

        {/* Torch Tower Structure */}
        {/* White Column */}
        <rect x="84" y="32" width="5" height="85" fill="#ffffff" />
        {/* Horizontal crossbar structure */}
        <rect x="74" y="82" width="16" height="4" fill="#ffffff" />
        <rect x="70" y="88" width="20" height="4" fill="#ffffff" />
        {/* Red Tower Shaft */}
        <rect x="88" y="48" width="6" height="68" fill="#e30613" />

        {/* Red Torch Flame with Gold Core */}
        <path
          d="M 91 10 C 78 22, 79 30, 91 38 C 103 30, 104 22, 91 10 Z"
          fill="#e30613"
        />
        <circle cx="91" cy="24" r="3.5" fill="#ffde00" />

        {/* Top Arc Text: TRUNG HỌC PHỔ THÔNG */}
        <defs>
          {/* Exact circular arc following the curve of the original logo */}
          <path
            id="thptLogoTextArc"
            d="M 92 36 A 90 90 0 0 1 228 140"
            fill="none"
          />
        </defs>
        <text
          fill="#ffffff"
          fontSize="17"
          fontWeight="bold"
          letterSpacing="2.2"
          fontFamily="system-ui, -apple-system, 'Plus Jakarta Sans', sans-serif"
        >
          <textPath href="#thptLogoTextArc" startOffset="10%">
            TRUNG HỌC PHỔ THÔNG
          </textPath>
        </text>

        {/* Stylized White Open Book spanning full width */}
        <g id="openBook">
          {/* Main Book Wings Body */}
          <path
            d="M 6 136 
               Q 65 106 120 128 
               Q 175 106 234 136 
               L 236 156 
               Q 175 124 128 146 
               L 128 158 
               L 120 158 
               L 112 158 
               L 112 146 
               Q 65 124 4 156 
               Z"
            fill="#ffffff"
          />
          {/* Red Top Border along the pages curve */}
          <path
            d="M 6 136 Q 65 106 120 128 Q 175 106 234 136"
            stroke="#e30613"
            strokeWidth="3.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Red Spine Bottom Notch */}
          <path
            d="M 106 148 L 120 162 L 134 148"
            stroke="#e30613"
            strokeWidth="2.5"
            fill="none"
          />
        </g>

        {/* Bottom Red Bold Text: 25 - 10 with thick crisp white border */}
        <g id="dateText" transform="translate(0, 16)">
          <text
            x="120"
            y="178"
            textAnchor="middle"
            fill="#e30613"
            stroke="#ffffff"
            strokeWidth="8"
            strokeLinejoin="round"
            paintOrder="stroke fill"
            fontSize="48"
            fontWeight="900"
            letterSpacing="2"
            fontFamily="Impact, Arial Black, system-ui, sans-serif"
          >
            25 - 10
          </text>
        </g>
      </svg>

      {showText && (
        <div className="flex flex-col leading-tight">
          <span className="text-xs uppercase tracking-wider text-sky-700 font-black">
            Trường THPT 25-10
          </span>
          <span className="text-sm font-black text-slate-950 tracking-wide">
            RUNG CHUÔNG VÀNG
          </span>
        </div>
      )}
    </div>
  );
};
