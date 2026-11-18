import { useState } from 'react'
import { View } from 'react-native'
import DonorLine from '../../components/DonorLine'
import { Badge, BloodTag, Button, Card, Choice, Divider, Input, Loading, Row, Screen, Sheet, T, useAction, useData } from '../../components/ui'
import { api } from '../../lib/api'
import { fmtDate, timeAgo } from '../../lib/format'

export default function Donors() {
  const [q, setQ] = useState('')
  const [group, setGroup] = useState('')
  const { data, reload, refresh, refreshing, error } = useData(`/api/bank/donors?q=${encodeURIComponent(q)}&group=${encodeURIComponent(group)}`)
  const [busy, run] = useAction()
  const [auditOpen, setAuditOpen] = useState(false)
  const audit = useData(auditOpen ? '/api/bank/audit' : null)
  return (
    <Screen title="Donor directory" subtitle="Full contact details · every view is audited" refreshing={refreshing} onRefresh={refresh}
      right={<Button small icon="file-text" onPress={() => { setAuditOpen(true); audit.reload() }} />}>
      <Input placeholder="Search name, phone or area" value={q} onChangeText={setQ} autoCapitalize="none" />
      <Choice options={[{ value: '', label: 'All' }, ...['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map(g => ({ value: g, label: g }))]} value={group} onChange={setGroup} />
      {!data ? <Loading error={error} onRetry={reload} /> : (
        <Card style={{ paddingVertical: 8 }}>
          {data.length === 0 && <T faint style={{ padding: 10 }}>No donors match.</T>}
          {data.map((d, i) => (
            <View key={d.id}>
              {i > 0 && <Divider />}
              <View style={{ paddingVertical: 12, gap: 8 }}>
                <DonorLine d={d} sub={`${d.sex} · ${d.age}y · ${d.weight_kg}kg · ${d.area}`} right={<BloodTag group={d.blood_group} />} />
                <Row wrap gap={6}>
                  {d.eligibility.eligible ? <Badge tone="ok" dot>Eligible today</Badge> : <Badge tone="warn">{d.eligibility.reasons[0]}</Badge>}
                  <Badge>Last: {fmtDate(d.last_donation_date)}</Badge>
                  {d.circles.length > 0 && <Badge tone="violet">Circle: {d.circles.join(', ')}</Badge>}
                  {d.verified ? <Badge tone="info" icon="shield">Verified</Badge>
                    : <Button small icon="shield" title="Verify" loading={busy === 'v' + d.id} onPress={() => run('v' + d.id, () => api(`/api/bank/donors/${d.id}/verify`, { method: 'POST', body: { verified: true } }), 'Donor verified').then(reload)} />}
                </Row>
              </View>
            </View>
          ))}
        </Card>
      )}
      <Sheet open={auditOpen} onClose={() => setAuditOpen(false)} title="Privacy audit trail">
        <T muted size={13}>Who viewed donor contact details, and when.</T>
        {!audit.data ? <Loading /> : audit.data.map((a, i) => (
          <Row key={i} style={{ paddingVertical: 4 }}><View style={{ flex: 1 }}><T weight="700" size={13}>{a.who} · {a.action.replace(/_/g, ' ')}</T><T faint size={12}>{a.target}</T></View><T faint size={12}>{timeAgo(a.when)}</T></Row>
        ))}
      </Sheet>
    </Screen>
  )
}
