import { animate } from 'animejs'

const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Same timing as the header link hover: 400ms, ease out(4).
// Resting look is glass (transparent + blur in CSS). data-fill="solid" keeps
// the old solid fill for buttons that still need it (About terms).
// The rest color has to be an rgba value. The keyword "transparent" is not a
// color to anime.js, so the next hover can no longer interpolate back to red.
const GLASS = 'rgba(0, 0, 0, 0)'
export const fillButton = (el, over) => {
  const solid = el.dataset.fill === 'solid'
  animate(el, {
    backgroundColor: over ? cssVar('--color-theme') : solid ? cssVar('--color-background') : GLASS,
    color: over ? cssVar('--color-background') : cssVar('--color-text'),
    borderColor: over || !solid ? cssVar('--color-theme') : cssVar('--color-text'),
    fontWeight: over ? 700 : 400,
    duration: 400,
    ease: 'out(4)',
  })
}

// Icon color only. Same 400ms out(4) curve as fillButton.
export const tintIcon = (el, over) => {
  animate(el, {
    backgroundColor: over ? cssVar('--color-theme') : cssVar('--color-text'),
    duration: 400,
    ease: 'out(4)',
  })
}
