import https from 'https';

export const CLOUDINARY_CLOUD_NAME = 'zw16y5km';
export const CLOUDINARY_UPLOAD_PRESET = 'cbithack';
export const FACEPP_API_KEY = 'xgKvCBcMZUo8AdxTGULbfQJOzQcwarsS';
export const FACEPP_API_SECRET = 'LSQThJFKnFYSyqY0dhfRkVhH2zwKzIMO';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Upload an image (base64 string or public URL) to Cloudinary
 */
export async function uploadToCloudinaryServer(
  fileOrUrl: string,
  folder = 'proctor-forge/candidate-photos'
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      file: fileOrUrl,
      upload_preset: CLOUDINARY_UPLOAD_PRESET,
      folder,
    }).toString();

    const options: https.RequestOptions = {
      hostname: 'api.cloudinary.com',
      port: 443,
      path: `/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Connection': 'close',
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(new Error(`Cloudinary error: ${parsed.error.message}`));
          }
          resolve({
            url: parsed.secure_url || parsed.url,
            publicId: parsed.public_id,
          });
        } catch {
          reject(new Error(`Cloudinary parse error: ${data.slice(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Cloudinary upload timed out'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Internal single attempt for Face++ detect from URL
 */
function rawDetectFaceUrl(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      api_key: FACEPP_API_KEY,
      api_secret: FACEPP_API_SECRET,
      image_url: imageUrl,
      return_attributes: 'gender,age',
    }).toString();

    const options: https.RequestOptions = {
      hostname: 'api-us.faceplusplus.com',
      port: 443,
      path: '/facepp/v3/detect',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Connection': 'close',
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error_message) {
            return reject(new Error(parsed.error_message));
          }
          if (!parsed.faces || parsed.faces.length === 0) {
            return reject(new Error('NO_FACE_DETECTED'));
          }
          resolve(parsed.faces[0].face_token);
        } catch {
          reject(new Error(`Face++ parse error: ${data.slice(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Face++ request timed out'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Detect a face from a public image URL with automatic retry on rate limits
 */
export async function detectFaceServerSide(imageUrl: string): Promise<string> {
  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await rawDetectFaceUrl(imageUrl);
    } catch (err: any) {
      lastErr = err.message || '';
      if (lastErr.includes('CONCURRENCY_LIMIT_EXCEEDED') || lastErr.includes('LIMIT')) {
        await sleep(800 * attempt);
        continue;
      }
      if (lastErr === 'NO_FACE_DETECTED') {
        throw new Error('No face detected in the image. Please provide a clear passport-style photo.');
      }
      throw err;
    }
  }
  throw new Error(`Face detection failed: ${lastErr}`);
}

/**
 * Internal single attempt for Face++ detect from Base64
 */
function rawDetectFaceBase64(base64Data: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');

    const postData = new URLSearchParams({
      api_key: FACEPP_API_KEY,
      api_secret: FACEPP_API_SECRET,
      image_base64: cleanBase64,
    }).toString();

    const options: https.RequestOptions = {
      hostname: 'api-us.faceplusplus.com',
      port: 443,
      path: '/facepp/v3/detect',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Connection': 'close',
      },
      timeout: 20000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error_message) {
            return reject(new Error(parsed.error_message));
          }
          if (!parsed.faces || parsed.faces.length === 0) {
            return reject(new Error('NO_FACE_DETECTED'));
          }
          resolve(parsed.faces[0].face_token);
        } catch {
          reject(new Error(`Face++ parse error: ${data.slice(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Face++ request timed out'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Detect a face from base64 with automatic retry on rate limits
 */
export async function detectFaceFromBase64ServerSide(base64Data: string): Promise<string> {
  let lastErr = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await rawDetectFaceBase64(base64Data);
    } catch (err: any) {
      lastErr = err.message || '';
      if (lastErr.includes('CONCURRENCY_LIMIT_EXCEEDED') || lastErr.includes('LIMIT')) {
        await sleep(800 * attempt);
        continue;
      }
      if (lastErr === 'NO_FACE_DETECTED') {
        throw new Error('No face detected in the webcam capture. Please look directly into the camera.');
      }
      throw err;
    }
  }
  throw new Error(`Webcam face scan failed: ${lastErr}`);
}

/**
 * Internal single attempt for Face++ compare
 */
function rawCompareFaces(
  token1: string,
  token2: string
): Promise<{ confidence: number; thresholds: any }> {
  return new Promise((resolve, reject) => {
    const postData = new URLSearchParams({
      api_key: FACEPP_API_KEY,
      api_secret: FACEPP_API_SECRET,
      face_token1: token1,
      face_token2: token2,
    }).toString();

    const options: https.RequestOptions = {
      hostname: 'api-us.faceplusplus.com',
      port: 443,
      path: '/facepp/v3/compare',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'Connection': 'close',
      },
      timeout: 15000,
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error_message) {
            return reject(new Error(parsed.error_message));
          }
          resolve({
            confidence: parsed.confidence || 0,
            thresholds: parsed.thresholds || {},
          });
        } catch {
          reject(new Error(`Face++ compare parse error: ${data.slice(0, 100)}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Face++ compare request timed out'));
    });
    req.write(postData);
    req.end();
  });
}

/**
 * Compare two face tokens using Face++ Compare API with automatic retry
 */
export async function compareFacesServerSide(
  token1: string,
  token2: string
): Promise<{ confidence: number; thresholds: any }> {
  let lastErr = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      return await rawCompareFaces(token1, token2);
    } catch (err: any) {
      lastErr = err.message || '';
      if (lastErr.includes('CONCURRENCY_LIMIT_EXCEEDED') || lastErr.includes('LIMIT') || lastErr.includes('403')) {
        // Generous backoff for Face++ free tier rate limit
        await sleep(1000 * attempt);
        continue;
      }
      throw err;
    }
  }
  throw new Error(`Face comparison failed: ${lastErr}`);
}
