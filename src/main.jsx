import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { startPerfLog } from './debug/perfLog'

startPerfLog()

// Debug borders: each element gets a different hue so stacked boxes stay readable.
let debugHue = 0
const paintDebugBorder = (el) => {
  if (el.nodeType !== 1 || el.dataset.debugBorder) return
  debugHue = (debugHue + 137.508) % 360
  el.style.borderColor = `hsl(${debugHue} 85% 45%)`
  el.dataset.debugBorder = '1'
}
const paintDebugTree = (root) => {
  paintDebugBorder(root)
  root.querySelectorAll?.('*').forEach(paintDebugBorder)
}
paintDebugTree(document.documentElement)
new MutationObserver((records) => {
  records.forEach((record) => {
    record.addedNodes.forEach((node) => {
      if (node.nodeType === 1) paintDebugTree(node)
    })
  })
}).observe(document.documentElement, { childList: true, subtree: true })

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
