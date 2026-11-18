import { View } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Avatar, Badge, Banner, Card, CardTitle, Divider, Loading, ProgressBar, Row, Screen, T } from '../../components/ui'
import { fmtDate } from '../../lib/format'
import { usePatient } from '../../lib/usePatient'
import { useTheme } from '../../lib/theme'

const WEIGHTS = [
  ['Rotation', 40, 'Longest since they last helped this patient'],
  ['Rest', 20, 'Extra rest beyond the mandatory gap'],
  ['Reliability', 20, 'Shows up when booked; few late cancellations'],
  ['Load', 15, 'Fewer donations this year – prevents fatigue'],
  ['Exact match', 5, 'Same ABO/Rh preferred for chronic transfusion'],
]

export default function Rotation() {
  const t = useTheme()
  const { p, reload, refresh, refreshing, error } = usePatient()
  return (
    <Screen title="Fair rotation" subtitle="Who's up next – and why" refreshing={refreshing} onRefresh={refresh}>
      {!p ? <Loading error={error} onRetry={reload} /> : (
        <>
          <Card>
            <CardTitle icon="calendar" title="Next 6 cycles" sub="Forecast, assuming each confirmed donor donates" />
            {p.forecast.map((f, i) => (
              <Animated.View key={f.date} entering={FadeInDown.delay(i * 70)}>
                {i > 0 && <Divider />}
                <Row style={{ paddingVertical: 10 }}>
                  <View style={{ width: 62 }}><T weight="900" size={15}>{fmtDate(f.date)}</T><T faint size={11}>cycle {i + 1}</T></View>
                  {f.confirmed ? (
                    <Row gap={8} style={{ flex: 1 }}><Avatar name={f.confirmed.name} size={32} /><T weight="700">{f.confirmed.name.split(' ')[0]}</T></Row>
                  ) : <View style={{ flex: 1 }}><Badge tone="crit">Gap – urgent likely</Badge></View>}
                  <T faint size={12.5}>{f.backup ? `backup ${f.backup.name.split(' ')[0]}` : 'no backup'}</T>
                </Row>
              </Animated.View>
            ))}
          </Card>
          <Card i={1}>
            <CardTitle icon="heart" title="How the score works" />
            <T muted size={13} style={{ marginBottom: 12 }}>Only donors who are medically eligible on the date (age, weight, 90/120-day gap, no deferral, compatible group) are scored:</T>
            {WEIGHTS.map(([k, w, d], i) => (
              <View key={k} style={{ marginBottom: 12, gap: 6 }}>
                <Row between><T weight="700">{k}</T><View style={{ backgroundColor: t.violetSoft, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}><T weight="900" size={12} color={t.violet}>{w} pts</T></View></Row>
                <ProgressBar pct={w * 2.5} color={t.violet} />
                <T faint size={12.5}>{d}</T>
              </View>
            ))}
            <Banner tone="info">Top score = confirmed donor, runner-up = backup. If someone cancels, the backup is promoted automatically.</Banner>
          </Card>
        </>
      )}
    </Screen>
  )
}
