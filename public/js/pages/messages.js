window.renderMessages = async function() {
  const token = localStorage.getItem('token');
  const [inbox, sent, contacts] = await Promise.all([
    fetch('/api/messages?type=inbox', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    fetch('/api/messages?type=sent', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
    fetch('/api/messages/contacts', { headers: { Authorization: 'Bearer ' + token } }).then(r => r.json()),
  ]);

  const roleColors = { admin: 'info', prof: 'success', eleve: 'warning', parent: 'purple', super: 'danger' };
  const roleLabels = { admin: 'Admin', prof: 'Enseignant', eleve: 'Élève', parent: 'Parent', super: 'Super Admin' };

  function renderMsgList(msgs, type) {
    if (!msgs.length) return '<div class="empty-state"><div class="empty-icon">📭</div><h3>Aucun message</h3></div>';
    return msgs.map(m => {
      const name = type === 'inbox' ? (m.exp_prenom + ' ' + m.exp_nom) : (m.dest_prenom + ' ' + m.dest_nom);
      const date = new Date(m.date_envoi).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
      return `<div class="msg-item ${!m.lu && type==='inbox' ? 'unread' : ''}" onclick="openMessage(${m.id}, '${type}', ${JSON.stringify(m.sujet).replace(/"/g,'&quot;')}, ${JSON.stringify(m.contenu).replace(/"/g,'&quot;')}, '${name}', '${date}')">
        <div class="avatar" style="flex-shrink:0;">${name[0]}</div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span class="msg-subject">${m.sujet}</span>
            <span class="msg-date">${date}</span>
          </div>
          <div class="msg-preview">${type==='inbox' ? 'De : ' : 'À : '}${name} — ${m.contenu}</div>
        </div>
      </div>`;
    }).join('');
  }

  document.getElementById('content').innerHTML = `
    <div class="page-header">
      <div><div class="page-title">💬 Messagerie</div><div class="page-sub">${inbox.filter(m => !m.lu).length} message(s) non lu(s)</div></div>
      <button class="btn btn-primary" onclick="openNewMessage(${JSON.stringify(contacts).replace(/"/g,'&quot;')})"><i class="fas fa-pen"></i> Nouveau message</button>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
      <div class="card" style="padding:0;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--border); font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;">
          <i class="fas fa-inbox" style="color:var(--accent);"></i> Boîte de réception
          ${inbox.filter(m=>!m.lu).length ? `<span class="badge badge-danger">${inbox.filter(m=>!m.lu).length}</span>` : ''}
        </div>
        <div style="max-height:500px; overflow-y:auto;">${renderMsgList(inbox, 'inbox')}</div>
      </div>
      <div class="card" style="padding:0;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--border); font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;">
          <i class="fas fa-paper-plane" style="color:var(--success);"></i> Messages envoyés
        </div>
        <div style="max-height:500px; overflow-y:auto;">${renderMsgList(sent, 'sent')}</div>
      </div>
    </div>`;

  // Refresh badge counts
  if (window.loadNotifCount) loadNotifCount();
};

window.openMessage = async function(id, type, sujet, contenu, name, date) {
  if (type === 'inbox') {
    const token = localStorage.getItem('token');
    await fetch('/api/messages/' + id + '/lu', { method: 'PUT', headers: { Authorization: 'Bearer ' + token } });
  }
  showModal(`
    <div class="modal-header">
      <span class="modal-title">✉️ ${sujet}</span>
      <button onclick="closeModal()" class="btn btn-outline btn-sm btn-icon"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div style="margin-bottom:16px; padding-bottom:16px; border-bottom:1px solid var(--border);">
        <div style="font-size:12px; color:var(--muted);">${type === 'inbox' ? 'De' : 'À'} : <strong>${name}</strong></div>
        <div style="font-size:12px; color:var(--muted); margin-top:4px;">Le ${date}</div>
      </div>
      <div style="font-size:14px; line-height:1.7; color:var(--text); white-space:pre-wrap;">${contenu}</div>
    </div>
    <div class="modal-footer">
      <button onclick="closeModal()" class="btn btn-outline">Fermer</button>
    </div>`);
  if (type === 'inbox') renderMessages();
};

window.openNewMessage = function(contacts) {
  const roleLabels = { admin: 'Admin', prof: 'Enseignant', eleve: 'Élève', parent: 'Parent', super: 'Super Admin' };
  showModal(`
    <div class="modal-header">
      <span class="modal-title">✉️ Nouveau message</span>
      <button onclick="closeModal()" class="btn btn-outline btn-sm btn-icon"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Destinataire</label>
        <select id="msg-dest" class="form-select">
          <option value="">-- Choisir --</option>
          ${contacts.map(c => `<option value="${c.id}">${c.prenom} ${c.nom} (${roleLabels[c.role] || c.role})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Sujet</label>
        <input type="text" id="msg-sujet" class="form-input" placeholder="Sujet du message">
      </div>
      <div class="form-group">
        <label class="form-label">Message</label>
        <textarea id="msg-contenu" class="form-textarea" rows="5" placeholder="Écrivez votre message..."></textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button onclick="closeModal()" class="btn btn-outline">Annuler</button>
      <button onclick="sendMessage()" class="btn btn-primary"><i class="fas fa-paper-plane"></i> Envoyer</button>
    </div>`);
};

window.sendMessage = async function() {
  const dest = document.getElementById('msg-dest').value;
  const sujet = document.getElementById('msg-sujet').value.trim();
  const contenu = document.getElementById('msg-contenu').value.trim();
  if (!dest || !sujet || !contenu) return toast('Remplissez tous les champs', 'error');
  const token = localStorage.getItem('token');
  const r = await fetch('/api/messages', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ destinataire_id: dest, sujet, contenu })
  });
  if (!r.ok) { const d = await r.json(); return toast(d.error || 'Erreur', 'error'); }
  toast('Message envoyé !', 'success');
  closeModal();
  renderMessages();
};
