import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import HomePage from './pages/HomePage/HomePage'
import MagazinePage from './pages/MagazinePage/MagazinePage'
import AboutPage from './pages/AboutPage/AboutPage'
import OpencallPage from './pages/OpencallPage/OpencallPage'
import Header from './components/Header/Header'
import FaviconRotator from './components/FaviconRotator/FaviconRotator'
import './App.css'

function App() {
  return (
    <Router
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <div className="App">
        <FaviconRotator />
        <Header />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/magazine" element={<MagazinePage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/opencall" element={<OpencallPage />} />
        </Routes>
        <Analytics />
      </div>
    </Router>
  )
}

export default App
