import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { cloudinary, isCloudinaryConfigured } from '../../config/cloudinary.js';
import { ApiError } from '../../lib/api-error.js';
import { requireAuth } from '../../middleware/auth.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1 },
  fileFilter(_request, file, callback) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new ApiError(400, 'INVALID_FILE_TYPE', 'Only JPEG, PNG and WebP images are accepted'));
      return;
    }
    callback(null, true);
  },
});

export const uploadsRouter = Router();
export const uploadImageHandler = [requireAuth, upload.single('image'), async (request: Request, response: Response) => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, 'STORAGE_NOT_CONFIGURED', 'Cloud storage is not configured on the server');
  }
  if (!request.file) throw ApiError.badRequest('An image file is required');

  const result = await new Promise<{ secure_url: string; public_id: string; width: number; height: number }>((resolve, reject) => {
    cloudinary.uploader.upload_stream({
      folder: process.env.CLOUDINARY_FOLDER || 'fegih',
      public_id: `${request.user!.id}/${randomUUID()}`,
      resource_type: 'image',
      transformation: [{ width: 1600, height: 1600, crop: 'limit' }, { quality: 'auto', fetch_format: 'auto' }],
    }, (error, uploaded) => {
      if (error || !uploaded) reject(new ApiError(502, 'UPLOAD_FAILED', 'Image upload failed'));
      else resolve(uploaded as { secure_url: string; public_id: string; width: number; height: number });
    }).end(request.file!.buffer);
  });

  response.status(201).json({ data: { url: result.secure_url, publicId: result.public_id, width: result.width, height: result.height } });
}];

uploadsRouter.post('/image', ...uploadImageHandler);
