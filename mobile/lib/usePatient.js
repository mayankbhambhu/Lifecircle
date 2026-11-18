import { useState } from 'react'
import { useData } from '../components/ui'

/** Family overview + which patient is selected (families can manage more than one). */
export function usePatient() {
  const q = useData('/api/family/overview')
  const [idx, setIdx] = useState(0)
  const patients = q.data?.patients || []
  return { ...q, patients, p: patients[Math.min(idx, Math.max(0, patients.length - 1))], idx, setIdx }
}
