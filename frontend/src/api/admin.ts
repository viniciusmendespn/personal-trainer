import { api } from './client'

export interface Personal {
  personal_id: string
  email: string
  name: string
  status: string
}

export const adminApi = {
  listPersonals: () =>
    api.get<{ personals: Personal[] }>('/v1/admin/personals').then((r) => r.data),

  impersonate: (personalId: string) =>
    api
      .post<{ token: string; expires_in: number; personal_id: string }>(
        `/v1/admin/impersonate/${personalId}`
      )
      .then((r) => r.data),
}
