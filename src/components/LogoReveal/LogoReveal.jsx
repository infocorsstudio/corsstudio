import { useId, useLayoutEffect, useRef } from 'react'
import { createTimeline, utils } from 'animejs'

const VIEW_W = 64.3
const VIEW_H = 29.42

// Each crescent = solid shape (outer arc + chord) minus a cut shape (inner arc + chord).
const MOON1_SOLID =
  'M64.3,0C39.28.31,19.51,4.58,19.51,9.8c0,3.51,8.93,6.58,22.37,8.32c1.63.21,3.33.4,5.09.57c5.31.51,11.16.83,17.33.91Z'
const MOON1_CUT =
  'M64.3,19.6c-6.5-.12-12.55-.63-17.78-1.45h-.01c-1.75-.27-3.41-.58-4.96-.91c-8.37-1.8-13.66-4.47-13.66-7.44c0-1.84,2.02-3.57,5.54-5.03C39.83,2.1,51.16.25,64.3,0Z'
const MOON2_SOLID =
  'M33.42,4.77c5.45,5.04,12.29,12.05,14.89,15.65c.29.4.55.78.79,1.15c2.1,3.18,2.75,5.52,1.64,6.73c-3.98,4.36-22.82-4-50.75-23.36Z'
const MOON2_CUT =
  'M-.01,4.94c22.89,15.72,38.97,19.51,41.58,16.89c.36-.36.55-.86.61-1.41c.06-.48.03-1.03-.12-1.64c-.62-2.67-4.57-9.53-8.64-14.02L33.8,3L-.6,3.2L-.6,4.94Z'

const LogoReveal = ({ className, color = '#e60000' }) => {
  const id = useId().replace(/:/g, '')
  const svgRef = useRef(null)
  const solid1 = useRef(null)
  const cut1 = useRef(null)
  const solid2 = useRef(null)
  const cut2 = useRef(null)

  useLayoutEffect(() => {
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const scale = Math.min(rect.width / VIEW_W, rect.height / VIEW_H) || 1
    // Offsets in SVG user units that push a shape fully past the viewport edge.
    const right = (window.innerWidth - rect.left) / scale + 2
    const diag = -(Math.min(rect.right, rect.bottom) / scale + 2)

    utils.set(svg, { color: '#000' })
    utils.set([solid1.current, cut1.current], { translateX: right })
    utils.set([solid2.current, cut2.current], {
      translateX: diag,
      translateY: diag,
    })

    const tl = createTimeline({
      delay: 300,
      defaults: { duration: 1000, ease: 'inOutQuart' },
    })
      .add(solid1.current, { translateX: 0 })
      .add(cut1.current, { translateX: 0 }, '-=900')
      .add(solid2.current, { translateX: 0, translateY: 0 }, '-=700')
      .add(cut2.current, { translateX: 0, translateY: 0 }, '-=900')
      .add(svg, { color, duration: 600, ease: 'outQuad' }, '+=50')

    return () => tl.revert()
  }, [color])

  const maskRect = { x: -10000, y: -10000, width: 20000, height: 20000 }

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <mask id={`${id}-m1`} maskUnits="userSpaceOnUse" {...maskRect}>
          <rect {...maskRect} fill="#fff" />
          <path ref={cut1} d={MOON1_CUT} fill="#000" />
        </mask>
        <mask id={`${id}-m2`} maskUnits="userSpaceOnUse" {...maskRect}>
          <rect {...maskRect} fill="#fff" />
          <path ref={cut2} d={MOON2_CUT} fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${id}-m1)`}>
        <path ref={solid1} d={MOON1_SOLID} fill="currentColor" />
      </g>
      <g mask={`url(#${id}-m2)`}>
        <path ref={solid2} d={MOON2_SOLID} fill="currentColor" />
      </g>
    </svg>
  )
}

export default LogoReveal
