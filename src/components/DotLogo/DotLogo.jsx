import './DotLogo.css'

// Points along the outline of public/assets/icons/logo.svg, scaled x10.
// Each row is x, y, then the direction (away from the shape) its number sits in.
const DOTS = [
  [0, 49, -0.3, -0.95],
  [90, 108, 0.51, -0.86],
  [169, 152, 0.46, -0.89],
  [250, 190, 0.38, -0.92],
  [336, 218, 0.24, -0.97],
  [422, 201, -1, -0.05],
  [366, 173, -0.17, 0.99],
  [302, 160, -0.24, 0.97],
  [241, 140, -0.4, 0.92],
  [195, 98, -1, 0],
  [236, 58, -0.42, -0.91],
  [298, 37, -0.25, -0.97],
  [401, 17, -0.14, -0.99],
  [480, 8, -0.09, -1],
  [560, 3, -0.05, -1],
  [643, 0, 1, 0],
  [521, 7, 0.1, 0.99],
  [445, 18, 0.17, 0.98],
  [369, 35, 0.29, 0.96],
  [294, 71, 0.66, 0.75],
  [288, 120, 0.74, -0.67],
  [335, 149, 0.38, -0.92],
  [405, 170, -0.55, -0.85],
  [334, 48, 0.75, 0.66],
  [459, 174, 0.75, -0.66],
  [643, 196, 1, 0],
  [476, 195, 0.89, 0.45],
  [502, 233, 0.88, -0.47],
  [508, 283, 0.74, 0.67],
  [449, 292, -0.18, 0.98],
  [382, 271, -0.37, 0.93],
  [296, 232, -0.46, 0.89],
  [212, 186, -0.5, 0.86],
  [131, 137, -0.53, 0.85],
  [50, 83, -0.56, 0.83],
]

const NUMBER_GAP = 20
const MARK_GAP = 27

// marks: dot numbers drawn larger and in the theme color.
const DotLogo = ({ marks = [] }) => {
  const first = DOTS[0]
  const last = DOTS[DOTS.length - 1]

  return (
    <svg
      className="dot-logo"
      viewBox="-130 -25 815 345"
      role="img"
      aria-label="CORS Studio logo as a connect-the-dots drawing"
    >
      <text className="dot-logo-start" x={first[0] - 16} y={first[1]}>
        Start Here →
      </text>
      <line x1={last[0]} y1={last[1]} x2={first[0]} y2={first[1]} />
      {DOTS.map(([x, y, dx, dy], i) => {
        const n = i + 1
        const marked = marks.includes(n)
        const gap = marked ? MARK_GAP : NUMBER_GAP
        return (
          <g key={n} className={marked ? 'is-marked' : undefined}>
            <circle cx={x} cy={y} r={marked ? 6.5 : 4} />
            <text x={x + dx * gap} y={y + dy * gap}>
              {n}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

export default DotLogo
