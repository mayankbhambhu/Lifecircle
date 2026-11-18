import { View } from 'react-native'
import { BloodTag, Card, Divider, Empty, Loading, Row, Screen, Status, T, useData } from '../../components/ui'
import { fmtDate, timeAgo } from '../../lib/format'

export default function HospitalUrgent() {
  const { data, reload, refresh, refreshing, error } = useData('/api/hospital/overview')
  return (
    <Screen title="Urgent requests" subtitle="For your patients" refreshing={refreshing} onRefresh={refresh}>
      {!data ? <Loading error={error} onRetry={reload} /> : (
        <Card style={{ paddingVertical: 8 }}>
          {data.urgent.length === 0 ? <Empty icon="shield" title="No urgent requests" /> : data.urgent.map((u, i) => (
            <View key={u.id}>
              {i > 0 && <Divider />}
              <View style={{ paddingVertical: 12, gap: 6 }}>
                <Row between><Row gap={8}><BloodTag group={u.blood_group} /><T weight="800">{u.patient.name}</T></Row><Status s={u.status} /></Row>
                <T muted size={13}>{u.units} unit(s) by {fmtDate(u.needed_by)} · {u.reason}</T>
                <T faint size={12}>{timeAgo(u.created_at)} · {u.alerted.circle + u.alerted.nearby} donors alerted · {u.blood_bank}{u.filled_by ? ` · filled by ${u.filled_by.display_name}` : ''}</T>
              </View>
            </View>
          ))}
        </Card>
      )}
    </Screen>
  )
}
