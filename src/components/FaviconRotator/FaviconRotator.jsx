import { useEffect } from 'react'

const FaviconRotator = () => {
  const icons = [
    '/assets/icons/favicon1.png',
    '/assets/icons/favicon2.png',
    '/assets/icons/favicon3.png',
    '/assets/icons/favicon4.png',
  ]

  let currentIndex = 0

  const changeFavicon = () => {
    let link = document.querySelector("link[rel*='icon']")

    if (!link) {
      link = document.createElement('link')
      link.type = 'image/x-icon'
      link.rel = 'shortcut icon'
      document.getElementsByTagName('head')[0].appendChild(link)
    }

    link.href = icons[currentIndex]
    currentIndex = (currentIndex + 1) % icons.length
  }

  useEffect(() => {
    // Set initial favicon
    changeFavicon()

    // Set up interval to change favicon
    const interval = setInterval(changeFavicon, 900)

    return () => clearInterval(interval)
  }, [])

  return null // This component doesn't render anything
}

export default FaviconRotator
