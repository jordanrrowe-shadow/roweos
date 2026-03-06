/**
 * RoweOS Cloud Functions — API Caller
 * v19.1: Direct HTTP calls to AI provider APIs (non-streaming)
 * Ported from client-side makeScheduledTaskAPICall() (~line 128080)
 */

var fetch = require('node-fetch');

/**
 * Make a non-streaming API call to the specified provider
 * @param {string} provider - 'anthropic', 'openai', or 'google'
 * @param {string} model - Model ID
 * @param {string} apiKey - API key
 * @param {string} systemPrompt - System prompt
 * @param {string} userPrompt - User prompt
 * @returns {string|null} Response text or null
 */
async function makeApiCall(provider, model, apiKey, systemPrompt, userPrompt) {
  var url, headers, body;

  if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    headers = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    };
    body = JSON.stringify({
      model: model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
  } else if (provider === 'openai') {
    url = 'https://api.openai.com/v1/chat/completions';
    headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey
    };
    body = JSON.stringify({
      model: model,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]
    });
  } else if (provider === 'google') {
    url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userPrompt }] }],
      generationConfig: { maxOutputTokens: 4096 }
    });
  } else {
    throw new Error('Unsupported provider: ' + provider);
  }

  var response = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: body,
    timeout: 120000 // 2 minute timeout
  });

  if (!response.ok) {
    var errText = await response.text();
    throw new Error('API call failed (' + response.status + '): ' + errText.substring(0, 500));
  }

  var data = await response.json();

  if (provider === 'anthropic') {
    return data.content && data.content[0] && data.content[0].text;
  } else if (provider === 'openai') {
    return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  } else if (provider === 'google') {
    return data.candidates && data.candidates[0] && data.candidates[0].content &&
           data.candidates[0].content.parts && data.candidates[0].content.parts[0] &&
           data.candidates[0].content.parts[0].text;
  }
  return null;
}

module.exports = { makeApiCall: makeApiCall };
