import { animate } from 'animejs'

const cssVar = (name) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()

// Same timing as the header link hover: 400ms, ease out(4).
export const fillButton = (el, over) => {
  animate(el, {
    backgroundColor: over ? cssVar('--color-theme') : cssVar('--color-background'),
    color: over ? cssVar('--color-background') : cssVar('--color-text'),
    borderColor: over ? cssVar('--color-theme') : cssVar('--color-text'),
    fontWeight: over ? 700 : 400,
    duration: 400,
    ease: 'out(4)',
  })
}
