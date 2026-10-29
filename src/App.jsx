
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
      ['date', 'Data', 'date', true],
      ['time', 'Horário', 'time'],
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
      ['method', 'Forma de pagamento', 'select'],
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
  let match = text.match(/^(\\d{4})-(\\d{2})-(\\d{2})(?:[T ]|$)/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;

  // Brazilian date: dd/mm/yyyy (with optional time)
  match = text.match(/^(\\d{1,2})[\\/.-](\\d{1,2})[\\/.-](\\d{4})(?:[ T].*)?$/);
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

  const match = iso.match(/^(\\d{4})-(\\d{2})-(\\d{2})$/);
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

  const refresh = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await api('read');
      const normalized = { ...emptyData(), ...result };
      // Garante que datas vindas do Sheets tenham sempre o mesmo formato
      // usado pelos inputs HTML: yyyy-MM-dd.
      for (const key of ['events', 'transactions', 'receivable', 'payable']) {
        normalized[key] = (normalized[key] || []).map(item => ({
          ...item,
          ...(item.date !== undefined ? { date: normalizeDateValue(item.date) } : {}),
          ...(item.dueDate !== undefined ? { dueDate: normalizeDateValue(item.dueDate) } : {})
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

      if (key === 'events' && next.time) {
        next.time = formatTime(next.time) || next.time;
      }

      await api(isUpdate ? 'update' : 'create', {
        entity: key,
        item: next
      });

      setModal(null);
      setNotice('Registro salvo.');
      await refresh();
    } catch (e) {
      setError(e.message);
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
    ? (data[active] || []).filter(x =>
        JSON.stringify(x).toLowerCase().includes(search.toLowerCase())
      )
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
                  <button
                    className="primary-btn"
                    onClick={() => setModal({
                      entity: active,
                      item: { date: today(), status: 'Pendente', type: 'Entrada' }
                    })}
                  >
                    <Plus size={17} /> Novo registro
                  </button>
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
                          {entities[active].fields.slice(0, 6).map(f => (
                            <th key={f[0]}>{f[1]}</th>
                          ))}
                          <th>Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentItems.map((item, i) => (
                          <tr key={item.id || i}>
                            {entities[active].fields.slice(0, 6).map(f => (
                              <td key={f[0]}>
                                {['amount', 'price', 'value', 'paid'].includes(f[0])
                                  ? money(item[f[0]])
                                  : f[0] === 'date' || f[0] === 'dueDate'
                                    ? formatDate(item[f[0]])
                                    : f[0] === 'time'
                                      ? formatTime(item[f[0]]) || '—'
                                      : item[f[0]] || '—'}
                              </td>
                            ))}
                            <td>
                              <div className="row-actions">
                                <button className="icon-btn" title="Editar" onClick={() => setModal({ entity: active, item })}>
                                  <Edit size={15} />
                                </button>
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
                  <p className="table-foot">{currentItems.length} registro(s) · Sincronização com Google Sheets</p>
                </>
              )}
            </>
          )}

          <footer>FotoGestor <span>·</span> Gestão simples para quem vive de fotografia</footer>
        </div>
      </main>

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
    time: item.time ? formatTime(item.time) : ''
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
          ? ['Pendente', 'Confirmado', 'Pago', 'Parcial', 'Cancelado']
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
          if (entity === 'events' && payload.time) {
            payload.time = formatTime(payload.time) || payload.time;
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

function Reports({ data, period, setPeriod }) {
  const tx = (data.transactions || []).filter(x => (x.date || '').startsWith(period));

  const income = tx
    .filter(x => x.type === 'Entrada')
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  const expense = tx
    .filter(x => x.type === 'Saída')
    .reduce((sum, x) => sum + Number(x.amount || 0), 0);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ANÁLISE DO NEGÓCIO</p>
          <h1>Relatórios</h1>
          <p>Visão financeira e pendências por período.</p>
        </div>
        <input className="period-input" type="month" value={period} onChange={e => setPeriod(e.target.value)} />
      </div>

      <div className="stats-grid">
        <Stat label="Entradas no período" value={money(income)} icon={ArrowDownToLine} tone="green" foot={period} />
        <Stat label="Saídas no período" value={money(expense)} icon={ArrowUpFromLine} tone="orange" foot={period} />
        <Stat label="Resultado do período" value={money(income - expense)} icon={ChartNoAxesCombined} tone="purple" foot="Entradas menos saídas" />
        <Stat label="Eventos cadastrados" value={data.events?.filter(e => (e.date || '').startsWith(period)).length || 0} icon={CalendarDays} tone="blue" foot="No mês selecionado" />
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-head">
            <div><h2>Contas a receber</h2><p>Saldo pendente por cliente</p></div>
          </div>
          {(data.receivable || [])
            .filter(x => Number(x.amount || 0) > Number(x.paid || 0))
            .map(x => (
              <div className="money-row" key={x.id}>
                <span>{x.person} · {x.description}</span>
                <b>{money(Number(x.amount) - Number(x.paid || 0))}</b>
              </div>
            ))}
          {!data.receivable?.some(x => Number(x.amount || 0) > Number(x.paid || 0)) && (
            <Empty text="Nenhuma conta pendente." />
          )}
        </section>

        <section className="panel">
          <div className="panel-head">
            <div><h2>Contas a pagar</h2><p>Saldo pendente por fornecedor</p></div>
          </div>
          {(data.payable || [])
            .filter(x => Number(x.amount || 0) > Number(x.paid || 0))
            .map(x => (
              <div className="money-row" key={x.id}>
                <span>{x.person} · {x.description}</span>
                <b>{money(Number(x.amount) - Number(x.paid || 0))}</b>
              </div>
            ))}
          {!data.payable?.some(x => Number(x.amount || 0) > Number(x.paid || 0)) && (
            <Empty text="Nenhuma conta pendente." />
          )}
        </section>
      </div>

      <button className="secondary-btn" onClick={() => window.print()}>
        Imprimir / salvar em PDF
      </button>
    </>
  );
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
