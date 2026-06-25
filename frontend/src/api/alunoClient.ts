import axios from 'axios'

export const alunoClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '',
  timeout: 30_000,
  withCredentials: true,
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
