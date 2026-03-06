/**
 * RoweOS Cloud Functions — Image Generator
 * v19.5: Gemini image generation + Firebase Storage upload
 * Ported from client-side generateImageWithNanobanana()
 */

var fetch = require('node-fetch');
var admin = require('firebase-admin');

/**
 * Generate an image using Gemini API
 * @param {string} prompt - Image generation prompt
 * @param {string} apiKey - Google API key
 * @param {Object} options - { model, referenceImages }
 * @returns {Object} { images: [{base64, mimeType}], text, model }
 */
async function generateImage(prompt, apiKey, options) {
  var opts = options || {};
  var model = opts.model || 'gemini-2.0-flash-exp-image-generation';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model +
    ':generateContent?key=' + apiKey;

  var parts = [{ text: prompt }];

  // Add reference images if provided (base64 inline data)
  if (opts.referenceImages && opts.referenceImages.length > 0) {
    for (var i = 0; i < opts.referenceImages.length; i++) {
      var ref = opts.referenceImages[i];
      parts.push({
        inline_data: {
          mime_type: ref.mimeType || 'image/png',
          data: ref.base64
        }
      });
    }
  }

  var body = {
    contents: [{ role: 'user', parts: parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      maxOutputTokens: 4096
    }
  };

  console.log('[ImageGen] Calling Gemini model:', model, 'prompt length:', prompt.length);

  var response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeout: 120000
  });

  if (!response.ok) {
    var errText = await response.text();
    throw new Error('Gemini image API failed (' + response.status + '): ' + errText.substring(0, 500));
  }

  var data = await response.json();

  // Parse response — extract text and images
  var result = { images: [], text: '', model: model };

  if (data.candidates && data.candidates[0] && data.candidates[0].content &&
      data.candidates[0].content.parts) {
    var responseParts = data.candidates[0].content.parts;
    for (var j = 0; j < responseParts.length; j++) {
      var part = responseParts[j];
      if (part.text) {
        result.text += part.text;
      } else if (part.inline_data) {
        result.images.push({
          base64: part.inline_data.data,
          mimeType: part.inline_data.mime_type || 'image/png'
        });
      }
    }
  }

  if (result.images.length === 0) {
    throw new Error('Gemini returned no images. Response text: ' + (result.text || '(empty)').substring(0, 200));
  }

  console.log('[ImageGen] Generated', result.images.length, 'image(s)');
  return result;
}

/**
 * Upload a base64 image to Firebase Storage and return a public URL
 * @param {string} uid - Firebase user ID
 * @param {string} imageBase64 - Base64 encoded image data (no data URI prefix)
 * @param {string} mimeType - Image MIME type, e.g. 'image/png'
 * @returns {string} Public download URL
 */
async function uploadToStorage(uid, imageBase64, mimeType) {
  var bucket = admin.storage().bucket();
  var ext = mimeType === 'image/jpeg' ? '.jpg' : mimeType === 'image/webp' ? '.webp' : '.png';
  var filename = 'cloud-images/' + uid + '/' + Date.now() + '-' +
    Math.random().toString(36).substring(2, 8) + ext;
  var file = bucket.file(filename);
  var buffer = Buffer.from(imageBase64, 'base64');

  console.log('[ImageGen] Uploading to Storage:', filename, buffer.length, 'bytes');

  await file.save(buffer, {
    metadata: {
      contentType: mimeType || 'image/png',
      cacheControl: 'public, max-age=604800' // 7 days
    }
  });
  await file.makePublic();

  var publicUrl = 'https://storage.googleapis.com/' + bucket.name + '/' + filename;
  console.log('[ImageGen] Upload complete:', publicUrl);
  return publicUrl;
}

module.exports = {
  generateImage: generateImage,
  uploadToStorage: uploadToStorage
};
