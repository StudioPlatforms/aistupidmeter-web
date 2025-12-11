'use client'

import { useEffect, useState } from 'react'

export default function ChristmasAnimations() {
  const [isChristmasTheme, setIsChristmasTheme] = useState(false)

  useEffect(() => {
    // Check if Christmas theme is active (index 1)
    const checkTheme = () => {
      if (typeof window === 'undefined') return
      const themeIndex = localStorage.getItem('retro-theme-index')
      const isChristmas = themeIndex === '1'
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
      {/* Falling Snowflakes - 10 total */}
      <div className="snowflake">❄</div>
      <div className="snowflake">❅</div>
      <div className="snowflake">❆</div>
      <div className="snowflake">❄</div>
      <div className="snowflake">❅</div>
      <div className="snowflake">❆</div>
      <div className="snowflake">❄</div>
      <div className="snowflake">❅</div>
      <div className="snowflake">❆</div>
      <div className="snowflake">❄</div>
      
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
