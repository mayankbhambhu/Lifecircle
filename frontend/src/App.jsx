import { AnimatePresence } from 'framer-motion'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './auth.jsx'
import Landing from './pages/Landing.jsx'
import Login from './pages/Login.jsx'
import MagicVerify from './pages/MagicVerify.jsx'
import Onboarding from './pages/Onboarding.jsx'
import PatientApp from './pages/PatientApp.jsx'
import DonorApp from './pages/DonorApp.jsx'
import BankApp from './pages/BankApp.jsx'
import HospitalApp from './pages/HospitalApp.jsx'

function Guard({ role, children }) {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== role) return <Navigate to={user.home} replace />
  return children
}

export default function App() {
  const loc = useLocation()
  const { user } = useAuth()
  return (
    <AnimatePresence mode="wait">
      <Routes location={loc} key={loc.pathname}>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={user ? <Navigate to={user.home} replace /> : <Login />} />
        <Route path="/auth/magic" element={<MagicVerify />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/app/patient" element={<Guard role="patient"><PatientApp /></Guard>} />
        <Route path="/app/donor" element={<Guard role="donor"><DonorApp /></Guard>} />
        <Route path="/app/blood_bank" element={<Guard role="blood_bank"><BankApp /></Guard>} />
        <Route path="/app/hospital" element={<Guard role="hospital"><HospitalApp /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  )
}
