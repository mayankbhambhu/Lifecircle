import * as Location from 'expo-location'
import { useState } from 'react'
import { View } from 'react-native'
import { Badge, Button, Card, CardTitle, Divider, Input, Loading, Row, Screen, Status, T, Toggle, useAction, useData } from '../../components/ui'
import { useToast } from '../../components/Toast'
import { api } from '../../lib/api'
import { fmtDate } from '../../lib/format'

export default function DonorProfile() {
  const { data, reload, refresh, refreshing, error } = useData('/api/donor/overview')
  const [busy, run] = useAction()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [relation, setRelation] = useState('')
  const prefs = body => run('p', () => api('/api/donor/preferences', { method: 'PUT', body }), 'Preferences saved').then(reload)
  const locate = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') return toast('Location permission denied', { tone: 'warning' })
    const p = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
    prefs({ lat: p.coords.latitude, lng: p.coords.longitude })
  }
  const pr = data?.profile
  return (
    <Screen title="Profile" subtitle="Availability, circles and history" refreshing={refreshing} onRefresh={refresh}>
      {!data ? <Loading error={error} onRetry={reload} /> : (
        <>
          <Card>
            <CardTitle icon="toggle-right" title="Availability" />
            <Toggle value={pr.available} label="Available to donate" sub="Turn off while travelling or unwell" onChange={v => prefs({ available: v })} />
            <Divider />
            <Toggle value={pr.open_to_urgent} label="Urgent alerts from strangers nearby" sub="Your circle can always reach you" onChange={v => prefs({ open_to_urgent: v })} />
            <Button small icon="map-pin" title="Update my location" style={{ marginTop: 10, alignSelf: 'flex-start' }} onPress={locate} />
          </Card>
          <Card i={1}>
            <CardTitle icon="lock" title="Your details" sub="Only you and blood bank staff can see these" />
            {[['Phone', pr.phone], ['Blood group', pr.blood_group], ['Last donation', fmtDate(pr.last_donation_date)], ['Weight', `${pr.weight_kg} kg`]].map(([k, v]) => (
              <Row key={k} between style={{ paddingVertical: 6 }}><T faint>{k}</T><T weight="700">{v}</T></Row>
            ))}
            <Row between style={{ paddingVertical: 6 }}><T faint>Verification</T>{pr.verified ? <Badge tone="ok" icon="shield">Verified</Badge> : <Badge tone="warn">Pending</Badge>}</Row>
          </Card>
          <Card i={2}>
            <CardTitle icon="user-plus" title="Join a circle" sub="Ask the family for their invite code" />
            <View style={{ gap: 10 }}>
              <Input placeholder="AARAV-7Q2K" autoCapitalize="characters" value={code} onChangeText={setCode} />
              <Input placeholder="Relation (optional)" value={relation} onChangeText={setRelation} />
              <Button variant="primary" title="Join circle" disabled={!code} loading={busy === 'j'}
                onPress={() => run('j', () => api('/api/donor/circles/join', { method: 'POST', body: { code, relation } }), r => `Joined ${r.patient}'s circle`).then(r => { if (r) { setCode(''); reload() } })} />
            </View>
          </Card>
          <Card i={3}>
            <CardTitle icon="droplet" title="Donation history" />
            {data.history.length === 0 ? <T faint>No donations logged yet.</T> : data.history.map((h, i) => (
              <Row key={i} between style={{ paddingVertical: 6 }}><T weight="700">{fmtDate(h.date)}</T><Status s={h.outcome} /></Row>
            ))}
          </Card>
        </>
      )}
    </Screen>
  )
}
