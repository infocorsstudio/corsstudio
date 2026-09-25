import { useState, useEffect, useRef } from 'react'
import { animate } from 'animejs'

const TextScramble = ({ text, onAnimationStart, onAnimationEnd, trigger = 0 }) => {
  const [displayText, setDisplayText] = useState(text)
  const [isAnimating, setIsAnimating] = useState(false)
  const animationRef = useRef(null)
  const targetTextRef = useRef(text)
  const progressRef = useRef({ value: 0 })
  const lastUpdateRef = useRef(0)

  const duration = 1100 // total duration of the animation in milliseconds
  const targetFPS = 40 // Target frame rate for text updates
  const frameInterval = 1000 / targetFPS // Time between frames in ms

  const getRandomChar = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789~!@#$%^&*()+=;:<>?/|"
    return chars[Math.floor(Math.random() * chars.length)]
  }

  const updateDisplayText = (progress) => {
    // Implement manual frame rate limiting
    const now = Date.now()
    if (now - lastUpdateRef.current < frameInterval) {
      return // Skip update if not enough time has passed
    }
    lastUpdateRef.current = now

    const numCorrectChars = Math.floor(progress * targetTextRef.current.length)
    let newDisplayText = ""

    for (let i = 0; i < targetTextRef.current.length; i++) {
      if (i < numCorrectChars) {
        newDisplayText += targetTextRef.current[i]
      } else if (targetTextRef.current[i] === ' ') {
        newDisplayText += ' '
      } else {
        newDisplayText += getRandomChar()
      }
    }

    setDisplayText(newDisplayText)
  }

  const startAnimation = () => {
    // Cancel any in-progress animation before starting a new one
    if (animationRef.current) {
      animationRef.current.pause()
      animationRef.current = null
    }

    setIsAnimating(true)
    progressRef.current.value = 0
    lastUpdateRef.current = 0 // Reset frame timing

    if (onAnimationStart) {
      onAnimationStart()
    }

    // Animate progress from 0 to 1
    animationRef.current = animate(progressRef.current, {
      value: 1,
      duration: duration,
      delay: 800,

      onUpdate: () => {
        updateDisplayText(progressRef.current.value)
      },
      onComplete: () => {
        setDisplayText(targetTextRef.current)
        setIsAnimating(false)
        animationRef.current = null
        if (onAnimationEnd) {
          onAnimationEnd()
        }
      }
    })
  }

  useEffect(() => {
    targetTextRef.current = text
    if (!isAnimating) {
      setDisplayText(text)
    }
  }, [text, isAnimating])

  useEffect(() => {
    // Start animation on mount or trigger change
    const timer = setTimeout(() => {
      startAnimation()
    }, 0)

    return () => {
      clearTimeout(timer)
      // If an animation was interrupted (paused without completing),
      // sync React state and notify the parent so it doesn't get stuck.
      if (animationRef.current) {
        animationRef.current.pause()
        animationRef.current = null
        setIsAnimating(false)
        if (onAnimationEnd) {
          onAnimationEnd()
        }
      }
    }
  }, [trigger]) // Re-run when trigger changes

  return <span>{displayText}</span>
}

export default TextScramble
