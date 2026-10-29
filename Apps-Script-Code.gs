/** FotoGestor - backend independente. Use em um NOVO projeto do Apps Script. */
const SHEETS = {
  Clientes: ['id','name','phone','email','document','address','notes','createdAt','updatedAt'],
  Fornecedores: ['id','name','category','phone','email','document','notes','createdAt','updatedAt'],
  Servicos: ['id','name','category','price','description','createdAt','updatedAt'],
  Eventos: ['id','title','clientName','date','time','type','location','value','status','notes','createdAt','updatedAt'],
  Lancamentos: ['id','type','date','description','category','person','method','amount','status','createdAt','updatedAt'],
  ContasReceber: ['id','person','description','dueDate','amount','paid','method','status','createdAt','updatedAt'],
  ContasPagar: ['id','person','description','dueDate','amount','paid','method','status','createdAt','updatedAt'],
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
function entitySheet_(entity) { const map={clients:'Clientes',suppliers:'Fornecedores',services:'Servicos',events:'Eventos',transactions:'Lancamentos',receivable:'ContasReceber',payable:'ContasPagar'}; const name=map[entity]; if(!name)throw new Error('Cadastro inválido.'); return name; }
function readAll_() {
  const ss=ss_(),out={clients:[],suppliers:[],services:[],events:[],transactions:[],receivable:[],payable:[],settings:{}};
  const map={Clientes:'clients',Fornecedores:'suppliers',Servicos:'services',Eventos:'events',Lancamentos:'transactions',ContasReceber:'receivable',ContasPagar:'payable'};
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
}
function deleteRow_(sheetName,id) { if(!id)throw new Error('Identificador ausente.');const sh=ss_().getSheetByName(sheetName);if(!sh)throw new Error('Aba não encontrada.');const vals=sh.getDataRange().getValues();for(let i=1;i<vals.length;i++)if(String(vals[i][0])===String(id)){sh.deleteRow(i+1);return;}throw new Error('Registro não encontrado.'); }
function saveSettings_(obj) { const sh=ss_().getSheetByName('Configuracoes');const vals=sh.getDataRange().getValues();Object.keys(obj).forEach(k=>{let found=-1;for(let i=1;i<vals.length;i++)if(String(vals[i][0])===k){found=i+1;break;}if(found<0)sh.appendRow([k,obj[k]]);else sh.getRange(found,2).setValue(obj[k]);}); }
