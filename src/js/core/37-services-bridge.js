// 37-services-bridge.js
// v33.12: Plain-JS mirror of services/sync/index.ts and services/agents/index.ts.
//
// The TS facades live in `services/*` and are the canonical types. Until esbuild
// is wired into the production build, this file is the runtime delegate that
// JS callers can use TODAY:
//
//   window.BrillianceServices.sync.writeDB(path, data)
//
// Same contract as services/sync. Falls back to legacy globals.

(function(){
  if (typeof window === 'undefined') return;

  // v33.31: ensure() forwards ALL args including options. The legacy v4 globals
  // accept extra positional args (e.g. writeDB(path, data, { category: 'x' })) —
  // we must not lose them when migrating callers through the bridge.
  function ensure(globalName, methodName) {
    return function() {
      var fn = window[globalName];
      if (typeof fn !== 'function') {
        return Promise.reject(new Error('[services bridge] ' + methodName + ' unavailable — ' + globalName + ' not loaded'));
      }
      try {
        var result = fn.apply(null, arguments);
        // v4 functions sometimes return undefined (sync) or a Promise. Wrap consistently.
        return Promise.resolve(result);
      } catch(e) {
        return Promise.reject(e);
      }
    };
  }

  var sync = {
    writeDB:        ensure('writeDB',        'writeDB'),
    readDB:         ensure('readDB',         'readDB'),
    writeDBDoc:     ensure('writeDBDoc',     'writeDBDoc'),
    deleteDBDoc:    ensure('deleteDBDoc',    'deleteDBDoc'),
    loadFromFirebase: ensure('loadFromFirebaseV2', 'loadFromFirebase'),
    manualSyncNow:  ensure('manualSyncNow',  'manualSyncNow'),
    mergeByTimestamp: function(local, cloud, idField) {
      if (typeof window.mergeByTimestamp === 'function') {
        return window.mergeByTimestamp(local, cloud, idField || 'id');
      }
      return cloud && cloud.length ? cloud : local;
    },
    currentUser: function() { return (typeof window.firebaseUser !== 'undefined' && window.firebaseUser) ? window.firebaseUser : null; }
  };

  function _agentCall(globalName, label) {
    return function(opts) {
      if (typeof window[globalName] !== 'function') {
        return Promise.reject(new Error('[services bridge] ' + label + ' unavailable'));
      }
      var cb = opts.callbacks || {};
      try {
        var result = window[globalName](opts.model, opts.apiKey, opts.messages, opts.systemPrompt, cb.onChunk, cb.onComplete, cb.onError, cb.abortSignal);
        return Promise.resolve(result);
      } catch(e) {
        return Promise.reject(e);
      }
    };
  }

  var agents = {
    callAnthropic:    _agentCall('callAnthropicStreaming',  'callAnthropicStreaming'),
    callOpenAI:       _agentCall('callOpenAIStreaming',     'callOpenAIStreaming'),
    callGoogle:       _agentCall('callGoogleStreaming',     'callGoogleStreaming'),
    callNanobanana:   _agentCall('callNanobananaStreaming', 'callNanobananaStreaming'),
    dispatch: function(provider, opts) {
      switch (provider) {
        case 'anthropic':   return agents.callAnthropic(opts);
        case 'openai':      return agents.callOpenAI(opts);
        case 'google':      return agents.callGoogle(opts);
        case 'nanobanana':  return agents.callNanobanana(opts);
        default:            return agents.callAnthropic(opts);
      }
    },
    getAgentSystemPrompt: function(id) {
      return (typeof window.getAgentSystemPrompt === 'function') ? window.getAgentSystemPrompt(id) : '';
    },
    buildBrandSystemPrompt: function(brand, agent) {
      return (typeof window.buildBrandSystemPrompt === 'function') ? window.buildBrandSystemPrompt(brand, agent) : '';
    }
  };

  window.BrillianceServices = {
    sync: sync,
    agents: agents
  };
})();
