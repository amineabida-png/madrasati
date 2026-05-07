window.renderSuperEcoles = async function() {
  const token = localStorage.getItem('token');
  const ecoles = await fetch('/api/super/ecoles', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json());

  const abonBadge = { trial: 'badge-warning', mensuel: 'badge-info', annuel: 'badge-success', lifetime: 'badge-purple' };
  const abonLabel = { trial: 'Essai', mensuel: 'Mensuel', annuel: 'Annuel', lifetime: 'À vie' };

  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">🏫 Gestion des Écoles</div><div class="page-sub">${ecoles.length} école(s) enregistrée(s)</div></div>
      <button class="btn btn-primary" onclick="openNewEcole()"><i class="fas fa-plus"></i> Nouvelle École</button>
    </div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(320px, 1fr)); gap:16px;">
      ${ecoles.map(e => `
        <div class="card" style="padding:0; overflow:hidden;">
          <div style="padding:16px 20px; background:linear-gradient(135deg,#0f1b35,#1a3568); color:white;">
            <div style="font-size:17px; font-weight:800;">${e.nom}</div>
            <div style="font-size:12px; opacity:0.6; margin-top:2px;">${e.slug}</div>
          </div>
          <div style="padding:16px 20px;">
            <div style="display:flex; gap:8px; margin-bottom:12px; flex-wrap:wrap;">
              <span class="badge ${abonBadge[e.abonnement] || 'badge-gray'}">${abonLabel[e.abonnement] || e.abonnement}</span>
              <span class="badge ${e.actif ? 'badge-success' : 'badge-danger'}">${e.actif ? 'Actif' : 'Suspendu'}</span>
            </div>
            <div style="font-size:12px; color:var(--muted); display:grid; gap:6px;">
              <div><i class="fas fa-users" style="width:16px;"></i> ${e.nb_eleves || 0} élèves · ${e.nb_admins || 0} admin(s)</div>
              <div><i class="fas fa-map-marker-alt" style="width:16px;"></i> ${e.adresse || '—'}</div>
              <div><i class="fas fa-phone" style="width:16px;"></i> ${e.telephone || '—'}</div>
              <div><i class="fas fa-envelope" style="width:16px;"></i> ${e.email || '—'}</div>
              <div><i class="fas fa-calendar" style="width:16px;"></i> Créée le ${new Date(e.created_at).toLocaleDateString('fr-FR')}</div>
              ${e.abonnement_fin ? `<div><i class="fas fa-clock" style="width:16px;"></i> Expire le ${new Date(e.abonnement_fin).toLocaleDateString('fr-FR')}</div>` : ''}
            </div>
            <div style="margin-top:14px; display:flex; gap:8px;">
              <button onclick="editEcole(${JSON.stringify(e).replace(/"/g,'&quot;')})" class="btn btn-outline btn-sm" style="flex:1;"><i class="fas fa-edit"></i> Modifier</button>
              <button onclick="toggleEcoleActif(${e.id}, ${e.actif})" class="btn ${e.actif ? 'btn-danger' : 'btn-success'} btn-sm">
                <i class="fas fa-${e.actif ? 'pause' : 'play'}"></i> ${e.actif ? 'Suspendre' : 'Activer'}
              </button>
            </div>
          </div>
        </div>`).join('')}
    </div>`;
};

window.renderSuperStats = async function() {
  const token = localStorage.getItem('token');
  const stats = await fetch('/api/super/stats', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json());

  const abonColors = { trial: '#f59e0b', mensuel: '#3b82f6', annuel: '#10b981', lifetime: '#8b5cf6' };
  const abonLabels = { trial: 'Essai', mensuel: 'Mensuel', annuel: 'Annuel', lifetime: 'À vie' };

  document.getElementById('content').innerHTML = `
    <div class="page-header"><div class="page-title">📊 Statistiques Globales</div></div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(200px, 1fr)); gap:16px; margin-bottom:24px;">
      <div class="stat-card">
        <div class="stat-icon" style="background:#eff6ff;"><span style="font-size:22px;">🏫</span></div>
        <div><div class="stat-val">${stats.totalEcoles}</div><div class="stat-label">Écoles actives</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#f0fdf4;"><span style="font-size:22px;">👤</span></div>
        <div><div class="stat-val">${stats.totalUsers}</div><div class="stat-label">Utilisateurs</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon" style="background:#fef9c3;"><span style="font-size:22px;">🎓</span></div>
        <div><div class="stat-val">${stats.totalEleves}</div><div class="stat-label">Élèves inscrits</div></div>
      </div>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <div class="card">
        <div style="font-weight:700; font-size:15px; margin-bottom:16px;">Abonnements</div>
        ${(stats.ecolesByAbonnement || []).map(a => `
          <div style="margin-bottom:14px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
              <span style="font-size:13px; font-weight:600;">${abonLabels[a.abonnement] || a.abonnement}</span>
              <span style="font-size:13px; color:var(--muted);">${a.n} école(s)</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${Math.round(a.n/stats.totalEcoles*100)}%; background:${abonColors[a.abonnement] || '#64748b'};"></div>
            </div>
          </div>`).join('')}
      </div>
      <div class="card">
        <div style="font-weight:700; font-size:15px; margin-bottom:16px;">Dernières écoles</div>
        ${(stats.recentEcoles || []).map(e => `
          <div style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--border);">
            <div class="avatar">${e.nom[0]}</div>
            <div>
              <div style="font-size:13px; font-weight:600;">${e.nom}</div>
              <div style="font-size:11px; color:var(--muted);">${new Date(e.created_at).toLocaleDateString('fr-FR')}</div>
            </div>
            <span class="badge badge-${e.abonnement === 'lifetime' ? 'purple' : 'gray'}" style="margin-left:auto;">${e.abonnement}</span>
          </div>`).join('')}
      </div>
    </div>`;
};

window.openNewEcole = function() {
  showModal(`
    <div class="modal-header">
      <span class="modal-title">🏫 Nouvelle École</span>
      <button onclick="closeModal()" class="btn btn-outline btn-sm btn-icon"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nom de l'école *</label><input id="e-nom" class="form-input" placeholder="Collège Al Amal"></div>
        <div class="form-group"><label class="form-label">Slug (URL) *</label><input id="e-slug" class="form-input" placeholder="al-amal"></div>
        <div class="form-group"><label class="form-label">Email</label><input id="e-email" type="email" class="form-input" placeholder="contact@ecole.ma"></div>
        <div class="form-group"><label class="form-label">Téléphone</label><input id="e-tel" class="form-input" placeholder="0522000000"></div>
        <div class="form-group"><label class="form-label">Abonnement</label>
          <select id="e-abonnement" class="form-select">
            <option value="trial">Essai (Trial)</option>
            <option value="mensuel">Mensuel</option>
            <option value="annuel">Annuel</option>
            <option value="lifetime">À vie</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Date fin abonnement</label><input id="e-fin" type="date" class="form-input"></div>
      </div>
      <div class="form-group"><label class="form-label">Adresse</label><input id="e-adresse" class="form-input" placeholder="Casablanca, Maroc"></div>
    </div>
    <div class="modal-footer">
      <button onclick="closeModal()" class="btn btn-outline">Annuler</button>
      <button onclick="saveNewEcole()" class="btn btn-primary"><i class="fas fa-save"></i> Créer</button>
    </div>`);
};

window.saveNewEcole = async function() {
  const nom = document.getElementById('e-nom').value.trim();
  const slug = document.getElementById('e-slug').value.trim().toLowerCase().replace(/\s+/g,'-');
  if (!nom || !slug) return toast('Nom et slug requis', 'error');
  const token = localStorage.getItem('token');
  const r = await fetch('/api/super/ecoles', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ nom, slug, email: document.getElementById('e-email').value, telephone: document.getElementById('e-tel').value, adresse: document.getElementById('e-adresse').value, abonnement: document.getElementById('e-abonnement').value, abonnement_fin: document.getElementById('e-fin').value })
  });
  const d = await r.json();
  if (!r.ok) return toast(d.error || 'Erreur', 'error');
  toast('École créée !', 'success');
  closeModal();
  renderSuperEcoles();
};

window.editEcole = function(ecole) {
  showModal(`
    <div class="modal-header">
      <span class="modal-title">✏️ Modifier — ${ecole.nom}</span>
      <button onclick="closeModal()" class="btn btn-outline btn-sm btn-icon"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nom</label><input id="ee-nom" class="form-input" value="${ecole.nom}"></div>
        <div class="form-group"><label class="form-label">Email</label><input id="ee-email" type="email" class="form-input" value="${ecole.email || ''}"></div>
        <div class="form-group"><label class="form-label">Téléphone</label><input id="ee-tel" class="form-input" value="${ecole.telephone || ''}"></div>
        <div class="form-group"><label class="form-label">Abonnement</label>
          <select id="ee-abonnement" class="form-select">
            <option value="trial" ${ecole.abonnement==='trial'?'selected':''}>Essai</option>
            <option value="mensuel" ${ecole.abonnement==='mensuel'?'selected':''}>Mensuel</option>
            <option value="annuel" ${ecole.abonnement==='annuel'?'selected':''}>Annuel</option>
            <option value="lifetime" ${ecole.abonnement==='lifetime'?'selected':''}>À vie</option>
          </select>
        </div>
        <div class="form-group"><label class="form-label">Date fin</label><input id="ee-fin" type="date" class="form-input" value="${ecole.abonnement_fin ? ecole.abonnement_fin.split('T')[0] : ''}"></div>
      </div>
      <div class="form-group"><label class="form-label">Adresse</label><input id="ee-adresse" class="form-input" value="${ecole.adresse || ''}"></div>
    </div>
    <div class="modal-footer">
      <button onclick="closeModal()" class="btn btn-outline">Annuler</button>
      <button onclick="saveEditEcole(${ecole.id})" class="btn btn-primary"><i class="fas fa-save"></i> Enregistrer</button>
    </div>`);
};

window.saveEditEcole = async function(id) {
  const token = localStorage.getItem('token');
  const r = await fetch('/api/super/ecoles/' + id, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ nom: document.getElementById('ee-nom').value, email: document.getElementById('ee-email').value, telephone: document.getElementById('ee-tel').value, adresse: document.getElementById('ee-adresse').value, abonnement: document.getElementById('ee-abonnement').value, abonnement_fin: document.getElementById('ee-fin').value, actif: 1 })
  });
  if (!r.ok) return toast('Erreur', 'error');
  toast('École mise à jour !', 'success');
  closeModal();
  renderSuperEcoles();
};

window.toggleEcoleActif = async function(id, actif) {
  const msg = actif ? 'Suspendre cette école ?' : 'Réactiver cette école ?';
  if (!confirm(msg)) return;
  const token = localStorage.getItem('token');
  await fetch('/api/super/ecoles/' + id, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ actif: actif ? 0 : 1 })
  });
  toast(actif ? 'École suspendue' : 'École réactivée', 'success');
  renderSuperEcoles();
};
