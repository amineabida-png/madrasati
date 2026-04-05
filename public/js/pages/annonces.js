async function renderAnnonces(container) {
  const annonces = await API.get('/api/annonces');
  const canPost = currentUser.role==='admin'||currentUser.role==='prof';
  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Annonces & Communication</div><div class="page-sub">Informations de l'établissement</div></div>
      ${canPost?`<button class="btn btn-primary" onclick="openAddAnnonce()"><i class="fas fa-bullhorn"></i> Publier une annonce</button>`:''}
    </div>
    <div id="annonces-grid" style="display:flex;flex-direction:column;gap:16px;">
      ${annonces.length===0?`<div class="empty-state"><div class="empty-icon">📢</div><h3>Aucune annonce publiée</h3><p>Les nouvelles annonces apparaîtront ici.</p></div>`
      : annonces.map(a=>renderAnnonceCard(a)).join('')}
    </div>`;
}

function renderAnnonceCard(a) {
  const dest = {tous:'Tous',parents:'Parents',eleves:'Élèves',profs:'Professeurs'}[a.destinataires]||a.destinataires;
  const destColor = {tous:'badge-info',parents:'badge-purple',eleves:'badge-success',profs:'badge-warning'}[a.destinataires]||'badge-gray';
  return `
    <div class="card" style="border-left:4px solid var(--accent);">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div style="flex:1;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap;">
            <div style="font-size:17px;font-weight:800;color:var(--text);">${a.titre}</div>
            <span class="badge ${destColor}"><i class="fas fa-users" style="margin-right:4px;"></i>${dest}</span>
          </div>
          <div style="font-size:14px;color:var(--text);line-height:1.7;margin-bottom:12px;">${a.contenu}</div>
          <div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <span><i class="fas fa-user-circle"></i> ${a.prenom} ${a.nom}</span>
            <span><i class="fas fa-clock"></i> ${formatDate(a.date_publication)}</span>
          </div>
        </div>
        ${currentUser.role==='admin'?`
          <button class="btn btn-outline btn-sm btn-icon" title="Supprimer" style="color:var(--danger);flex-shrink:0;" onclick="supprimerAnnonce(${a.id},'${a.titre.replace(/'/g,"\\'")}')">
            <i class="fas fa-trash"></i>
          </button>`:''
        }
      </div>
    </div>`;
}

function openAddAnnonce() {
  modal(`
    <div class="modal-header">
      <div class="modal-title"><i class="fas fa-bullhorn" style="color:var(--accent);margin-right:8px;"></i>Publier une annonce</div>
      <button class="btn btn-outline btn-sm btn-icon" onclick="closeModal()"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-group"><label class="form-label">Titre *</label>
        <input id="ann-titre" class="form-input" placeholder="Ex: Réunion parents d'élèves" maxlength="100">
      </div>
      <div class="form-group"><label class="form-label">Contenu *</label>
        <textarea id="ann-contenu" class="form-textarea" placeholder="Rédigez votre annonce ici..." style="min-height:120px;"></textarea>
      </div>
      <div class="form-group"><label class="form-label">Destinataires</label>
        <select id="ann-dest" class="form-select">
          <option value="tous">👥 Tous (élèves, parents, profs)</option>
          <option value="parents">👨‍👩‍👧 Parents uniquement</option>
          <option value="eleves">🎓 Élèves uniquement</option>
          <option value="profs">👨‍🏫 Professeurs uniquement</option>
        </select>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-outline" onclick="closeModal()">Annuler</button>
      <button class="btn btn-primary" onclick="saveAnnonce()"><i class="fas fa-paper-plane"></i> Publier</button>
    </div>`);
}

async function saveAnnonce() {
  const data = {
    titre: document.getElementById('ann-titre').value.trim(),
    contenu: document.getElementById('ann-contenu').value.trim(),
    destinataires: document.getElementById('ann-dest').value,
  };
  if (!data.titre||!data.contenu) return toast('Titre et contenu requis','error');
  try {
    loading(true);
    await API.post('/api/annonces', data);
    loading(false); closeModal();
    toast('Annonce publiée');
    showPage('annonces');
  } catch(err) { loading(false); toast(err.message,'error'); }
}

function supprimerAnnonce(id, titre) {
  confirm(`Supprimer l'annonce "<strong>${titre}</strong>" ?`, async ()=>{
    try { await API.delete(`/api/annonces/${id}`); toast('Annonce supprimée'); showPage('annonces'); }
    catch(err) { toast(err.message,'error'); }
  });
}
