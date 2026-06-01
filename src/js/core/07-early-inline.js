  // v33.1/v33.9: Set Brilli form on <html> before first paint to avoid blob/orb flash.
  (function setBrilliFormEarly(){
    try {
      var f = localStorage.getItem('roweos_brilli_form');
      var valid = ['celestial','aura','firefly','signature','classic'];
      if (!f || valid.indexOf(f) === -1) f = 'celestial';
      document.documentElement.setAttribute('data-brilli-form', f);
    } catch(e) {
      try { document.documentElement.setAttribute('data-brilli-form', 'celestial'); } catch(eR){}
    }
  })();

  // v33.2: Set Evolve flag attribute pre-paint so flag-gated nav items render correctly.
  (function setEvolveFlagEarly(){
    try {
      var enabled = localStorage.getItem('roweos_evolve_enabled') === 'true';
      document.documentElement.setAttribute('data-evolve', enabled ? 'on' : 'off');
    } catch(e) {
      try { document.documentElement.setAttribute('data-evolve', 'off'); } catch(eR){}
    }
  })();

  // v27.1: Toggle email form visibility on auth screen
  function toggleEmailForm() {
    var form = document.getElementById('authEmailForm');
    var card = document.getElementById('authEmailCard');
    if (!form) return;
    if (form.style.display === 'none') {
      form.style.display = 'block';
      card.style.borderColor = 'rgba(201,181,122,0.4)';
      card.style.background = 'rgba(201,181,122,0.05)';
      card.onmouseover = null;
      card.onmouseout = null;
      setTimeout(function() {
        var emailInput = document.getElementById('authEmailInput');
        if (emailInput) emailInput.focus();
      }, 100);
    } else {
      form.style.display = 'none';
      card.style.borderColor = 'rgba(255,255,255,0.08)';
      card.style.background = 'rgba(255,255,255,0.03)';
      card.onmouseover = function() { this.style.borderColor='#b2997b';this.style.transform='translateY(-2px)';this.style.boxShadow='0 6px 24px rgba(178,153,123,0.1)'; };
      card.onmouseout = function() { this.style.borderColor='rgba(255,255,255,0.08)';this.style.transform='none';this.style.boxShadow='none'; };
    }
  }

  // v27.1: Gold transition from welcome splash to auth login
  function triggerGoldTransition() {
    var splash = document.getElementById('authSplash');
    var gold = document.getElementById('goldTransitionOverlay');
    var login = document.getElementById('authLogin');

    // Fade out splash content
    splash.style.transition = 'opacity 0.4s ease';
    splash.style.opacity = '0';

    // Fire gold flash
    setTimeout(function() {
      gold.style.pointerEvents = 'all';
      gold.style.animation = 'splashGoldFlash 1.4s ease forwards';
      gold.style.opacity = '1';
    }, 200);

    // Show login screen
    setTimeout(function() {
      splash.style.display = 'none';
      login.style.display = 'block';
      login.style.opacity = '0';
      login.style.transition = 'opacity 0.6s ease';
      setTimeout(function() { login.style.opacity = '1'; }, 50);
    }, 900);

    // Clear gold overlay
    setTimeout(function() {
      gold.style.transition = 'opacity 0.5s ease';
      gold.style.opacity = '0';
      setTimeout(function() {
        gold.style.animation = '';
        gold.style.pointerEvents = 'none';
      }, 500);
    }, 1600);
  }

  function showAuthLogin() {
    var splash = document.getElementById('authSplash');
    var login = document.getElementById('authLogin');
    if (splash) splash.style.display = 'none';
    if (login) { login.style.display = 'block'; login.style.opacity = '0'; setTimeout(function() { login.style.transition = 'opacity 0.3s ease'; login.style.opacity = '1'; }, 10); }
  }
  function showAuthSplash() {
    var splash = document.getElementById('authSplash');
    var login = document.getElementById('authLogin');
    if (login) login.style.display = 'none';
    if (splash) splash.style.display = 'block';
    // v27.1: Reset splash visibility for gold transition re-entry
    var splash = document.getElementById('authSplash');
    if (splash) {
      splash.style.display = 'flex';
      splash.style.opacity = '1';
      splash.style.transition = 'none';
    }
    var gold = document.getElementById('goldTransitionOverlay');
    if (gold) {
      gold.style.opacity = '0';
      gold.style.animation = '';
      gold.style.pointerEvents = 'none';
    }
  }
  // v20.8: Auth gate theme toggle - class-based approach
  function toggleAuthTheme() {
    var html = document.documentElement;
    var gate = document.getElementById('authGate');
    var isLight = html.classList.toggle('light-mode');
    if (gate) {
      if (isLight) { gate.classList.add('auth-light'); }
      else { gate.classList.remove('auth-light'); }
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = isLight ? '#f5f5f5' : '#0a0a0a';
  }
  // v34.109: Reload always lands on the "Be Brilliant" splash for everyone.
  // Previously (v20.1) returning users were shortcut to the login form so they
  // wouldn't see the welcome splash on every reload. Per user direction: keep
  // the branded splash on every reload; the Begin button takes them through
  // the gold transition to the sign-in form in one tap.
  // (No-op block kept here so any future inline shortcut writes to a single
  // documented location.)
