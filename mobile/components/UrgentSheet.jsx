import { Feather } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable } from 'react-native'
import { Banner, Button, Choice, Input, Sheet, tap } from './ui'
import { useTheme } from '../lib/theme'
import { fmtDate, todayIso } from '../lib/format'

const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }

/** Shared "request urgent help" form for families and hospital staff. */
export default function UrgentSheet({ open, onClose, onSubmit, busy, destination, defaultDate, placeholder }) {
  const blank = { reason: '', units: 1, needed_by: null }
  const [form, setF] = useState(blank)
  const f = { ...form, needed_by: form.needed_by || defaultDate || todayIso() }
  const close = () => { setF(blank); onClose() }
  const dates = [...new Set([todayIso(), plus(1), plus(2), defaultDate].filter(Boolean))]
  return (
    <Sheet open={open} onClose={close} title="Request urgent help">
      <Banner tone="crit" icon="alert-octagon">{`Goes straight to ${destination || 'the blood bank'} and alerts the patient's circle first.`}</Banner>
      <Input label="What happened?" multiline placeholder={placeholder || 'e.g. Donor cancelled, Hb dropped to 6.5'} value={f.reason} onChangeText={reason => setF(x => ({ ...x, reason }))} />
      <Choice label="Needed by" options={dates.map(d => ({ value: d, label: d === todayIso() ? 'Today' : d === plus(1) ? 'Tomorrow' : fmtDate(d) }))} value={f.needed_by} onChange={needed_by => setF(x => ({ ...x, needed_by }))} />
      <Choice label="Units" options={[1, 2, 3]} value={f.units} onChange={units => setF(x => ({ ...x, units }))} />
      <Button variant="danger" icon="alert-octagon" title="Send urgent request" loading={busy} disabled={f.reason.trim().length < 3} onPress={async () => { if (await onSubmit(f) !== false) setF(blank) }} />
    </Sheet>
  )
}

export function UrgentButton({ onPress }) {
  const t = useTheme()
  return (
    <Pressable onPress={() => { tap(); onPress() }} accessibilityLabel="Request urgent help"
      style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: t.crit, alignItems: 'center', justifyContent: 'center' }}>
      <Feather name="alert-octagon" size={19} color="#fff" />
    </Pressable>
  )
}
