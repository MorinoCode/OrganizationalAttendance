import React from "react"
import appLogo from "../assets/icon.png"

interface BrandLogoProps {
  className?: string
  size?: number
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = "h-11 w-11", size = 44 }) => {
  return (
    <img
      src={appLogo}
      alt="Logo"
      width={size}
      height={size}
      className={`rounded-xl object-contain drop-shadow-[0_2px_8px_rgba(214,171,91,0.25)] ${className}`}
    />
  )
}
