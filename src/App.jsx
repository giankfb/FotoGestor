
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
  audits: [],
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
  const [deleteEventModal, setDeleteEventModal] = useState(null);

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
          ...(item.dueDate !== undefined ? { dueDate: normalizeDateValue(item.dueDate) } : {})
        }));
      }
      normalized.receipts = (normalized.receipts || []).filter(r => String(r.status || '').toLowerCase() !== 'estornado');
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
    if (key === 'events') {
      // Pode haver mais de uma conta antiga vinculada ao mesmo evento.
      // Considere todas para decidir se é necessário perguntar sobre os recebimentos.
      const accounts = (data.receivable || []).filter(x => String(x.eventId || '') === String(item.id));
      const accountIds = new Set(accounts.map(x => String(x.id || '')));
      const receipts = (data.receipts || []).filter(r => accountIds.has(String(r.receivableId || '')) && String(r.status || '').toLowerCase() !== 'estornado');
      if (receipts.length) {
        setDeleteEventModal({ event: item, account: accounts[0] || null, accounts, receipts });
        return;
      }
      if (!confirm(`Excluir “${item.name || item.title || 'este evento'}”?\n\nO evento será removido da Agenda e do Google Agenda, e a conta a receber vinculada também será encerrada.`)) return;
      try {
        await api('deleteEvent', { eventId: item.id, mode: 'excluir' });
        await refresh();
        setNotice('Evento excluído e conta a receber removida.');
      } catch (e) { setError(e.message); }
      return;
    }

    if (!confirm(`Excluir “${item.name || item.title || item.description || item.person || 'este registro'}”?`)) return;
    try {
      await api('delete', { entity: key, id: item.id });
      await refresh();
      setNotice('Registro excluído.');
    } catch (e) {
      setError(e.message);
    }
  };

  const confirmDeleteEvent = async mode => {
    if (!deleteEventModal) return;
    const { event, receipts } = deleteEventModal;
    try {
      const result = await api('deleteEvent', { eventId: event.id, mode });
      setDeleteEventModal(null);
      await refresh();
      if (mode === 'estornar') {
        setNotice(`Evento excluído. ${receipts.length} recebimento(s), total de ${money(result.totalReceived)}, foram estornados e retirados do Caixa. O histórico ficou registrado na Auditoria.`);
      } else {
        setNotice(`Evento excluído. Os recebimentos (${money(result.totalReceived)}) foram mantidos no Caixa e o histórico ficou registrado na Auditoria.`);
      }
    } catch (e) { setError(e.message); }
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

      {deleteEventModal && (
        <EventDeleteModal
          event={deleteEventModal.event}
          account={deleteEventModal.account}
          receipts={deleteEventModal.receipts}
          close={() => setDeleteEventModal(null)}
          onChoose={confirmDeleteEvent}
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

function EventDeleteModal({ event, account, receipts, close, onChoose }) {
  const total = receipts.reduce((sum, r) => sum + Number(r.amount || 0), 0);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && close()}>
    <div className="modal">
      <div className="modal-head">
        <div>
          <p className="eyebrow">EXCLUSÃO DO EVENTO</p>
          <h2>{event.title || 'Evento fotográfico'}</h2>
          <small>{event.clientName || 'Cliente não informado'} · {formatDate(event.date)}</small>
        </div>
        <button type="button" className="icon-btn" onClick={close}><X /></button>
      </div>
      <div className="panel" style={{marginBottom:14}}>
        <b>Este evento possui {receipts.length} recebimento{receipts.length === 1 ? '' : 's'} registrado{receipts.length === 1 ? '' : 's'}.</b>
        <div style={{marginTop:7}}>Total recebido: <strong>{money(total)}</strong></div>
        <small style={{display:'block',marginTop:7,color:'#7b8494'}}>Escolha como o sistema deve tratar o financeiro antes de excluir o evento.</small>
      </div>
      <div className="delete-choice-grid">
        <button className="choice-btn danger-choice" onClick={() => onChoose('estornar')}>
          <b>Estornar recebimentos</b>
          <span>Exclui o evento, estorna os recebimentos e remove essas entradas do Caixa. O estorno fica registrado na Auditoria.</span>
        </button>
        <button className="choice-btn keep-choice" onClick={() => onChoose('manter')}>
          <b>Excluir evento e manter recebimentos</b>
          <span>Exclui o evento, mas mantém os valores já recebidos no Caixa e preserva o histórico financeiro.</span>
        </button>
      </div>
      <div className="modal-actions"><button type="button" className="secondary-btn" onClick={close}>Cancelar</button></div>
    </div>
  </div>;
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
  const todayISO = today();
  const [reportType, setReportType] = useState('agenda');
  const [startDate, setStartDate] = useState(() => `${todayISO.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(() => todayISO);
  const [clientFilter, setClientFilter] = useState('');
  const [selectedDays, setSelectedDays] = useState([5, 6]);
  const [copyNotice, setCopyNotice] = useState('');

  const weekdayNames = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const shortWeekday = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const monthNames = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

  const dateFromISO = value => {
    const [y, m, d] = String(value || '').split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  };

  const inRange = value => {
    const iso = normalizeDateValue(value);
    return !!iso && (!startDate || iso >= startDate) && (!endDate || iso <= endDate);
  };

  const receiptsByAccount = accountId => (data.receipts || []).filter(r => String(r.receivableId || '') === String(accountId) && !String(r.status || '').toLowerCase().includes('estorn'));
  const paymentsByAccount = accountId => (data.payments || []).filter(r => String(r.payableId || '') === String(accountId) && !String(r.status || '').toLowerCase().includes('estorn'));
  const receivedFor = account => receiptsByAccount(account.id).reduce((sum, r) => sum + Number(r.amount || 0), 0);
  const paidFor = account => paymentsByAccount(account.id).reduce((sum, r) => sum + Number(r.amount || 0), 0);

  const clients = [...new Set((data.clients || []).map(c => String(c.name || '').trim()).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'pt-BR'));

  const receivables = (data.receivable || [])
    .filter(x => inRange(x.dueDate))
    .filter(x => !clientFilter || String(x.person || '') === clientFilter)
    .sort((a,b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

  const payables = (data.payable || [])
    .filter(x => inRange(x.dueDate))
    .sort((a,b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

  const transactions = (data.transactions || [])
    .filter(x => inRange(x.date))
    .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')));

  const events = (data.events || [])
    .filter(x => inRange(x.date))
    .filter(x => !String(x.status || '').toLowerCase().includes('cancel'))
    .filter(x => !clientFilter || String(x.clientName || '') === clientFilter)
    .sort((a,b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '').localeCompare(String(b.time || '')));

  const availabilityDates = [];
  if (startDate && endDate && startDate <= endDate) {
    let cursor = dateFromISO(startDate);
    const end = dateFromISO(endDate);
    while (cursor && end && cursor <= end) {
      const iso = localISODate(cursor);
      if (selectedDays.includes(cursor.getDay())) availabilityDates.push({ iso, day: cursor.getDay() });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const bookedDates = new Set((data.events || [])
    .filter(e => !String(e.status || '').toLowerCase().includes('cancel'))
    .map(e => normalizeDateValue(e.date)).filter(Boolean));
  const freeDates = availabilityDates.filter(x => !bookedDates.has(x.iso));

  const toggleDay = day => setSelectedDays(days => days.includes(day) ? days.filter(x => x !== day) : [...days, day].sort((a,b) => a-b));

  const reportTitles = {
    agenda: ['Agenda', 'Eventos agendados no período'],
    availability: ['Datas disponíveis', 'Sextas e sábados — ou outros dias selecionados — ainda livres'],
    receivable: ['Contas a receber', 'Contas com vencimento no período'],
    payable: ['Contas a pagar', 'Contas com vencimento no período'],
    transactions: ['Caixa', 'Entradas e saídas registradas no período']
  };

  const copyAvailable = async () => {
    if (!freeDates.length) { setCopyNotice('Não há datas disponíveis com os filtros selecionados.'); return; }
    const lines = ['DATAS DISPONÍVEIS', `${formatDate(startDate)} a ${formatDate(endDate)}`, ''];
    freeDates.forEach(item => {
      const d = dateFromISO(item.iso);
      lines.push(`• ${shortWeekday[item.day]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`);
    });
    lines.push('', 'Consulte a disponibilidade antes de confirmar.');
    const text = lines.join('\n');
    try { await navigator.clipboard.writeText(text); setCopyNotice('Lista copiada para o WhatsApp.'); }
    catch { window.prompt('Copie a lista abaixo:', text); }
  };

  const printReport = () => window.print();

  return (
    <div className="reports-page">
      <div className="report-print-header">
        <div className="report-brand"><span className="report-logo"><Camera size={20}/></span><strong>FotoGestor</strong></div>
        <div className="report-brand-sub">Relatório</div>
      </div>

      <div className="page-heading report-screen-heading">
        <div>
          <p className="eyebrow">RELATÓRIOS</p>
          <h1>Relatórios</h1>
          <p>Escolha o relatório e o período que deseja consultar ou imprimir.</p>
        </div>
        <button className="secondary-btn" onClick={printReport}>Imprimir / PDF</button>
      </div>

      <div className="report-selector">
        {[
          ['agenda','Agenda',CalendarDays],
          ['availability','Datas disponíveis',CalendarClock],
          ['receivable','Contas a receber',ArrowDownToLine],
          ['payable','Contas a pagar',ArrowUpFromLine],
          ['transactions','Caixa',Wallet]
        ].map(([id,label,Icon]) => (
          <button key={id} className={reportType === id ? 'report-selector-btn active' : 'report-selector-btn'} onClick={() => { setReportType(id); setCopyNotice(''); }}>
            <Icon size={16}/><span>{label}</span>
          </button>
        ))}
      </div>

      <section className="report-sheet">
        <header className="report-sheet-header">
          <div>
            <p className="eyebrow">{reportTitles[reportType][0].toUpperCase()}</p>
            <h2>{reportTitles[reportType][0]}</h2>
            <p>{reportTitles[reportType][1]}</p>
          </div>
          <div className="report-period-print">{startDate ? formatDate(startDate) : '—'} a {endDate ? formatDate(endDate) : '—'}</div>
        </header>

        <div className="report-filters">
          <label className="field">De<input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
          <label className="field">Até<input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></label>
          {(reportType === 'agenda' || reportType === 'availability' || reportType === 'receivable') && (
            <label className="field">Cliente{reportType === 'availability' ? <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}><option value="">Todos</option>{clients.map(name => <option key={name}>{name}</option>)}</select> : <select value={clientFilter} onChange={e => setClientFilter(e.target.value)}><option value="">Todos os clientes</option>{clients.map(name => <option key={name}>{name}</option>)}</select>}</label>
          )}
          {reportType === 'availability' && (
            <div className="weekday-filter report-weekdays">
              {weekdayNames.map((name, day) => <label key={name} className="weekday-check"><input type="checkbox" checked={selectedDays.includes(day)} onChange={() => toggleDay(day)} /> {name}</label>)}
            </div>
          )}
        </div>

        {reportType === 'availability' && (
          <div className="report-inline-actions">
            <button className="secondary-btn" onClick={copyAvailable}>Copiar datas para WhatsApp</button>
            {copyNotice && <span>{copyNotice}</span>}
          </div>
        )}

        {startDate > endDate ? <div className="report-warning">A data inicial não pode ser posterior à data final.</div> : (
          <>
            {reportType === 'agenda' && <ReportTable columns={['Data','Dia','Horário','Evento','Cliente','Local','Valor','Situação']} rows={events.map(e => { const d=dateFromISO(e.date); return [formatDate(e.date), weekdayNames[d?.getDay() ?? 0], formatTime(e.time)||'—', e.title||e.type||'Evento fotográfico', e.clientName||'—', e.location||'—', money(e.value), e.status||'Agendado']; })} empty="Nenhum evento encontrado no período." />}
            {reportType === 'receivable' && <ReportTable columns={['Vencimento','Cliente','Descrição','Valor','Recebido','Saldo','Situação']} rows={receivables.map(a => { const received=receivedFor(a); const balance=Math.max(0,Number(a.amount||0)-received); return [formatDate(a.dueDate),a.person||'—',a.description||'—',money(a.amount),money(received),money(balance),a.status|| (balance<=0?'Pago':'Pendente')]; })} empty="Nenhuma conta a receber no período." />}
            {reportType === 'payable' && <ReportTable columns={['Vencimento','Fornecedor','Descrição','Valor','Pago','Saldo','Situação']} rows={payables.map(a => { const paid=paidFor(a); const balance=Math.max(0,Number(a.amount||0)-paid); return [formatDate(a.dueDate),a.person||'—',a.description||'—',money(a.amount),money(paid),money(balance),a.status|| (balance<=0?'Pago':'Pendente')]; })} empty="Nenhuma conta a pagar no período." />}
            {reportType === 'transactions' && <ReportTable columns={['Data','Tipo','Descrição','Categoria','Pessoa','Forma','Valor']} rows={transactions.map(x => [formatDate(x.date),x.type||'—',x.description||'—',x.category||'—',x.person||'—',x.method||'—',money(x.amount)])} empty="Nenhuma movimentação no período." />}
            {reportType === 'availability' && <ReportTable columns={['Data','Dia','Situação']} rows={availabilityDates.map(x => [formatDate(x.iso),weekdayNames[x.day],bookedDates.has(x.iso)?'Agendada':'Disponível']).filter((_,i) => true).filter(row => row[2] === 'Disponível')} empty="Nenhuma data disponível com os filtros selecionados." />}
          </>
        )}

        {reportType === 'availability' && startDate <= endDate && <p className="report-note">A disponibilidade é calculada considerando eventos ativos da Agenda. Eventos cancelados não bloqueiam a data.</p>}
      </section>
    </div>
  );
}

function ReportTable({ columns, rows, empty }) {
  return <div className="report-list-wrap">
    <table className="report-list-table">
      <thead><tr>{columns.map(c => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{cell}</td>)}</tr>)}</tbody>
    </table>
    {!rows.length && <Empty text={empty} />}
  </div>;
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
