import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { decodeUploadedFilename } from '../encoding';

const router = Router();
const uploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads');

const SAFE_UPLOAD_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.log': 'text/plain',
};
const INLINE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.mp4', '.mov', '.webm', '.mp3', '.wav', '.ogg', '.pdf']);
const TEXT_EXTENSIONS = new Set(['.txt', '.csv', '.md', '.markdown', '.log']);
const ZIP_EXTENSIONS = new Set(['.zip', '.docx', '.xlsx', '.pptx']);
const LEGACY_OFFICE_EXTENSIONS = new Set(['.doc', '.xls', '.ppt']);

if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

function uploadedExtension(name: string) {
  return path.extname(decodeUploadedFilename(name || '')).toLowerCase();
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => cb(null, `${uuidv4()}${uploadedExtension(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 200 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = uploadedExtension(file.originalname);
    if (!SAFE_UPLOAD_TYPES[ext]) {
      cb(new Error('不支持该文件类型；HTML、SVG、脚本和可执行文件不能上传'));
      return;
    }
    cb(null, true);
  },
});

function hasPrefix(buffer: Buffer, bytes: number[]) {
  return bytes.every((value, index) => buffer[index] === value);
}

function hasAscii(buffer: Buffer, value: string, offset = 0) {
  return buffer.subarray(offset, offset + value.length).toString('ascii') === value;
}

function hasSafeSignature(filePath: string, ext: string) {
  const fd = fs.openSync(filePath, 'r');
  const head = Buffer.alloc(8192);
  let length = 0;
  try {
    length = fs.readSync(fd, head, 0, head.length, 0);
  } finally {
    fs.closeSync(fd);
  }
  const bytes = head.subarray(0, length);
  if (!length) return false;
  if (TEXT_EXTENSIONS.has(ext)) return !bytes.includes(0);
  if (ZIP_EXTENSIONS.has(ext)) return hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04]) || hasPrefix(bytes, [0x50, 0x4b, 0x05, 0x06]);
  if (LEGACY_OFFICE_EXTENSIONS.has(ext)) return hasPrefix(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (ext === '.png') return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (ext === '.jpg' || ext === '.jpeg') return hasPrefix(bytes, [0xff, 0xd8, 0xff]);
  if (ext === '.gif') return hasAscii(bytes, 'GIF87a') || hasAscii(bytes, 'GIF89a');
  if (ext === '.webp') return hasAscii(bytes, 'RIFF') && hasAscii(bytes, 'WEBP', 8);
  if (ext === '.bmp') return hasAscii(bytes, 'BM');
  if (ext === '.pdf') return hasAscii(bytes, '%PDF-');
  if (ext === '.mp4' || ext === '.mov') return hasAscii(bytes, 'ftyp', 4);
  if (ext === '.webm') return hasPrefix(bytes, [0x1a, 0x45, 0xdf, 0xa3]);
  if (ext === '.mp3') return hasAscii(bytes, 'ID3') || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
  if (ext === '.wav') return hasAscii(bytes, 'RIFF') && hasAscii(bytes, 'WAVE', 8);
  if (ext === '.ogg') return hasAscii(bytes, 'OggS');
  return false;
}

function removeRejectedUpload(file?: Express.Multer.File) {
  if (!file?.path) return;
  try {
    fs.rmSync(file.path, { force: true });
  } catch {
    // The response still reports rejection; cleanup can be retried by an external janitor.
  }
}

function uploadErrorMessage(err: unknown): string {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') return '文件大小超过 200MB 限制';
    if (err.code === 'LIMIT_FILE_COUNT') return '每次只能上传一个文件';
    if (err.code === 'LIMIT_UNEXPECTED_FILE') return '上传字段无效';
    return '文件上传失败';
  }
  if (err instanceof Error && err.message) return err.message;
  return '文件上传失败';
}

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      removeRejectedUpload(req.file);
      return res.status(400).json({ code: -1, message: uploadErrorMessage(err) });
    }
    next();
  });
}, (req: Request, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ code: -1, message: '未选择文件' });
    const name = decodeUploadedFilename(req.file.originalname || req.file.filename);
    const ext = uploadedExtension(name);
    if (!hasSafeSignature(req.file.path, ext)) {
      removeRejectedUpload(req.file);
      return res.status(400).json({ code: -1, message: '文件内容与扩展名不匹配，已拒绝上传' });
    }
    res.status(201).json({
      code: 0,
      data: {
        name,
        size: req.file.size,
        type: SAFE_UPLOAD_TYPES[ext],
        url: `/static/uploads/${req.file.filename}`,
        disposition: INLINE_EXTENSIONS.has(ext) ? 'inline' : 'attachment',
      },
    });
  } catch (err: unknown) {
    removeRejectedUpload(req.file);
    const message = err instanceof Error ? err.message : '文件上传失败';
    res.status(500).json({ code: -1, message });
  }
});

export function setUploadedAssetHeaders(res: Response, filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (!INLINE_EXTENSIONS.has(ext)) res.setHeader('Content-Disposition', 'attachment');
}

export default router;
