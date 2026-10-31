const FACEPP_API_KEY = 'xgKvCBcMZUo8AdxTGULbfQJOzQcwarsS';
const FACEPP_API_SECRET = 'LSQThJFKnFYSyqY0dhfRkVhH2zwKzIMO';
const FACEPP_BASE_URL = 'https://api-us.faceplusplus.com/facepp/v3';

export interface FaceDetectResult {
  faceToken: string;
  faceRectangle: { top: number; left: number; width: number; height: number };
  attributes?: { gender?: { value: string }; age?: { value: number } };
}

export interface FaceCompareResult {
  isMatch: boolean;
  confidence: number;
  thresholds: { '1e-3': number; '1e-4': number; '1e-5': number };
}

/**
 * Detect a face from a public image URL via Face++ API
 * Returns the face_token string
 */
export async function detectFaceFromUrl(imageUrl: string): Promise<FaceDetectResult> {
  const formData = new FormData();
  formData.append('api_key', FACEPP_API_KEY);
  formData.append('api_secret', FACEPP_API_SECRET);
  formData.append('image_url', imageUrl);
  formData.append('return_attributes', 'gender,age');

  const res = await fetch(`${FACEPP_BASE_URL}/detect`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  if (data.error_message) {
    throw new Error(`Face++ detect error: ${data.error_message}`);
  }

  if (!data.faces || data.faces.length === 0) {
    throw new Error('No face detected in the image. Please upload a clear photo with a visible face.');
  }

  const face = data.faces[0];
  return {
    faceToken: face.face_token,
    faceRectangle: face.face_rectangle,
    attributes: face.attributes,
  };
}

/**
 * Detect a face from a base64-encoded image via Face++ API
 */
export async function detectFaceFromBase64(base64Data: string): Promise<FaceDetectResult> {
  // Strip data URI prefix if present
  const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

  const formData = new FormData();
  formData.append('api_key', FACEPP_API_KEY);
  formData.append('api_secret', FACEPP_API_SECRET);
  formData.append('image_base64', cleanBase64);
  formData.append('return_attributes', 'gender,age');

  const res = await fetch(`${FACEPP_BASE_URL}/detect`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  if (data.error_message) {
    throw new Error(`Face++ detect error: ${data.error_message}`);
  }

  if (!data.faces || data.faces.length === 0) {
    throw new Error('No face detected. Please ensure your face is clearly visible and well-lit.');
  }

  const face = data.faces[0];
  return {
    faceToken: face.face_token,
    faceRectangle: face.face_rectangle,
    attributes: face.attributes,
  };
}

/**
 * Compare two face tokens and return confidence score
 */
export async function compareFaces(
  storedFaceToken: string,
  liveFaceToken: string
): Promise<FaceCompareResult> {
  const formData = new FormData();
  formData.append('api_key', FACEPP_API_KEY);
  formData.append('api_secret', FACEPP_API_SECRET);
  formData.append('face_token1', storedFaceToken);
  formData.append('face_token2', liveFaceToken);

  const res = await fetch(`${FACEPP_BASE_URL}/compare`, {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  if (data.error_message) {
    throw new Error(`Face++ compare error: ${data.error_message}`);
  }

  return {
    isMatch: data.confidence >= 80,
    confidence: data.confidence,
    thresholds: data.thresholds,
  };
}

/**
 * Capture a frame from a video element and return it as a base64 JPEG
 */
export function captureFrameFromVideo(videoElement: HTMLVideoElement): string {
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(videoElement, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * Full verification flow: capture from webcam video → detect face → compare with stored token
 */
export async function verifyFromWebcam(
  storedFaceToken: string,
  videoElement: HTMLVideoElement
): Promise<FaceCompareResult> {
  const base64Frame = captureFrameFromVideo(videoElement);
  const liveResult = await detectFaceFromBase64(base64Frame);
  const compareResult = await compareFaces(storedFaceToken, liveResult.faceToken);
  return compareResult;
}
