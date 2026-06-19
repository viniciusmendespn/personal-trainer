import axios from 'axios'

export const ALUNO_TOKEN_KEY = 'pt_aluno_token'

export const alunoClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 30_000,
})

alunoClient.interceptors.request.use((config) => {
  const tk = localStorage.getItem(ALUNO_TOKEN_KEY)
  if (tk) config.headers.Authorization = `Bearer ${tk}`
  return config
})

alunoClient.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error?.response?.status === 403) {
      window.dispatchEvent(new CustomEvent('pt:aluno:403'))
    }
    return Promise.reject(error)
  }
)
