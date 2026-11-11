import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import works from 'virtual:featured-works'
import './FeaturedWorks.css'

// Fractions down the viewport. 0 is the top edge, 1 is the bottom edge.
const FADE_IN_START = 0.5
const FADE_IN_END = 0.4

// Section top crossing 50% → 40% fades in. No fade out: the frame stays
// centered until section 3's bottom edge pushes it off the screen.
const opacityFor = (sectionTop) => {
  if (sectionTop <= FADE_IN_END) return 1
  if (sectionTop < FADE_IN_START) {
    return (FADE_IN_START - sectionTop) / (FADE_IN_START - FADE_IN_END)
  }
  return 0
}

const placeFrame = (frame, sectionBottom) => {
  const height = frame.offsetHeight
  const centeredTop = (window.innerHeight - height) / 2
  const carriedTop = sectionBottom - height
  frame.style.top = `${Math.min(centeredTop, carriedTop)}px`
}

// One shuffled pass: each file appears once, then the scroll loops that order.
const slides = (() => {
  const list = [...new Set(works)].map((src) => {
    const file = decodeURIComponent(src.split('/').pop() || '')
    const base = file.replace(/\.[^.]+$/, '')
    const splitAt = base.indexOf('_')
    const author = splitAt === -1 ? base : base.slice(0, splitAt).trim()
    const title = splitAt === -1 ? '' : base.slice(splitAt + 1).trim()
    return { src, author, title }
  })
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const item = list[i]
    list[i] = list[j]
    list[j] = item
  }
  return list
})()

const FeaturedWorks = () => {
  const frameRef = useRef(null)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    const frame = frameRef.current
    // Scroll progress follows the section this frame sits in.
    const section = frame?.parentElement || frame
    if (!section || slides.length === 0) return
    let raf = 0
    const update = () => {
      raf = 0
      const rect = section.getBoundingClientRect()
      const vh = window.innerHeight
      const start = section.offsetTop - vh
      const distance = section.offsetHeight + vh
      const p = Math.min(1, Math.max(0, (window.scrollY - start) / distance))
      const count = slides.length
      const next = Math.min(count - 1, Math.floor(p * count))
      frame.style.opacity = String(opacityFor(rect.top / vh))
      placeFrame(frame, rect.bottom)
      setIndex((prev) => (prev === next ? prev : next))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  // A taller image would hang past the section bottom until the next scroll.
  useLayoutEffect(() => {
    const frame = frameRef.current
    const section = frame?.parentElement
    if (!frame || !section) return
    placeFrame(frame, section.getBoundingClientRect().bottom)
  }, [index])

  return (
    <div className="featured-works" ref={frameRef}>
      {slides.map((work, i) => (
        <img
          key={work.src}
          src={work.src}
          alt={`${work.author} ${work.title}`.trim()}
          className={i === index ? 'is-active' : undefined}
          onLoad={() => {
            const frame = frameRef.current
            const section = frame?.parentElement
            if (!frame || !section) return
            placeFrame(frame, section.getBoundingClientRect().bottom)
          }}
        />
      ))}
      {slides[index] && (
        <div className="featured-works-meta">
          <span>{slides[index].author}</span>
          <span>{slides[index].title}</span>
        </div>
      )}
    </div>
  )
}

export default FeaturedWorks
