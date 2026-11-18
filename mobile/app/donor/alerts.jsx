import AlertCard from '../../components/AlertCard'
import { Banner, Card, Empty, Loading, Screen, useAction, useData } from '../../components/ui'
import { api } from '../../lib/api'

export default function DonorAlerts() {
  const { data, reload, refresh, refreshing, error } = useData('/api/donor/overview')
  const [busy, run] = useAction()
  const post = (key, path, msg) => run(key, () => api(path, { method: 'POST' }), msg).then(reload)
  return (
    <Screen title="Urgent alerts" subtitle="Ranked by distance to the blood bank" refreshing={refreshing} onRefresh={refresh}>
      {!data ? <Loading error={error} onRetry={reload} /> : (
        <>
          <Banner tone="info" icon="map-pin">You only see the patient’s name if you’re in their circle. Your number stays with the blood bank.</Banner>
          {data.alerts.length === 0 ? <Card><Empty icon="radio" title="No urgent alerts" sub="We'll notify you when someone nearby needs your blood group." /></Card>
            : data.alerts.map((a, i) => (
              <AlertCard key={a.alert_id} a={a} i={i} busy={busy}
                onAccept={() => post('a' + a.alert_id, `/api/donor/alerts/${a.alert_id}/accept`, r => r.message)}
                onDecline={() => post('d', `/api/donor/alerts/${a.alert_id}/decline`, 'Thanks for letting us know')} />
            ))}
        </>
      )}
    </Screen>
  )
}
