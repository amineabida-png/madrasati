window.renderMessages = async function(container) {
  if (!container) container = document.getElementById('content');
  const [inbox, sent, contacts] = await Promise.all([
    API.get('/api/messages?type=inbox'),
    API.get('/api/messages?type=sent'),
    API.get('/api/messages/contacts'),
  ]);

  const roleLabels = { admin: 'Admin', prof: 'Enseignant', eleve: 'Élève', parent: 'Parent', super: 'Super Admin' };

  function renderMsgList(msgs, type) {
    if (!msgs.length) return '<div class="empty-state"><div class="empty-icon">📭</div><h3>Aucun message</h3></div>';
    return msgs.map(m => {
      const name = type === 'inbox' ? (m.exp_prenom + ' ' + m.exp_nom) : (m.dest_prenom + ' ' + m.dest_nom);
      const date = new Date(m.date_envoi).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
      const sujetEsc = (m.sujet||'').replace(/'/g,"\\'");
      const contenuEsc = (m.contenu||'').replace(/'/g,"\\'").replace(/\n/g,'\\n');
      const nameEsc = name.replace(/'/g,"\\'");
      return `<div class="msg-item ${!m.lu && type==='inbox' ? 'unread' : ''}" onclick="openMessage(${m.id}, '${type}', '${sujetEsc}', '${contenuEsc}', '${nameEsc}', '${date}')">
        <div class="avatar" style="flex-shrink:0;">${name[0]||'?'}</div>
        <div style="flex:1; min-width:0;">
          <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
            <span class="msg-subject">${m.sujet||'(Sans sujet)'}</span>
            <span class="msg-date">${date}</span>
          </div>
          <div class="msg-preview">${type==='inbox' ? 'De : ' : 'À : '}${name} — ${(m.contenu||'').slice(0,80)}${m.contenu&&m.contenu.length>80?'...':''}</div>
        </div>
      </div>`;
    }).join('');
  }

  const unreadCount = inbox.filter(m => !m.lu).length;
  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">💬 Messagerie</div><div class="page-sub">${unreadCount ? unreadCount + ' message(s) non lu(s)' : 'Tous les messages lus'}</div></div>
      <button class="btn btn-primary" onclick="openNewMessage()"><i class="fas fa-pen"></i> Nouveau message</button>
    </div>
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px; flex-wrap:wrap;">
      <div class="card" style="padding:0;">
        <div style="padding:16px 20px; border-bottom:1px solid var(--border); font-weight:700; font-size:14px; display:flex; align-items:center; gap:8px;">
          <i class="fas fa-inbox" style="color:var(--accent);"></i> Boîte de réception
          ${unreadCount ? `<span class="badge badge-danger">${unreadCount}</span>` : ''}
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

  window._msgContacts = contacts;
  if (window.loadNotifCount) loadNotifCount();
};

window.openMessage = async function(id, type, sujet, contenu, name, date) {
  if (type === 'inbox') {
    await API.put('/api/messages/' + id + '/lu', {});
  }
  modal(`
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

window.openNewMessage = function() {
  const contacts = window._msgContacts || [];
  const roleLabels = { admin: 'Admin', prof: 'Enseignant', eleve: 'Élève', parent: 'Parent', super: 'Super Admin' };
  modal(`
    <div class="modal-header">
      <span class="modal-title">✉️ Nouveau message</span>
      <button onclick="closeModal()" class="btn btn-outline btn-sm btn-icon"><i class="fas fa-times"></i></button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">Destinataire *</label>
        <select id="msg-dest" class="form-select">
          <option value="">-- Choisir --</option>
          ${contacts.map(c => `<option value="${c.id}">${c.prenom} ${c.nom} (${roleLabels[c.role] || c.role})</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Sujet *</label>
        <input type="text" id="msg-sujet" class="form-input" placeholder="Sujet du message">
      </div>
      <div class="form-group">
        <label class="form-label">Message *</label>
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
  if (!dest) return toast('Choisissez un destinataire', 'error');
  if (!sujet) return toast('Sujet requis', 'error');
  if (!contenu) return toast('Message vide', 'error');
  try {
    loading(true);
    await API.post('/api/messages', { destinataire_id: dest, sujet, contenu });
    loading(false);
    toast('Message envoyé !');
    closeModal();
    renderMessages();
  } catch(err) { loading(false); toast(err.message, 'error'); }
};
