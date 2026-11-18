import { StockAlerts, StockTubes } from '../../components/Stock'
import { Card, CardTitle, Loading, Screen, useData } from '../../components/ui'

export default function HospitalStock() {
  const { data, reload, refresh, refreshing, error } = useData('/api/hospital/overview')
  return (
    <Screen title="Blood stock" subtitle={data ? `${data.blood_bank.name} · read-only` : ''} refreshing={refreshing} onRefresh={refresh}>
      {!data ? <Loading error={error} onRetry={reload} /> : (
        <>
          <Card><CardTitle icon="droplet" title="Live inventory" sub="Days of cover shown under each group" /><StockTubes stock={data.stock} /></Card>
          <Card i={1}><CardTitle icon="alert-triangle" title="Shortage alerts" /><StockAlerts alerts={data.stock_alerts} /></Card>
        </>
      )}
    </Screen>
  )
}
