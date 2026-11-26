import React from "react"

interface BrandLogoProps {
  className?: string
  size?: number
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = "h-11 w-11", size = 44 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bgGrad" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#241a10" />
          <stop offset="50%" stopColor="#14100c" />
          <stop offset="100%" stopColor="#0a0805" />
        </linearGradient>

        <linearGradient id="goldBorder" x1="0" y1="0" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffe49e" />
          <stop offset="30%" stopColor="#d4af37" />
          <stop offset="70%" stopColor="#8a5a18" />
          <stop offset="100%" stopColor="#e6c98a" />
        </linearGradient>

        <linearGradient id="goldCore" x1="8" y1="8" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fff3d1" />
          <stop offset="25%" stopColor="#f3cf7a" />
          <stop offset="50%" stopColor="#c59235" />
          <stop offset="80%" stopColor="#9e6e20" />
          <stop offset="100%" stopColor="#ffd885" />
        </linearGradient>

        <linearGradient id="goldWing" x1="12" y1="12" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#e6c98a" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#8a5d1b" stopOpacity="0.4" />
        </linearGradient>

        <radialGradient id="emeraldPulse" cx="37" cy="37" r="5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#78dcbc" />
          <stop offset="60%" stopColor="#2ba688" />
          <stop offset="100%" stopColor="#125242" />
        </radialGradient>

        <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="#d4af37" floodOpacity="0.35" />
        </filter>
      </defs>

      <rect
        x="1"
        y="1"
        width="42"
        height="42"
        rx="11"
        fill="url(#bgGrad)"
        stroke="url(#goldBorder)"
        strokeWidth="1.2"
      />

      <rect
        x="3"
        y="3"
        width="38"
        height="38"
        rx="9"
        fill="none"
        stroke="rgba(214,171,91,0.15)"
        strokeWidth="0.8"
      />

      <circle
        cx="22"
        cy="22"
        r="13"
        stroke="url(#goldWing)"
        strokeWidth="1.2"
        strokeDasharray="2 3"
      />

      <g filter="url(#goldGlow)">
        <path
          d="M22 10L31 15V24C31 29.5 27.2 33.8 22 35C16.8 33.8 13 29.5 13 24V15L22 10Z"
          fill="rgba(214,171,91,0.08)"
          stroke="url(#goldCore)"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />

        <path
          d="M22 13.5L28.5 17.2V23.5C28.5 27.5 25.8 30.6 22 31.8C18.2 30.6 15.5 27.5 15.5 23.5V17.2L22 13.5Z"
          fill="none"
          stroke="url(#goldCore)"
          strokeWidth="0.8"
          strokeOpacity="0.6"
        />

        <circle cx="22" cy="22" r="2" fill="url(#goldCore)" />

        <path
          d="M22 22L17.8 18"
          stroke="url(#goldCore)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        <path
          d="M22 22L26.5 16.5"
          stroke="url(#goldCore)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />

        <path
          d="M20 23.8L21.4 25.2L25 21"
          stroke="#78dcbc"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <circle
        cx="37.5"
        cy="37.5"
        r="3.5"
        fill="url(#emeraldPulse)"
        stroke="#0b0a08"
        strokeWidth="1.5"
      />
    </svg>
  )
}
