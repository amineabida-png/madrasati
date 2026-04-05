let elevesData = [];
let classesCache = [];

async function renderEleves(container) {
  const [eleves, classes] = await Promise.all([
    API.get('/api/eleves'),
    API.get('/api/classes')
  ]);
  elevesData = eleves;
  classesCache = classes;
  renderElevesTable(container, eleves, classes);
}

function renderElevesTable(container, eleves, classes) {
  const canEdit = (currentUser.role === 'admin' || currentUser.role === 'super');
  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Élèves <span style="font-size:14px;color:var(--muted);font-weight:400;">(${eleves.length})</span></div>
        <div class="page-sub">Gestion des élèves inscrits</div>
      </div>
      ${canEdit ? `<button class="btn btn-primary" onclick="openAddEleve()"><i class="fas fa-plus"></i> Ajouter élève</button>` : ''}
    </div>

    <div class="filter-bar">
      <div style="position:relative;flex:1;min-width:220px;">
        <i class="fas fa-search" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:12px;"></i>
        <input type="text" class="form-input" placeholder="Rechercher un élève..." style="padding-left:32px;" oninput="filterEleves(this.value, document.getElementById('classe-filter').value)">
      </div>
      <select id="classe-filter" class="form-select" onchange="filterEleves(document.querySelector('.filter-bar input').value, this.value)" style="min-width:160px;">
        <option value="">Toutes les classes</option>
        ${classes.map(c => `<option value="${c.id}">${c.nom}</option>`).join('')}
      </select>
    </div>

    <div class="card" style="padding:0;">
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Élève</th>
              <th>Matricule</th>
              <th>Classe</th>
              <th>Contact parent</th>
              <th>Inscription</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="eleves-tbody">
            ${renderElevesRows(eleves)}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function renderElevesRows(eleves) {
  if (!eleves.length) return `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">🎓</div><h3>Aucun élève trouvé</h3></div></td></tr>`;
  return eleves.map(e => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="avatar">${initials(e.nom, e.prenom)}</div>
          <div>
            <div style="font-weight:600;">${e.prenom} ${e.nom}</div>
            <div style="font-size:12px;color:var(--muted);">${e.email || '—'}</div>
          </div>
        </div>
      </td>
      <td><code style="font-size:12px;background:var(--bg);padding:2px 8px;border-radius:4px;">${e.numero_matricule}</code></td>
      <td>${e.classe_nom ? `<span class="badge badge-info">${e.classe_nom}</span>` : '<span class="badge badge-gray">Sans classe</span>'}</td>
      <td>
        ${e.parent_nom ? `<div style="font-size:13px;">${e.parent_prenom} ${e.parent_nom}</div><div style="font-size:12px;color:var(--muted);">${e.parent_tel || ''}</div>` : '<span style="color:var(--muted)">—</span>'}
      </td>
      <td style="color:var(--muted);font-size:13px;">${formatDate(e.date_inscription)}</td>
      <td>
        <div style="display:flex;gap:6px;">
          <button class="btn btn-outline btn-sm btn-icon" title="Voir profil" onclick="viewEleve(${e.id})"><i class="fas fa-eye"></i></button>
          ${(currentUser.role === 'admin' || currentUser.role === 'super') ? `
          <button class="btn btn-outline btn-sm btn-icon" title="Modifier" onclick="editEleve(${e.id})"><i class="fas fa-edit"></i></button>
          <button class="btn btn-outline btn-sm btn-icon" title="Supprimer" style="color:var(--danger)" onclick="deleteEleve(${e.id},'${e.prenom} ${e.nom}')"><i class="fas fa-trash"></i></button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function filterEleves(search, classeId) {
  let filtered = elevesData;
  if (search.trim()) {
    const s = search.toLowerCase();
    filtered = filtered.filter(e => `${e.nom} ${e.prenom} ${e.numero_matricule}`.toLowerCase().includes(s));
  }
  if (classeId) filtered = filtered.filter(e => e.classe_id == classeId);
  document.getElementById('eleves-tbody').innerHTML = renderElevesRows(filtered);
}

async function viewEleve(id) {
  const e = await API.get(`/api/eleves/${id}`);
  const presStats = await API.get(`/api/presences/stats/${id}`);
  const totalPres = presStats.reduce((s, p) => s + p.total, 0);
  const presents = presStats.find(p => p.statut === 'present')?.total || 0;
  const absents = presStats.find(p => p.statut === 'absent')?.total || 0;
  const txPres = totalPres > 0 ? Math.round(presents / totalPres * 100) : 100;

  modal(`
    <div class="modal-header">
      <div class="modal-title">Profil Élève</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:16px;background:var(--bg);border-radius:10px;">
        <div class="avatar" style="width:56px;height:56px;font-size:20px;">${initials(e.nom, e.prenom)}</div>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--text);">${e.prenom} ${e.nom}</div>
          <div style="font-size:13px;color:var(--muted);">${e.numero_matricule}</div>
          <div style="margin-top:4px;">${e.classe_nom ? `<span class="badge badge-info">${e.classe_nom}</span>` : ''}</div>
        </div>
      </div>
      <div class="form-grid">
        <div><div class="form-label">Email</div><div style="font-size:13px;">${e.email || '—'}</div></div>
        <div><div class="form-label">Téléphone</div><div style="font-size:13px;">${e.telephone || '—'}</div></div>
        <div><div class="form-label">Date de naissance</div><div style="font-size:13px;">${formatDate(e.date_naissance)}</div></div>
        <div><div class="form-label">Adresse</div><div style="font-size:13px;">${e.adresse || '—'}</div></div>
        <div><div class="form-label">Parent / Tuteur</div><div style="font-size:13px;">${e.parent_prenom ? `${e.parent_prenom} ${e.parent_nom}` : '—'}</div></div>
        <div><div class="form-label">Contact parent</div><div style="font-size:13px;">${e.parent_tel || '—'}</div></div>
      </div>
      <div style="margin-top:16px;padding:14px;background:var(--bg);border-radius:8px;">
        <div style="font-size:13px;font-weight:700;margin-bottom:8px;color:var(--text);">Assiduité</div>
        <div style="display:flex;gap:12px;margin-bottom:8px;">
          <span class="badge badge-success">Présent: ${presents}</span>
          <span class="badge badge-danger">Absent: ${absents}</span>
          <span class="badge badge-info">Taux: ${txPres}%</span>
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${txPres}%;background:${txPres>80?'var(--success)':txPres>60?'var(--warning)':'var(--danger)'};"></div></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Fermer</button>
      ${(currentUser.role==='admin'||currentUser.role==='super')?`<button class="btn btn-primary" onclick="closeModal();editEleve(${e.id})"><i class="fas fa-edit"></i> Modifier</button>`:''}
    </div>
  `);
}

function openAddEleve() {
  const classes = classesCache;
  modal(`
    <div class="modal-header">
      <div class="modal-title"><i class="fas fa-user-plus" style="color:var(--accent);margin-right:8px;"></i>Ajouter un élève</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nom *</label><input id="el-nom" class="form-input" placeholder="ALAMI" required></div>
        <div class="form-group"><label class="form-label">Prénom *</label><input id="el-prenom" class="form-input" placeholder="Youssef" required></div>
        <div class="form-group"><label class="form-label">Email *</label><input id="el-email" class="form-input" type="email" placeholder="youssef@email.ma" required></div>
        <div class="form-group"><label class="form-label">Téléphone</label><input id="el-tel" class="form-input" placeholder="0621000000"></div>
        <div class="form-group"><label class="form-label">Date de naissance</label><input id="el-dob" class="form-input" type="date"></div>
        <div class="form-group"><label class="form-label">Classe</label>
          <select id="el-classe" class="form-select">
            <option value="">Sans classe</option>
            ${classes.map(c => `<option value="${c.id}">${c.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label class="form-label">Adresse</label><input id="el-adresse" class="form-input" placeholder="Casablanca, Maroc"></div>
      </div>
      <div style="font-size:12px;color:var(--muted);background:var(--bg);padding:10px;border-radius:6px;margin-top:4px;"><i class="fas fa-info-circle"></i> Mot de passe par défaut : <strong>eleve123</strong></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveEleve()"><i class="fas fa-save"></i> Enregistrer</button>
    </div>
  `);
}

async function saveEleve() {
  const data = {
    nom: document.getElementById('el-nom').value.trim(),
    prenom: document.getElementById('el-prenom').value.trim(),
    email: document.getElementById('el-email').value.trim(),
    telephone: document.getElementById('el-tel').value.trim(),
    date_naissance: document.getElementById('el-dob').value,
    classe_id: document.getElementById('el-classe').value || null,
    adresse: document.getElementById('el-adresse').value.trim(),
  };
  if (!data.nom || !data.prenom || !data.email) return toast('Nom, prénom et email requis', 'error');
  try {
    loading(true);
    await API.post('/api/eleves', data);
    loading(false);
    closeModal();
    toast('Élève ajouté avec succès');
    showPage('eleves');
  } catch (err) {
    loading(false);
    toast(err.message, 'error');
  }
}

async function editEleve(id) {
  const e = await API.get(`/api/eleves/${id}`);
  modal(`
    <div class="modal-header">
      <div class="modal-title"><i class="fas fa-edit" style="color:var(--accent);margin-right:8px;"></i>Modifier l'élève</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nom *</label><input id="el-nom" class="form-input" value="${e.nom}" required></div>
        <div class="form-group"><label class="form-label">Prénom *</label><input id="el-prenom" class="form-input" value="${e.prenom}" required></div>
        <div class="form-group"><label class="form-label">Email *</label><input id="el-email" class="form-input" type="email" value="${e.email || ''}"></div>
        <div class="form-group"><label class="form-label">Téléphone</label><input id="el-tel" class="form-input" value="${e.telephone || ''}"></div>
        <div class="form-group"><label class="form-label">Date naissance</label><input id="el-dob" class="form-input" type="date" value="${e.date_naissance || ''}"></div>
        <div class="form-group"><label class="form-label">Classe</label>
          <select id="el-classe" class="form-select">
            <option value="">Sans classe</option>
            ${classesCache.map(c => `<option value="${c.id}" ${c.id==e.classe_id?'selected':''}>${c.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="grid-column:1/-1"><label class="form-label">Adresse</label><input id="el-adresse" class="form-input" value="${e.adresse || ''}"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="updateEleve(${id})"><i class="fas fa-save"></i> Enregistrer</button>
    </div>
  `);
}

async function updateEleve(id) {
  const data = {
    nom: document.getElementById('el-nom').value.trim(),
    prenom: document.getElementById('el-prenom').value.trim(),
    email: document.getElementById('el-email').value.trim(),
    telephone: document.getElementById('el-tel').value.trim(),
    date_naissance: document.getElementById('el-dob').value,
    classe_id: document.getElementById('el-classe').value || null,
    adresse: document.getElementById('el-adresse').value.trim(),
  };
  try {
    loading(true);
    await API.put(`/api/eleves/${id}`, data);
    loading(false);
    closeModal();
    toast('Élève mis à jour');
    showPage('eleves');
  } catch (err) {
    loading(false);
    toast(err.message, 'error');
  }
}

function deleteEleve(id, nom) {
  confirm(`Supprimer l'élève <strong>${nom}</strong> ? Cette action est irréversible.`, async () => {
    try {
      await API.delete(`/api/eleves/${id}`);
      toast('Élève supprimé');
      showPage('eleves');
    } catch (err) { toast(err.message, 'error'); }
  });
}
