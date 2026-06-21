import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import {
  Users, Plus, Trash2, ChevronRight, TrendingUp, Wallet,
  PiggyBank, Target, CreditCard, SlidersHorizontal, Check, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Sun, Moon, LayoutDashboard
} from 'lucide-react';

// --------------------------------------------------------------------------
// DESIGN TOKENS (uses CSS variables for dark/light)
// --------------------------------------------------------------------------
const COLORS = {
  ink: 'var(--text-primary)',
  paper: 'var(--bg-body)',
  paperRaised: 'var(--bg-card)',
  forest: 'var(--success)',
  clay: 'var(--danger)',
  slate: 'var(--text-secondary)',
  gold: 'var(--accent)',
  goldLight: 'var(--accent-light)',
  border: 'var(--border)',
};
const PIE_COLORS = ['#2F5D50', '#C9A24B', '#A8503D', '#6B7785', '#4A7A6B', '#D4B876'];

// Supported currencies
const CURRENCIES = {
  USD: { locale: 'en-US', symbol: '$' },
  INR: { locale: 'en-IN', symbol: '₹' },
  EUR: { locale: 'de-DE', symbol: '€' },
  GBP: { locale: 'en-GB', symbol: '£' },
  JPY: { locale: 'ja-JP', symbol: '¥', decimals: 0 },
  CAD: { locale: 'en-CA', symbol: 'CA$' },
  AUD: { locale: 'en-AU', symbol: 'A$' },
};

// Formatting functions now take a currency code
const fmt = (n, currency = 'USD', decimals = 0) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  const cur = CURRENCIES[currency] || CURRENCIES.USD;
  const dec = cur.decimals !== undefined ? cur.decimals : decimals;
  const v = Math.round(n * Math.pow(10, dec)) / Math.pow(10, dec);
  return new Intl.NumberFormat(cur.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  }).format(v);
};
const fmtPct = (n, decimals = 1) => `${(n || 0).toFixed(decimals)}%`;
const fmtCompact = (n, currency = 'USD') => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e6) return `${CURRENCIES[currency]?.symbol || '$'}${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `${CURRENCIES[currency]?.symbol || '$'}${(n / 1e3).toFixed(0)}K`;
  return fmt(n, currency, 0);
};

// --------------------------------------------------------------------------
// DEFAULT DATA MODEL (added currency, theme, expenseCategories, debtMethod)
// --------------------------------------------------------------------------
const newClientId = () => `client_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const newId = () => Math.random().toString(36).slice(2, 10);

const defaultClient = (name = 'New client') => ({
  id: newClientId(),
  name,
  createdAt: Date.now(),
  theme: 'light',                       // 'light' | 'dark'
  profile: {
    age: 35,
    retirementAge: 65,
    lifeExpectancy: 90,
    annualIncome: 95000,
    incomeGrowth: 2.5,
    filingStatus: 'single',
    riskTolerance: 'moderate',
    dependents: 0,
    currency: 'USD',                    // selected currency
    notes: '',
  },
  assets: [
    { id: newId(), name: 'Checking & savings', value: 15000, category: 'cash' },
    { id: newId(), name: '401(k)', value: 85000, category: 'retirement' },
    { id: newId(), name: 'Brokerage account', value: 22000, category: 'investment' },
  ],
  liabilities: [
    { id: newId(), name: 'Credit card', value: 3200, rate: 22, minPayment: 120 },
    { id: newId(), name: 'Auto loan', value: 14000, rate: 6.5, minPayment: 320 },
  ],
  expenses: [
    { id: newId(), name: 'Housing', amount: 1800, category: 'essential' },
    { id: newId(), name: 'Food', amount: 600, category: 'essential' },
    { id: newId(), name: 'Transportation', amount: 400, category: 'essential' },
    { id: newId(), name: 'Insurance', amount: 250, category: 'essential' },
    { id: newId(), name: 'Discretionary', amount: 500, category: 'lifestyle' },
  ],
  expenseCategories: ['essential', 'lifestyle'],   // customizable categories
  retirementInputs: {
    currentSavings: 85000,
    monthlyContribution: 800,
    employerMatch: 200,
    preRetirementReturn: 7,
    postRetirementReturn: 4.5,
    inflationRate: 2.8,
    desiredAnnualIncome: 65000,
    socialSecurityAnnual: 22000,
    socialSecurityStartAge: 67,
  },
  goals: [
    { id: newId(), name: 'Emergency fund', target: 25000, current: 8000, targetDate: '2027-06', priority: 'high' },
    { id: newId(), name: 'House down payment', target: 60000, current: 15000, targetDate: '2029-01', priority: 'high' },
  ],
  scenario: {
    returnAdjust: 0,
    retirementAgeAdjust: 0,
    savingsRateAdjust: 0,
  },
  debtMethod: 'avalanche',   // 'avalanche' or 'snowball'
});

// --------------------------------------------------------------------------
// STORAGE HOOK (unchanged)
// --------------------------------------------------------------------------
function useClientStore() {
  const [clients, setClients] = useState({});
  const [activeId, setActiveId] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const saveTimer = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const idx = await window.storage.get('client_index');
        const ids = idx ? JSON.parse(idx.value) : [];
        const loadedClients = {};
        for (const id of ids) {
          try {
            const c = await window.storage.get(`client:${id}`);
            if (c) loadedClients[id] = JSON.parse(c.value);
          } catch (e) {}
        }
        if (Object.keys(loadedClients).length === 0) {
          const c = defaultClient('Alex Morgan (sample)');
          loadedClients[c.id] = c;
          await window.storage.set('client_index', JSON.stringify([c.id]));
          await window.storage.set(`client:${c.id}`, JSON.stringify(c));
        }
        setClients(loadedClients);
        setActiveId(Object.keys(loadedClients)[0]);
      } catch (e) {
        const c = defaultClient('Alex Morgan (sample)');
        setClients({ [c.id]: c });
        setActiveId(c.id);
      }
      setLoaded(true);
    })();
  }, []);

  const persist = useCallback((clientObj) => {
    setSaveState('saving');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await window.storage.set(`client:${clientObj.id}`, JSON.stringify(clientObj));
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 1200);
      } catch (e) { setSaveState('idle'); }
    }, 400);
  }, []);

  const updateClient = useCallback((id, updater) => {
    setClients(prev => {
      const current = prev[id];
      if (!current) return prev;
      const next = typeof updater === 'function' ? updater(current) : updater;
      persist(next);
      return { ...prev, [id]: next };
    });
  }, [persist]);

  const addClient = useCallback(async (name) => {
    const c = defaultClient(name);
    const newClients = { ...clients, [c.id]: c };
    setClients(newClients);
    setActiveId(c.id);
    const ids = Object.keys(newClients);
    await window.storage.set('client_index', JSON.stringify(ids));
    await window.storage.set(`client:${c.id}`, JSON.stringify(c));
    return c.id;
  }, [clients]);

  const deleteClient = useCallback(async (id) => {
    const newClients = { ...clients };
    delete newClients[id];
    setClients(newClients);
    const ids = Object.keys(newClients);
    await window.storage.set('client_index', JSON.stringify(ids));
    try { await window.storage.delete(`client:${id}`); } catch (e) {}
    if (activeId === id) setActiveId(ids[0] || null);
  }, [clients, activeId]);

  return { clients, activeId, setActiveId, updateClient, addClient, deleteClient, loaded, saveState };
}

// --------------------------------------------------------------------------
// SHARED UI ATOMS
// --------------------------------------------------------------------------
const Card = ({ children, style = {}, padded = true }) => (
  <div style={{
    background: COLORS.paperRaised, border: `1px solid ${COLORS.border}`,
    borderRadius: 6, padding: padded ? '20px 22px' : 0, boxShadow: '0 2px 6px var(--shadow)', ...style
  }}>{children}</div>
);

const SectionLabel = ({ children }) => (
  <div style={{
    fontFamily: 'IBM Plex Mono, monospace', fontSize: 11, letterSpacing: '0.08em',
    textTransform: 'uppercase', color: COLORS.slate, marginBottom: 10, fontWeight: 500
  }}>{children}</div>
);

const PageTitle = ({ children, sub }) => (
  <div style={{ marginBottom: 24 }}>
    <h1 style={{
      fontFamily: 'Source Serif 4, Georgia, serif', fontSize: 28, fontWeight: 600,
      color: COLORS.ink, margin: 0, letterSpacing: '-0.01em'
    }}>{children}</h1>
    {sub && <p style={{ color: COLORS.slate, fontSize: 14, marginTop: 6 }}>{sub}</p>}
  </div>
);

const Num = ({ children, size = 22, color = COLORS.ink, weight = 600 }) => (
  <span style={{
    fontFamily: 'IBM Plex Mono, monospace', fontSize: size, fontWeight: weight,
    color, fontVariantNumeric: 'tabular-nums'
  }}>{children}</span>
);

function TickingNumber({ value, format = (v) => v, duration = 500 }) {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    let raf;
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(step);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);
  return <>{format(display)}</>;
}

const TextField = ({ label, value, onChange, type = 'text', prefix, suffix, step, min, max, full }) => (
  <label style={{ display: 'block', gridColumn: full ? '1 / -1' : undefined }}>
    <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 5, fontWeight: 500 }}>{label}</div>
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      {prefix && <span style={{ position: 'absolute', left: 10, fontSize: 14, color: COLORS.slate }}>{prefix}</span>}
      <input
        type={type}
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={e => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
        style={{
          width: '100%', padding: '8px 10px',
          paddingLeft: prefix ? 22 : 10, paddingRight: suffix ? 28 : 10,
          border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 14,
          fontFamily: type === 'number' ? 'IBM Plex Mono, monospace' : 'Inter, sans-serif',
          color: COLORS.ink, background: COLORS.paper, boxSizing: 'border-box',
          textAlign: type === 'number' ? 'right' : 'left'
        }}
      />
      {suffix && <span style={{ position: 'absolute', right: 10, fontSize: 13, color: COLORS.slate }}>{suffix}</span>}
    </div>
  </label>
);

const SelectField = ({ label, value, onChange, options }) => (
  <label style={{ display: 'block' }}>
    <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 5, fontWeight: 500 }}>{label}</div>
    <select value={value} onChange={e => onChange(e.target.value)} style={{
      width: '100%', padding: '8px 10px', border: `1px solid ${COLORS.border}`,
      borderRadius: 4, fontSize: 14, color: COLORS.ink, background: COLORS.paper,
      fontFamily: 'Inter, sans-serif', boxSizing: 'border-box'
    }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </label>
);

const EmptyRow = ({ text }) => (
  <div style={{ padding: '14px 0', color: COLORS.slate, fontSize: 13, textAlign: 'center' }}>{text}</div>
);

// --------------------------------------------------------------------------
// CALCULATION ENGINE (updated to accept currency for formatting inside)
// --------------------------------------------------------------------------
function calcTotals(client) {
  const totalAssets = client.assets.reduce((s, a) => s + a.value, 0);
  const totalLiabilities = client.liabilities.reduce((s, l) => s + l.value, 0);
  const netWorth = totalAssets - totalLiabilities;
  const totalExpenses = client.expenses.reduce((s, e) => s + e.amount, 0) * 12;
  const totalMinPayments = client.liabilities.reduce((s, l) => s + (l.minPayment || 0), 0) * 12;
  const annualIncome = client.profile.annualIncome;
  const annualSavings = annualIncome - totalExpenses - totalMinPayments;
  const savingsRate = annualIncome > 0 ? (annualSavings / annualIncome) * 100 : 0;
  return { totalAssets, totalLiabilities, netWorth, totalExpenses, totalMinPayments, annualSavings, savingsRate, annualIncome };
}

function projectRetirement(client, scenarioOverride = null) {
  const s = scenarioOverride || client.scenario;
  const r = client.retirementInputs;
  const p = client.profile;
  const yearsToRetire = Math.max(0, (p.retirementAge + (s.retirementAgeAdjust || 0)) - p.age);
  const yearsInRetirement = Math.max(0, p.lifeExpectancy - (p.retirementAge + (s.retirementAgeAdjust || 0)));
  const preReturn = (r.preRetirementReturn + (s.returnAdjust || 0)) / 100;
  const postReturn = (r.postRetirementReturn + (s.returnAdjust || 0) * 0.6) / 100;
  const inflation = r.inflationRate / 100;
  const monthlyContrib = (r.monthlyContribution + r.employerMatch) * (1 + (s.savingsRateAdjust || 0) / 100);

  const accumulation = [];
  let balance = r.currentSavings;
  for (let y = 0; y <= yearsToRetire; y++) {
    accumulation.push({ age: p.age + y, year: y, balance: Math.round(balance), phase: 'saving' });
    balance = balance * (1 + preReturn) + monthlyContrib * 12;
  }
  const balanceAtRetirement = accumulation.length ? accumulation[accumulation.length - 1].balance : r.currentSavings;

  const desiredIncomeAtRetirement = r.desiredAnnualIncome * Math.pow(1 + inflation, yearsToRetire);
  const decumulation = [];
  let postBalance = balanceAtRetirement;
  let depletionAge = null;
  for (let y = 0; y <= yearsInRetirement; y++) {
    const age = p.retirementAge + (s.retirementAgeAdjust || 0) + y;
    const ssThisYear = age >= r.socialSecurityStartAge ? r.socialSecurityAnnual : 0;
    const withdrawal = Math.max(0, (desiredIncomeAtRetirement * Math.pow(1 + inflation, y)) - ssThisYear);
    decumulation.push({ age, year: yearsToRetire + y, balance: Math.round(Math.max(0, postBalance)), phase: 'retired' });
    if (postBalance <= 0 && depletionAge === null && y > 0) depletionAge = age;
    postBalance = postBalance * (1 + postReturn) - withdrawal;
  }
  const fullProjection = [...accumulation, ...decumulation.slice(1)];
  const sustainable = depletionAge === null || depletionAge >= p.lifeExpectancy;
  return {
    yearsToRetire, balanceAtRetirement, fullProjection, sustainable, depletionAge,
    desiredIncomeAtRetirement, withdrawalNeeded: Math.max(0, desiredIncomeAtRetirement - r.socialSecurityAnnual),
    ssAnnual: r.socialSecurityAnnual,
  };
}

function projectGoal(goal) {
  const now = new Date();
  const target = new Date(goal.targetDate + '-01');
  const monthsRemaining = Math.max(1, (target.getFullYear() - now.getFullYear()) * 12 + (target.getMonth() - now.getMonth()));
  const remaining = Math.max(0, goal.target - goal.current);
  const monthlyNeeded = remaining / monthsRemaining;
  const pctComplete = goal.target > 0 ? Math.min(100, (goal.current / goal.target) * 100) : 0;
  return { monthsRemaining, remaining, monthlyNeeded, pctComplete };
}

function projectDebtPayoff(liabilities, extraPayment = 0, method = 'avalanche') {
  const debts = liabilities.map(l => ({ ...l, balance: l.value }))
    .sort((a, b) => method === 'avalanche' ? b.rate - a.rate : a.balance - b.balance);
  const months = [];
  let month = 0;
  months.push({ month: 0, totalBalance: debts.reduce((s, d) => s + d.balance, 0), breakdown: debts.map(d => ({ name: d.name, balance: d.balance })) });
  const remaining = () => debts.filter(d => d.balance > 0.01);
  while (remaining().length > 0 && month < 600) {
    month++;
    const paidOffMin = debts.filter(d => d.balance <= 0.01).reduce((s, d) => s + d.minPayment, 0);
    let snowball = extraPayment + paidOffMin;
    const target = method === 'avalanche' ? remaining()[0] : remaining().reduce((a, b) => a.balance < b.balance ? a : b);
    for (const d of debts) {
      if (d.balance <= 0.01) { d.balance = 0; continue; }
      const interest = (d.rate / 100 / 12) * d.balance;
      const extraForThis = d === target ? snowball : 0;
      const payment = d.minPayment + extraForThis;
      d.balance = Math.max(0, d.balance + interest - payment);
    }
    if (month % 3 === 0 || remaining().length === 0) {
      months.push({
        month, totalBalance: Math.round(debts.reduce((s, d) => s + d.balance, 0)),
        breakdown: debts.map(d => ({ name: d.name, balance: Math.round(d.balance) }))
      });
    }
  }
  return { months, payoffMonths: month, debts: debts.map(d => d.name) };
}

// --------------------------------------------------------------------------
// CLIENT RAIL (added dark/light toggle)
// --------------------------------------------------------------------------
function ClientRail({ clients, activeId, setActiveId, addClient, deleteClient, activeModule, setActiveModule, saveState, client, update }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const clientList = Object.values(clients).sort((a, b) => a.createdAt - b.createdAt);

  const modules = [
    { id: 'summary', label: 'Summary', icon: LayoutDashboard },
    { id: 'profile', label: 'Profile', icon: Users },
    { id: 'networth', label: 'Net worth', icon: Wallet },
    { id: 'cashflow', label: 'Cash flow', icon: TrendingUp },
    { id: 'retirement', label: 'Retirement', icon: PiggyBank },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'debt', label: 'Debt payoff', icon: CreditCard },
    { id: 'scenario', label: 'Scenarios', icon: SlidersHorizontal },
  ];

  const toggleTheme = () => {
    if (!client) return;
    update(c => ({ ...c, theme: c.theme === 'light' ? 'dark' : 'light' }));
  };

  return (
    <div style={{
      width: 230, flexShrink: 0, background: 'var(--bg-rail)', color: 'var(--text-rail)',
      minHeight: '100%', display: 'flex', flexDirection: 'column'
    }}>
      <div style={{ padding: '20px 18px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Source Serif 4, Georgia, serif', fontSize: 18, fontWeight: 600 }}>Ledger</div>
          <div style={{ fontSize: 11, color: 'rgba(250,248,244,0.5)', marginTop: 2, fontFamily: 'IBM Plex Mono, monospace' }}>financial planning</div>
        </div>
        <button onClick={toggleTheme} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer' }}>
          {client?.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>

      {/* Clients list */}
      <div style={{ padding: '0 14px', marginBottom: 8 }}>
        <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(250,248,244,0.45)', padding: '8px 4px 6px', fontFamily: 'IBM Plex Mono, monospace' }}>Clients</div>
        {clientList.map(c => (
          <div key={c.id}>
            <button onClick={() => setActiveId(c.id)}
              style={{
                width: '100%', textAlign: 'left', padding: '9px 10px', marginBottom: 2,
                background: activeId === c.id ? 'rgba(201,162,75,0.18)' : 'transparent',
                border: 'none', borderLeft: activeId === c.id ? `2px solid ${COLORS.gold}` : '2px solid transparent',
                color: activeId === c.id ? COLORS.gold : 'rgba(250,248,244,0.8)',
                fontSize: 13, fontWeight: activeId === c.id ? 600 : 400, cursor: 'pointer',
                borderRadius: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
              {confirmDelete !== c.id && (
                <Trash2 size={12} style={{ opacity: 0.4, flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); setConfirmDelete(c.id); }} />
              )}
            </button>
            {confirmDelete === c.id && (
              <div style={{ display: 'flex', gap: 4, padding: '2px 10px 8px', fontSize: 11 }}>
                <span style={{ color: 'rgba(250,248,244,0.6)' }}>Delete?</span>
                <button onClick={() => { deleteClient(c.id); setConfirmDelete(null); }} style={{ color: COLORS.clay, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Yes</button>
                <button onClick={() => setConfirmDelete(null)} style={{ color: 'rgba(250,248,244,0.6)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancel</button>
              </div>
            )}
          </div>
        ))}
        {adding ? (
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)} placeholder="Client name"
              onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) { addClient(newName.trim()); setNewName(''); setAdding(false); } if (e.key === 'Escape') setAdding(false); }}
              style={{ flex: 1, padding: '6px 8px', fontSize: 12, borderRadius: 3, border: `1px solid rgba(250,248,244,0.25)`, background: 'rgba(255,255,255,0.05)', color: 'var(--text-rail)' }} />
            <button onClick={() => { if (newName.trim()) { addClient(newName.trim()); setNewName(''); setAdding(false); } }} style={{ background: 'none', border: 'none', color: COLORS.gold, cursor: 'pointer' }}><Check size={16} /></button>
          </div>
        ) : (
          <button onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 10px', background: 'none', border: '1px dashed rgba(250,248,244,0.25)', borderRadius: 3, color: 'rgba(250,248,244,0.6)', fontSize: 12, cursor: 'pointer', marginTop: 4 }}><Plus size={13} /> Add client</button>
        )}
      </div>

      {/* Modules */}
      {activeId && (
        <div style={{ padding: '14px 14px', borderTop: '1px solid rgba(250,248,244,0.1)', marginTop: 8 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(250,248,244,0.45)', padding: '4px 4px 8px', fontFamily: 'IBM Plex Mono, monospace' }}>Modules</div>
          {modules.map(m => (
            <button key={m.id} onClick={() => setActiveModule(m.id)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left',
              padding: '9px 10px', marginBottom: 1, background: activeModule === m.id ? 'rgba(255,255,255,0.07)' : 'transparent',
              border: 'none', color: activeModule === m.id ? 'var(--text-rail)' : 'rgba(250,248,244,0.65)',
              fontSize: 13, fontWeight: activeModule === m.id ? 600 : 400, cursor: 'pointer', borderRadius: 3
            }}>
              <m.icon size={15} />
              {m.label}
              {activeModule === m.id && <ChevronRight size={13} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 'auto', padding: '12px 18px', fontSize: 11, color: 'rgba(250,248,244,0.4)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
        {saveState === 'saving' && <>● saving</>}
        {saveState === 'saved' && <><Check size={11} /> saved</>}
        {saveState === 'idle' && <>autosaves locally</>}
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------
// MODULES (summary, profile, net worth, cash flow, retirement, goals, debt, scenario)
// --------------------------------------------------------------------------

function SummaryModule({ client, update }) {
  const totals = calcTotals(client);
  const currency = client.profile.currency;
  const projection = useMemo(() => projectRetirement(client), [client]);
  const debts = client.liabilities.filter(l => l.value > 0);
  const payoff = useMemo(() => projectDebtPayoff(debts, 0, client.debtMethod), [debts, client.debtMethod]);
  const goals = client.goals;

  return (
    <div>
      <PageTitle sub="A quick glance at your financial health.">Summary</PageTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
        <Card><SectionLabel>Net Worth</SectionLabel><Num size={26} color={totals.netWorth >= 0 ? COLORS.forest : COLORS.clay}><TickingNumber value={totals.netWorth} format={(v) => fmt(v, currency)} /></Num></Card>
        <Card><SectionLabel>Savings Rate</SectionLabel><Num size={26}>{fmtPct(totals.savingsRate)}</Num></Card>
        <Card><SectionLabel>Retirement Outlook</SectionLabel><Num size={26} color={projection.sustainable ? COLORS.forest : COLORS.clay}>{projection.sustainable ? 'On track' : 'At risk'}</Num></Card>
        <Card><SectionLabel>Debt Payoff</SectionLabel><Num size={26}>{debts.length ? `${Math.ceil(payoff.payoffMonths / 12 * 10) / 10} yrs` : 'None'}</Num></Card>
        <Card><SectionLabel>Goals</SectionLabel><Num size={26}>{goals.filter(g => (g.current / g.target) >= 1).length}/{goals.length} met</Num></Card>
      </div>
      <Card>
        <SectionLabel>Asset Allocation</SectionLabel>
        {client.assets.length > 0 ? (
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={client.assets.map(a => ({ name: a.category, value: a.value }))} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                {client.assets.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => fmt(v, currency)} />
            </PieChart>
          </ResponsiveContainer>
        ) : <EmptyRow text="Add assets to see allocation." />}
      </Card>
    </div>
  );
}

function ProfileModule({ client, update }) {
  const p = client.profile;
  const set = (key, val) => update(c => ({ ...c, profile: { ...c.profile, [key]: val } }));
  const setName = (val) => update(c => ({ ...c, name: val }));

  return (
    <div>
      <PageTitle sub="Core details that drive every projection in this plan.">Client profile</PageTitle>
      <Card>
        <SectionLabel>Identity</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
          <TextField label="Client name" value={client.name} onChange={setName} full />
        </div>
        <SectionLabel>Personal</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 22 }}>
          <TextField label="Current age" value={p.age} type="number" onChange={v => set('age', v)} />
          <TextField label="Target retirement age" value={p.retirementAge} type="number" onChange={v => set('retirementAge', v)} />
          <TextField label="Life expectancy" value={p.lifeExpectancy} type="number" onChange={v => set('lifeExpectancy', v)} />
          <TextField label="Dependents" value={p.dependents} type="number" onChange={v => set('dependents', v)} />
          <SelectField label="Filing status" value={p.filingStatus} onChange={v => set('filingStatus', v)}
            options={[{ value: 'single', label: 'Single' }, { value: 'married', label: 'Married filing jointly' }, { value: 'hoh', label: 'Head of household' }]} />
          <SelectField label="Risk tolerance" value={p.riskTolerance} onChange={v => set('riskTolerance', v)}
            options={[{ value: 'conservative', label: 'Conservative' }, { value: 'moderate', label: 'Moderate' }, { value: 'aggressive', label: 'Aggressive' }]} />
        </div>
        <SectionLabel>Currency</SectionLabel>
        <SelectField label="Display currency" value={p.currency} onChange={v => set('currency', v)}
          options={Object.keys(CURRENCIES).map(c => ({ value: c, label: `${c} (${CURRENCIES[c].symbol})` }))} />
        <SectionLabel>Income</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 22 }}>
          <TextField label="Annual gross income" value={p.annualIncome} type="number" prefix={CURRENCIES[p.currency]?.symbol} onChange={v => set('annualIncome', v)} />
          <TextField label="Expected annual income growth" value={p.incomeGrowth} type="number" step="0.1" suffix="%" onChange={v => set('incomeGrowth', v)} />
        </div>
        <SectionLabel>Notes</SectionLabel>
        <textarea value={p.notes} onChange={e => set('notes', e.target.value)} placeholder="Context for this plan..." style={{ width: '100%', minHeight: 80, padding: 10, border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 13, fontFamily: 'Inter, sans-serif', color: COLORS.ink, background: COLORS.paper, resize: 'vertical', boxSizing: 'border-box' }} />
      </Card>
    </div>
  );
}

function NetWorthModule({ client, update }) {
  const totals = calcTotals(client);
  const currency = client.profile.currency;
  const assetFields = [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category', type: 'select', width: '140px', options: [{ value: 'cash', label: 'Cash' }, { value: 'retirement', label: 'Retirement' }, { value: 'investment', label: 'Investment' }, { value: 'real_estate', label: 'Real estate' }, { value: 'other', label: 'Other' }] },
    { key: 'value', label: 'Value', type: 'number', width: '130px' },
  ];
  const liabilityFields = [
    { key: 'name', label: 'Name' },
    { key: 'value', label: 'Balance', type: 'number', width: '120px' },
    { key: 'rate', label: 'Rate %', type: 'number', width: '90px' },
    { key: 'minPayment', label: 'Min/mo', type: 'number', width: '100px' },
  ];

  return (
    <div>
      <PageTitle sub="Everything owned, everything owed, and what's left.">Net worth</PageTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <Card><SectionLabel>Total assets</SectionLabel><Num size={26} color={COLORS.forest}><TickingNumber value={totals.totalAssets} format={(v) => fmt(v, currency)} /></Num></Card>
        <Card><SectionLabel>Total liabilities</SectionLabel><Num size={26} color={COLORS.clay}><TickingNumber value={totals.totalLiabilities} format={(v) => fmt(v, currency)} /></Num></Card>
        <Card style={{ background: 'var(--bg-rail)' }}><SectionLabel>Net worth</SectionLabel><Num size={26} color={COLORS.gold}><TickingNumber value={totals.netWorth} format={(v) => fmt(v, currency)} /></Num></Card>
      </div>
      {/* ... rest of NetWorthModule unchanged but using currency for tooltip etc. */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, marginBottom: 20 }}>
        <Card>
          <SectionLabel>Assets</SectionLabel>
          <ListEditor items={client.assets} fields={assetFields} addLabel="Add asset"
            onAdd={() => update(c => ({ ...c, assets: [...c.assets, { id: newId(), name: 'New asset', value: 0, category: 'other' }] }))}
            onUpdate={(id, key, val) => update(c => ({ ...c, assets: c.assets.map(a => a.id === id ? { ...a, [key]: val } : a) }))}
            onRemove={(id) => update(c => ({ ...c, assets: c.assets.filter(a => a.id !== id) }))} />
        </Card>
        <Card>
          <SectionLabel>Asset allocation</SectionLabel>
          {client.assets.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={client.assets.map(a => ({ name: a.category, value: a.value }))} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {client.assets.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => fmt(v, currency)} />
              </PieChart>
            </ResponsiveContainer>
          ) : <EmptyRow text="Add assets to see allocation." />}
        </Card>
      </div>
      <Card>
        <SectionLabel>Liabilities</SectionLabel>
        <ListEditor items={client.liabilities} fields={liabilityFields} addLabel="Add liability"
          onAdd={() => update(c => ({ ...c, liabilities: [...c.liabilities, { id: newId(), name: 'New debt', value: 0, rate: 0, minPayment: 0 }] }))}
          onUpdate={(id, key, val) => update(c => ({ ...c, liabilities: c.liabilities.map(l => l.id === id ? { ...l, [key]: val } : l) }))}
          onRemove={(id) => update(c => ({ ...c, liabilities: c.liabilities.filter(l => l.id !== id) }))} />
      </Card>
    </div>
  );
}

function CashFlowModule({ client, update }) {
  const totals = calcTotals(client);
  const currency = client.profile.currency;
  const monthlyIncome = totals.annualIncome / 12;
  const monthlyExpenses = totals.totalExpenses / 12;
  const monthlyDebt = totals.totalMinPayments / 12;
  const monthlySavings = totals.annualSavings / 12;

  const expenseFields = [
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category', type: 'select', width: '140px', options: (client.expenseCategories || ['essential','lifestyle']).map(c => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) })) },
    { key: 'amount', label: 'Monthly', type: 'number', width: '110px' },
  ];

  // Allow adding new category
  const [newCat, setNewCat] = useState('');
  const addCategory = () => {
    if (newCat.trim() && !client.expenseCategories.includes(newCat.trim().toLowerCase())) {
      update(c => ({ ...c, expenseCategories: [...c.expenseCategories, newCat.trim().toLowerCase()] }));
      setNewCat('');
    }
  };

  const flowData = [
    { name: 'Income', value: monthlyIncome },
    { name: 'Expenses', value: -monthlyExpenses },
    { name: 'Debt payments', value: -monthlyDebt },
    { name: 'Net savings', value: monthlySavings },
  ];

  return (
    <div>
      <PageTitle sub="Where the money comes from, and where it goes each month.">Cash flow</PageTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <Card><SectionLabel>Monthly income</SectionLabel><Num size={22} color={COLORS.forest}><TickingNumber value={monthlyIncome} format={(v) => fmt(v, currency)} /></Num></Card>
        <Card><SectionLabel>Monthly expenses</SectionLabel><Num size={22} color={COLORS.clay}><TickingNumber value={monthlyExpenses + monthlyDebt} format={(v) => fmt(v, currency)} /></Num></Card>
        <Card><SectionLabel>Net monthly savings</SectionLabel><Num size={22} color={monthlySavings >= 0 ? COLORS.forest : COLORS.clay}><TickingNumber value={monthlySavings} format={(v) => fmt(v, currency)} /></Num></Card>
        <Card><SectionLabel>Savings rate</SectionLabel><Num size={22}>{fmtPct(totals.savingsRate)}</Num></Card>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
        <Card>
          <SectionLabel>Monthly expenses</SectionLabel>
          <ListEditor items={client.expenses} fields={expenseFields} addLabel="Add expense"
            onAdd={() => update(c => ({ ...c, expenses: [...c.expenses, { id: newId(), name: 'New expense', amount: 0, category: (c.expenseCategories[0] || 'essential') }] }))}
            onUpdate={(id, key, val) => update(c => ({ ...c, expenses: c.expenses.map(e => e.id === id ? { ...e, [key]: val } : e) }))}
            onRemove={(id) => update(c => ({ ...c, expenses: c.expenses.filter(e => e.id !== id) }))} />
          <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category" style={{ flex: 1, padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 12 }} />
            <button onClick={addCategory} style={{ background: COLORS.gold, color: '#fff', border: 'none', borderRadius: 4, padding: '6px 10px', cursor: 'pointer' }}><Plus size={14} /></button>
          </div>
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, color: COLORS.slate }}>Debt minimum payments</span>
            <Num size={13} weight={500}>{fmt(monthlyDebt, currency)}/mo</Num>
          </div>
        </Card>
        <Card>
          <SectionLabel>Monthly flow</SectionLabel>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={flowData} layout="vertical" margin={{ left: 10, right: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: COLORS.slate }} tickFormatter={(v) => fmtCompact(v, currency)} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 12, fill: COLORS.ink }} width={100} />
              <Tooltip formatter={(v) => fmt(v, currency)} />
              <ReferenceLine x={0} stroke={COLORS.slate} />
              <Bar dataKey="value" radius={3}>
                {flowData.map((d, i) => <Cell key={i} fill={d.value >= 0 ? COLORS.forest : COLORS.clay} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}

function RetirementModule({ client, update }) {
  const r = client.retirementInputs;
  const currency = client.profile.currency;
  const set = (key, val) => update(c => ({ ...c, retirementInputs: { ...c.retirementInputs, [key]: val } }));
  const projection = useMemo(() => projectRetirement(client), [client]);

  return (
    <div>
      <PageTitle sub="Savings growth through retirement, and whether it lasts.">Retirement projection</PageTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <Card><SectionLabel>Projected balance at retirement</SectionLabel><Num size={24}><TickingNumber value={projection.balanceAtRetirement} format={(v) => fmt(v, currency)} /></Num><div style={{ fontSize: 12, color: COLORS.slate }}>at age {client.profile.retirementAge}</div></Card>
        <Card><SectionLabel>Target annual income</SectionLabel><Num size={24}><TickingNumber value={projection.desiredIncomeAtRetirement} format={(v) => fmt(v, currency)} /></Num></Card>
        <Card style={{ background: projection.sustainable ? 'var(--success)' + '22' : 'var(--danger)' + '22' }}>
          <SectionLabel>Plan outlook</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {projection.sustainable ? <Check size={20} color={COLORS.forest} /> : <AlertTriangle size={20} color={COLORS.clay} />}
            <span style={{ fontWeight: 600, fontSize: 15 }}>{projection.sustainable ? 'On track' : `Funds run out at ${projection.depletionAge}`}</span>
          </div>
        </Card>
      </div>
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Balance over time</SectionLabel>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={projection.fullProjection}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey="age" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => fmtCompact(v, currency)} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmt(v, currency)} labelFormatter={(l) => `Age ${l}`} />
            <ReferenceLine x={client.profile.retirementAge} stroke={COLORS.gold} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="balance" stroke={COLORS.forest} fill="url(#balGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
      <Card>
        <SectionLabel>Assumptions</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <TextField label="Current retirement savings" value={r.currentSavings} type="number" prefix={CURRENCIES[currency]?.symbol} onChange={v => set('currentSavings', v)} />
          <TextField label="Monthly contribution" value={r.monthlyContribution} type="number" prefix={CURRENCIES[currency]?.symbol} onChange={v => set('monthlyContribution', v)} />
          <TextField label="Employer match (monthly)" value={r.employerMatch} type="number" prefix={CURRENCIES[currency]?.symbol} onChange={v => set('employerMatch', v)} />
          <TextField label="Pre-retirement return" value={r.preRetirementReturn} type="number" step="0.1" suffix="%" onChange={v => set('preRetirementReturn', v)} />
          <TextField label="Post-retirement return" value={r.postRetirementReturn} type="number" step="0.1" suffix="%" onChange={v => set('postRetirementReturn', v)} />
          <TextField label="Inflation rate" value={r.inflationRate} type="number" step="0.1" suffix="%" onChange={v => set('inflationRate', v)} />
          <TextField label="Desired annual income (today's $)" value={r.desiredAnnualIncome} type="number" prefix={CURRENCIES[currency]?.symbol} onChange={v => set('desiredAnnualIncome', v)} />
          <TextField label="Social Security (annual)" value={r.socialSecurityAnnual} type="number" prefix={CURRENCIES[currency]?.symbol} onChange={v => set('socialSecurityAnnual', v)} />
          <TextField label="Social Security start age" value={r.socialSecurityStartAge} type="number" onChange={v => set('socialSecurityStartAge', v)} />
        </div>
      </Card>
    </div>
  );
}

function GoalsModule({ client, update }) {
  const currency = client.profile.currency;
  return (
    <div>
      <PageTitle sub="Specific targets, tracked against their own timelines.">Goal planning</PageTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {client.goals.map(goal => {
          const proj = projectGoal(goal);
          return (
            <Card key={goal.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <input value={goal.name} onChange={e => update(c => ({ ...c, goals: c.goals.map(g => g.id === goal.id ? { ...g, name: e.target.value } : g) }))}
                  style={{ fontFamily: 'Source Serif 4, Georgia, serif', fontSize: 17, fontWeight: 600, color: COLORS.ink, border: 'none', background: 'none', padding: 0, width: '70%' }} />
                <button onClick={() => update(c => ({ ...c, goals: c.goals.filter(g => g.id !== goal.id) }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.slate }}><Trash2 size={14} /></button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                <Num size={20}>{fmt(goal.current, currency)}</Num>
                <span style={{ fontSize: 12, color: COLORS.slate }}>of {fmt(goal.target, currency)}</span>
              </div>
              <div style={{ height: 8, background: COLORS.slateLight, borderRadius: 100, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ height: '100%', width: `${proj.pctComplete}%`, background: COLORS.forest, borderRadius: 100, transition: 'width 0.4s' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <TextField label="Current saved" value={goal.current} type="number" prefix={CURRENCIES[currency]?.symbol} onChange={v => update(c => ({ ...c, goals: c.goals.map(g => g.id === goal.id ? { ...g, current: v } : g) }))} />
                <TextField label="Target amount" value={goal.target} type="number" prefix={CURRENCIES[currency]?.symbol} onChange={v => update(c => ({ ...c, goals: c.goals.map(g => g.id === goal.id ? { ...g, target: v } : g) }))} />
                <label><div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 5, fontWeight: 500 }}>Target date</div>
                <input type="month" value={goal.targetDate} onChange={e => update(c => ({ ...c, goals: c.goals.map(g => g.id === goal.id ? { ...g, targetDate: e.target.value } : g) }))} style={{ width: '100%', padding: '8px 10px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 13, color: COLORS.ink, background: COLORS.paper }} /></label>
                <SelectField label="Priority" value={goal.priority} onChange={v => update(c => ({ ...c, goals: c.goals.map(g => g.id === goal.id ? { ...g, priority: v } : g) }))} options={[{ value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' }]} />
              </div>
              <div style={{ paddingTop: 12, borderTop: `1px solid ${COLORS.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: COLORS.slate }}>Needed monthly</span>
                <Num size={16} color={COLORS.forest}>{fmt(proj.monthlyNeeded, currency)}/mo</Num>
              </div>
            </Card>
          );
        })}
      </div>
      <button onClick={() => update(c => ({ ...c, goals: [...c.goals, { id: newId(), name: 'New goal', target: 10000, current: 0, targetDate: '2027-12', priority: 'medium' }] }))}
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, padding: '9px 14px', background: 'none', border: `1px dashed ${COLORS.border}`, borderRadius: 4, color: COLORS.slate, fontSize: 13, cursor: 'pointer' }}><Plus size={14} /> Add goal</button>
    </div>
  );
}

function DebtModule({ client, update }) {
  const [extra, setExtra] = useState(0);
  const debts = client.liabilities.filter(l => l.value > 0);
  const currency = client.profile.currency;
  const method = client.debtMethod;
  const payoff = useMemo(() => projectDebtPayoff(debts, extra, method), [debts, extra, method]);
  const payoffNoExtra = useMemo(() => projectDebtPayoff(debts, 0, method), [debts, method]);
  const totalDebt = debts.reduce((s, d) => s + d.value, 0);
  const weightedRate = totalDebt > 0 ? debts.reduce((s, d) => s + d.rate * d.value, 0) / totalDebt : 0;

  if (debts.length === 0) {
    return <div><PageTitle sub="Payoff order and timeline for outstanding debts.">Debt payoff</PageTitle><Card><EmptyRow text="No active debts." /></Card></div>;
  }

  return (
    <div>
      <PageTitle sub="Payoff order and timeline, customizable method.">Debt payoff</PageTitle>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 20 }}>
        <Card><SectionLabel>Total debt</SectionLabel><Num size={24} color={COLORS.clay}>{fmt(totalDebt, currency)}</Num></Card>
        <Card><SectionLabel>Weighted avg rate</SectionLabel><Num size={24}>{fmtPct(weightedRate)}</Num></Card>
        <Card><SectionLabel>Payoff timeline</SectionLabel><Num size={24} color={COLORS.forest}>{Math.ceil(payoff.payoffMonths / 12 * 10) / 10} yrs</Num>
          {extra > 0 && <div style={{ fontSize: 11, color: COLORS.slate }}>vs {Math.ceil(payoffNoExtra.payoffMonths / 12 * 10) / 10} yrs without extra</div>}
        </Card>
      </div>
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Method</SectionLabel>
        <SelectField label="Payoff strategy" value={method} onChange={v => update(c => ({ ...c, debtMethod: v }))}
          options={[{ value: 'avalanche', label: 'Avalanche (highest interest first)' }, { value: 'snowball', label: 'Snowball (smallest balance first)' }]} />
        <div style={{ maxWidth: 320, marginBottom: 16 }}>
          <TextField label="Extra monthly payment" value={extra} type="number" prefix={CURRENCIES[currency]?.symbol} onChange={setExtra} />
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={payoff.months}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} tickFormatter={(m) => `${m}mo`} />
            <YAxis tickFormatter={(v) => fmtCompact(v, currency)} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => fmt(v, currency)} labelFormatter={(l) => `Month ${l}`} />
            <Area type="monotone" dataKey="totalBalance" stroke={COLORS.clay} fill="url(#debtGrad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function ScenarioModule({ client, update }) {
  const s = client.scenario;
  const currency = client.profile.currency;
  const set = (key, val) => update(c => ({ ...c, scenario: { ...c.scenario, [key]: val } }));
  const baseline = useMemo(() => projectRetirement(client, { returnAdjust: 0, retirementAgeAdjust: 0, savingsRateAdjust: 0 }), [client]);
  const adjusted = useMemo(() => projectRetirement(client, s), [client, s]);
  const delta = adjusted.balanceAtRetirement - baseline.balanceAtRetirement;

  return (
    <div>
      <PageTitle sub="Adjust assumptions live and see the projected impact against the baseline plan.">Scenario comparison</PageTitle>
      <Card style={{ marginBottom: 20 }}>
        <SectionLabel>Adjust assumptions</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>
          <div>
            <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 8 }}>Investment return {s.returnAdjust >= 0 ? '+' : ''}{s.returnAdjust}%</div>
            <input type="range" min={-4} max={4} step={0.5} value={s.returnAdjust} onChange={e => set('returnAdjust', parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 8 }}>Retirement age {s.retirementAgeAdjust >= 0 ? '+' : ''}{s.retirementAgeAdjust} yrs</div>
            <input type="range" min={-10} max={10} step={1} value={s.retirementAgeAdjust} onChange={e => set('retirementAgeAdjust', parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: COLORS.slate, marginBottom: 8 }}>Savings rate {s.savingsRateAdjust >= 0 ? '+' : ''}{s.savingsRateAdjust}%</div>
            <input type="range" min={-50} max={100} step={5} value={s.savingsRateAdjust} onChange={e => set('savingsRateAdjust', parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>
        </div>
        <button onClick={() => update(c => ({ ...c, scenario: { returnAdjust: 0, retirementAgeAdjust: 0, savingsRateAdjust: 0 } }))} style={{ marginTop: 14, fontSize: 12, color: COLORS.slate, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Reset to baseline</button>
      </Card>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <Card><SectionLabel>Baseline balance at retirement</SectionLabel><Num size={22} color={COLORS.slate}>{fmt(baseline.balanceAtRetirement, currency)}</Num></Card>
        <Card><SectionLabel>Adjusted balance at retirement</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <Num size={22}><TickingNumber value={adjusted.balanceAtRetirement} format={(v) => fmt(v, currency)} /></Num>
            <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 13, color: delta >= 0 ? COLORS.forest : COLORS.clay, fontWeight: 600 }}>
              {delta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
              {fmtCompact(Math.abs(delta), currency)}
            </span>
          </div>
        </Card>
      </div>
      <Card>
        <SectionLabel>Projected balance — baseline vs. adjusted</SectionLabel>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={Array.from({ length: Math.max(baseline.fullProjection.length, adjusted.fullProjection.length) }, (_, i) => ({
            age: baseline.fullProjection[i]?.age ?? adjusted.fullProjection[i]?.age,
            baseline: baseline.fullProjection[i]?.balance ?? null,
            adjusted: adjusted.fullProjection[i]?.balance ?? null,
          }))}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey="age" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => fmtCompact(v, currency)} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v) => v != null ? fmt(v, currency) : '—'} labelFormatter={(l) => `Age ${l}`} />
            <Line type="monotone" dataKey="baseline" stroke={COLORS.slate} strokeWidth={2} strokeDasharray="5 4" dot={false} name="Baseline" />
            <Line type="monotone" dataKey="adjusted" stroke={COLORS.gold} strokeWidth={2.5} dot={false} name="Adjusted" />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

// ListEditor component (unchanged but uses currency from props? We'll pass currency where needed)
function ListEditor({ items, onAdd, onUpdate, onRemove, fields, addLabel }) {
  return (
    <div>
      {items.map(item => (
        <div key={item.id} style={{
          display: 'grid', gridTemplateColumns: fields.map(f => f.width || '1fr').join(' ') + ' auto',
          gap: 10, alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${COLORS.border}`
        }}>
          {fields.map(f => (
            f.type === 'select' ? (
              <select key={f.key} value={item[f.key]} onChange={e => onUpdate(item.id, f.key, e.target.value)}
                style={{ padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 13, background: COLORS.paper, color: COLORS.ink }}>
                {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input key={f.key} type={f.type || 'text'} value={item[f.key]}
                onChange={e => onUpdate(item.id, f.key, f.type === 'number' ? (parseFloat(e.target.value) || 0) : e.target.value)}
                style={{
                  padding: '6px 8px', border: `1px solid ${COLORS.border}`, borderRadius: 4, fontSize: 13,
                  fontFamily: f.type === 'number' ? 'IBM Plex Mono, monospace' : 'Inter, sans-serif',
                  textAlign: f.type === 'number' ? 'right' : 'left', color: COLORS.ink, background: COLORS.paper
                }} />
            )
          ))}
          <button onClick={() => onRemove(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: COLORS.slate }}><Trash2 size={14} /></button>
        </div>
      ))}
      {items.length === 0 && <EmptyRow text="Nothing here yet." />}
      <button onClick={onAdd} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, padding: '7px 12px', background: 'none', border: `1px dashed ${COLORS.border}`, borderRadius: 4, color: COLORS.slate, fontSize: 12, cursor: 'pointer' }}><Plus size={13} /> {addLabel}</button>
    </div>
  );
}

// --------------------------------------------------------------------------
// MAIN APP
// --------------------------------------------------------------------------
export default function FinancialPlanner() {
  const { clients, activeId, setActiveId, updateClient, addClient, deleteClient, loaded, saveState } = useClientStore();
  const [activeModule, setActiveModule] = useState('summary');

  const client = activeId ? clients[activeId] : null;
  const update = useCallback((updater) => {
    if (!activeId) return;
    updateClient(activeId, updater);
  }, [activeId, updateClient]);

  // Apply theme to document
  useEffect(() => {
    if (client) {
      document.documentElement.setAttribute('data-theme', client.theme);
    }
  }, [client?.theme]);

  if (!loaded) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400, fontFamily: 'Inter, sans-serif', color: COLORS.slate }}>
        Loading plan data…
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', minHeight: 720, background: COLORS.paper,
      fontFamily: 'Inter, sans-serif', borderRadius: 8, overflow: 'hidden',
      border: `1px solid ${COLORS.border}`
    }}>
      <ClientRail
        clients={clients} activeId={activeId} setActiveId={setActiveId}
        addClient={addClient} deleteClient={deleteClient}
        activeModule={activeModule} setActiveModule={setActiveModule}
        saveState={saveState} client={client} update={update}
      />
      <div style={{ flex: 1, padding: '32px 36px', overflowY: 'auto', background: COLORS.paper }}>
        {!client ? (
          <div style={{ textAlign: 'center', padding: 60, color: COLORS.slate }}>
            <Users size={32} style={{ marginBottom: 12, opacity: 0.5 }} />
            <div>Add a client to get started.</div>
          </div>
        ) : (
          <>
            {activeModule === 'summary' && <SummaryModule client={client} update={update} />}
            {activeModule === 'profile' && <ProfileModule client={client} update={update} />}
            {activeModule === 'networth' && <NetWorthModule client={client} update={update} />}
            {activeModule === 'cashflow' && <CashFlowModule client={client} update={update} />}
            {activeModule === 'retirement' && <RetirementModule client={client} update={update} />}
            {activeModule === 'goals' && <GoalsModule client={client} update={update} />}
            {activeModule === 'debt' && <DebtModule client={client} update={update} />}
            {activeModule === 'scenario' && <ScenarioModule client={client} update={update} />}
          </>
        )}
      </div>
    </div>
  );
}