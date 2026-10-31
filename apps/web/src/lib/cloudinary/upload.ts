const CLOUDINARY_CLOUD_NAME = 'zw16y5km';
const CLOUDINARY_UPLOAD_PRESET = 'cbithack';
const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;

export interface CloudinaryUploadResult {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

/**
 * Upload a base64-encoded image to Cloudinary
 */
export async function uploadBase64ToCloudinary(
  base64Data: string,
  folder = 'proctor-forge/candidate-photos'
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append('file', base64Data);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloudinary upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width || 0,
    height: data.height || 0,
  };
}

/**
 * Upload a File object (from input[type=file]) to Cloudinary
 */
export async function uploadFileToCloudinary(
  file: File,
  folder = 'proctor-forge/candidate-photos'
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloudinary upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width || 0,
    height: data.height || 0,
  };
}

/**
 * Upload an image from a public URL to Cloudinary
 */
export async function uploadUrlToCloudinary(
  imageUrl: string,
  folder = 'proctor-forge/candidate-photos'
): Promise<CloudinaryUploadResult> {
  const formData = new FormData();
  formData.append('file', imageUrl);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
  formData.append('folder', folder);

  const res = await fetch(CLOUDINARY_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Cloudinary upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return {
    url: data.secure_url,
    publicId: data.public_id,
    width: data.width || 0,
    height: data.height || 0,
  };
}
