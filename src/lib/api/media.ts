/**
 * api/media.ts — 文件上传
 */
import { getToken } from '@/lib/http'

export async function uploadMedia(file: File): Promise<{ url: string }> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': file.type || 'application/octet-stream',
    'X-Filename': encodeURIComponent(file.name),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
  const r = await fetch('/api/media/upload', { method: 'POST', headers, body: file })
  if (!r.ok) throw new Error(`Upload failed: ${r.status}`)
  return r.json()
}
