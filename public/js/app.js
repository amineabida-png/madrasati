// MAIN APP
let currentUser = null;
let isDark = localStorage.getItem('theme') === 'dark';
if (isDark) document.documentElement.setAttribute('data-theme', 'dark');

const NAV_ADMIN = [
  { section: 'Principal' },
  { id: 'dashboard', icon: 'tachometer-alt', label: 'Tableau de bord' },
  { section: 'Académique' },
  { id: 'eleves', icon: 'user-graduate', label: 'Élèves' },
  { id: 'profs', icon: 'chalkboard-teacher', label: 'Enseignants' },
  { id: 'classes', icon: 'school', label: 'Classes & Groupes' },
  { id: 'emploi', icon: 'calendar-alt', label: 'Emploi du temps' },
  { id: 'presences', icon: 'clipboard-check', label: 'Présences' },
  { id: 'notes', icon: 'star-half-alt', label: 'Notes & Bulletins' },
  { section: 'Administration' },
  { id: 'facturation', icon: 'file-invoice-dollar', label: 'Facturation', badge: 'impayees' },
  { id: 'annonces', icon: 'bullhorn', label: 'Annonces' },
];

const NAV_PROF = [
  { section: 'Menu' },
  { id: 'dashboard', icon: 'tachometer-alt', label: 'Tableau de bord' },
  { id: 'eleves', icon: 'user-graduate', label: 'Mes Élèves' },
  { id: 'emploi', icon: 'calendar-alt', label: 'Mon Emploi du temps' },
  { id: 'presences', icon: 'clipboard-check', label: 'Présences' },
  { id: 'notes', icon: 'star-half-alt', label: 'Notes' },
  { id: 'annonces', icon: 'bullhorn', label: 'Annonces' },
];

const NAV_ELEVE = [
  { section: 'Menu' },
  { id: 'dashboard', icon: 'tachometer-alt', label: 'Tableau de bord' },
  { id: 'emploi', icon: 'calendar-alt', label: 'Mon Emploi du temps' },
  { id: 'notes', icon: 'star-half-alt', label: 'Mes Notes' },
  { id: 'presences', icon: 'clipboard-check', label: 'Mes Présences' },
  { id: 'annonces', icon: 'bullhorn', label: 'Annonces' },
];

const NAV_PARENT = [
  { section: 'Menu' },
  { id: 'dashboard', icon: 'tachometer-alt', label: 'Tableau de bord' },
  { id: 'notes', icon: 'star-half-alt', label: 'Notes & Bulletins' },
  { id: 'presences', icon: 'clipboard-check', label: 'Présences' },
  { id: 'facturation', icon: 'file-invoice-dollar', label: 'Factures' },
  { id: 'annonces', icon: 'bullhorn', label: 'Annonces' },
];

const PAGE_TITLES = {
  dashboard: 'Tableau de bord',
  eleves: 'Gestion des Élèves',
  profs: 'Gestion des Enseignants',
  classes: 'Classes & Groupes',
  emploi: 'Emploi du Temps',
  presences: 'Gestion des Présences',
  notes: 'Notes & Bulletins',
  facturation: 'Facturation & Paiements',
  annonces: 'Annonces & Communication',
};

function buildSidebar(role) {
  const navMap = { admin: NAV_ADMIN, prof: NAV_PROF, eleve: NAV_ELEVE, parent: NAV_PARENT };
  const items = navMap[role] || NAV_ELEVE;
  const nav = document.getElementById('sidebar-nav');
  nav.innerHTML = items.map(item => {
    if (item.section) return `<div class="nav-section">${item.section}</div>`;
    return `<div class="nav-item" id="nav-${item.id}" onclick="showPage('${item.id}')">
      <span class="nav-icon"><i class="fas fa-${item.icon}"></i></span>
      <span>${item.label}</span>
      ${item.badge ? `<span class="nav-badge" id="badge-${item.badge}" style="display:none">0</span>` : ''}
    </div>`;
  }).join('');
}

function setActiveNav(pageId) {
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`nav-${pageId}`)?.classList.add('active');
  document.getElementById('topbar-title').textContent = PAGE_TITLES[pageId] || pageId;
}

const PAGES = {
  dashboard: renderDashboard,
  eleves: renderEleves,
  profs: renderProfs,
  classes: renderClasses,
  emploi: renderEmploi,
  presences: renderPresences,
  notes: renderNotes,
  facturation: renderFacturation,
  annonces: renderAnnonces,
};

async function showPage(pageId) {
  setActiveNav(pageId);
  const content = document.getElementById('content');
  content.innerHTML = `<div class="empty-state"><div class="loader" style="margin:0 auto;"></div></div>`;
  const fn = PAGES[pageId];
  if (fn) {
    try {
      await fn(content);
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Erreur de chargement</h3><p>${err.message}</p></div>`;
    }
  }
  // close sidebar on mobile
  if (window.innerWidth < 768) {
    document.getElementById('sidebar').classList.remove('mobile-open');
    document.getElementById('sidebar-overlay').classList.remove('show');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (window.innerWidth < 768) {
    sidebar.classList.toggle('mobile-open');
    overlay.classList.toggle('show');
  } else {
    sidebar.classList.toggle('collapsed');
    document.getElementById('main').classList.toggle('full');
  }
}

function toggleDark() {
  isDark = !isDark;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  document.getElementById('dark-icon').className = isDark ? 'fas fa-sun' : 'fas fa-moon';
  document.getElementById('dark-label').textContent = isDark ? 'Mode clair' : 'Mode sombre';
}

async function logout() {
  await API.post('/api/logout');
  localStorage.removeItem('token');
  location.reload();
}

const globalSearch = debounce(async (val) => {
  if (!val.trim() || val.length < 2) return;
  const [eleves, factures] = await Promise.all([
    API.get(`/api/eleves?search=${encodeURIComponent(val)}`),
    API.get(`/api/factures?search=${encodeURIComponent(val)}`)
  ]);
  // Show quick results
  let existing = document.getElementById('search-results');
  if (existing) existing.remove();
  if (!eleves.length && !factures.length) return;
  const div = document.createElement('div');
  div.id = 'search-results';
  div.style.cssText = 'position:absolute;top:44px;left:0;right:0;background:var(--card);border:1px solid var(--border);border-radius:10px;z-index:1000;box-shadow:0 8px 24px rgba(0,0,0,0.12);max-height:300px;overflow-y:auto;';
  div.innerHTML = [...eleves.slice(0,5).map(e => `
    <div onclick="showPage('eleves')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;font-size:13px;" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
      <div class="avatar" style="width:28px;height:28px;font-size:11px;">${initials(e.nom, e.prenom)}</div>
      <div><div style="font-weight:600">${e.prenom} ${e.nom}</div><div style="font-size:11px;color:var(--muted)">${e.classe_nom || 'Sans classe'} · ${e.numero_matricule}</div></div>
    </div>`),
    ...factures.slice(0,3).map(f => `
    <div onclick="showPage('facturation')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;font-size:13px;" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
      <div style="width:28px;height:28px;background:#fef3c7;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;">💰</div>
      <div><div style="font-weight:600">${f.numero}</div><div style="font-size:11px;color:var(--muted)">${f.prenom} ${f.nom} · ${formatMoney(f.montant)}</div></div>
    </div>`)
  ].join('');
  const bar = document.getElementById('search-bar');
  bar.style.position = 'relative';
  bar.appendChild(div);
  document.addEventListener('click', () => div.remove(), { once: true });
}, 300);


// ─── LOGIN DEMO ───────────────────────────────────────────
async function loginDemo() {
  const btn = document.getElementById('demo-btn');
  btn.innerHTML = '<span>⏳ Chargement...</span>';
  btn.disabled = true;
  try {
    const { user } = await API.login('demo@madrasati.ma', 'eleve123');
    currentUser = user;
    initApp();
  } catch(err) {
    btn.innerHTML = '<span>🚀 Essayer Madrasati</span><span style="font-size:10px;background:rgba(245,158,11,0.2);color:#f59e0b;padding:2px 8px;border-radius:4px;font-weight:700;">48H GRATUIT</span>';
    btn.disabled = false;
  }
}


// ─── EXPORT / IMPORT / RESET ─────────────────────────────
async function exportData() {
  try {
    const resp = await fetch('/api/export', { headers: { 'Authorization': 'Bearer ' + API.token } });
    const r = await resp.json();
    const json = JSON.stringify(r, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'madrasati_backup_' + new Date().toISOString().slice(0,10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    toast('✔ Export JSON téléchargé');
  } catch(e) {
    toast('Erreur export: ' + e.message, 'error');
  }
}

function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  confirm('⚠️ Importer ce fichier va remplacer toutes les données actuelles. Continuer ?', () => {
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.eleves) { toast('Format JSON invalide', 'error'); return; }
        const r = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API.token },
          body: JSON.stringify(data)
        });
        const result = await r.json();
        if (!r.ok) { toast('Erreur: ' + result.error, 'error'); return; }
        toast('✔ Import réussi — ' + (data.eleves?.length || 0) + ' élèves importés');
        setTimeout(() => window.location.reload(), 1500);
      } catch(err) {
        toast('Fichier JSON invalide', 'error');
      }
    };
    reader.readAsText(file);
  });
  e.target.value = '';
}

function resetData() {
  confirm('⚠️ Réinitialiser TOUTES les données scolaires ?\n\nÉlèves, profs, classes, notes, présences, factures, annonces... seront supprimés. Cette action est irréversible.', async () => {
    try {
      const r = await fetch('/api/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API.token }
      });
      const result = await r.json();
      if (!r.ok) { toast('Erreur: ' + result.error, 'error'); return; }
      toast('✔ Application réinitialisée — toutes les données ont été supprimées');
      setTimeout(() => window.location.reload(), 1500);
    } catch(e) {
      toast('Erreur: ' + e.message, 'error');
    }
  });
}

// LOGIN
document.getElementById('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  btn.innerHTML = '<span class="spinner"></span> Connexion...';
  btn.disabled = true;
  try {
    const { user } = await API.login(
      document.getElementById('login-email').value,
      document.getElementById('login-password').value
    );
    currentUser = user;
    initApp();
  } catch (err) {
    toast(err.message, 'error');
    btn.innerHTML = 'Se connecter';
    btn.disabled = false;
  }
});

async function initApp() {
  if (!API.token) {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
    return;
  }
  try {
    currentUser = await API.get('/api/me');
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    document.getElementById('sidebar-username').textContent = `${currentUser.prenom} ${currentUser.nom}`;
    document.getElementById('sidebar-role').textContent = { admin: 'Administrateur', prof: 'Professeur', eleve: 'Élève', parent: 'Parent' }[currentUser.role] || currentUser.role;
    document.getElementById('sidebar-avatar').textContent = initials(currentUser.nom, currentUser.prenom);
    if (isDark) { document.getElementById('dark-icon').className = 'fas fa-sun'; document.getElementById('dark-label').textContent = 'Mode clair'; }
    buildSidebar(currentUser.role);
    // Fix: afficher/cacher le bouton mdp immédiatement selon le compte demo
    const pwdBtn = document.getElementById('change-pwd-btn');
    if (pwdBtn) {
      pwdBtn.style.display = currentUser.email === 'demo@madrasati.ma' ? 'none' : 'flex';
    }
    // Bouton admin uniquement pour super
    const adminBtn = document.getElementById('admin-btn');
    if (adminBtn) {
      adminBtn.style.display = currentUser.role === 'super' ? 'flex' : 'none';
    }
    showPage('dashboard');
    // Check trial after user is loaded
    setTimeout(checkTrial, 1000);
    // Check abonnement pour les admins (pas pour demo ni super)
    if (currentUser.role === 'admin' && currentUser.email !== 'demo@madrasati.ma') {
      setTimeout(checkSubscription, 1500);
      setInterval(checkSubscription, 300000);
    }
    // Update badge
    if (currentUser.role === 'admin') {
      const stats = await API.get('/api/factures/stats/summary');
      const badge = document.getElementById('badge-impayees');
      if (badge && stats.nb_impayees > 0) { badge.style.display = 'inline-flex'; badge.textContent = stats.nb_impayees; }
    }
  } catch (err) {
    localStorage.removeItem('token');
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }
}

// INIT
initApp();

// TRIAL CHECK
async function checkTrial() {
  try {
    if (!currentUser) return;
    const banner = document.getElementById('trial-banner');
    const pwdBtn = document.getElementById('change-pwd-btn');
    
    if (currentUser.email !== 'demo@madrasati.ma') {
      // Compte normal : cacher bannière, montrer changer mdp
      if (banner) banner.style.display = 'none';
      if (pwdBtn) pwdBtn.style.display = 'flex';
      return;
    }
    
    // Compte demo : cacher changer mdp
    if (pwdBtn) pwdBtn.style.display = 'none';
    
    const t = await API.get('/api/trial');
    if (t.expired) {
      document.body.innerHTML = '';
      location.href = '/trial-expired.html';
      return;
    }
    // Montrer bannière avec compte à rebours
    if (banner) {
      banner.style.display = 'block';
      const countdown = document.getElementById('trial-countdown');
      if (countdown) countdown.textContent = `${t.hours}h ${t.minutes}min`;
    }
  } catch(e) {}
}


// ─── ABONNEMENT ──────────────────────────────────────────
async function checkSubscription() {
  try {
    const r = await fetch('/api/subscription');
    const s = await r.json();
    if (s.unlimited) return;
    if (s.expired) {
      document.getElementById('content').innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:60vh;text-align:center;padding:40px;">
          <div style="font-size:3rem;margin-bottom:16px;">🔒</div>
          <h2 style="margin-bottom:8px;">Abonnement expiré</h2>
          <p style="color:var(--muted);margin-bottom:24px;">Votre abonnement mensuel a expiré. Contactez l'administrateur pour le renouveler.</p>
          <button onclick="logout()" class="btn btn-primary">Se déconnecter</button>
        </div>`;
      return;
    }
    if (s.warning || s.attention) {
      let banner = document.getElementById('sub-banner');
      if (!banner) {
        banner = document.createElement('div');
        banner.id = 'sub-banner';
        banner.style.cssText = `position:fixed;bottom:0;left:0;right:0;z-index:9998;background:${s.warning ? 'linear-gradient(90deg,#dc2626,#b91c1c)' : 'linear-gradient(90deg,#d97706,#b45309)'};color:white;padding:10px 20px;text-align:center;font-size:13px;font-weight:600;`;
        document.body.appendChild(banner);
      }
      banner.textContent = `${s.warning ? '🔴' : '🟡'} ABONNEMENT — ${s.daysLeft} jour(s) restants · Contactez votre administrateur`;
    }
  } catch(e) {}
}

// Check every minute
setInterval(checkTrial, 60000);

// ─── CHANGEMENT MOT DE PASSE ─────────────────────────────────────────────────
function openChangePassword() {
  modal(`
    <div class="modal-header">
      <div class="modal-title"><i class="fas fa-lock" style="color:var(--accent);margin-right:8px;"></i>Changer mon mot de passe</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Nouveau mot de passe *</label>
        <input id="pwd-new" class="form-input" type="password" placeholder="Minimum 6 caractères">
      </div>
      <div class="form-group">
        <label class="form-label">Confirmer le mot de passe *</label>
        <input id="pwd-confirm" class="form-input" type="password" placeholder="Répétez le mot de passe">
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveNewPassword()"><i class="fas fa-save"></i> Enregistrer</button>
    </div>
  `);
}

async function saveNewPassword() {
  const pwd = document.getElementById('pwd-new').value;
  const confirm = document.getElementById('pwd-confirm').value;
  if (!pwd || pwd.length < 6) return toast('Mot de passe trop court (min. 6 caractères)', 'error');
  if (pwd !== confirm) return toast('Les mots de passe ne correspondent pas', 'error');
  try {
    loading(true);
    await API.put(`/api/users/${currentUser.id}/password`, { password: pwd });
    loading(false);
    closeModal();
    toast('Mot de passe changé avec succès ! Reconnectez-vous.');
    setTimeout(() => logout(), 2000);
  } catch(err) { loading(false); toast(err.message, 'error'); }
}
