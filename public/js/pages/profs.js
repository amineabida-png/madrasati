// ─── PROFS ───────────────────────────────────────────────────────────────────
async function renderProfs(container) {
  const profs = await API.get('/api/profs');

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Enseignants <span style="font-size:14px;color:var(--muted);font-weight:400;">(${profs.length})</span></div>
        <div class="page-sub">Gestion du corps enseignant</div>
      </div>
      ${(currentUser.role==='admin'||currentUser.role==='super')?`<button class="btn btn-primary" onclick="openAddProf()"><i class="fas fa-plus"></i> Ajouter enseignant</button>`:''}
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;">
      ${profs.map(p => `
        <div class="card" style="padding:20px;">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
            <div class="avatar" style="width:48px;height:48px;font-size:18px;background:linear-gradient(135deg,#059669,#0d9488);">${initials(p.nom, p.prenom)}</div>
            <div>
              <div style="font-size:15px;font-weight:700;color:var(--text);">${p.prenom} ${p.nom}</div>
              <div style="font-size:12px;color:var(--muted);">${p.specialite || 'Non renseigné'}</div>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;font-size:13px;">
            <div><i class="fas fa-envelope" style="color:var(--muted);width:18px;"></i> ${p.email || '—'}</div>
            <div><i class="fas fa-phone" style="color:var(--muted);width:18px;"></i> ${p.telephone || '—'}</div>
            <div><i class="fas fa-school" style="color:var(--muted);width:18px;"></i> ${p.nb_classes} classe(s)</div>
            ${p.matieres ? `<div><i class="fas fa-book" style="color:var(--muted);width:18px;"></i> ${p.matieres}</div>` : ''}
          </div>
          ${(currentUser.role==='admin'||currentUser.role==='super')?`
          <div style="display:flex;gap:8px;margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">
            <button class="btn btn-outline btn-sm" style="flex:1;" onclick="editProf(${p.id})"><i class="fas fa-edit"></i> Modifier</button>
          </div>`:''} 
        </div>
      `).join('')}
      ${profs.length===0?'<div class="empty-state"><div class="empty-icon">👨‍🏫</div><h3>Aucun enseignant</h3></div>':''}
    </div>
  `;
}

function openAddProf() {
  modal(`
    <div class="modal-header">
      <div class="modal-title"><i class="fas fa-chalkboard-teacher" style="color:var(--accent);margin-right:8px;"></i>Ajouter un enseignant</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nom *</label><input id="pr-nom" class="form-input" placeholder="BENALI"></div>
        <div class="form-group"><label class="form-label">Prénom *</label><input id="pr-prenom" class="form-input" placeholder="Mohammed"></div>
        <div class="form-group"><label class="form-label">Email *</label><input id="pr-email" class="form-input" type="email"></div>
        <div class="form-group"><label class="form-label">Téléphone</label><input id="pr-tel" class="form-input" placeholder="0661000000"></div>
        <div class="form-group"><label class="form-label">Spécialité</label><input id="pr-spec" class="form-input" placeholder="Mathématiques"></div>
        <div class="form-group"><label class="form-label">CIN</label><input id="pr-cin" class="form-input" placeholder="BE123456"></div>
        <div class="form-group"><label class="form-label">Date d'embauche</label><input id="pr-embauche" class="form-input" type="date"></div>
        <div class="form-group"><label class="form-label">Salaire (MAD)</label><input id="pr-salaire" class="form-input" type="number" placeholder="5000"></div>
      </div>
      <div style="font-size:12px;color:var(--muted);background:var(--bg);padding:10px;border-radius:6px;"><i class="fas fa-info-circle"></i> Mot de passe par défaut : <strong>prof123</strong></div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveProf()"><i class="fas fa-save"></i> Enregistrer</button>
    </div>
  `);
}

async function saveProf() {
  const data = {
    nom: document.getElementById('pr-nom').value.trim(),
    prenom: document.getElementById('pr-prenom').value.trim(),
    email: document.getElementById('pr-email').value.trim(),
    telephone: document.getElementById('pr-tel').value.trim(),
    specialite: document.getElementById('pr-spec').value.trim(),
    cin: document.getElementById('pr-cin').value.trim(),
    date_embauche: document.getElementById('pr-embauche').value,
    salaire: document.getElementById('pr-salaire').value,
  };
  if (!data.nom || !data.prenom || !data.email) return toast('Nom, prénom et email requis', 'error');
  try {
    loading(true);
    await API.post('/api/profs', data);
    loading(false);
    closeModal();
    toast('Enseignant ajouté');
    showPage('profs');
  } catch (err) { loading(false); toast(err.message, 'error'); }
}

async function editProf(id) {
  const profs = await API.get('/api/profs');
  const p = profs.find(x => x.id == id);
  if (!p) return;
  modal(`
    <div class="modal-header">
      <div class="modal-title">Modifier l'enseignant</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Nom *</label><input id="pr-nom" class="form-input" value="${p.nom}"></div>
        <div class="form-group"><label class="form-label">Prénom *</label><input id="pr-prenom" class="form-input" value="${p.prenom}"></div>
        <div class="form-group"><label class="form-label">Email</label><input id="pr-email" class="form-input" type="email" value="${p.email||''}"></div>
        <div class="form-group"><label class="form-label">Téléphone</label><input id="pr-tel" class="form-input" value="${p.telephone||''}"></div>
        <div class="form-group"><label class="form-label">Spécialité</label><input id="pr-spec" class="form-input" value="${p.specialite||''}"></div>
        <div class="form-group"><label class="form-label">CIN</label><input id="pr-cin" class="form-input" value="${p.cin||''}"></div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="updateProf(${id})"><i class="fas fa-save"></i> Enregistrer</button>
    </div>
  `);
}

async function updateProf(id) {
  const data = {
    nom: document.getElementById('pr-nom').value.trim(),
    prenom: document.getElementById('pr-prenom').value.trim(),
    email: document.getElementById('pr-email').value.trim(),
    telephone: document.getElementById('pr-tel').value.trim(),
    specialite: document.getElementById('pr-spec').value.trim(),
    cin: document.getElementById('pr-cin').value.trim(),
  };
  try {
    loading(true);
    await API.put(`/api/profs/${id}`, data);
    loading(false);
    closeModal();
    toast('Enseignant mis à jour');
    showPage('profs');
  } catch (err) { loading(false); toast(err.message, 'error'); }
}
