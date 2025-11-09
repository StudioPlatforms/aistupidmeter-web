'use client'

import { useEffect, useState } from 'react'

export default function HalloweenAnimations() {
  const [isHalloweenTheme, setIsHalloweenTheme] = useState(false)

  useEffect(() => {
    // Check if Halloween theme is active (index 0)
    const checkTheme = () => {
      if (typeof window === 'undefined') return
      const themeIndex = localStorage.getItem('retro-theme-index')
      const isHalloween = themeIndex === '0'
      setIsHalloweenTheme(isHalloween)
      
      // Set data attribute on body for CSS
      if (isHalloween) {
        document.body.setAttribute('data-halloween-theme', 'true')
      } else {
        document.body.removeAttribute('data-halloween-theme')
      }
    }

    // Check on mount
    checkTheme()

    // Listen for theme changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'retro-theme-index') {
        checkTheme()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    
    // Also check periodically in case theme changes in same tab
    const interval = setInterval(checkTheme, 1000)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [])

  if (!isHalloweenTheme) return null

  return (
    <div className="halloween-animations">
      {/* Floating Skeleton Heads - 5 total */}
      <div className="pixel-skull"></div>
      <div className="pixel-skull"></div>
      <div className="pixel-skull"></div>
      <div className="pixel-skull"></div>
      <div className="pixel-skull"></div>
      
      {/* Floating Ghosts - 5 total */}
      <div className="pixel-ghost"></div>
      <div className="pixel-ghost"></div>
      <div className="pixel-ghost"></div>
      <div className="pixel-ghost"></div>
      <div className="pixel-ghost"></div>
      
      {/* Bouncing Pumpkins */}
      <div className="pixel-pumpkin"></div>
      <div className="pixel-pumpkin"></div>
    </div>
  )
}
