/** FotoGestor - backend independente. Use em um NOVO projeto do Apps Script. */
const SHEETS = {
  Clientes: ['id','name','phone','email','document','address','notes','createdAt','updatedAt'],
  Fornecedores: ['id','name','category','phone','email','document','notes','createdAt','updatedAt'],
  Servicos: ['id','name','category','price','description','createdAt','updatedAt'],
  Eventos: ['id','title','clientName','date','time','endDate','endTime','type','location','value','status','notes','googleEventId','googleCalendarId','createdAt','updatedAt'],
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
    if (action === 'googleCalendarList') return json_({ok:true,data:listGoogleCalendarEvents_(body.data || {})});
    if (action === 'googleCalendarImport') return json_({ok:true,data:importGoogleCalendarEvents_(body.data || {})});
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
  Object.keys(SHEETS).forEach(name=>{let sh=ss.getSheetByName(name);if(!sh)sh=ss.insertSheet(name);sh.clear();sh.getRange(1,1,1,SHEETS[name].length).setValues([SHEETS[name]]);sh.setFrozenRows(1);sh.getRange(1,1,1,SHEETS[name].length).setFontWeight('bold').setBackground('#101827').setFontColor('#ffffff');['date','dueDate','time','endDate','endTime'].forEach(h=>{const c=SHEETS[name].indexOf(h);if(c>=0)sh.getRange(2,c+1,Math.max(1,sh.getMaxRows()-1),1).setNumberFormat('@');});});
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
  const dateFields={date:true,dueDate:true,endDate:true};
  const record=headers.map(h=>{
    if(h==='createdAt') return item.createdAt||now;
    if(h==='updatedAt') return now;
    if(dateFields[h]) return normalizeDate_(item[h]);
    if(h==='time') return normalizeTime_(item[h]);
    return item[h]===undefined ? (rowIndex>0 ? rows[rowIndex-1][headers.indexOf(h)] : '') : item[h];
  });

  if(rowIndex<0) sh.appendRow(record);
  else sh.getRange(rowIndex,1,1,record.length).setValues([record]);

  // Datas e horários de negócio ficam como texto para que o Sheets não aplique
  // conversões automáticas de fuso/locale.
  headers.forEach((h,i)=>{
    if(dateFields[h] || h==='time') sh.getRange(rowIndex<0 ? sh.getLastRow() : rowIndex, i+1).setNumberFormat('@');
  });
  if(sheetName==='Eventos') {
    syncReceivableForEvent_(item);
    syncGoogleCalendarEvent_(item, rowIndex > 0 ? 'update' : 'create');
  }
  if(sheetName==='Recebimentos') syncReceivableFromReceipts_(item.receivableId);
  if(sheetName==='Recebimentos') syncReceiptCash_(item, isUpdate);
  if(sheetName==='Pagamentos') syncPayableFromPayments_(item.payableId);
  if(sheetName==='Pagamentos') syncPaymentCash_(item, isUpdate);
  if(sheetName==='ContasReceber') syncReceivableFromReceipts_(item.id);
  if(sheetName==='ContasPagar') syncPayableFromPayments_(item.id);
}

function syncReceivableFromReceipts_(receivableId) {
  if(!receivableId) return;
  const sh=ss_().getSheetByName('ContasReceber'); if(!sh||sh.getLastRow()<2) return;
  const vals=sh.getDataRange().getValues(), headers=vals[0].map(String), idc=headers.indexOf('id'), amountc=headers.indexOf('amount'), paidc=headers.indexOf('paid'), statusc=headers.indexOf('status'), upd=headers.indexOf('updatedAt'), methodc=headers.indexOf('method');
  for(let i=1;i<vals.length;i++) if(String(vals[i][idc]||'')===String(receivableId)){
    const total=Number(vals[i][amountc]||0), paid=receiptsTotalFor_(receivableId);
    sh.getRange(i+1,paidc+1).setValue(paid);
    // A forma de pagamento da conta é um resumo: usa a forma do recebimento mais recente.
    if(methodc>=0){
      const rs=ss_().getSheetByName('Recebimentos');
      let latestMethod=''; let latestTime=0;
      if(rs && rs.getLastRow()>1){
        const rv=rs.getDataRange().getValues(), rh=rv[0].map(String), rid=rh.indexOf('receivableId'), rdate=rh.indexOf('date'), rmethod=rh.indexOf('method');
        for(let j=1;j<rv.length;j++) if(String(rv[j][rid]||'')===String(receivableId)){
          const d=String(rv[j][rdate]||''); const t=Date.parse(d)||0;
          if(t>=latestTime){ latestTime=t; latestMethod=String(rv[j][rmethod]||''); }
        }
      }
      sh.getRange(i+1,methodc+1).setValue(latestMethod);
    }
    const duec=headers.indexOf('dueDate'); const due=duec>=0?normalizeDate_(vals[i][duec]):'';
    sh.getRange(i+1,statusc+1).setValue(paid>=total?'Pago':paid>0?'Parcial':(due && due<todayISO_()?'Vencida':'Pendente'));
    if(upd>=0)sh.getRange(i+1,upd+1).setValue(new Date());
    const eventId=headers.indexOf('eventId')>=0 ? String(vals[i][headers.indexOf('eventId')]||'') : '';
    if(eventId) syncGoogleCalendarColorForEventId_(eventId);
    return;
  }
}
function findRowById_(sheetName,id){ const sh=ss_().getSheetByName(sheetName); if(!sh||sh.getLastRow()<2)return -1; const vals=sh.getDataRange().getValues(); for(let i=1;i<vals.length;i++) if(String(vals[i][0])===String(id)) return i+1; return -1; }
function deleteRow_(sheetName,id) {
  if(!id)throw new Error('Identificador ausente.');
  const sh=ss_().getSheetByName(sheetName);
  if(!sh)throw new Error('Aba não encontrada.');
  const vals=sh.getDataRange().getValues(), headers=vals[0].map(String);
  for(let i=1;i<vals.length;i++) if(String(vals[i][0])===String(id)){
    const deleted=headers.reduce((o,h,j)=>(o[h]=vals[i][j],o),{});
    if(sheetName==='Eventos') deleteGoogleCalendarEvent_(deleted.googleEventId, deleted.googleCalendarId);
    sh.deleteRow(i+1);
    if(sheetName==='Recebimentos'){syncReceivableFromReceipts_(deleted.receivableId); deleteCashBySource_('receivable', id);}
    if(sheetName==='Pagamentos'){syncPayableFromPayments_(deleted.payableId); deleteCashBySource_('payable', id);}
    return;
  }
  throw new Error('Registro não encontrado.');
}

function googleCalendarName_(){
  // Nome da agenda de trabalho: altere somente aqui se um dia quiser renomeá-la.
  return '02 EVENTOS';
}

function findEventosCalendar_(){
  const NAME = googleCalendarName_();
  let calendars=[];
  try { calendars=CalendarApp.getCalendarsByName(NAME) || []; } catch(e) { calendars=[]; }
  if(!calendars.length){
    try { calendars=CalendarApp.getOwnedCalendarsByName(NAME) || []; } catch(e) { calendars=[]; }
  }
  const wanted=NAME.trim().toLowerCase();
  const cal=calendars.find(c=>String(c.getName()||'').trim().toLowerCase()===wanted);
  if(!cal) throw new Error('A agenda "'+NAME+'" não foi encontrada. Crie/compartilhe essa agenda no Google Calendar. A agenda principal não será usada pelo FotoGestor.');
  return cal;
}

function authorizeGoogleCalendar(){
  const props=PropertiesService.getScriptProperties();
  const cal=findEventosCalendar_();
  props.setProperty('GOOGLE_CALENDAR_ID', cal.getId());
  props.setProperty('GOOGLE_CALENDAR_NAME', cal.getName());
  installGoogleCalendarSync_();
  return 'Google Agenda autorizada: ' + cal.getName() + '. Sincronização bidirecional ativada.';
}

function installGoogleCalendarSync_(){
  const handler='syncGoogleToFotoGestor_';
  ScriptApp.getProjectTriggers().forEach(t=>{
    if(t.getHandlerFunction()===handler) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger(handler).timeBased().everyMinutes(5).create();
}

// Execute manualmente uma vez, se quiser instalar/reinstalar a sincronização.
function setupGoogleCalendarSync(){
  const cal=findEventosCalendar_();
  PropertiesService.getScriptProperties().setProperty('GOOGLE_CALENDAR_ID',cal.getId());
  PropertiesService.getScriptProperties().setProperty('GOOGLE_CALENDAR_NAME',cal.getName());
  installGoogleCalendarSync_();
  return 'Sincronização bidirecional instalada para a agenda: '+cal.getName();
}

function googleCalendar_(){
  const props=PropertiesService.getScriptProperties();
  const cal=findEventosCalendar_();
  props.setProperty('GOOGLE_CALENDAR_ID', cal.getId());
  props.setProperty('GOOGLE_CALENDAR_NAME', cal.getName());
  ensureGoogleCalendarSyncTrigger_();
  return cal;
}

function ensureGoogleCalendarSyncTrigger_(){
  const handler='syncGoogleToFotoGestor_';
  const exists=ScriptApp.getProjectTriggers().some(t=>t.getHandlerFunction()===handler);
  if(!exists) ScriptApp.newTrigger(handler).timeBased().everyMinutes(5).create();
}

function calendarForEvent_(event){
  if(event && event.googleCalendarId){
    const linked=CalendarApp.getCalendarById(String(event.googleCalendarId));
    if(linked) return linked;
  }
  return googleCalendar_();
}

function eventDateTime_(dateStr,timeStr){
  const d=String(dateStr||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!d) throw new Error('Data do evento inválida para o Google Agenda: '+dateStr);
  const y=Number(d[1]), m=Number(d[2])-1, day=Number(d[3]);
  const t=String(timeStr||'').match(/^(\d{1,2}):(\d{2})/);
  if(!t) return new Date(y,m,day);
  return new Date(y,m,day,Number(t[1]),Number(t[2]),0,0);
}

function eventEnd_(event,start,allDay){
  if(allDay){
    const endDate=normalizeDate_(event.endDate||event.date)||event.date;
    const end=eventDateTime_(endDate,'');
    // Google usa data final exclusiva para eventos de dia inteiro.
    if(end.getTime()<=start.getTime()) end.setDate(start.getDate()+1);
    else end.setDate(end.getDate()+1);
    return end;
  }
  if(event.endDate || event.endTime){
    const end=eventDateTime_(event.endDate||event.date,event.endTime||event.time);
    if(end.getTime()>start.getTime()) return end;
  }
  return new Date(start.getTime()+60*60*1000);
}

function googleEventDescription_(event){
  const lines=[];
  if(event.clientName) lines.push('Cliente: '+event.clientName);
  if(event.type) lines.push('Tipo: '+event.type);
  // Não enviar valor financeiro ao Google Calendar.
  if(event.notes) lines.push('Observações: '+event.notes);
  lines.push('FotoGestor ID: '+event.id);
  return lines.join('\n');
}

function saveGoogleEventIds_(eventId, googleEventId, calendarId){
  const sh=ss_().getSheetByName('Eventos'); if(!sh) return;
  const row=findRowById_('Eventos',eventId); if(row<0) return;
  const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const ec=h.indexOf('googleEventId'), cc=h.indexOf('googleCalendarId');
  if(ec>=0) sh.getRange(row,ec+1).setValue(googleEventId||'');
  if(cc>=0) sh.getRange(row,cc+1).setValue(calendarId||'');
}

function updateEventOperationalFields_(eventId, fields){
  const row=findRowById_('Eventos',eventId); if(row<0) return false;
  const sh=ss_().getSheetByName('Eventos');
  const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  Object.keys(fields).forEach(k=>{
    const c=h.indexOf(k); if(c>=0) sh.getRange(row,c+1).setValue(fields[k]);
  });
  const uc=h.indexOf('updatedAt'); if(uc>=0) sh.getRange(row,uc+1).setValue(new Date());
  return true;
}

function clientNameForEvent_(event){
  const name=String(event && event.clientName || '').trim();
  return name;
}

function googleEventTitle_(event){
  // O título exibido no Google é sempre o contratante selecionado no FotoGestor.
  // Se ainda não houver cliente vinculado, usa o título do evento como fallback.
  return clientNameForEvent_(event) || String(event && (event.title || event.type) || 'Evento FotoGestor');
}

function syncGoogleCalendarEvent_(event, mode){
  if(!event || !event.id || !event.date) return;
  const cal=calendarForEvent_(event);
  const calendarId=cal.getId();
  let googleEventId=String(event.googleEventId||'');
  let gEvent=null;
  if(googleEventId){ try { gEvent=cal.getEventById(googleEventId); } catch(e) { gEvent=null; } }
  const title=googleEventTitle_(event);
  const description=googleEventDescription_(event);
  const location=String(event.location||'');
  const hasTime=!!normalizeTime_(event.time);
  if(!gEvent){
    if(hasTime){
      const start=eventDateTime_(event.date,event.time);
      gEvent=cal.createEvent(title,start,eventEnd_(event,start,false),{description:description,location:location});
    } else {
      const day=eventDateTime_(event.date,'');
      gEvent=cal.createAllDayEvent(title,day,{description:description,location:location});
      if(event.endDate && normalizeDate_(event.endDate)!==normalizeDate_(event.date)){
        try { const endExclusive=eventDateTime_(event.endDate,''); endExclusive.setDate(endExclusive.getDate()+1); gEvent.setAllDayDates(day,endExclusive); } catch(ignore) {}
      }
    }
    googleEventId=gEvent.getId();
    setGoogleEventColor_(gEvent,event);
    saveGoogleEventIds_(event.id,googleEventId,calendarId);
    return;
  }
  try {
    if(hasTime){
      const start=eventDateTime_(event.date,event.time);
      const end=eventEnd_(event,start,false);
      gEvent.setTitle(title); gEvent.setTime(start,end);
    } else {
      const day=eventDateTime_(event.date,'');
      gEvent.setTitle(title);
      const endDate=normalizeDate_(event.endDate||event.date)||event.date;
      if(endDate!==normalizeDate_(event.date)){ const endExclusive=eventDateTime_(endDate,''); endExclusive.setDate(endExclusive.getDate()+1); gEvent.setAllDayDates(day,endExclusive); }
      else gEvent.setAllDayDate(day);
    }
    gEvent.setLocation(location);
    gEvent.setDescription(description);
    setGoogleEventColor_(gEvent,event);
    saveGoogleEventIds_(event.id,gEvent.getId(),calendarId);
  } catch(e){
    try { gEvent.deleteEvent(); } catch(ignore) {}
    let recreated;
    if(hasTime){
      const start=eventDateTime_(event.date,event.time);
      recreated=cal.createEvent(title,start,eventEnd_(event,start,false),{description:description,location:location});
    } else {
      const day=eventDateTime_(event.date,'');
      recreated=cal.createAllDayEvent(title,day,{description:description,location:location});
      const endDate=normalizeDate_(event.endDate||event.date)||event.date;
      if(endDate!==normalizeDate_(event.date)){ try{ const endExclusive=eventDateTime_(endDate,''); endExclusive.setDate(endExclusive.getDate()+1); recreated.setAllDayDates(day,endExclusive); }catch(ignore){} }
    }
    setGoogleEventColor_(recreated,event);
    saveGoogleEventIds_(event.id,recreated.getId(),calendarId);
  }
}

function syncGoogleCalendarColorForEventId_(eventId){
  const row=findRowById_('Eventos',eventId); if(row<0) return;
  const sh=ss_().getSheetByName('Eventos'); const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); const r=sh.getRange(row,1,1,h.length).getValues()[0];
  const event={}; h.forEach((k,i)=>event[k]=r[i]);
  if(!event.googleEventId) return;
  try{
    const cal=event.googleCalendarId ? CalendarApp.getCalendarById(String(event.googleCalendarId)) : googleCalendar_();
    const ev=cal && cal.getEventById(String(event.googleEventId));
    if(ev) setGoogleEventColor_(ev,event);
  }catch(e){ Logger.log('Não foi possível atualizar a cor do evento: '+e); }
}

function googleEventColor_(event){
  if(!event || String(event.status||'').toLowerCase()==='cancelado') return CalendarApp.EventColor.GRAY;
  const value=Number(event.value||0);
  if(value<=0) return CalendarApp.EventColor.RED;
  const sh=ss_().getSheetByName('ContasReceber');
  if(!sh || sh.getLastRow()<2) return CalendarApp.EventColor.RED;
  const vals=sh.getDataRange().getValues(), h=vals[0].map(String), ec=h.indexOf('eventId'), sc=h.indexOf('status');
  if(ec<0 || sc<0) return CalendarApp.EventColor.RED;
  for(let i=1;i<vals.length;i++) if(String(vals[i][ec]||'')===String(event.id||'')){
    const status=String(vals[i][sc]||'Pendente').toLowerCase();
    if(status==='pago') return CalendarApp.EventColor.GREEN;
    if(status==='parcial') return CalendarApp.EventColor.YELLOW;
    return CalendarApp.EventColor.RED;
  }
  return CalendarApp.EventColor.RED;
}

function setGoogleEventColor_(gEvent,event){ try { gEvent.setColor(googleEventColor_(event)); } catch(e) { Logger.log('Não foi possível definir a cor do evento: '+e); } }

function listGoogleCalendarEvents_(data){
  const cal=googleCalendar_();
  const start=eventDateTime_(data.startDate || todayISO_(),'');
  const end=eventDateTime_(data.endDate || todayISO_(),'');
  end.setDate(end.getDate()+1);
  const existingIds={};
  const sh=ss_().getSheetByName('Eventos');
  if(sh && sh.getLastRow()>1){ const vals=sh.getDataRange().getValues(), h=vals[0].map(String), c=h.indexOf('googleEventId'); if(c>=0) for(let i=1;i<vals.length;i++) if(vals[i][c]) existingIds[String(vals[i][c])]=true; }
  return cal.getEvents(start,end).map(ev=>({id:ev.getId(),title:ev.getTitle(),start:Utilities.formatDate(ev.getStartTime(),cal.getTimeZone(),'yyyy-MM-dd'),time:ev.isAllDayEvent()?'':Utilities.formatDate(ev.getStartTime(),cal.getTimeZone(),'HH:mm'),end:Utilities.formatDate(ev.getEndTime(),cal.getTimeZone(),'yyyy-MM-dd HH:mm'),allDay:ev.isAllDayEvent(),location:ev.getLocation()||'',description:ev.getDescription()||'',color:String(ev.getColor()||''),imported:!!existingIds[String(ev.getId())]})).filter(x=>!x.imported).sort((a,b)=>(a.start+' '+a.time).localeCompare(b.start+' '+b.time));
}

function importGoogleCalendarEvents_(data){
  const ids=(data.ids||[]).map(String); if(!ids.length) return {imported:0,skipped:0};
  const cal=googleCalendar_(); const sh=ss_().getSheetByName('Eventos'); const vals=sh.getDataRange().getValues(), h=vals[0].map(String), gidc=h.indexOf('googleEventId');
  const existing={}; if(gidc>=0) for(let i=1;i<vals.length;i++) if(vals[i][gidc]) existing[String(vals[i][gidc])]=true;
  let imported=0,skipped=0;
  ids.forEach(id=>{
    if(existing[id]){ skipped++; return; }
    let ev=null; try{ ev=cal.getEventById(id); }catch(e){ ev=null; }
    if(!ev){ skipped++; return; }
    const start=Utilities.formatDate(ev.getStartTime(),cal.getTimeZone(),'yyyy-MM-dd');
    const end=ev.isAllDayEvent() ? Utilities.formatDate(new Date(ev.getEndTime().getTime()-24*60*60*1000),cal.getTimeZone(),'yyyy-MM-dd') : Utilities.formatDate(ev.getEndTime(),cal.getTimeZone(),'yyyy-MM-dd');
    const googleTitle=ev.getTitle()||'Evento importado';
    let importedClient='';
    try { const cs=ss_().getSheetByName('Clientes'); if(cs && cs.getLastRow()>1){ const cv=cs.getDataRange().getValues(), ch=cv[0].map(String), nc=ch.indexOf('name'); if(nc>=0){ const found=cv.slice(1).find(r=>String(r[nc]||'').trim().toLowerCase()===googleTitle.trim().toLowerCase()); if(found) importedClient=String(found[nc]||'').trim(); } } } catch(ignore) {}
    const item={id:Utilities.getUuid(),title:googleTitle,clientName:importedClient,date:start,time:ev.isAllDayEvent()?'':Utilities.formatDate(ev.getStartTime(),cal.getTimeZone(),'HH:mm'),endDate:end,endTime:ev.isAllDayEvent()?'':Utilities.formatDate(ev.getEndTime(),cal.getTimeZone(),'HH:mm'),type:'',location:ev.getLocation()||'',value:0,status:'Confirmado',notes:'Importado do Google Agenda — informe cliente e valor contratado no FotoGestor.',googleEventId:ev.getId(),googleCalendarId:cal.getId(),createdAt:new Date(),updatedAt:new Date()};
    saveRow_('Eventos',item,false); imported++;
  });
  return {imported:imported,skipped:skipped};
}

function syncGoogleToFotoGestor_(){
  const cal=googleCalendar_();
  const sh=ss_().getSheetByName('Eventos'); if(!sh || sh.getLastRow()<2) return;
  const vals=sh.getDataRange().getValues(), h=vals[0].map(String), idx={}; h.forEach((x,i)=>idx[x]=i);
  const now=new Date();
  for(let i=1;i<vals.length;i++){
    const row=vals[i], gid=String(row[idx.googleEventId]||''); if(!gid) continue;
    let ev=null; try{ ev=cal.getEventById(gid); }catch(e){ ev=null; }
    if(!ev) continue;
    const tz=cal.getTimeZone();
    const date=Utilities.formatDate(ev.getStartTime(),tz,'yyyy-MM-dd');
    const time=ev.isAllDayEvent()?'':Utilities.formatDate(ev.getStartTime(),tz,'HH:mm');
    const endDate=ev.isAllDayEvent() ? Utilities.formatDate(new Date(ev.getEndTime().getTime()-24*60*60*1000),tz,'yyyy-MM-dd') : Utilities.formatDate(ev.getEndTime(),tz,'yyyy-MM-dd');
    const endTime=ev.isAllDayEvent()?'':Utilities.formatDate(ev.getEndTime(),tz,'HH:mm');
    const title=ev.getTitle()||'Evento FotoGestor';
    const location=ev.getLocation()||'';
    const current={title:String(row[idx.title]||''),date:normalizeDate_(row[idx.date]),time:normalizeTime_(row[idx.time]),endDate:normalizeDate_(row[idx.endDate]||row[idx.date]),endTime:normalizeTime_(row[idx.endTime]||''),location:String(row[idx.location]||'')};
    if(current.title===title && current.date===date && current.time===time && current.endDate===endDate && current.endTime===endTime && current.location===location) continue;
    const fields={date:date,time:time,endDate:endDate,endTime:endTime,location:location,updatedAt:now};
    Object.keys(fields).forEach(k=>{ if(idx[k]>=0) sh.getRange(i+1,idx[k]+1).setValue(fields[k]); });
  }
}

function upsertCash_(sourceType, sourceId, tx){
  ensureStructure_(); const sh=ss_().getSheetByName('Lancamentos'); const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String); const vals=sh.getDataRange().getValues(); const si=headers.indexOf('sourceId'), st=headers.indexOf('sourceType'); let row=-1;
  for(let i=1;i<vals.length;i++) if(String(vals[i][st]||'')===sourceType && String(vals[i][si]||'')===String(sourceId)){row=i+1;break;}
  const record=headers.map(h=>{ if(h==='id') return row>0?vals[row-1][0]:Utilities.getUuid(); if(h==='type') return tx.type; if(h==='date') return normalizeDate_(tx.date); if(h==='description') return tx.description||''; if(h==='category') return tx.category||''; if(h==='person') return tx.person||''; if(h==='method') return tx.method||''; if(h==='amount') return Number(tx.amount||0); if(h==='status') return 'Confirmado'; if(h==='sourceType') return sourceType; if(h==='sourceId') return sourceId; if(h==='createdAt') return row>0?vals[row-1][headers.indexOf('createdAt')]:new Date(); if(h==='updatedAt') return new Date(); return row>0?vals[row-1][headers.indexOf(h)]||'':''; });
  if(row>0) sh.getRange(row,1,1,record.length).setValues([record]); else sh.appendRow(record);
  const r=row>0?row:sh.getLastRow(); const dc=headers.indexOf('date'); if(dc>=0)sh.getRange(r,dc+1).setNumberFormat('@');
  return record[0];
}
function deleteCashBySource_(sourceType, sourceId){ const sh=ss_().getSheetByName('Lancamentos'); if(!sh||sh.getLastRow()<2)return; const vals=sh.getDataRange().getValues(),h=vals[0].map(String),st=h.indexOf('sourceType'),si=h.indexOf('sourceId'); for(let i=vals.length-1;i>=1;i--) if(String(vals[i][st]||'')===sourceType&&String(vals[i][si]||'')===String(sourceId)) sh.deleteRow(i+1); }
function lookupAccount_(sheetName, id){
  const sh=ss_().getSheetByName(sheetName); if(!sh || sh.getLastRow()<2) return null;
  const vals=sh.getDataRange().getValues(), h=vals[0].map(String), idc=h.indexOf('id');
  if(idc<0) return null;
  for(let i=1;i<vals.length;i++) if(String(vals[i][idc]||'')===String(id)){
    const o={}; h.forEach((k,j)=>o[k]=vals[i][j]); return o;
  }
  return null;
}
function lookupAccountPerson_(sheetName, id, personFallback){
  if(personFallback) return String(personFallback);
  const account=lookupAccount_(sheetName,id);
  if(account && account.person) return String(account.person);
  if(account && account.eventId){
    const event=lookupAccount_('Eventos',account.eventId);
    if(event && event.clientName) return String(event.clientName);
  }
  return '';
}
function syncReceiptCash_(item){
  const total=Number(item.amount||0); if(total<=0)return;
  const receivableId=String(item.receivableId||'');
  const person=lookupAccountPerson_('ContasReceber', receivableId, item.person||'');
  const cashId=upsertCash_('receivable',item.id,{type:'Entrada',date:item.date,description:'Recebimento · '+(item.notes||'Conta a receber'),person:person,method:item.method||'',amount:total,category:'Contas a receber'});
  const sh=ss_().getSheetByName('Recebimentos'); const row=findRowById_('Recebimentos',item.id);
  if(row>0){const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),c=h.indexOf('cashTransactionId'); if(c>=0)sh.getRange(row,c+1).setValue(cashId);}
}
function syncPaymentCash_(item){
  const total=Number(item.amount||0); if(total<=0)return;
  const payableId=String(item.payableId||'');
  const person=lookupAccountPerson_('ContasPagar', payableId, item.person||'');
  const cashId=upsertCash_('payable',item.id,{type:'Saída',date:item.date,description:'Pagamento · '+(item.notes||'Conta a pagar'),person:person,method:item.method||'',amount:total,category:'Contas a pagar'});
  const sh=ss_().getSheetByName('Pagamentos'); const row=findRowById_('Pagamentos',item.id);
  if(row>0){const h=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String),c=h.indexOf('cashTransactionId'); if(c>=0)sh.getRange(row,c+1).setValue(cashId);}
}
function paymentsTotalFor_(payableId){ const sh=ss_().getSheetByName('Pagamentos'); if(!sh||sh.getLastRow()<2)return 0; const vals=sh.getDataRange().getValues(),h=vals[0].map(String),pi=h.indexOf('payableId'),ai=h.indexOf('amount'); return vals.slice(1).reduce((s,r)=>s+(String(r[pi]||'')===String(payableId)?Number(r[ai]||0):0),0); }
function syncPayableFromPayments_(payableId){ if(!payableId)return; const sh=ss_().getSheetByName('ContasPagar'); if(!sh||sh.getLastRow()<2)return; const vals=sh.getDataRange().getValues(),h=vals[0].map(String),idc=h.indexOf('id'),ac=h.indexOf('amount'),pc=h.indexOf('paid'),sc=h.indexOf('status'),dc=h.indexOf('dueDate'),uc=h.indexOf('updatedAt'); for(let i=1;i<vals.length;i++) if(String(vals[i][idc]||'')===String(payableId)){const total=Number(vals[i][ac]||0),paid=paymentsTotalFor_(payableId),due=dc>=0?normalizeDate_(vals[i][dc]):''; sh.getRange(i+1,pc+1).setValue(paid);sh.getRange(i+1,sc+1).setValue(paid>=total?'Pago':paid>0?'Parcial':(due&&due<todayISO_()?'Vencida':'Pendente'));if(uc>=0)sh.getRange(i+1,uc+1).setValue(new Date());return;} }
function saveSettings_(obj) { const sh=ss_().getSheetByName('Configuracoes');const vals=sh.getDataRange().getValues();Object.keys(obj).forEach(k=>{let found=-1;for(let i=1;i<vals.length;i++)if(String(vals[i][0])===k){found=i+1;break;}if(found<0)sh.appendRow([k,obj[k]]);else sh.getRange(found,2).setValue(obj[k]);}); }
