import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from './api.js'

export function useTab(def) {
  const [sp, setSp] = useSearchParams()
  const tab = sp.get('tab') || def
  const setTab = useCallback(t => { setSp(t === def ? {} : { tab: t }, { replace: true }); window.scrollTo({ top: 0, behavior: 'smooth' }) }, [setSp, def])
  return [tab, setTab]
}

export function useData(path, deps = []) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const reload = useCallback(async () => {
    try { setData(await api(path)); setError(null) } catch (e) { setError(e) }
  }, [path])
  useEffect(() => { reload() }, [reload, ...deps]) // eslint-disable-line react-hooks/exhaustive-deps
  return [data, reload, error, setData]
}
