/**
 * docs-auth.js — Docs password gate
 *
 * Flows:
 *   first visit  → Set your password (localStorage has no stored hash)
 *   returning    → Sign in
 *   forgotten    → Reset via recovery key → set new password
 *
 * Recovery key: MAINT-DOCS-RESET
 * (stored as base64 in source; not plain-text visible)
 *
 * Browser console API:
 *   DocsAuth.logout()   — end session, return to sign-in
 *   DocsAuth.clearAll() — wipe stored password, return to setup
 */
(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────
  var RECOVERY    = 'TUFJTlQtRE9DUy1SRVNFVA=='; // atob → 'MAINT-DOCS-RESET'
  var STORAGE_KEY = 'ma_docs_pw';
  var SESSION_KEY = 'ma_docs_ok';

  // ── Hash (djb2) ────────────────────────────────────────────────────
  function djb2(s) {
    var v = 5381;
    for (var i = 0; i < s.length; i++) v = (Math.imul(v, 33) ^ s.charCodeAt(i)) >>> 0;
    return v.toString(16);
  }

  // ── Auth helpers ───────────────────────────────────────────────────
  function isAuth()       { return sessionStorage.getItem(SESSION_KEY) === '1'; }
  function hasPassword()  { return !!localStorage.getItem(STORAGE_KEY); }
  function checkPw(p)     { return djb2(p) === localStorage.getItem(STORAGE_KEY); }
  function savePw(p)      { localStorage.setItem(STORAGE_KEY, djb2(p)); }
  function grantSession() { sessionStorage.setItem(SESSION_KEY, '1'); }

  // ── Public console API ─────────────────────────────────────────────
  window.DocsAuth = {
    logout:   function () { sessionStorage.removeItem(SESSION_KEY); location.reload(); },
    clearAll: function () { localStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(SESSION_KEY); location.reload(); }
  };

  // ── Hide page until resolved ───────────────────────────────────────
  document.documentElement.style.visibility = 'hidden';
  if (isAuth()) { document.documentElement.style.visibility = ''; return; }

  // ── Inject gate when DOM is ready ─────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    injectStyles();
    var gate = document.createElement('div');
    gate.id = 'docs-gate';
    document.body.insertBefore(gate, document.body.firstChild);
    showView(hasPassword() ? 'login' : 'setup');
    document.documentElement.style.visibility = '';
  });

  // ── View router ────────────────────────────────────────────────────
  function showView(view) {
    var gate = document.getElementById('docs-gate');
    gate.innerHTML = render(view);

    if (view === 'setup') {
      gate.querySelector('#gate-form').addEventListener('submit', onSetup);
    }
    if (view === 'login') {
      gate.querySelector('#gate-form').addEventListener('submit', onLogin);
      gate.querySelector('#gate-secondary').addEventListener('click', function (e) {
        e.preventDefault(); showView('reset');
      });
    }
    if (view === 'reset') {
      gate.querySelector('#gate-form').addEventListener('submit', onReset);
      gate.querySelector('#gate-secondary').addEventListener('click', function (e) {
        e.preventDefault(); showView('login');
      });
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────
  function onSetup(e) {
    e.preventDefault();
    var p1 = val('gate-f1'), p2 = val('gate-f2');
    if (p1.length < 8)  return err('Password must be at least 8 characters.');
    if (p1 !== p2)       return err('Passwords do not match.');
    savePw(p1); grantSession();
    document.getElementById('docs-gate').remove();
  }

  function onLogin(e) {
    e.preventDefault();
    var p = val('gate-f1');
    if (!checkPw(p)) { err('Incorrect password. Please try again.'); document.getElementById('gate-f1').value = ''; return; }
    grantSession();
    document.getElementById('docs-gate').remove();
  }

  function onReset(e) {
    e.preventDefault();
    var key = val('gate-f1').trim();
    var p1  = val('gate-f2');
    var p2  = val('gate-f3');
    if (key !== atob(RECOVERY)) return err('Invalid recovery key.');
    if (p1.length < 8)           return err('Password must be at least 8 characters.');
    if (p1 !== p2)               return err('Passwords do not match.');
    savePw(p1); grantSession();
    document.getElementById('docs-gate').remove();
  }

  function val(id)  { return document.getElementById(id).value; }
  function err(msg) {
    var el = document.getElementById('gate-err');
    el.textContent = msg;
    el.style.display = 'block';
  }

  // ── Templates ──────────────────────────────────────────────────────
  function render(view) {
    var logo =
      '<div class="gate-logo">' +
        '<div class="gate-logo-mark">MA</div>' +
        '<span class="gate-logo-text">Maintenance Agent</span>' +
      '</div>';

    if (view === 'setup') return wrap(logo,
      'Set your password',
      'First time here — choose an access password for the docs.',
      field('gate-f1', 'Password',         'password', 'Minimum 8 characters') +
      field('gate-f2', 'Confirm password', 'password', 'Repeat password'),
      'Set password', null
    );

    if (view === 'login') return wrap(logo,
      'Sign in',
      'Enter the docs access password.',
      field('gate-f1', 'Password', 'password', 'Access password'),
      'Sign in',
      '<a href="#" id="gate-secondary" class="gate-link">Forgot password?</a>'
    );

    if (view === 'reset') return wrap(logo,
      'Reset password',
      'Enter the recovery key, then choose a new password.',
      field('gate-f1', 'Recovery key',     'text',     'Your recovery key') +
      field('gate-f2', 'New password',     'password', 'Minimum 8 characters') +
      field('gate-f3', 'Confirm password', 'password', 'Repeat new password'),
      'Reset password',
      '<a href="#" id="gate-secondary" class="gate-link">← Back to sign in</a>'
    );
  }

  function wrap(logo, title, sub, fields, btn, footer) {
    return (
      '<div class="gate-wrap">' +
        logo +
        '<h1 class="gate-title">' + title + '</h1>' +
        '<p class="gate-sub">' + sub + '</p>' +
        '<div class="gate-card">' +
          '<div id="gate-err" class="gate-err"></div>' +
          '<form id="gate-form">' + fields +
            '<button type="submit" class="gate-btn">' + btn + '</button>' +
          '</form>' +
        '</div>' +
        (footer ? '<div class="gate-footer">' + footer + '</div>' : '') +
      '</div>'
    );
  }

  function field(id, label, type, placeholder) {
    return (
      '<label class="gate-label" for="' + id + '">' + label + '</label>' +
      '<input id="' + id + '" type="' + type + '" class="gate-input"' +
        ' placeholder="' + placeholder + '" autocomplete="' +
        (type === 'password' ? 'current-password' : 'off') + '" required />'
    );
  }

  // ── Styles ─────────────────────────────────────────────────────────
  function injectStyles() {
    var s = document.createElement('style');
    s.textContent = [
      '#docs-gate{position:fixed;inset:0;z-index:9999;background:#fff;overflow-y:auto;',
        'font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;color:#1e293b}',

      '.gate-wrap{max-width:420px;margin:72px auto 0;padding:0 16px 48px}',

      '.gate-logo{display:flex;align-items:center;gap:10px;margin-bottom:28px}',
      '.gate-logo-mark{width:36px;height:36px;border-radius:9px;',
        'background:linear-gradient(135deg,#4f46e5,#7c3aed);',
        'display:flex;align-items:center;justify-content:center;',
        'color:#fff;font-weight:700;font-size:14px;letter-spacing:-.5px}',
      '.gate-logo-text{font-weight:700;font-size:16px;color:#1e293b;letter-spacing:-.3px}',

      '.gate-title{font-size:22px;font-weight:700;color:#1e293b;margin:0 0 6px;letter-spacing:-.3px}',
      '.gate-sub{font-size:13px;color:#475569;margin:0 0 16px;line-height:1.5}',

      '.gate-card{border:1px solid #e2e8f0;border-radius:16px;padding:20px;',
        'background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.06);margin-bottom:12px}',

      '.gate-err{background:#fef2f2;border:1px solid #fca5a5;color:#b91c1c;',
        'padding:10px 12px;border-radius:8px;font-size:13px;margin-bottom:14px;display:none}',

      '.gate-label{display:block;font-size:14px;font-weight:600;color:#1e293b;margin-bottom:5px}',

      '.gate-input{width:100%;padding:10px;border-radius:8px;border:1px solid #e2e8f0;',
        'margin-bottom:12px;font-size:15px;box-sizing:border-box;font-family:inherit;',
        'color:#1e293b;background:#fff;outline:none;transition:border-color .15s,box-shadow .15s}',
      '.gate-input:focus{border-color:#4f46e5;box-shadow:0 0 0 3px rgba(79,70,229,.12)}',

      '.gate-btn{width:100%;padding:10px 14px;border-radius:8px;border:1px solid #4f46e5;',
        'background:#4f46e5;color:#fff;font-size:15px;font-weight:600;cursor:pointer;',
        'font-family:inherit;transition:background .15s;margin-top:2px}',
      '.gate-btn:hover{background:#4338ca}',

      '.gate-footer{text-align:center;padding-top:4px}',
      '.gate-link{font-size:13px;color:#4f46e5;text-decoration:none}',
      '.gate-link:hover{text-decoration:underline}'
    ].join('');
    document.head.appendChild(s);
  }

}());
