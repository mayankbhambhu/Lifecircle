import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

/* ------------------------------------------------------------------ storage
 * Session tokens live in the device keychain / keystore (expo-secure-store). */
const webStore = globalThis.localStorage
export const store = {
  get: k => (Platform.OS === 'web' ? Promise.resolve(webStore?.getItem(k) ?? null) : SecureStore.getItemAsync(k)),
  set: (k, v) => (Platform.OS === 'web' ? Promise.resolve(webStore?.setItem(k, v)) : SecureStore.setItemAsync(k, v)),
  del: k => (Platform.OS === 'web' ? Promise.resolve(webStore?.removeItem(k)) : SecureStore.deleteItemAsync(k)),
}

/* ------------------------------------------------------------------ server
 * In Expo Go the bundle is served by `expo start` on your laptop, so the laptop's
 * LAN address is in Constants.expoConfig.hostUri ("192.168.1.7:8081"). The FastAPI
 * server runs on the same laptop on port 8000. Override with EXPO_PUBLIC_API_URL
 * or from the "Server" setting on the login screen (needed when using --tunnel). */
export function detectServer() {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '')
  const host = (Constants.expoConfig?.hostUri || '').split(':')[0]
  if (host && !host.endsWith('.exp.direct')) return `http://${host}:8000`
  return Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000'
}

let server = detectServer()
let token = null
const unauthorizedListeners = new Set()

export const getServer = () => server
export async function setServer(url) {
  server = (url || detectServer()).trim().replace(/\/$/, '')
  if (url) await store.set('lc_server', server)
  else await store.del('lc_server')
}
export function setToken(t) { token = t }
export function onUnauthorized(fn) { unauthorizedListeners.add(fn); return () => unauthorizedListeners.delete(fn) }

export async function initServer() {
  const saved = await store.get('lc_server')
  if (saved) server = saved
}

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status }
}

export async function api(path, { method = 'GET', body } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 12000)
  let res
  try {
    res = await fetch(server + path, {
      method,
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new ApiError(0, `Can't reach the server at ${server}. Is the backend running with --host 0.0.0.0 and is your phone on the same Wi-Fi?`)
  } finally {
    clearTimeout(timer)
  }
  let data = null
  try { data = await res.json() } catch { /* empty body */ }
  if (!res.ok) {
    let msg = data?.detail
    if (Array.isArray(msg)) msg = msg.map(d => d.msg).join(', ')
    if (res.status === 401 && token) unauthorizedListeners.forEach(fn => fn())
    throw new ApiError(res.status, msg || `Request failed (${res.status})`)
  }
  return data
}
