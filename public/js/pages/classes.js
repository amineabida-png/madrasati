async function renderClasses(container) {
  const [classes, niveaux, profs] = await Promise.all([
    API.get('/api/classes'),
    API.get('/api/niveaux'),
    API.get('/api/profs')
  ]);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Classes & Groupes <span style="font-size:14px;color:var(--muted);font-weight:400;">(${classes.length})</span></div>
        <div class="page-sub">Organisation pédagogique</div>
      </div>
      ${(currentUser.role==='admin'||currentUser.role==='super')?`<button class="btn btn-primary" onclick="openAddClasse(${JSON.stringify(niveaux).replace(/"/g,'&quot;')},${JSON.stringify(profs).replace(/"/g,'&quot;')})"><i class="fas fa-plus"></i> Nouvelle classe</button>`:''}
    </div>

    <!-- Niveaux -->
    ${niveaux.map(n => {
      const classesNiveau = classes.filter(c => c.niveau_id == n.id);
      if (!classesNiveau.length) return '';
      return `
        <div style="margin-bottom:24px;">
          <div style="font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:12px;">${n.nom}</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">
            ${classesNiveau.map(c => `
              <div class="card" style="padding:18px;cursor:pointer;transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''" onclick="viewClasse(${c.id})">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
                  <div style="font-size:20px;font-weight:900;color:var(--accent);">${c.nom}</div>
                  <div style="width:40px;height:40px;background:var(--bg);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;">🏫</div>
                </div>
                <div style="font-size:13px;color:var(--muted);margin-bottom:4px;"><i class="fas fa-users"></i> ${c.nb_eleves}/${c.max_eleves} élèves</div>
                ${c.prof_nom?`<div style="font-size:13px;color:var(--muted);"><i class="fas fa-chalkboard-teacher"></i> ${c.prof_prenom} ${c.prof_nom}</div>`:''}
                <div style="margin-top:12px;">
                  <div class="progress-bar"><div class="progress-fill" style="width:${Math.round(c.nb_eleves/c.max_eleves*100)}%;background:${c.nb_eleves/c.max_eleves>0.9?'var(--danger)':'var(--accent)'};"></div></div>
                  <div style="font-size:11px;color:var(--muted);margin-top:4px;">${Math.round(c.nb_eleves/c.max_eleves*100)}% occupé</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }).join('')}

    ${classes.length === 0 ? '<div class="empty-state"><div class="empty-icon">🏫</div><h3>Aucune classe créée</h3></div>' : ''}
  `;
}

function openAddClasse(niveaux, profs) {
  if (typeof niveaux === 'string') niveaux = JSON.parse(niveaux.replace(/&quot;/g,'"'));
  if (typeof profs === 'string') profs = JSON.parse(profs.replace(/&quot;/g,'"'));
  modal(`
    <div class="modal-header">
      <div class="modal-title"><i class="fas fa-school" style="color:var(--accent);margin-right:8px;"></i>Nouvelle classe</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nom de la classe *</label><input id="cl-nom" class="form-input" placeholder="Ex: 1AC-A"></div>
        <div class="form-group"><label class="form-label">Niveau *</label>
          <select id="cl-niveau" class="form-select">
            <option value="">Choisir un niveau</option>
            ${niveaux.map(n=>`<option value="${n.id}">${n.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Professeur principal</label>
          <select id="cl-prof" class="form-select">
            <option value="">Aucun</option>
            ${profs.map(p=>`<option value="${p.user_id}">${p.prenom} ${p.nom}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Max élèves</label><input id="cl-max" class="form-input" type="number" value="35"></div>
        <div class="form-group"><label class="form-label">Année scolaire</label><input id="cl-annee" class="form-input" value="2024-2025"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveClasse()"><i class="fas fa-save"></i> Créer</button>
    </div>
  `);
}

async function saveClasse() {
  const data = {
    nom: document.getElementById('cl-nom').value.trim(),
    niveau_id: document.getElementById('cl-niveau').value || null,
    prof_principal_id: document.getElementById('cl-prof').value || null,
    max_eleves: document.getElementById('cl-max').value || 35,
    annee_scolaire: document.getElementById('cl-annee').value || '2024-2025',
  };
  if (!data.nom) return toast('Le nom de la classe est requis', 'error');
  try {
    loading(true);
    await API.post('/api/classes', data);
    loading(false);
    closeModal();
    toast('Classe créée');
    showPage('classes');
  } catch (err) { loading(false); toast(err.message, 'error'); }
}

async function viewClasse(id) {
  const [classes, eleves] = await Promise.all([API.get('/api/classes'), API.get(`/api/eleves?classe_id=${id}`)]);
  const c = classes.find(x => x.id == id);
  if (!c) return;
  modal(`
    <div class="modal-header">
      <div class="modal-title">Classe ${c.nom}</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="display:flex;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
        <span class="badge badge-info">${c.niveau_nom || 'Niveau non défini'}</span>
        <span class="badge badge-success">${c.nb_eleves}/${c.max_eleves} élèves</span>
        ${c.prof_nom?`<span class="badge badge-purple">Prof: ${c.prof_prenom} ${c.prof_nom}</span>`:''}
      </div>
      <div style="font-size:14px;font-weight:700;margin-bottom:12px;">Liste des élèves (${eleves.length})</div>
      ${eleves.length===0?'<div class="empty-state" style="padding:20px"><p>Aucun élève dans cette classe</p></div>':
        eleves.map((e,i) => `
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
          <div style="width:20px;font-size:12px;color:var(--muted);text-align:right;">${i+1}</div>
          <div class="avatar" style="width:28px;height:28px;font-size:10px;">${initials(e.nom,e.prenom)}</div>
          <div style="flex:1;font-size:13px;font-weight:500;">${e.prenom} ${e.nom}</div>
          <code style="font-size:11px;background:var(--bg);padding:2px 6px;border-radius:4px;">${e.numero_matricule}</code>
        </div>`).join('')}
    </div>
  `);
}
