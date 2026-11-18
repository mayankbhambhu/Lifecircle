import { useState } from 'react'
import { StockAlerts, StockTubes } from '../../components/Stock'
import DonorLine from '../../components/DonorLine'
import { Button, Card, CardTitle, Empty, Input, Loading, Row, Screen, Sheet, T, useAction, useData } from '../../components/ui'
import { api } from '../../lib/api'

export default function Stock() {
  const { data, reload, refresh, refreshing, error } = useData('/api/bank/inventory')
  const [busy, run] = useAction()
  const [edit, setEdit] = useState(null)
  const [rallied, setRallied] = useState(null)
  const rally = g => run(g, () => api(`/api/bank/inventory/${encodeURIComponent(g)}/rally`, { method: 'POST' })).then(r => { if (r) { setRallied({ group: g, ...r }); reload() } })
  return (
    <Screen title="Blood stock" subtitle={data?.bank} refreshing={refreshing} onRefresh={refresh}>
      {!data ? <Loading error={error} onRetry={reload} /> : (
        <>
          <Card>
            <CardTitle icon="droplet" title="Live inventory" sub="Tap a group to update it" />
            <StockTubes stock={data.stock} onSelect={s => setEdit({ ...s, units: String(s.units), min_threshold: String(s.min_threshold), daily_usage: String(s.daily_usage) })} />
          </Card>
          <Card i={1}>
            <CardTitle icon="alert-triangle" title="Shortage alerts" sub="Rally notifies eligible, verified donors of that group within 15 km" />
            <StockAlerts alerts={data.alerts} onRally={rally} busy={busy} />
          </Card>
        </>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit ? `Update ${edit.blood_group}` : ''}>
        {edit && (
          <>
            <Row gap={10}>
              <Input style={{ flex: 1 }} label="Units" keyboardType="number-pad" value={edit.units} onChangeText={units => setEdit(e => ({ ...e, units }))} />
              <Input style={{ flex: 1 }} label="Minimum" keyboardType="number-pad" value={edit.min_threshold} onChangeText={min_threshold => setEdit(e => ({ ...e, min_threshold }))} />
              <Input style={{ flex: 1 }} label="Use/day" keyboardType="decimal-pad" value={edit.daily_usage} onChangeText={daily_usage => setEdit(e => ({ ...e, daily_usage }))} />
            </Row>
            <Button variant="primary" title="Save" loading={busy === 'save'} onPress={async () => {
              const r = await run('save', () => api(`/api/bank/inventory/${encodeURIComponent(edit.blood_group)}`, { method: 'PUT', body: { units: Number(edit.units), min_threshold: Number(edit.min_threshold), daily_usage: Number(edit.daily_usage) } }), s => `${s.blood_group} is now ${s.status}`)
              if (r) { setEdit(null); reload() }
            }} />
          </>
        )}
      </Sheet>
      <Sheet open={!!rallied} onClose={() => setRallied(null)} title={rallied ? `Rallied ${rallied.contacted} ${rallied.group} donors` : ''}>
        {rallied && (rallied.contacted === 0 ? <Empty icon="volume-x" title="No eligible donors within 15 km right now" />
          : rallied.donors.map(d => <DonorLine key={d.donor_id} d={d} right={<T weight="700" size={13}>{d.distance}</T>} />))}
      </Sheet>
    </Screen>
  )
}
