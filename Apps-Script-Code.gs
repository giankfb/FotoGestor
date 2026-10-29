/** FotoGestor - backend independente. Use em um NOVO projeto do Apps Script. */
const SHEETS = {
  Clientes: ['id','name','phone','email','document','address','notes','createdAt','updatedAt'],
  Fornecedores: ['id','name','category','phone','email','document','notes','createdAt','updatedAt'],
  Servicos: ['id','name','category','price','description','createdAt','updatedAt'],
  Eventos: ['id','title','clientName','date','time','type','location','value','status','notes','createdAt','updatedAt'],
  Lancamentos: ['id','type','date','description','category','person','method','amount','status','sourceType','sourceId','createdAt','updatedAt'],
  ContasReceber: ['id','eventId','person','description','dueDate','amount','paid','method','status','createdAt','updatedAt'],
  Recebimentos: ['id','receivableId','eventId','date','amount','method','notes','cashTransactionId','createdAt','updatedAt'],
  ContasPagar: ['id','person','description','dueDate','amount','paid','method','status','createdAt','updatedAt'],
  Pagamentos: ['id','payableId','date','amount','method','notes','cashTransactionId','createdAt','updatedAt'],
  Configuracoes: ['key','value']
};
function doGet() { return json_({ok:true,message:'FotoGestor API ativa. Use POST para operações.'}); }
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '');
    if (action === 'read') return json_({ok:true,data:readAll_()});
    if (action === 'settings') { saveSettings_(body.data || {}); return json_({ok:true,data:true}); }
    if (['create','update','delete'].includes(action)) {
      const entity = String(body.data && body.data.entity || '');
      const item = body.data && body.data.item || {};
      const id = String(body.data && body.data.id || item.id || '');
      const sheetName = entitySheet_(entity);
      if (action === 'delete') deleteRow_(sheetName,id);
      else saveRow_(sheetName,item,action === 'update');
      return json_({ok:true,data:{id:item.id || id}});
    }
    return json_({ok:false,error:'Ação não reconhecida.'});
  } catch (err) { return json_({ok:false,error:String(err && err.message || err)}); }
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function ss_() { const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'); if(!id) throw new Error('Configure SPREADSHEET_ID nas propriedades do script ou execute setupFotoGestor().'); return SpreadsheetApp.openById(id); }
function setupFotoGestor() {
  const ss=SpreadsheetApp.create('FotoGestor - Banco de dados');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID',ss.getId());
  Object.keys(SHEETS).forEach(name=>{let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);sh.clear();sh.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]);sh.setFrozenRows(1);sh.getRange(1,1,1,SHEETS[name].length).setFontWeight('bold').setBackground('#101827').setFontColor('#ffffff');['date','dueDate','time'].forEach(h=>{const c=SHEETS[name].indexOf(h);if(c>=0)sh.getRange(2,c+1,Math.max(1,sh.getMaxRows()-1),1).setNumberFormat('@');});});
  const first=ss.getSheetByName('Sheet1');if(first)ss.deleteSheet(first);
  Logger.log('Planilha criada: '+ss.getUrl()); return ss.getUrl();
}
function entitySheet_(entity) { const map={clients:'Clientes',suppliers:'Fornecedores',services:'Servicos',events:'Eventos',transactions:'Lancamentos',receivable:'ContasReceber',payable:'ContasPagar',receipts:'Recebimentos',payments:'Pagamentos'}; const name=map[entity]; if(!name)throw new Error('Cadastro inválido.'); return name; }
function ensureStructure_() {
  const ss=ss_();
  Object.keys(SHEETS).forEach(name=>{
    let sh=ss.getSheetByName(name);
    if(!sh){ sh=ss.insertSheet(name); sh.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]); sh.setFrozenRows(1); return; }
    const current=sh.getLastColumn()?sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String):[];
    SHEETS[name].forEach(h=>{ if(!current.includes(h)){ sh.getRange(1,sh.getLastColumn()+1).setValue(h); } });
  });
}

function syncReceivableForEvent_(event) {
  if(!event || !event.id) return;
  ensureStructure_();
  const sh=ss_().getSheetByName('ContasReceber');
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const idx={}; headers.forEach((h,i)=>idx[h]=i);
  const rows=sh.getDataRange().getValues();
  let row=-1;
  for(let i=1;i<rows.length;i++){ if(String(rows[i][idx.eventId]||'')===String(event.id)){ row=i+1; break; } }
  const value=Number(event.value||0);
  if(value<=0){ return; }
  const existingPaid=row>0?Number(rows[row-1][idx.paid]||0):0;
  const receiptsTotal=receiptsTotalFor_(row>0?String(rows[row-1][idx.id]||''):null);
  const paid=Math.max(existingPaid,receiptsTotal);
  const due=normalizeDate_(event.date); const status=paid>=value?'Pago':paid>0?'Parcial':(due && due<todayISO_()?'Vencida':'Pendente');
  const record=headers.map(h=>{
    if(h==='id') return row>0?rows[row-1][idx.id]:Utilities.getUuid();
    if(h==='eventId') return event.id;
    if(h==='person') return event.clientName||'';
    if(h==='description') return event.title||'Evento';
    if(h==='dueDate') return normalizeDate_(event.date);
    if(h==='amount') return value;
    if(h==='paid') return paid;
    if(h==='status') return status;
    if(h==='method') return row>0?rows[row-1][idx.method]:'';
    if(h==='createdAt') return row>0?rows[row-1][idx.createdAt]:new Date();
    if(h==='updatedAt') return new Date();
    return row>0?rows[row-1][idx[h]]:'';
  });
  if(row>0) sh.getRange(row,1,1,record.length).setValues([record]); else sh.appendRow(record);
}

function receiptsTotalFor_(receivableId) {
  if(!receivableId) return 0;
  const sh=ss_().getSheetByName('Recebimentos'); if(!sh || sh.getLastRow()<2) return 0;
  const vals=sh.getDataRange().getValues(), headers=vals[0].map(String), ri=headers.indexOf('receivableId'), ai=headers.indexOf('amount');
  if(ri<0||ai<0) return 0;
  return vals.slice(1).reduce((s,r)=>s+(String(r[ri]||'')===String(receivableId)?Number(r[ai]||0):0),0);
}

function todayISO_(){ return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd'); }

function readAll_() {
  ensureStructure_();
  const ss=ss_(),out={clients:[],suppliers:[],services:[],events:[],transactions:[],receivable:[],payable:[],receipts:[],settings:{}};
  const map={Clientes:'clients',Fornecedores:'suppliers',Servicos:'services',Eventos:'events',Lancamentos:'transactions',ContasReceber:'receivable',ContasPagar:'payable',Recebimentos:'receipts',Pagamentos:'payments'};
  Object.keys(map).forEach(name=>{
    const sh=ss.getSheetByName(name); if(!sh) return;
    const range=sh.getDataRange();
    const v=range.getValues();
    const display=range.getDisplayValues();
    if(v.length<2) return;
    const headers=v[0].map(String);
    out[map[name]]=v.slice(1).filter(r=>r.some(x=>x!==''&&x!==null)).map((r,ri)=>{
      const o={};
      headers.forEach((h,i)=>{
        // Para datas/horários, use o valor exibido na planilha. Isso evita
        // qualquer deslocamento de fuso causado por objetos Date do Sheets.
        const raw=(h==='date'||h==='dueDate'||h==='time') ? display[ri+1][i] : r[i];
        o[h]=serialize_(raw, h);
      });
      return o;
    });
  });
  const set=ss.getSheetByName('Configuracoes');if(set&&set.getLastRow()>1)set.getRange(2,1,set.getLastRow()-1,2).getValues().forEach(r=>out.settings[String(r[0])]=r[1]);
  out.settings.studioName=out.settings.studioName||'Meu Estúdio de Fotografia'; return out;
}
function normalizeDate_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  const text = String(value).trim();
  let m = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  m = text.match(/^(\d{1,2})[\\/.-](\d{1,2})[\\/.-](\d{4})(?:[ T].*)?$/);
  if (m) return `${m[3]}-${String(m[2]).padStart(2,'0')}-${String(m[1]).padStart(2,'0')}`;

  return text;
}

function serialize_(v, header) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    if (header === 'time') return Utilities.formatDate(v, Session.getScriptTimeZone(), 'HH:mm');
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  if (header === 'date' || header === 'dueDate') return normalizeDate_(v);
  if (header === 'time') return normalizeTime_(v);
  return v;
}

function normalizeTime_(value) {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'HH:mm');
  }
  if (typeof value === 'number' && isFinite(value)) {
    var totalMinutes = Math.round(value * 1440) % 1440;
    if (totalMinutes < 0) totalMinutes += 1440;
    return ('0' + Math.floor(totalMinutes / 60)).slice(-2) + ':' + ('0' + (totalMinutes % 60)).slice(-2);
  }
  var text = String(value).trim();
  var m = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (m) return ('0' + m[1]).slice(-2) + ':' + m[2];
  m = text.match(/(?:^|T| )(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (m) return ('0' + m[1]).slice(-2) + ':' + m[2];
  return text;
}

function saveRow_(sheetName,item,isUpdate) {
  if(!item || !item.id)throw new Error('Registro sem identificador.');
  const ss=ss_(),sh=ss.getSheetByName(sheetName);if(!sh)throw new Error('Aba não encontrada: '+sheetName);
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);const rows=sh.getDataRange().getValues();let rowIndex=-1;
  for(let i=1;i<rows.length;i++)if(String(rows[i][0])===String(item.id)){rowIndex=i+1;break;}
  if(isUpdate&&rowIndex<0)throw new Error('Registro não encontrado para atualização.');
  if(!isUpdate&&rowIndex>0)throw new Error('Este registro já existe.');

  const now=new Date();
  const dateFields={date:true,dueDate:true};
  const record=headers.map(h=>{
    if(h==='createdAt') return item.createdAt||now;
    if(h==='updatedAt') return now;
    if(dateFields[h]) return normalizeDate_(item[h]);
    if(h==='time') return normalizeTime_(item[h]);
    return item[h]===undefined?'':item[h];
  });

  if(rowIndex<0) sh.appendRow(record);
  else sh.getRange(rowIndex,1,1,record.length).setValues([record]);

  // Datas e horários de negócio ficam como texto para que o Sheets não aplique
  // conversões automáticas de fuso/locale.
  headers.forEach((h,i)=>{
    if(dateFields[h] || h==='time') sh.getRange(rowIndex<0 ? sh.getLastRow() : rowIndex, i+1).setNumberFormat('@');
  });
  if(sheetName==='Eventos') syncReceivableForEvent_(item);
  if(sheetName==='Recebimentos') syncReceivableFromReceipts_(item.receivableId);
  if(sheetName==='Recebimentos') syncReceiptCash_(item, isUpdate);
  if(sheetName==='Pagamentos') syncPayableFromPayments_(item.payableId);
  if(sheetName==='Pagamentos') syncPaymentCash_(item, isUpdate);
  if(sheetName==='ContasReceber' && item.eventId) syncReceivableFromReceipts_(item.id);
  if(sheetName==='ContasPagar') syncPayableFromPayments_(item.id);
}

function syncReceivableFromReceipts_(receivableId) {
  if(!receivableId) return;
  const sh=ss_().getSheetByName('ContasReceber'); if(!sh||sh.getLastRow()<2) return;
  const vals=sh.getDataRange().getValues(), headers=vals[0].map(String), idc=headers.indexOf('id'), amountc=headers.indexOf('amount'), paidc=headers.indexOf('paid'), statusc=headers.indexOf('status'), upd=headers.indexOf('updatedAt');
  for(let i=1;i<vals.length;i++) if(String(vals[i][idc]||'')===String(receivableId)){
    const total=Number(vals[i][amountc]||0), paid=receiptsTotalFor_(receivableId);
    sh.getRange(i+1,paidc+1).setValue(paid);
    const duec=headers.indexOf('dueDate'); const due=duec>=0?normalizeDate_(vals[i][duec]):''; sh.getRange(i+1,statusc+1).setValue(paid>=total?'Pago':paid>0?'Parcial':(due && due<todayISO_()?'Vencida':'Pendente'));
    if(upd>=0) sh.getRange(i+1,upd+1).setValue(new Date());
    return;
  }
}
function findRowById_(sheetName,id){ const sh=ss_().getSheetByName(sheetName); if(!sh||sh.getLastRow()<2)return -1; const vals=sh.getDataRange().getValues(); for(let i=1;i<vals.length;i++) if(String(vals[i][0])===String(id)) return i+1; return -1; }
function deleteRow_(sheetName,id) { if(!id)throw new Error('Identificador ausente.');const sh=ss_().getSheetByName(sheetName);if(!sh)throw new Error('Aba não encontrada.');const vals=sh.getDataRange().getValues(), headers=vals[0].map(String);for(let i=1;i<vals.length;i++)if(String(vals[i][0])===String(id)){const deleted=headers.reduce((o,h,j)=>(o[h]=vals[i][j],o),{});sh.deleteRow(i+1);if(sheetName==='Recebimentos'){syncReceivableFromReceipts_(deleted.receivableId); deleteCashBySource_('receivable', id);} if(sheetName==='Pagamentos'){syncPayableFromPayments_(deleted.payableId); deleteCashBySource_('payable', id);} return;}throw new Error('Registro não encontrado.'); }
function upsertCash_(sourceType, sourceId, tx){
  ensureStructure_(); const sh=ss_().getSheetByName('Lancamentos'); const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); const vals=sh.getDataRange().getValues(); const si=headers.indexOf('sourceId'), st=headers.indexOf('sourceType'); let row=-1;
  for(let i=1;i<vals.length;i++) if(String(vals[i][st]||'')===sourceType && String(vals[i][si]||'')===String(sourceId)){row=i+1;break;}
  const record=headers.map(h=>{ if(h==='id') return row>0?vals[row-1][0]:Utilities.getUuid(); if(h==='type') return tx.type; if(h==='date') return normalizeDate_(tx.date); if(h==='description') return tx.description||''; if(h==='category') return tx.category||''; if(h==='person') return tx.person||''; if(h==='method') return tx.method||''; if(h==='amount') return Number(tx.amount||0); if(h==='status') return 'Confirmado'; if(h==='sourceType') return sourceType; if(h==='sourceId') return sourceId; if(h==='createdAt') return row>0?vals[row-1][headers.indexOf('createdAt')]:new Date(); if(h==='updatedAt') return new Date(); return row>0?vals[row-1][headers.indexOf(h)]||'':''; });
  if(row>0) sh.getRange(row,1,1,record.length).setValues([record]); else sh.appendRow(record);
  const r=row>0?row:sh.getLastRow(); const dc=headers.indexOf('date'); if(dc>=0)sh.getRange(r,dc+1).setNumberFormat('@');
  return record[0];
}
function deleteCashBySource_(sourceType, sourceId){ const sh=ss_().getSheetByName('Lancamentos'); if(!sh||sh.getLastRow()<2)return; const vals=sh.getDataRange().getValues(),h=vals[0].map(String),st=h.indexOf('sourceType'),si=h.indexOf('sourceId'); for(let i=vals.length-1;i>=1;i--) if(String(vals[i][st]||'')===sourceType&&String(vals[i][si]||'')===String(sourceId)) sh.deleteRow(i+1); }
function syncReceiptCash_(item){ const total=Number(item.amount||0); if(total<=0)return; const cashId=upsertCash_('receivable',item.id,{type:'Entrada',date:item.date,description:'Recebimento · '+(item.notes||'Conta a receber'),person:item.person||'',method:item.method||'',amount:total,category:'Contas a receber'}); const sh=ss_().getSheetByName('Recebimentos'); const row=findRowById_('Recebimentos',item.id); if(row>0){const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),c=h.indexOf('cashTransactionId'); if(c>=0)sh.getRange(row,c+1).setValue(cashId);} }
function syncPaymentCash_(item){ const total=Number(item.amount||0); if(total<=0)return; const cashId=upsertCash_('payable',item.id,{type:'Saída',date:item.date,description:'Pagamento · '+(item.notes||'Conta a pagar'),person:item.person||'',method:item.method||'',amount:total,category:'Contas a pagar'}); const sh=ss_().getSheetByName('Pagamentos'); const row=findRowById_('Pagamentos',item.id); if(row>0){const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),c=h.indexOf('cashTransactionId'); if(c>=0)sh.getRange(row,c+1).setValue(cashId);} }
function paymentsTotalFor_(payableId){ const sh=ss_().getSheetByName('Pagamentos'); if(!sh||sh.getLastRow()<2)return 0; const vals=sh.getDataRange().getValues(),h=vals[0].map(String),pi=h.indexOf('payableId'),ai=h.indexOf('amount'); return vals.slice(1).reduce((s,r)=>s+(String(r[pi]||'')===String(payableId)?Number(r[ai]||0):0),0); }
function syncPayableFromPayments_(payableId){ if(!payableId)return; const sh=ss_().getSheetByName('ContasPagar'); if(!sh||sh.getLastRow()<2)return; const vals=sh.getDataRange().getValues(),h=vals[0].map(String),idc=h.indexOf('id'),ac=h.indexOf('amount'),pc=h.indexOf('paid'),sc=h.indexOf('status'),dc=h.indexOf('dueDate'),uc=h.indexOf('updatedAt'); for(let i=1;i<vals.length;i++) if(String(vals[i][idc]||'')===String(payableId)){const total=Number(vals[i][ac]||0),paid=paymentsTotalFor_(payableId),due=dc>=0?normalizeDate_(vals[i][dc]):''; sh.getRange(i+1,pc+1).setValue(paid);sh.getRange(i+1,sc+1).setValue(paid>=total?'Pago':paid>0?'Parcial':(due&&due<todayISO_()?'Vencida':'Pendente'));if(uc>=0)sh.getRange(i+1,uc+1).setValue(new Date());return;} }
function saveSettings_(obj) { const sh=ss_().getSheetByName('Configuracoes');const vals=sh.getDataRange().getValues();Object.keys(obj).forEach(k=>{let found=-1;for(let i=1;i<vals.length;i++)if(String(vals[i][0])===k){found=i+1;break;}if(found<0)sh.appendRow([k,obj[k]]);else sh.getRange(found,2).setValue(obj[k]);}); }
