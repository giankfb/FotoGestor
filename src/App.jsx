
import React, { useEffect, useState } from 'react';
import {
  Camera, LayoutDashboard, CalendarDays, Users, Truck,
  BriefcaseBusiness, Wallet, ArrowDownToLine, ArrowUpFromLine,
  ChartNoAxesCombined, Settings, Plus, Search, RefreshCw, Trash2,
  Edit, Menu, X, CalendarClock, Clock, MapPin, CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { API_URL } from './config';

const sections = [
  ['dashboard', 'Painel', LayoutDashboard],
  ['events', 'Agenda', CalendarDays],
  ['clients', 'Clientes', Users],
  ['suppliers', 'Fornecedores', Truck],
  ['services', 'Serviços e pacotes', BriefcaseBusiness],
  ['transactions', 'Caixa', Wallet],
  ['receivable', 'Contas a receber', ArrowDownToLine],
  ['payable', 'Contas a pagar', ArrowUpFromLine],
  ['reports', 'Relatórios', ChartNoAxesCombined],
  ['settings', 'Configurações', Settings]
];

const entities = {
  clients: {
    title: 'Clientes',
    sheet: 'Clientes',
    fields: [
      ['name', 'Nome', 'text', true],
      ['phone', 'Telefone / WhatsApp', 'tel'],
      ['email', 'E-mail', 'email'],
      ['document', 'CPF/CNPJ', 'text'],
      ['address', 'Endereço', 'text'],
      ['notes', 'Observações', 'textarea']
    ]
  },
  suppliers: {
    title: 'Fornecedores',
    sheet: 'Fornecedores',
    fields: [
      ['name', 'Nome / empresa', 'text', true],
      ['category', 'Tipo de serviço', 'text'],
      ['phone', 'Telefone', 'tel'],
      ['email', 'E-mail', 'email'],
      ['document', 'CPF/CNPJ', 'text'],
      ['notes', 'Observações', 'textarea']
    ]
  },
  services: {
    title: 'Serviços e pacotes',
    sheet: 'Servicos',
    fields: [
      ['name', 'Nome do serviço/pacote', 'text', true],
      ['category', 'Categoria', 'text'],
      ['price', 'Preço (R$)', 'number', true],
      ['description', 'Descrição', 'textarea']
    ]
  },
  events: {
    title: 'Agenda de eventos',
    sheet: 'Eventos',
    fields: [
      ['title', 'Evento', 'text', true],
      ['clientName', 'Cliente', 'client', true],
      ['date', 'Data inicial', 'date', true],
      ['time', 'Horário inicial', 'time'],
      ['endDate', 'Data final', 'date'],
      ['endTime', 'Horário final', 'time'],
      ['type', 'Tipo de evento', 'text'],
      ['location', 'Local', 'text'],
      ['value', 'Valor contratado (R$)', 'number'],
      ['status', 'Situação', 'select'],
      ['notes', 'Observações', 'textarea']
    ]
  },
  transactions: {
    title: 'Caixa',
    sheet: 'Lancamentos',
    fields: [
      ['type', 'Movimento', 'select', true],
      ['date', 'Data', 'date', true],
      ['description', 'Descrição', 'text', true],
      ['category', 'Categoria', 'text'],
      ['person', 'Cliente / fornecedor', 'text'],
      ['method', 'Forma de pagamento', 'select'],
      ['amount', 'Valor (R$)', 'number', true],
      ['status', 'Situação', 'select']
    ]
  },
  receivable: {
    title: 'Contas a receber',
    sheet: 'ContasReceber',
    fields: [
      ['person', 'Cliente', 'text', true],
      ['description', 'Descrição', 'text', true],
      ['dueDate', 'Vencimento', 'date', true],
      ['amount', 'Valor total (R$)', 'number', true],
      ['paid', 'Valor recebido (R$)', 'number'],
      ['status', 'Situação', 'select']
    ]
  },
  payable: {
    title: 'Contas a pagar',
    sheet: 'ContasPagar',
    fields: [
      ['person', 'Fornecedor', 'text', true],
      ['description', 'Descrição', 'text', true],
      ['dueDate', 'Vencimento', 'date', true],
      ['amount', 'Valor total (R$)', 'number', true],
      ['paid', 'Valor pago (R$)', 'number'],
      ['method', 'Forma de pagamento', 'select'],
      ['status', 'Situação', 'select']
    ]
  }
};

const money = n => Number(n || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL'
});

// Datas de negócio devem ser tratadas no fuso local, sem passar por UTC.
// Isso evita que eventos de madrugada/no fim do dia mudem de data no Brasil.
const localISODate = (date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const today = () => localISODate();

const currentMonth = () => today().slice(0, 7);

const emptyData = () => ({
  clients: [],
  suppliers: [],
  services: [],
  events: [],
  transactions: [],
  receivable: [],
  payable: [],
  receipts: [],
  settings: { studioName: 'Meu Estúdio de Fotografia' }
});

async function api(action, data) {
  if (!API_URL || API_URL.startsWith('COLE_')) {
    throw new Error('Configure a URL do novo Apps Script no arquivo src/config.js.');
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, data })
  });

  const result = await response.json();
  if (!result.ok) throw new Error(result.error || 'Falha na API.');
  return result.data;
}

function normalizeDateValue(value) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return localISODate(value);
  }

  const text = String(value).trim();

  // ISO / Google Sheets: yyyy-mm-dd or yyyy-mm-ddTHH:mm:ss...
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ]|$)/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  // Brazilian date: dd/mm/yyyy (with optional time)
  match = text.match(/^(\d{1,2})[\\/.-](\d{1,2})[\\/.-](\d{4})(?:[ T].*)?$/);
  if (match) {
    return `${match[3]}-${String(match[2]).padStart(2, '0')}-${String(match[1]).padStart(2, '0')}`;
  }

  // Google Sheets/Apps Script Date text such as "Sat Oct 31 2026 ..."
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return localISODate(parsed);

  return text;
}

function formatDate(value) {
  const iso = normalizeDateValue(value);
  if (!iso) return '—';

  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;

  return iso;
}

/*
 * Normaliza horários retornados pelo Sheets.
 * Aceita HH:mm, HH:mm:ss, fração de dia e ISO com hora.
 */
function formatTime(value) {
  if (value === null || value === undefined || value === '') return '';

  if (typeof value === 'number' && Number.isFinite(value)) {
    const totalMinutes = Math.round(value * 1440);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const text = String(value).trim();

  const timeMatch = text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (timeMatch) {
    return `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
  }

  const isoMatch = text.match(
    /^1899-12-30[T ](\d{2}):(\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/i
  );

  if (isoMatch) {
    return `${isoMatch[1]}:${isoMatch[2]}`;
  }

  // Se veio somente a data-base, não há hora recuperável no valor.
  if (/^1899-12-30(?:T00:00:00(?:\.000)?Z?)?$/i.test(text)) {
    return '';
  }

  return '';
}

function App() {
  const [data, setData] = useState(emptyData);
  const [active, setActive] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mobile, setMobile] = useState(false);
  const [period, setPeriod] = useState(currentMonth());
  const [paymentModal, setPaymentModal] = useState(null);
  const [googleImportOpen, setGoogleImportOpen] = useState(false);
  const [googleImporting, setGoogleImporting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await api('read');
      const normalized = { ...emptyData(), ...result };
      // Vincula automaticamente o cliente pelo nome para que o formulário de edição
      // consiga selecionar o cliente correto mesmo que a planilha não tenha clientId.
      const clientByName = new Map((normalized.clients || []).map(client => [
        String(client.name || '').trim().toLowerCase(), client.id
      ]));
      normalized.events = (normalized.events || []).map(event => ({
        ...event,
        clientId: event.clientId || clientByName.get(String(event.clientName || '').trim().toLowerCase()) || ''
      }));
      // Garante que datas vindas do Sheets tenham sempre o mesmo formato
      // usado pelos inputs HTML: yyyy-MM-dd.
      for (const key of ['events', 'transactions', 'receivable', 'payable', 'receipts']) {
        normalized[key] = (normalized[key] || []).map(item => ({
          ...item,
          ...(item.date !== undefined ? { date: normalizeDateValue(item.date) } : {}),
          ...(item.dueDate !== undefined ? { dueDate: normalizeDateValue(item.dueDate) } : {}),
          ...(item.endDate !== undefined ? { endDate: normalizeDateValue(item.endDate) } : {})
        }));
      }
      setData(normalized);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const save = async (key, item) => {
    try {
      const isUpdate = Boolean(item.id);
      const next = {
        ...item,
        id: item.id || crypto.randomUUID(),
        updatedAt: new Date().toISOString()
      };

      // Nunca envie uma data de negócio convertida por UTC.
      if (next.date !== undefined) next.date = normalizeDateValue(next.date);
      if (next.dueDate !== undefined) next.dueDate = normalizeDateValue(next.dueDate);
      if (next.endDate !== undefined) next.endDate = normalizeDateValue(next.endDate);

      if (key === 'events' && next.time) {
        next.time = formatTime(next.time) || next.time;
      }

      // Valor recebido/pago é derivado dos lançamentos individuais.
      // Se o usuário editar esse campo diretamente na conta, ajustamos o
      // último recebimento/pagamento em vez de gravar um valor que depois
      // seria sobrescrito pela sincronização.
      if (isUpdate && (key === 'receivable' || key === 'payable') && Object.prototype.hasOwnProperty.call(item, 'paid')) {
        const list = key === 'receivable' ? (data.receipts || []) : (data.payments || []);
        const refKey = key === 'receivable' ? 'receivableId' : 'payableId';
        const related = list.filter(x => String(x[refKey] || '') === String(item.id));
        const desired = Math.max(0, Number(item.paid || 0));
        const current = related.reduce((sum, x) => sum + Number(x.amount || 0), 0);
        if (Math.abs(desired - current) > 0.001) {
          if (related.length) {
            const latest = [...related].sort((a,b) => String(b.date||'').localeCompare(String(a.date||'')))[0];
            const nextAmount = Math.max(0, Number(latest.amount || 0) + desired - current);
            if (nextAmount <= 0.001) await api('delete', { entity: key === 'receivable' ? 'receipts' : 'payments', id: latest.id });
            else await api('update', { entity: key === 'receivable' ? 'receipts' : 'payments', item: { ...latest, amount: nextAmount, updatedAt: new Date().toISOString() } });
          } else if (desired > 0) {
            const entity = key === 'receivable' ? 'receipts' : 'payments';
            const ref = key === 'receivable' ? { receivableId: item.id, eventId: item.eventId || '' } : { payableId: item.id };
            await api('create', { entity, item: { id: crypto.randomUUID(), date: today(), amount: desired, method: item.method || 'Pix', notes: 'Ajuste pelo valor recebido/pago', ...ref, person: item.person || '' } });
          }
          const refreshed = { ...next };
          delete refreshed.paid;
          delete refreshed.method;
          delete refreshed.status;
          await api('update', { entity: key, item: refreshed });
        } else {
          delete next.paid;
          delete next.method;
          delete next.status;
          await api('update', { entity: key, item: next });
        }
      } else {
        await api(isUpdate ? 'update' : 'create', {
          entity: key,
          item: next
        });
      }

      setModal(null);
      setNotice('Registro salvo.');
      await refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const savePayment = async (payment) => {
    try {
      const isUpdate = Boolean(payment.id);
      const next = { ...payment, id: payment.id || crypto.randomUUID(), date: normalizeDateValue(payment.date || today()), updatedAt: new Date().toISOString() };
      const entity = payment.paymentType === 'payable' ? 'payments' : 'receipts';
      await api(isUpdate ? 'update' : 'create', { entity, item: next });
      setPaymentModal(null);
      setNotice('Recebimento registrado.');
      await refresh();
    } catch (e) { setError(e.message); }
  };

  const removePayment = async payment => {
    if (!confirm('Excluir este pagamento? O saldo da conta e o caixa serão recalculados.')) return;
    try { await api('delete', { entity: payment.paymentType === 'payable' ? 'payments' : 'receipts', id: payment.id }); await refresh(); setNotice('Pagamento excluído.'); }
    catch (e) { setError(e.message); }
  };

  const importGoogleEvents = async ids => {
    if (googleImporting) return;
    setGoogleImporting(true);
    setError('');
    setNotice('Importando eventos do Google Agenda... aguarde.');
    try {
      const result = await api('googleCalendarImport', { ids });
      setGoogleImportOpen(false);
      const imported = Number(result?.imported || 0);
      const skipped = Number(result?.skipped || 0);
      setNotice(`${imported} evento(s) importado(s)${skipped ? ` · ${skipped} já existente(s) ou indisponível(is), ignorado(s)` : ''}.`);
      await refresh();
    } catch (e) {
      setError(e.message);
      setNotice('');
    } finally {
      setGoogleImporting(false);
    }
  };

  const createClient = async client => {
    const newClient = {
      ...client,
      id: crypto.randomUUID(),
      updatedAt: new Date().toISOString()
    };

    await api('create', {
      entity: 'clients',
      item: newClient
    });

    await refresh();
    setNotice('Cliente cadastrado com sucesso.');
    return newClient;
  };

  const del = async (key, item) => {
    if (!confirm(`Excluir “${item.name || item.title || item.description || item.person || 'este registro'}”?`)) {
      return;
    }

    try {
      await api('delete', { entity: key, id: item.id });
      await refresh();
      setNotice('Registro excluído.');
    } catch (e) {
      setError(e.message);
    }
  };

  const tx = data.transactions || [];

  const income = tx
    .filter(x => x.type === 'Entrada')
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const expense = tx
    .filter(x => x.type === 'Saída')
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const pendingIn = (data.receivable || []).reduce(
    (sum, x) => sum + Math.max(0, Number(x.amount || 0) - Number(x.paid || 0)),
    0
  );

  const pendingOut = (data.payable || []).reduce(
    (sum, x) => sum + Math.max(0, Number(x.amount || 0) - Number(x.paid || 0)),
    0
  );

  const title = sections.find(s => s[0] === active)?.[1] || 'Painel';

  const currentItems = entities[active]
    ? (data[active] || [])
        .filter(x => JSON.stringify(x).toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
          if (active !== 'events') return 0;
          const ad = normalizeDateValue(a.date || '');
          const bd = normalizeDateValue(b.date || '');
          const byDate = ad.localeCompare(bd);
          if (byDate !== 0) return byDate;
          return String(a.time || '').localeCompare(String(b.time || ''));
        })
    : [];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobile ? 'open' : ''}`}>
        <div className="brand">
          <div className="brand-icon"><Camera size={23} /></div>
          <div><b>FotoGestor</b><small>Gestão de fotografia</small></div>
          <button className="icon-btn mobile-close" onClick={() => setMobile(false)}>
            <X />
          </button>
        </div>

        <div className="studio-label">ESTÚDIO</div>

        <nav>
          {sections.map(([id, label, Icon]) => (
            <button
              key={id}
              className={`nav-item ${active === id ? 'active' : ''}`}
              onClick={() => {
                setActive(id);
                setSearch('');
                setMobile(false);
              }}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'events' && data.events?.length > 0 && (
                <small>{data.events.length}</small>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <span className="status-dot" /> Dados no Google Sheets
          <button onClick={refresh} className="refresh-link">
            <RefreshCw size={14} /> Sincronizar
          </button>
        </div>
      </aside>

      {mobile && <button className="overlay" onClick={() => setMobile(false)} />}

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setMobile(true)}>
            <Menu />
          </button>
          <div className="crumb">
            Gestor de Fotografia <span>/</span> <b>{title}</b>
          </div>
          <div className="top-actions">
            <span className="today-label">
              <CalendarClock size={15} /> {new Date().toLocaleDateString('pt-BR')}
            </span>
            <button className="avatar" title="Perfil">GF</button>
          </div>
        </header>

        <div className="content">
          {error && (
            <div className="alert error">
              <AlertCircle size={17} />{error}
              <button onClick={() => setError('')}>Fechar</button>
            </div>
          )}

          {notice && (
            <div className="alert success">
              <CheckCircle2 size={17} />{notice}
              <button onClick={() => setNotice('')}>Fechar</button>
            </div>
          )}

          {active === 'dashboard' ? (
            <>
              <div className="welcome">
                <div>
                  <p className="eyebrow">VISÃO GERAL</p>
                  <h1>Seu estúdio, em foco.</h1>
                  <p>Acompanhe seus eventos e mantenha o financeiro organizado.</p>
                </div>
                <button
                  className="primary-btn"
                  onClick={() => {
                    setActive('events');
                    setModal({
                      entity: 'events',
                      item: { date: today(), status: 'Confirmado' }
                    });
                  }}
                >
                  <Plus size={17} /> Novo evento
                </button>
              </div>

              <div className="stats-grid">
                <Stat label="Eventos agendados" value={data.events?.filter(x => x.date >= today()).length || 0} icon={CalendarDays} tone="purple" foot="Eventos futuros" />
                <Stat label="Clientes cadastrados" value={data.clients?.length || 0} icon={Users} tone="blue" foot="Base de clientes" />
                <Stat label="A receber" value={money(pendingIn)} icon={ArrowDownToLine} tone="green" foot="Valores em aberto" />
                <Stat label="A pagar" value={money(pendingOut)} icon={ArrowUpFromLine} tone="orange" foot="Despesas pendentes" />
              </div>

              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-head">
                    <div><h2>Próximos eventos</h2><p>Agenda dos próximos compromissos</p></div>
                    <button className="text-btn" onClick={() => setActive('events')}>Ver agenda →</button>
                  </div>

                  {(data.events || [])
                    .filter(x => x.date >= today())
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .slice(0, 5)
                    .map((event, i) => (
                      <div className="event-row" key={event.id || i}>
                        <div className="date-tile">
                          <b>{event.date?.slice(8, 10) || '—'}</b>
                          <small>
                            {event.date
                              ? `${['jan.','fev.','mar.','abr.','mai.','jun.','jul.','ago.','set.','out.','nov.','dez.'][Number(event.date.slice(5, 7)) - 1]}`
                              : 'Data'}
                          </small>
                        </div>
                        <div className="event-info">
                          <b>{event.title || event.type || 'Evento fotográfico'}</b>
                          <span>{event.clientName || 'Cliente não informado'}</span>
                          <small>
                            <Clock size={13} /> {formatTime(event.time) || 'Horário a definir'}
                            {event.location && <> · <MapPin size={13} /> {event.location}</>}
                          </small>
                        </div>
                        <span className="status-pill">{event.status || 'Agendado'}</span>
                      </div>
                    ))}

                  {!data.events?.length && <Empty text="Nenhum evento cadastrado ainda." />}
                </section>

                <section className="panel finance-panel">
                  <div className="panel-head">
                    <div><h2>Resumo financeiro</h2><p>Movimentações registradas</p></div>
                    <Wallet size={19} />
                  </div>
                  <div className="balance">
                    <small>Saldo das movimentações</small>
                    <strong>{money(income - expense)}</strong>
                  </div>
                  <div className="money-row"><span><i className="legend in" /> Entradas</span><b>{money(income)}</b></div>
                  <div className="money-row"><span><i className="legend out" /> Saídas</span><b>{money(expense)}</b></div>
                  <button className="secondary-btn full" onClick={() => setActive('transactions')}>Abrir caixa</button>
                </section>
              </div>

              <div className="quick-actions">
                <h2>Acesso rápido</h2>
                <div>
                  {[
                    ['clients', 'Cadastrar cliente', Users],
                    ['suppliers', 'Cadastrar fornecedor', Truck],
                    ['transactions', 'Lançar entrada/saída', Wallet],
                    ['receivable', 'Ver contas a receber', ArrowDownToLine]
                  ].map(([id, label, Icon]) => (
                    <button
                      key={id}
                      onClick={() => {
                        setActive(id);
                        if (entities[id]) {
                          setModal({ entity: id, item: { date: today() } });
                        }
                      }}
                    >
                      <Icon size={18} />{label}<span>→</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : active === 'reports' ? (
            <Reports data={data} period={period} setPeriod={setPeriod} />
          ) : active === 'settings' ? (
            <SettingsPage
              data={data}
              onSave={async settings => {
                try {
                  await api('settings', settings);
                  setData(d => ({ ...d, settings }));
                  setNotice('Configurações salvas.');
                } catch (e) {
                  setError(e.message);
                }
              }}
            />
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">CADASTROS E CONTROLE</p>
                  <h1>{title}</h1>
                  <p>Gerencie os registros do seu negócio em um só lugar.</p>
                </div>
                {entities[active] && (
                  <div style={{display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end'}}>
                    {active === 'events' && (
                      <button className="secondary-btn" onClick={() => setGoogleImportOpen(true)}>
                        <RefreshCw size={15} /> Importar do Google
                      </button>
                    )}
                    <button
                      className="primary-btn"
                      onClick={() => setModal({
                        entity: active,
                        item: { date: today(), status: 'Pendente', type: 'Entrada' }
                      })}
                    >
                      <Plus size={17} /> Novo registro
                    </button>
                  </div>
                )}
              </div>

              {entities[active] && (
                <>
                  <div className="list-toolbar">
                    <div className="searchbox">
                      <Search size={17} />
                      <input
                        placeholder={`Buscar em ${title.toLowerCase()}...`}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                    <button className="secondary-btn" onClick={refresh}>
                      <RefreshCw size={15} /> Atualizar
                    </button>
                  </div>

                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          {entities[active].fields.slice(0, active === 'transactions' ? 7 : 6).map(f => (
                            <th key={f[0]}>{f[1]}</th>
                          ))}
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentItems.map((item, i) => (
                          <tr key={item.id || i}>
                            {entities[active].fields.slice(0, active === 'transactions' ? 7 : 6).map(f => (
                              <td key={f[0]}>
                                {['amount', 'price', 'value', 'paid'].includes(f[0])
                                  ? money(item[f[0]])
                                  : ['date', 'dueDate', 'endDate'].includes(f[0])
                                    ? formatDate(item[f[0]])
                                    : ['time', 'endTime'].includes(f[0])
                                      ? formatTime(item[f[0]]) || '—'
                                      : item[f[0]] || '—'}
                              </td>
                            ))}
                            <td>
                              <div className="row-actions">
                                <button className="icon-btn" title="Editar" onClick={() => setModal({ entity: active, item })}>
                                  <Edit size={15} />
                                </button>
                                {active === 'receivable' && (
                                  <button className="icon-btn" title="Registrar recebimento" onClick={() => setPaymentModal({ account: item })}>
                                    <Wallet size={15} />
                                  </button>
                                )}
                                {active === 'payable' && (
                                  <button className="icon-btn" title="Registrar pagamento" onClick={() => setPaymentModal({ account: item, type: 'payable' })}>
                                    <Wallet size={15} />
                                  </button>
                                )}
                                <button className="icon-btn danger" title="Excluir" onClick={() => del(active, item)}>
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!currentItems.length && (
                      <Empty text={loading ? 'Carregando dados...' : 'Nenhum registro encontrado.'} />
                    )}
                  </div>
                  <p className="table-foot">{currentItems.length} registro(s) · Sincronização com Google Sheets{active === 'receivable' ? ' · Use o ícone 💰 para registrar cada pagamento' : ''}</p>
                </>
              )}
            </>
          )}

          <footer>FotoGestor <span>·</span> Gestão simples para quem vive de fotografia</footer>
        </div>
      </main>

      {googleImportOpen && (
        <GoogleImportModal
          close={() => setGoogleImportOpen(false)}
          importEvents={importGoogleEvents}
          importing={googleImporting}
        />
      )}

      {paymentModal && (
        <PaymentModal
          account={paymentModal.account}
          receipts={(paymentModal.type === 'payable' ? (data.payments || []) : (data.receipts || [])).filter(r => (paymentModal.type === 'payable' ? r.payableId : r.receivableId) === paymentModal.account.id).map(r => ({...r, paymentType: paymentModal.type || 'receivable'}))}
          type={paymentModal.type || 'receivable'}
          close={() => setPaymentModal(null)}
          save={savePayment}
          remove={removePayment}
        />
      )}

      {modal && (
        <RecordModal
          config={entities[modal.entity]}
          entity={modal.entity}
          item={modal.item}
          clients={data.clients || []}
          createClient={createClient}
          close={() => setModal(null)}
          save={save}
        />
      )}
    </div>
  );
}

function Stat({ label, value, icon: Icon, tone, foot }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}><Icon size={20} /></div>
      <div className="stat-label">{label}</div>
      <strong>{value}</strong>
      <small>{foot}</small>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="empty-state">
      <div><CalendarDays size={22} /></div>
      <p>{text}</p>
    </div>
  );
}

function GoogleImportModal({ close, importEvents, importing=false }) {
  const defaultStart = today();
  const d = new Date(); d.setDate(d.getDate() + 180);
  const defaultEnd = localISODate(d);
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [items, setItems] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    if (endDate < startDate) { setError('A data final não pode ser anterior à inicial.'); return; }
    setLoading(true); setError('');
    try {
      const result = await api('googleCalendarList', { startDate, endDate });
      setItems(result || []);
      setSelected(new Set((result || []).map(x => x.id)));
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
      <div className="modal" style={{maxWidth:760}}>
        <div className="modal-head">
          <div>
            <p className="eyebrow">GOOGLE AGENDA</p>
            <h2>Importar da agenda “02 EVENTOS”</h2>
            <p className="hint">Os eventos particulares da agenda principal não entram nesta sincronização.</p>
          </div>
          <button className="icon-btn" onClick={close}><X /></button>
        </div>

        <div className="form-grid">
          <label className="field">De<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          <label className="field">Até<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
        </div>
        <button className="secondary-btn" onClick={load} disabled={loading || importing}>
          <RefreshCw size={15} /> {loading ? 'Consultando...' : 'Buscar eventos'}
        </button>

        {error && <div className="alert error" style={{marginTop:12}}><AlertCircle size={16}/>{error}</div>}

        {importing && <div className="alert" style={{marginTop:12}}><RefreshCw size={16} className="spin"/> Importação em andamento. Não clique novamente; o sistema está salvando os eventos na planilha.</div>}

        {items.length > 0 && (
          <div className="panel" style={{marginTop:16, maxHeight:360, overflow:'auto'}}>
            <div className="panel-head">
              <div><h2>Eventos encontrados</h2><p>{selected.size} selecionado(s) para importar</p></div>
              <button className="text-btn" onClick={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map(x => x.id)))}>
                {selected.size === items.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
            </div>
            {items.map(item => (
              <label key={item.id} className="event-row" style={{cursor:'pointer'}}>
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => setSelected(current => {
                    const next = new Set(current); next.has(item.id) ? next.delete(item.id) : next.add(item.id); return next;
                  })}
                />
                <div className="date-tile"><b>{item.start?.slice(8,10)}</b><small>{item.start?.slice(5,7)}</small></div>
                <div className="event-info">
                  <b>{item.title || 'Evento sem título'}</b>
                  <span>{item.time || 'Dia inteiro'}{item.location ? ` · ${item.location}` : ''}</span>
                </div>
              </label>
            ))}
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="empty-state" style={{marginTop:16}}><div><CalendarDays size={22}/></div><p>Nenhum evento novo encontrado no período.</p></div>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={close} disabled={importing}>Cancelar</button>
          <button type="button" className="primary-btn" disabled={!selected.size || loading || importing} onClick={() => importEvents([...selected])}>
            <RefreshCw size={16} className={importing ? 'spin' : ''}/> {importing ? 'Importando...' : `Importar selecionados (${selected.size})`}
          </button>
        </div>
      </div>
    </div>
  );
}

function RecordModal({
  config,
  entity,
  item,
  close,
  save,
  clients = [],
  createClient
}) {
  const [form, setForm] = useState(() => ({
    ...item,
    time: item.time ? formatTime(item.time) : '',
    endTime: item.endTime ? formatTime(item.endTime) : '',
    endDate: normalizeDateValue(item.endDate || item.date || '')
  }));

  const [showNewClient, setShowNewClient] = useState(false);
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '' });
  const [savingClient, setSavingClient] = useState(false);
  const [clientError, setClientError] = useState('');

  if (!config) return null;

  const opts = {
    select: key => key === 'type'
      ? ['Entrada', 'Saída']
      : key === 'method'
        ? ['Pix', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Outro']
        : key === 'status'
          ? ['Pendente', 'Vencida', 'Confirmado', 'Pago', 'Parcial', 'Cancelado']
          : []
  };

  const handleFieldChange = (key, value) => {
    if (entity === 'events' && key === 'clientName') {
      const selected = clients.find(client => client.id === value);

      setForm(current => ({
        ...current,
        clientId: selected?.id || '',
        clientName: selected?.name || ''
      }));
      return;
    }

    setForm(current => ({
      ...current,
      [key]: key === 'time' ? (formatTime(value) || value) : value
    }));
  };

  const handleCreateClient = async () => {
    if (!newClient.name.trim()) {
      setClientError('Informe o nome do cliente.');
      return;
    }

    setSavingClient(true);
    setClientError('');

    try {
      const created = await createClient({
        name: newClient.name.trim(),
        phone: newClient.phone.trim(),
        email: newClient.email.trim()
      });

      setForm(current => ({
        ...current,
        clientId: created.id,
        clientName: created.name
      }));

      setNewClient({ name: '', phone: '', email: '' });
      setShowNewClient(false);
    } catch (e) {
      setClientError(e.message || 'Não foi possível cadastrar o cliente.');
    } finally {
      setSavingClient(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
      <form
        className="modal"
        onSubmit={e => {
          e.preventDefault();

          const payload = { ...form };
          if (entity === 'events') {
            payload.time = payload.time ? (formatTime(payload.time) || payload.time) : '';
            payload.endTime = payload.endTime ? (formatTime(payload.endTime) || payload.endTime) : '';
            if (!payload.endDate) payload.endDate = payload.date;
            if (payload.endDate < payload.date) {
              alert('A data final não pode ser anterior à data inicial.');
              return;
            }
          }

          save(entity, payload);
        }}
      >
        <div className="modal-head">
          <div>
            <p className="eyebrow">FORMULÁRIO</p>
            <h2>{item.id ? 'Editar registro' : `Novo: ${config.title}`}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={close}><X /></button>
        </div>

        <div className="form-grid">
          {config.fields.map(([key, label, type, required]) => (
            <label key={key} className={`field ${type === 'textarea' ? 'wide' : ''}`}>
              {label}

              {entity === 'events' && key === 'clientName' ? (
                <>
                  <select
                    required={required}
                    value={form.clientId || ''}
                    onChange={e => handleFieldChange(key, e.target.value)}
                  >
                    <option value="">Selecione um cliente...</option>
                    {clients.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                    {form.clientName && !form.clientId && (
                      <option value="__legacy__">{form.clientName} (cadastro anterior)</option>
                    )}
                  </select>

                  {form.clientName && !form.clientId && (
                    <small className="hint">
                      Cliente de um evento antigo. Selecione um cliente cadastrado para vincular.
                    </small>
                  )}

                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setShowNewClient(value => !value);
                      setClientError('');
                    }}
                  >
                    <Plus size={15} />
                    {showNewClient ? 'Cancelar novo cliente' : 'Novo cliente'}
                  </button>

                  {showNewClient && (
                    <div className="panel">
                      <label className="field">
                        Nome *
                        <input
                          required
                          value={newClient.name}
                          onChange={e => setNewClient(current => ({
                            ...current,
                            name: e.target.value
                          }))}
                        />
                      </label>

                      <label className="field">
                        Telefone / WhatsApp
                        <input
                          type="tel"
                          value={newClient.phone}
                          onChange={e => setNewClient(current => ({
                            ...current,
                            phone: e.target.value
                          }))}
                        />
                      </label>

                      <label className="field">
                        E-mail
                        <input
                          type="email"
                          value={newClient.email}
                          onChange={e => setNewClient(current => ({
                            ...current,
                            email: e.target.value
                          }))}
                        />
                      </label>

                      {clientError && <p role="alert">{clientError}</p>}

                      <button
                        type="button"
                        className="primary-btn"
                        disabled={savingClient}
                        onClick={handleCreateClient}
                      >
                        {savingClient ? 'Salvando...' : 'Salvar cliente'}
                      </button>
                    </div>
                  )}
                </>
              ) : type === 'textarea' ? (
                <textarea
                  rows="3"
                  value={form[key] || ''}
                  onChange={e => handleFieldChange(key, e.target.value)}
                />
              ) : type === 'select' ? (
                <select
                  required={required}
                  value={form[key] || ''}
                  onChange={e => handleFieldChange(key, e.target.value)}
                >
                  <option value="">Selecione...</option>
                  {opts.select(key).map(option => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  required={required}
                  type={type}
                  min={type === 'number' ? '0' : undefined}
                  step={type === 'number' ? '0.01' : undefined}
                  value={type === 'time' ? formatTime(form[key]) : (form[key] ?? '')}
                  onChange={e => handleFieldChange(key, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={close}>Cancelar</button>
          <button className="primary-btn" type="submit">Salvar registro</button>
        </div>
      </form>
    </div>
  );
}

function PaymentModal({ account, receipts, type='receivable', close, save, remove }) {
  const [form, setForm] = useState({ date: today(), amount: '', method: 'Pix', notes: '' });
  const [error, setError] = useState('');
  const received = receipts.reduce((s,r)=>s+Number(r.amount||0),0);
  const balance = Math.max(0, Number(account.amount||0)-received);
  const label = type === 'payable' ? 'PAGAMENTO' : 'RECEBIMENTO';
  const submit = e => {
    e.preventDefault(); const amount=Number(form.amount||0);
    if(amount<=0){setError('Informe um valor maior que zero.');return;}
    const editing = form.id ? receipts.find(r=>r.id===form.id) : null;
    const allowed = balance + Number(editing?.amount || 0);
    if(amount>allowed+0.001){setError(`O valor não pode ser maior que o saldo de ${money(allowed)}.`);return;}
    save({ ...form, amount, paymentType:type, ...(type==='payable'?{payableId:account.id, person:account.person||''}:{receivableId:account.id,eventId:account.eventId||'',person:account.person||''}) });
  };
  const edit = r => { setError(''); setForm({id:r.id,date:normalizeDateValue(r.date||today()),amount:String(r.amount ?? ''),method:r.method||'Pix',notes:r.notes||'',paymentType:type}); };
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&close()}>
    <form className="modal" onSubmit={submit}>
      <div className="modal-head"><div><p className="eyebrow">{form.id ? `EDITAR ${label}` : label}</p><h2>{account.description || 'Conta'}</h2><small>{account.person || 'Cliente / fornecedor'} · Total {money(account.amount)}</small></div><button type="button" className="icon-btn" onClick={close}><X /></button></div>
      <div className="panel"><b>Já {type==='payable'?'pago':'recebido'}: {money(received)}</b><br/><span>Saldo pendente: <strong>{money(balance)}</strong></span></div><div className="panel"><small>Os valores e a forma de pagamento abaixo ficam registrados individualmente. Ao editar, o Caixa também é atualizado.</small></div>
      <div className="form-grid">
        <label className="field">Data<input type="date" required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label>
        <label className="field">Valor {type==='payable'?'pago':'recebido'}<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label>
        <label className="field">Forma de pagamento<select value={form.method} onChange={e=>setForm({...form,method:e.target.value})}>{['Pix','Dinheiro','Cartão de crédito','Cartão de débito','Transferência','Outro'].map(x=><option key={x}>{x}</option>)}</select></label>
        <label className="field wide">Observação<textarea rows="3" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></label>
      </div>
      {receipts.length>0 && <div className="panel"><b>Histórico</b>{receipts.map(r=><div key={r.id} style={{display:'flex',justifyContent:'space-between',gap:12,padding:'8px 0',borderBottom:'1px solid #eee'}}><span>{formatDate(r.date)} · {r.method || '—'}{r.notes ? ` · ${r.notes}` : ''}</span><span><b>{money(r.amount)}</b> <button type="button" className="icon-btn" title="Editar" onClick={()=>edit(r)}><Edit size={13}/></button> <button type="button" className="icon-btn danger" title="Excluir" onClick={()=>remove(r)}><Trash2 size={13}/></button></span></div>)}</div>}
      {error && <p role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={()=>{setError('');setForm({date:today(),amount:'',method:'Pix',notes:'',paymentType:type});}}>{form.id?'Novo pagamento':'Fechar'}</button><button className="primary-btn" type="submit">{form.id?'Salvar alteração':(type==='payable'?'Registrar pagamento':'Registrar recebimento')}</button></div>
    </form>
  </div>;
}
function Reports({ data, period, setPeriod }) {
  const [report, setReport] = useState('receivable');
  const [selectedClients, setSelectedClients] = useState([]);
  const [from, setFrom] = useState(`${period}-01`);
  const [to, setTo] = useState(() => {
    const [y,m] = period.split('-').map(Number);
    const d = new Date(y, m, 0);
    return localISODate(d);
  });

  useEffect(() => {
    setFrom(`${period}-01`);
    const [y,m] = period.split('-').map(Number);
    setTo(localISODate(new Date(y, m, 0)));
  }, [period]);

  const inPeriod = value => {
    const d = normalizeDateValue(value);
    return (!from || d >= from) && (!to || d <= to);
  };

  const titleMap = {
    agenda: 'Agenda de eventos',
    available: 'Datas disponíveis',
    receivable: 'Contas a receber',
    payable: 'Contas a pagar',
    cash: 'Caixa'
  };

  const clientNames = [...new Set((data.clients || [])
    .map(x => String(x.name || '').trim())
    .filter(Boolean))].sort((a,b) => a.localeCompare(b, 'pt-BR'));

  const events = (data.events || [])
    .filter(x => inPeriod(x.date))
    .filter(x => !selectedClients.length || selectedClients.includes(String(x.clientName || '').trim()))
    .sort((a,b) => `${a.date} ${a.time||''}`.localeCompare(`${b.date} ${b.time||''}`));

  const receivables = (data.receivable || [])
    .filter(x => inPeriod(x.dueDate))
    .sort((a,b) => String(a.dueDate||'').localeCompare(String(b.dueDate||'')));

  const payables = (data.payable || [])
    .filter(x => inPeriod(x.dueDate))
    .sort((a,b) => String(a.dueDate||'').localeCompare(String(b.dueDate||'')));

  const transactions = (data.transactions || [])
    .filter(x => inPeriod(x.date))
    .sort((a,b) => String(a.date||'').localeCompare(String(b.date||'')));

  const pendingReceivables = receivables.filter(x => Number(x.amount||0) > Number(x.paid||0));
  const pendingPayables = payables.filter(x => Number(x.amount||0) > Number(x.paid||0));
  const income = transactions.filter(x => x.type === 'Entrada').reduce((s,x)=>s+Number(x.amount||0),0);
  const expense = transactions.filter(x => x.type === 'Saída').reduce((s,x)=>s+Number(x.amount||0),0);

  const printTitle = titleMap[report];

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">RELATÓRIOS</p>
          <h1>{printTitle}</h1>
          <p>Relatórios simples, filtrados por período e prontos para impressão.</p>
        </div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',justifyContent:'flex-end'}}>
          <label className="field" style={{minWidth:150}}>Relatório
            <select value={report} onChange={e=>setReport(e.target.value)}>
              <option value="agenda">Agenda</option>
              <option value="available">Datas disponíveis</option>
              <option value="receivable">Contas a receber</option>
              <option value="payable">Contas a pagar</option>
              <option value="cash">Caixa</option>
            </select>
          </label>
          <label className="field">De
            <input className="period-input" type="date" value={from} onChange={e=>setFrom(e.target.value)} />
          </label>
          <label className="field">Até
            <input className="period-input" type="date" value={to} onChange={e=>setTo(e.target.value)} />
          </label>
          {report === 'agenda' && (
            <div className="field report-client-filter">
              <span>Clientes</span>
              <details className="multi-check">
                <summary>{selectedClients.length ? `${selectedClients.length} cliente(s) selecionado(s)` : 'Todos os clientes'}</summary>
                <div className="multi-check-menu">
                  <label className="check-row check-all">
                    <input
                      type="checkbox"
                      checked={!selectedClients.length}
                      onChange={() => setSelectedClients([])}
                    />
                    <b>Todos</b>
                  </label>
                  {clientNames.map(name => (
                    <label className="check-row" key={name}>
                      <input
                        type="checkbox"
                        checked={selectedClients.includes(name)}
                        onChange={e => setSelectedClients(prev => e.target.checked ? [...prev, name] : prev.filter(x => x !== name))}
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                  {!clientNames.length && <small className="multi-check-empty">Nenhum cliente cadastrado.</small>}
                </div>
              </details>
            </div>
          )}
        </div>
      </div>

      <section className="panel report-sheet">
        <div className="panel-head">
          <div>
            <h2>FotoGestor</h2>
            <p>{printTitle} · {formatDate(from)} até {formatDate(to)}</p>
          </div>
          <button className="secondary-btn" onClick={()=>window.print()}>Imprimir / PDF</button>
        </div>

        {report === 'agenda' && (
          <ReportTable headers={['Data','Horário','Evento','Cliente','Tipo','Local','Valor','Situação']} rows={events.map(x=>[
            formatDate(x.date), formatTime(x.time)||'—', x.title||'—', x.clientName||'—', x.type||'—', x.location||'—', money(x.value), x.status||'—'
          ])} empty="Nenhum evento no período." />
        )}

        {report === 'receivable' && (
          <ReportTable headers={['Vencimento','Cliente','Descrição','Valor','Recebido','Saldo','Situação']} rows={receivables.map(x=>[
            formatDate(x.dueDate), x.person||'—', x.description||'—', money(x.amount), money(x.paid), money(Number(x.amount||0)-Number(x.paid||0)), x.status||'—'
          ])} empty="Nenhuma conta a receber no período." />
        )}

        {report === 'payable' && (
          <ReportTable headers={['Vencimento','Fornecedor','Descrição','Valor','Pago','Saldo','Situação']} rows={payables.map(x=>[
            formatDate(x.dueDate), x.person||'—', x.description||'—', money(x.amount), money(x.paid), money(Number(x.amount||0)-Number(x.paid||0)), x.status||'—'
          ])} empty="Nenhuma conta a pagar no período." />
        )}

        {report === 'cash' && (
          <>
            <div className="stats-grid" style={{marginBottom:16}}>
              <Stat label="Entradas" value={money(income)} icon={ArrowDownToLine} tone="green" foot="Período" />
              <Stat label="Saídas" value={money(expense)} icon={ArrowUpFromLine} tone="orange" foot="Período" />
              <Stat label="Saldo" value={money(income-expense)} icon={ChartNoAxesCombined} tone="purple" foot="Entradas − saídas" />
            </div>
            <ReportTable headers={['Data','Movimento','Descrição','Pessoa','Forma','Valor']} rows={transactions.map(x=>[
              formatDate(x.date), x.type||'—', x.description||'—', x.person||'—', x.method||'—', money(x.amount)
            ])} empty="Nenhum lançamento no período." />
          </>
        )}

        {report === 'available' && <AvailableDatesReport events={data.events || []} from={from} to={to} />}
      </section>
    </>
  );
}

function ReportTable({ headers, rows, empty }) {
  return rows.length ? (
    <div className="table-wrap">
      <table>
        <thead><tr>{headers.map(h=><th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((row,i)=><tr key={i}>{row.map((cell,j)=><td key={j}>{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  ) : <Empty text={empty} />;
}

function AvailableDatesReport({ events, from, to }) {
  const [selectedDays, setSelectedDays] = useState([5,6,0]);
  const weekdays = [
    [1,'Segunda-feira'], [2,'Terça-feira'], [3,'Quarta-feira'], [4,'Quinta-feira'],
    [5,'Sexta-feira'], [6,'Sábado'], [0,'Domingo']
  ];

  const toggleDay = day => setSelectedDays(prev =>
    prev.includes(day) ? prev.filter(x => x !== day) : [...prev, day]
  );

  const occupied = new Set();

  // Considera todo o intervalo de um evento, inclusive eventos de vários dias.
  events.forEach(event => {
    const start = normalizeDateValue(event.date || '');
    const finish = normalizeDateValue(event.endDate || event.date || '');
    if (!start) return;

    let cursor = new Date(`${start}T12:00:00`);
    const end = new Date(`${finish >= start ? finish : start}T12:00:00`);
    while (cursor <= end) {
      const iso = localISODate(cursor);
      if (inRange(iso, from, to)) occupied.add(iso);
      cursor.setDate(cursor.getDate() + 1);
    }
  });

  const dates=[];
  if(from && to && from <= to) {
    let d=new Date(`${from}T12:00:00`);
    const end=new Date(`${to}T12:00:00`);
    while(d<=end){
      const iso=localISODate(d);
      // Mostra somente os dias da semana selecionados e que estejam livres.
      if(selectedDays.includes(d.getDay()) && !occupied.has(iso)) {
        dates.push({iso,weekday:weekdays.find(x=>x[0]===d.getDay())?.[1] || ''});
      }
      d.setDate(d.getDate() + 1);
    }
  }

  return (
    <>
      <div className="available-days-filter">
        <div className="available-days-title">Dias da semana</div>
        <div className="available-days-options">
          {weekdays.map(([day,label]) => (
            <label className="check-row" key={day}>
              <input type="checkbox" checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
      <ReportTable
        headers={['Data','Dia']}
        rows={dates.map(x=>[formatDate(x.iso),x.weekday])}
        empty="Nenhuma data disponível para os dias selecionados no período."
      />
    </>
  );
}

function inRange(value, from, to) {
  const d=normalizeDateValue(value);
  return (!from || d>=from) && (!to || d<=to);
}

function SettingsPage({ data, onSave }) {
  const [name, setName] = useState(data.settings?.studioName || 'Meu Estúdio de Fotografia');
  const [phone, setPhone] = useState(data.settings?.phone || '');
  const [email, setEmail] = useState(data.settings?.email || '');

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">PERSONALIZAÇÃO</p>
          <h1>Configurações</h1>
          <p>Dados básicos do estúdio.</p>
        </div>
      </div>

      <form
        className="panel settings-form"
        onSubmit={e => {
          e.preventDefault();
          onSave({ studioName: name, phone, email });
        }}
      >
        <label className="field">
          Nome do estúdio
          <input value={name} onChange={e => setName(e.target.value)} required />
        </label>
        <label className="field">
          Telefone
          <input value={phone} onChange={e => setPhone(e.target.value)} />
        </label>
        <label className="field">
          E-mail
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <button className="primary-btn">Salvar configurações</button>
        <p className="hint">
          A URL do Apps Script é configurada separadamente em <code>src/config.js</code>.
        </p>
      </form>
    </>
  );
}

export default App;
