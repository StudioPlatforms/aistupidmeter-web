'use client'

import { useEffect, useState } from 'react'

export default function ChristmasAnimations() {
  const [isChristmasTheme, setIsChristmasTheme] = useState(false)
  const [windowWidth, setWindowWidth] = useState(1920)
  const [snowflakes, setSnowflakes] = useState<Array<{
    id: number
    position: number // 0-100 percentage
    delay: number
    duration: number
    size: number
    char: string
  }>>([])

  useEffect(() => {
    // Generate random snowflake data once on mount
    if (typeof window !== 'undefined') {
      const flakes = Array.from({ length: 10 }, (_, i) => ({
        id: i,
        position: Math.random() * 100, // 0% to 100%
        delay: Math.random() * 5, // 0 to 5 seconds
        duration: 10 + Math.random() * 8, // 10 to 18 seconds  
        size: 14 + Math.random() * 12, // 14px to 26px
        char: ['❄', '❅', '❆'][Math.floor(Math.random() * 3)]
      }))
      setSnowflakes(flakes)
    }
  }, [])

  useEffect(() => {
    // Set initial window width
    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth)
      
      // Update on resize to keep snowflakes spanning full width
      const handleResize = () => {
        setWindowWidth(window.innerWidth)
      }
      
      window.addEventListener('resize', handleResize)
      return () => window.removeEventListener('resize', handleResize)
    }
  }, [])

  useEffect(() => {
    // Check if Christmas theme is active (index 1)
    const checkTheme = () => {
      if (typeof window === 'undefined') return
      const themeIndex = localStorage.getItem('retro-theme-index')
      
      // For new users (no localStorage), check if December for default Christmas
      let isChristmas = themeIndex === '1'
      if (!themeIndex) {
        const month = new Date().getMonth()
        isChristmas = month === 11 // December = Christmas season (auto-activated)
      }
      
      setIsChristmasTheme(isChristmas)
      
      // Set data attribute on body for CSS
      if (isChristmas) {
        document.body.setAttribute('data-christmas-theme', 'true')
      } else {
        document.body.removeAttribute('data-christmas-theme')
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

  if (!isChristmasTheme) return null

  return (
    <div className="christmas-animations">
      {/* Falling Snowflakes - randomly positioned across full screen width */}
      {snowflakes.map((flake) => {
        // Calculate pixel position from stored percentage (0-100%)
        // This ensures snowflakes span the ENTIRE viewport width
        const leftPosition = (windowWidth * flake.position) / 100
        
        return (
          <div 
            key={flake.id}
            className="snowflake"
            style={{
              left: `${leftPosition}px`,
              animationDelay: `${flake.delay}s`,
              animationDuration: `${flake.duration}s`,
              fontSize: `${flake.size}px`
            }}
          >
            {flake.char}
          </div>
        );
      })}
      
      {/* Twinkling Christmas Lights - Top bar */}
      <div className="christmas-lights">
        <div className="light red"></div>
        <div className="light gold"></div>
        <div className="light green"></div>
        <div className="light blue"></div>
        <div className="light red"></div>
        <div className="light gold"></div>
        <div className="light green"></div>
        <div className="light blue"></div>
        <div className="light red"></div>
        <div className="light gold"></div>
      </div>
      
      {/* Floating Ornaments */}
      <div className="pixel-ornament red"></div>
      <div className="pixel-ornament gold"></div>
      <div className="pixel-ornament red"></div>
    </div>
  )
}
