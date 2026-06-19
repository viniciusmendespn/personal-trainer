import { api } from './client'
import type { WapiStatus, WapiDeviceInfo } from '../types'

export const wapiApi = {
  saveConfig: (instance_id: string, token: string) =>
    api.post('/v1/wapi/config', { instance_id, token }).then((r) => r.data),
  status: () => api.get<WapiStatus>('/v1/wapi/status').then((r) => r.data),
  deviceInfo: () => api.get<WapiDeviceInfo>('/v1/wapi/device-info').then((r) => r.data),
  qr: () => api.get<{ qr_code: string }>('/v1/wapi/qr').then((r) => r.data),
  pairingCode: (phone: string) =>
    api.get<{ code: string }>('/v1/wapi/pairing-code', { params: { phone } }).then((r) => r.data),
  disconnect: () => api.post('/v1/wapi/disconnect'),
}
