// Utils
function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
  el.innerHTML = `<i class="fas fa-${icon}"></i><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function loading(show) {
  let el = document.getElementById('loading-overlay');
  if (show) {
    if (!el) {
      el = document.createElement('div');
      el.id = 'loading-overlay';
      el.className = 'loading-overlay';
      el.innerHTML = '<div class="loading-box"><div class="loader"></div><div style="font-size:14px;color:var(--muted)">Chargement...</div></div>';
      document.body.appendChild(el);
    }
  } else {
    if (el) el.remove();
  }
}

function modal(html, size = 'max-w-xl') {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal ${size}">${html}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
  return overlay;
}

function closeModal() {
  document.querySelector('.modal-overlay')?.remove();
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMoney(n) {
  if (n == null) return '0,00 MAD';
  return parseFloat(n).toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' MAD';
}

function initials(nom, prenom) {
  return ((nom || '?')[0] + (prenom || '?')[0]).toUpperCase();
}

function statutBadge(s) {
  const m = {
    payee: ['success', 'Payée'],
    impayee: ['danger', 'Impayée'],
    partielle: ['warning', 'Partielle'],
    annulee: ['gray', 'Annulée'],
    present: ['success', 'Présent'],
    absent: ['danger', 'Absent'],
    retard: ['warning', 'Retard'],
    excuse: ['purple', 'Excusé'],
    actif: ['success', 'Actif'],
    inactif: ['gray', 'Inactif'],
  };
  const [cls, label] = m[s] || ['gray', s];
  return `<span class="badge badge-${cls}">${label}</span>`;
}

function roleBadge(role) {
  const m = { admin: ['danger', 'Admin'], prof: ['info', 'Professeur'], eleve: ['success', 'Élève'], parent: ['purple', 'Parent'] };
  const [cls, label] = m[role] || ['gray', role];
  return `<span class="badge badge-${cls}">${label}</span>`;
}

function confirm(msg, cb) {
  const m = modal(`
    <div class="modal-header">
      <div class="modal-title"><i class="fas fa-exclamation-triangle" style="color:var(--warning);margin-right:8px;"></i>Confirmation</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <p style="font-size:14px;color:var(--text);">${msg}</p>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-danger" id="confirm-yes">Confirmer</button>
    </div>
  `);
  document.getElementById('confirm-yes').onclick = () => { closeModal(); cb(); };
}

function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function getNote20(valeur, sur) {
  if (!sur) return valeur;
  return Math.round((valeur / sur) * 20 * 100) / 100;
}

function noteColor(n) {
  if (n >= 16) return '#059669';
  if (n >= 12) return '#2563eb';
  if (n >= 10) return '#d97706';
  return '#dc2626';
}

function getMention(moy) {
  if (moy >= 18) return 'Excellent';
  if (moy >= 16) return 'Très Bien';
  if (moy >= 14) return 'Bien';
  if (moy >= 12) return 'Assez Bien';
  if (moy >= 10) return 'Passable';
  return 'Insuffisant';
}
