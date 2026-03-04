/**
 * media.js — 本地媒体文件上传与访问
 *
 * POST /api/media/upload
 *   body: 二进制文件内容（不是 JSON！）
 *   headers:
 *     Content-Type: <文件 MIME 类型>
 *     X-Filename:   <encodeURIComponent 后的原始文件名>
 *   response: { url, name }
 *
 * GET  /api/media/:filename — 访问已上传文件
 */
const express = require('express')
const path    = require('path')
const fs      = require('fs')

const router = express.Router()

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

// MIME type → 扩展名映射表
const MIME_TO_EXT = {
  // 图片
  'image/jpeg': '.jpg', 'image/jpg': '.jpg', 'image/png': '.png',
  'image/gif': '.gif',  'image/webp': '.webp', 'image/svg+xml': '.svg',
  'image/bmp': '.bmp',  'image/tiff': '.tiff', 'image/ico': '.ico',
  // 视频
  'video/mp4': '.mp4',  'video/webm': '.webm', 'video/ogg': '.ogv',
  'video/quicktime': '.mov', 'video/x-msvideo': '.avi', 'video/x-matroska': '.mkv',
  // 音频
  'audio/mpeg': '.mp3', 'audio/mp3': '.mp3', 'audio/wav': '.wav',
  'audio/ogg': '.ogg',  'audio/aac': '.aac', 'audio/flac': '.flac',
  'audio/x-m4a': '.m4a', 'audio/m4a': '.m4a', 'audio/opus': '.opus',
  'audio/x-wav': '.wav', 'audio/webm': '.weba',
  // 文档
  'application/pdf': '.pdf',
  'application/zip': '.zip', 'application/x-zip-compressed': '.zip',
  'application/x-tar': '.tar', 'application/gzip': '.gz',
  'text/plain': '.txt', 'text/markdown': '.md',
  'application/json': '.json',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
}

function guessExt(mimeType, originalName) {
  // 1. 优先用原始文件名的扩展名
  if (originalName) {
    const e = path.extname(originalName)
    if (e) return e
  }
  // 2. 查 MIME 映射表（去掉 charset 等参数）
  const base = (mimeType || '').split(';')[0].trim()
  return MIME_TO_EXT[base] || '.bin'
}

// ─── POST /api/media/upload ─────────────────────────────────────────────────
router.post(
  '/media/upload',
  express.raw({ type: '*/*', limit: '200mb' }),   // 接收任意二进制，无 base64 膨胀
  (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      return res.status(400).json({ error: 'empty body' })
    }

    const originalName = decodeURIComponent(req.headers['x-filename'] || 'upload')
    const mimeType     = req.headers['content-type'] || 'application/octet-stream'
    const ext          = guessExt(mimeType, originalName)
    const savedName    = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}${ext}`
    const filepath     = path.join(UPLOADS_DIR, savedName)

    try {
      fs.writeFileSync(filepath, req.body)
      res.json({ url: `/api/media/${savedName}`, name: originalName, mime: mimeType })
    } catch (err) {
      console.error('[media upload]', err)
      res.status(500).json({ error: err.message })
    }
  }
)

// ─── GET /api/media/:filename ────────────────────────────────────────────────
router.get('/media/:filename', (req, res) => {
  const filename = path.basename(req.params.filename) // 防路径穿越
  const filepath = path.join(UPLOADS_DIR, filename)
  if (!fs.existsSync(filepath)) return res.status(404).end()
  res.sendFile(filepath)
})

module.exports = { init: () => router }
