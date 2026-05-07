// ── NAVIGATION CONFIG ──────────────────────────────────────────────────────────
const NAV_CONFIG = {
  super: [
    { section: 'Tableau de bord' },
    { id: 'dashboard', icon: 'fas fa-tachometer-alt', label: 'Dashboard' },
    { section: 'Administration' },
    { id: 'super-ecoles', icon: 'fas fa-school', label: 'Écoles' },
    { id: 'super-stats', icon: 'fas fa-chart-bar', label: 'Statistiques' },
    { section: 'Communication' },
    { id: 'messages', icon: 'fas fa-envelope', label: 'Messages', badge: 'msg' },
    { id: 'annonces', icon: 'fas fa-bullhorn', label: 'Annonces' },
  ],
  admin: [
    { section: 'Tableau de bord' },
    { id: 'dashboard', icon: 'fas fa-tachometer-alt', label: 'Dashboard' },
    { section: 'Gestion Scolaire' },
    { id: 'eleves', icon: 'fas fa-user-graduate', label: 'Élèves' },
    { id: 'profs', icon: 'fas fa-chalkboard-teacher', label: 'Enseignants' },
    { id: 'classes', icon: 'fas fa-door-open', label: 'Classes' },
    { id: 'emploi', icon: 'fas fa-calendar-week', label: 'Emploi du temps' },
    { section: 'Pédagogie' },
    { id: 'presences', icon: 'fas fa-clipboard-check', label: 'Présences' },
    { id: 'notes', icon: 'fas fa-star-half-alt', label: 'Notes & Bulletins' },
    { section: 'Finances' },
    { id: 'facturation', icon: 'fas fa-file-invoice-dollar', label: 'Facturation' },
    { section: 'Communication' },
    { id: 'messages', icon: 'fas fa-envelope', label: 'Messages', badge: 'msg' },
    { id: 'annonces', icon: 'fas fa-bullhorn', label: 'Annonces' },
  ],
  prof: [
    { section: 'Navigation' },
    { id: 'dashboard', icon: 'fas fa-tachometer-alt', label: 'Dashboard' },
    { id: 'emploi', icon: 'fas fa-calendar-week', label: 'Mon emploi du temps' },
    { id: 'presences', icon: 'fas fa-clipboard-check', label: 'Présences' },
    { id: 'notes', icon: 'fas fa-star-half-alt', label: 'Notes' },
    { section: 'Communication' },
    { id: 'messages', icon: 'fas fa-envelope', label: 'Messages', badge: 'msg' },
    { id: 'annonces', icon: 'fas fa-bullhorn', label: 'Annonces' },
  ],
  eleve: [
    { section: 'Navigation' },
    { id: 'dashboard', icon: 'fas fa-tachometer-alt', label: 'Dashboard' },
    { id: 'emploi', icon: 'fas fa-calendar-week', label: 'Mon emploi du temps' },
    { id: 'notes', icon: 'fas fa-star-half-alt', label: 'Mes notes' },
    { id: 'presences', icon: 'fas fa-clipboard-check', label: 'Mes absences' },
    { id: 'facturation', icon: 'fas fa-file-invoice-dollar', label: 'Mes factures' },
    { section: 'Communication' },
    { id: 'messages', icon: 'fas fa-envelope', label: 'Messages', badge: 'msg' },
    { id: 'annonces', icon: 'fas fa-bullhorn', label: 'Annonces' },
  ],
  parent: [
    { section: 'Navigation' },
    { id: 'dashboard', icon: 'fas fa-tachometer-alt', label: 'Dashboard' },
    { id: 'notes', icon: 'fas fa-star-half-alt', label: 'Notes de mon enfant' },
    { id: 'presences', icon: 'fas fa-clipboard-check', label: 'Absences' },
    { id: 'facturation', icon: 'fas fa-file-invoice-dollar', label: 'Factures' },
    { section: 'Communication' },
    { id: 'messages', icon: 'fas fa-envelope', label: 'Messages', badge: 'msg' },
    { id: 'annonces', icon: 'fas fa-bullhorn', label: 'Annonces' },
  ]
};

// ── GLOBAL STATE ──────────────────────────────────────────────────────────────
window.APP = {
  user: null,
  currentPage: 'dashboard',
  notifInterval: null,
  msgCount: 0,
  notifCount: 0,
};

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
function buildNav(role) {
  const nav = NAV_CONFIG[role] || NAV_CONFIG.admin;
  const container = document.getElementById('sidebar-nav');
  container.innerHTML = nav.map(item => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    return `<div class="nav-item" id="nav-${item.id}" onclick="showPage('${item.id}')">
      <span class="nav-icon"><i class="${item.icon}"></i></span>
      <span>${item.label}</span>
      ${item.badge ? `<span class="nav-badge" id="nav-badge-${item.badge}" style="display:none;">0</span>` : ''}
    </div>`;
  }).join('');
}

function setActiveNav(page) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('nav-' + page);
  if (el) el.classList.add('active');
}

function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const main = document.getElementById('main');
  const overlay = document.getElementById('sidebar-overlay');
  if (window.innerWidth <= 768) {
    sb.classList.toggle('mobile-open');
    overlay.classList.toggle('show');
  } else {
    sb.classList.toggle('collapsed');
    main.classList.toggle('full');
  }
}

// ── PAGES ─────────────────────────────────────────────────────────────────────
window.showPage = async function(page) {
  APP.currentPage = page;
  setActiveNav(page);
  document.getElementById('topbar-title').textContent = getPageTitle(page);
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  }
  const content = document.getElementById('content');
  content.innerHTML = '<div style="display:flex;justify-content:center;padding:60px;"><div class="loader"></div></div>';
  try {
    switch(page) {
      case 'dashboard': await renderDashboard(); break;
      case 'eleves': await renderEleves(); break;
      case 'profs': await renderProfs(); break;
      case 'classes': await renderClasses(); break;
      case 'emploi': await renderEmploi(); break;
      case 'presences': await renderPresences(); break;
      case 'notes': await renderNotes(); break;
      case 'facturation': await renderFacturation(); break;
      case 'annonces': await renderAnnonces(); break;
      case 'messages': await renderMessages(); break;
      case 'super-ecoles': await renderSuperEcoles(); break;
      case 'super-stats': await renderSuperStats(); break;
      case 'notifications': await renderNotifications(); break;
      default: content.innerHTML = '<div class="empty-state"><div class="empty-icon">🚧</div><h3>Page en développement</h3></div>';
    }
  } catch(e) {
    content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Erreur : ${e.message}</h3></div>`;
  }
};

function getPageTitle(page) {
  const titles = {
    dashboard: 'Tableau de bord', eleves: 'Élèves', profs: 'Enseignants',
    classes: 'Classes', emploi: 'Emploi du temps', presences: 'Présences',
    notes: 'Notes & Bulletins', facturation: 'Facturation', annonces: 'Annonces',
    messages: 'Messagerie', 'super-ecoles': 'Gestion des Écoles',
    'super-stats': 'Statistiques Globales', notifications: 'Notifications'
  };
  return titles[page] || page;
}

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
async function loadNotifCount() {
  try {
    const token = localStorage.getItem('token');
    if (!token) return;
    const r = await fetch('/api/dashboard', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return;
    const data = await r.json();
    // Messages non lus
    if (data.msgCount > 0) {
      document.getElementById('msg-badge').textContent = data.msgCount;
      document.getElementById('msg-badge').style.display = 'flex';
      const nb = document.getElementById('nav-badge-msg');
      if (nb) { nb.textContent = data.msgCount; nb.style.display = 'inline-block'; }
    } else {
      document.getElementById('msg-badge').style.display = 'none';
      const nb = document.getElementById('nav-badge-msg');
      if (nb) nb.style.display = 'none';
    }
    // Notifications non lues
    if (data.notifCount > 0) {
      document.getElementById('notif-badge').textContent = data.notifCount;
      document.getElementById('notif-badge').style.display = 'flex';
    } else {
      document.getElementById('notif-badge').style.display = 'none';
    }
    APP.msgCount = data.msgCount;
    APP.notifCount = data.notifCount;
  } catch(e) {}
}

window.toggleNotifPanel = async function() {
  const panel = document.getElementById('notif-panel');
  const isOpen = panel.style.display !== 'none';
  panel.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) await loadNotifPanel();
};

async function loadNotifPanel() {
  const list = document.getElementById('notif-list');
  list.innerHTML = '<div style="padding:16px; color:var(--muted); font-size:13px;">Chargement...</div>';
  try {
    const token = localStorage.getItem('token');
    const r = await fetch('/api/notifications', { headers: { Authorization: 'Bearer ' + token } });
    const notifs = await r.json();
    if (!notifs.length) {
      list.innerHTML = '<div style="padding:24px; text-align:center; color:var(--muted); font-size:13px;">Aucune notification</div>';
      return;
    }
    list.innerHTML = notifs.slice(0, 10).map(n => `
      <div class="notif-item ${n.lu ? '' : 'unread'}" onclick="markNotifRead(${n.id}, this)">
        <div style="font-size:13px; font-weight:${n.lu ? 400 : 700}; color:var(--text);">${n.titre}</div>
        <div style="font-size:12px; color:var(--muted); margin-top:2px;">${n.message || ''}</div>
        <div style="font-size:11px; color:var(--muted); margin-top:4px;">${new Date(n.created_at).toLocaleString('fr-FR')}</div>
      </div>`).join('');
  } catch(e) {
    list.innerHTML = '<div style="padding:16px; color:var(--danger); font-size:13px;">Erreur de chargement</div>';
  }
}

window.markNotifRead = async function(id, el) {
  const token = localStorage.getItem('token');
  await fetch('/api/notifications/' + id + '/lu', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
  el.classList.remove('unread');
  el.querySelector('div').style.fontWeight = '400';
  loadNotifCount();
};

window.markAllNotifsRead = async function() {
  const token = localStorage.getItem('token');
  await fetch('/api/notifications/all/lu', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
  document.getElementById('notif-panel').style.display = 'none';
  loadNotifCount();
  toast('Toutes les notifications marquées comme lues', 'success');
};

window.renderNotifications = async function() {
  const token = localStorage.getItem('token');
  const r = await fetch('/api/notifications', { headers: { Authorization: 'Bearer ' + token } });
  const notifs = await r.json();
  const typeIcons = { note: '📝', absence: '🚨', facture: '💰', message: '✉️' };
  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Notifications</div></div>
      <button class="btn btn-outline btn-sm" onclick="markAllNotifsRead()"><i class="fas fa-check-double"></i> Tout marquer lu</button>
    </div>
    <div class="card" style="padding:0;">
      ${!notifs.length ? '<div class="empty-state"><div class="empty-icon">🔔</div><h3>Aucune notification</h3></div>' :
      notifs.map(n => `<div class="notif-item ${n.lu ? '' : 'unread'}" onclick="markNotifRead(${n.id}, this)">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="font-size:20px;">${typeIcons[n.type] || '📣'}</span>
          <div>
            <div style="font-size:13.5px; font-weight:${n.lu ? 500 : 700}; color:var(--text);">${n.titre}</div>
            <div style="font-size:12px; color:var(--muted);">${n.message || ''}</div>
            <div style="font-size:11px; color:var(--muted); margin-top:4px;">${new Date(n.created_at).toLocaleString('fr-FR')}</div>
          </div>
        </div>
      </div>`).join('')}
    </div>`;
};

// Close notif panel on outside click
document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  const btn = document.getElementById('notif-btn');
  if (panel && !btn?.contains(e.target)) panel.style.display = 'none';
});

// ── AUTH ──────────────────────────────────────────────────────────────────────
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  btn.innerHTML = '<span class="spinner"></span> Connexion...';
  btn.disabled = true;
  try {
    const r = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Erreur');
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    initApp(data.user);
  } catch(err) {
    toast(err.message, 'error');
    btn.innerHTML = 'Se connecter';
    btn.disabled = false;
  }
});

window.loginDemo = async function() {
  document.getElementById('login-email').value = 'demo@madrasati.ma';
  document.getElementById('login-password').value = 'eleve123';
  document.getElementById('login-form').dispatchEvent(new Event('submit'));
};

window.logout = async function() {
  await fetch('/api/logout', { method: 'POST' });
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (APP.notifInterval) clearInterval(APP.notifInterval);
  location.reload();
};

// ── INIT ──────────────────────────────────────────────────────────────────────
function initApp(user) {
  APP.user = user;
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('app').style.display = 'flex';
  document.getElementById('sidebar-avatar').textContent = (user.prenom?.[0] || '') + (user.nom?.[0] || '');
  document.getElementById('sidebar-username').textContent = user.prenom + ' ' + user.nom;
  document.getElementById('sidebar-role').textContent = { super:'Super Admin', admin:'Administrateur', prof:'Enseignant', eleve:'Élève', parent:'Parent' }[user.role] || user.role;
  buildNav(user.role);
  // Show change-pwd button only for non-demo
  if (user.email !== 'demo@madrasati.ma') {
    document.getElementById('change-pwd-btn').style.display = 'flex';
  }
  // Show admin btn for super
  if (user.role === 'super') {
    document.getElementById('admin-btn').style.display = 'flex';
  }
  // Trial banner
  fetch('/api/trial').then(r => r.json()).then(info => {
    if (info.active && !info.unlimited) {
      document.getElementById('trial-banner').style.display = 'block';
      document.getElementById('trial-countdown').textContent = info.hoursLeft + 'h';
    }
  });
  // Start polling notifications every 30s
  loadNotifCount();
  APP.notifInterval = setInterval(loadNotifCount, 30000);
  // Register PWA service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  showPage('dashboard');
}

// ── DARK MODE ─────────────────────────────────────────────────────────────────
window.toggleDark = function() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  localStorage.setItem('theme', isDark ? 'light' : 'dark');
  document.getElementById('dark-icon').className = isDark ? 'fas fa-moon' : 'fas fa-sun';
  document.getElementById('dark-label').textContent = isDark ? 'Mode sombre' : 'Mode clair';
};

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────
window.openChangePassword = function() {
  showModal(`
    <div class="modal-header">
      <span class="modal-title">🔐 Changer mon mot de passe</span>
      <button onclick="closeModal()" class="btn btn-outline btn-sm btn-icon"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Mot de passe actuel</label>
        <input type="password" id="cur-pwd" class="form-input" placeholder="Mot de passe actuel">
      </div>
      <div class="form-group">
        <label class="form-label">Nouveau mot de passe</label>
        <input type="password" id="new-pwd" class="form-input" placeholder="Au moins 6 caractères">
      </div>
      <div class="form-group">
        <label class="form-label">Confirmer</label>
        <input type="password" id="new-pwd2" class="form-input" placeholder="Confirmer le nouveau mot de passe">
      </div>
    </div>
    <div class="modal-footer">
      <button onclick="closeModal()" class="btn btn-outline">Annuler</button>
      <button onclick="savePassword()" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
    </div>`);
};

window.savePassword = async function() {
  const cur = document.getElementById('cur-pwd').value;
  const np = document.getElementById('new-pwd').value;
  const np2 = document.getElementById('new-pwd2').value;
  if (np !== np2) return toast('Les mots de passe ne correspondent pas', 'error');
  if (np.length < 6) return toast('Mot de passe trop court (min 6 caractères)', 'error');
  const token = localStorage.getItem('token');
  const r = await fetch('/api/users/' + APP.user.id + '/password', {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ currentPassword: cur, password: np })
  });
  const data = await r.json();
  if (!r.ok) return toast(data.error || 'Erreur', 'error');
  toast('Mot de passe changé !', 'success');
  closeModal();
};

// ── EXPORT ────────────────────────────────────────────────────────────────────
window.exportData = async function() {
  const token = localStorage.getItem('token');
  const r = await fetch('/api/export', { headers: { Authorization: 'Bearer ' + token } });
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'madrasati_backup.json'; a.click();
};

window.resetData = async function() {
  if (!confirm('⚠️ Êtes-vous sûr de vouloir réinitialiser toutes les données ?')) return;
  if (!confirm('Dernière confirmation — cette action est irréversible.')) return;
  const token = localStorage.getItem('token');
  const r = await fetch('/api/reset', { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
  if (r.ok) { toast('Données réinitialisées !', 'success'); setTimeout(() => location.reload(), 1500); }
};

window.globalSearch = function(q) {
  if (!q) return;
  // Simple: redirect to eleves page with search
  if (APP.currentPage !== 'eleves') showPage('eleves');
};

// ── UTILS ────────────────────────────────────────────────────────────────────
window.showModal = function(html) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'modal-overlay';
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
};

window.closeModal = function() {
  const m = document.getElementById('modal-overlay');
  if (m) m.remove();
};

window.toast = function(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
  el.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i>${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
};

window.fmt = function(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-FR');
};

window.fmtMoney = function(n) {
  return (n || 0).toLocaleString('fr-MA') + ' MAD';
};

// ── STARTUP ───────────────────────────────────────────────────────────────────
(function() {
  const theme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'dark') {
    document.getElementById('dark-icon').className = 'fas fa-sun';
    document.getElementById('dark-label').textContent = 'Mode clair';
  }
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');
  if (token && user) {
    try { initApp(JSON.parse(user)); } catch(e) { localStorage.clear(); }
  }
})();
