import { useEffect, useState } from 'react'

const content = fetch('/assets/works/assets.json').then((res) => {
  if (!res.ok) throw new Error('Failed to load site content')
  return res.json()
})

export function useSiteContent() {
  const [site, setSite] = useState(null)

  useEffect(() => {
    let alive = true
    content.then((data) => {
      if (alive) setSite(data)
    })
    return () => {
      alive = false
    }
  }, [])

  return site
}
