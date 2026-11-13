import axios from 'axios'

/**
 * axios 实例
 * baseURL 读取 Vite 显式公开的 RENDERER_VITE_API_HOST（来自 env/*.env）
 */
const service = axios.create({
  baseURL: import.meta.env.RENDERER_VITE_API_HOST || '',
  timeout: 30000
})

// 请求拦截器：可在此统一注入 token
service.interceptors.request.use(
  config => config,
  error => Promise.reject(error)
)

// 响应拦截器：统一处理错误
service.interceptors.response.use(
  response => response.data,
  error => Promise.reject(error)
)

export default service
