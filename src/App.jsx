'use client'

import { useEffect, useEffectEvent, useMemo, useState, useTransition } from 'react'
import {
  Check,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  LoaderCircle,
  LogOut,
  PieChart,
  Plus,
  Receipt,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  Wallet,
} from 'lucide-react'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import {
  formatCurrency,
  formatMonthLabel,
  formatShortDate,
  getCurrentMonth,
  getMonthWindow,
  groupTotals,
  shiftMonth,
  sumBy,
  currencyOptions,
} from './lib/format'

const defaultCategories = ['Food', 'Transport', 'Utilities', 'Health', 'Shopping', 'Rent', 'Travel', 'Other']
const titleMaxLength = 80
const categoryMaxLength = 40
const groupNameMaxLength = 48
const inviteCodeLength = 10
const maxExportRangeDays = 366
const navItems = [
  { id: 'overview', label: 'Overview', icon: Wallet },
  { id: 'budgets', label: 'Budgets', icon: CreditCard },
  { id: 'insights', label: 'Insights', icon: PieChart },
  { id: 'profile', label: 'Profile', icon: UserRound },
]

const emptyExpenseForm = (date, userId) => ({
  title: '',
  amount: '',
  category: '',
  paid_by: userId || '',
  date,
})

const emptyContributionForm = (month, userId) => ({
  user_id: userId || '',
  amount: '',
  month,
})

const normalizeText = (value, maxLength) => value.trim().replace(/\s+/g, ' ').slice(0, maxLength)
const normalizeInviteCode = (value) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')
const parsePositiveAmount = (value) => {
  const amount = Number.parseFloat(value)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}
const isValidDateString = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value)
const isValidMonthString = (value) => /^\d{4}-\d{2}$/.test(value)
const getDaySpan = (start, end) => Math.ceil((new Date(`${end}T00:00:00`) - new Date(`${start}T00:00:00`)) / 86400000)

function App() {
  const [session, setSession] = useState(null)
  const [loadingSession, setLoadingSession] = useState(isSupabaseConfigured)
  const [appLoading, startTransition] = useTransition()
  const [errorMessage, setErrorMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [activeView, setActiveView] = useState('overview')
  const [selectedType, setSelectedType] = useState('personal')
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [authMode, setAuthMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('et_visited') ? 'signin' : 'signup'
    }
    return 'signin'
  })
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '' })
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm(new Date().toISOString().slice(0, 10), ''))
  const [contributionForm, setContributionForm] = useState(emptyContributionForm(getCurrentMonth(), ''))
  const [groupForm, setGroupForm] = useState({ name: '', inviteCode: '' })
  const [exportRange, setExportRange] = useState({
    start: `${getCurrentMonth()}-01`,
    end: new Date().toISOString().slice(0, 10),
  })
  const [currency, setCurrency] = useState('USD')
  const [openSheet, setOpenSheet] = useState('')
  const [pendingAction, setPendingAction] = useState('')
  const [store, setStore] = useState({
    profile: null,
    groups: [],
    members: [],
    expenses: [],
    contributions: [],
    trendExpenses: [],
    trendContributions: [],
    categories: [],
    previousBalance: 0,
  })

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return undefined

    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session ?? null)
      setLoadingSession(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
      setLoadingSession(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  const updateCurrency = async (newCurrency) => {
    setCurrency(newCurrency)
    if (supabase && currentUserId) {
      await supabase.from('users').update({ currency: newCurrency }).eq('id', currentUserId)
    }
  }

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 2800)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (!errorMessage) return undefined
    const timer = window.setTimeout(() => setErrorMessage(''), 4500)
    return () => window.clearTimeout(timer)
  }, [errorMessage])

  const currentUserId = session?.user?.id || ''
  const currentDate = new Date().toISOString().slice(0, 10)
  const formatMoney = useMemo(() => (value) => formatCurrency(value, currency), [currency])
  const isBusy = (action) => pendingAction === action

  const categoryOptions = useMemo(() => {
    const dynamicCategories = store.categories.map((item) => item.name)
    return [...new Set([...defaultCategories, ...dynamicCategories])]
  }, [store.categories])

  const recentTransactions = useMemo(() => {
    const items = [
      ...store.expenses.map((item) => ({ ...item, entryType: 'expense', sortDate: item.date })),
      ...store.contributions.map((item) => ({
        ...item,
        title: item.users?.name || item.users?.email || 'Contribution',
        entryType: 'contribution',
        sortDate: `${item.month}-01`,
      })),
    ]
    return items.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate)).slice(0, 7)
  }, [store.expenses, store.contributions])

  const totals = useMemo(() => {
    const contributions = sumBy(store.contributions, 'amount')
    const expenses = sumBy(store.expenses, 'amount')
    const monthBalance = contributions - expenses
    return {
      contributions,
      expenses,
      monthBalance,
      balance: store.previousBalance + monthBalance,
      previousBalance: store.previousBalance,
    }
  }, [store.contributions, store.expenses, store.previousBalance])

  const categoryBreakdown = useMemo(() => {
    const totalsByCategory = groupTotals(store.expenses, 'category')
    return Object.entries(totalsByCategory)
      .map(([name, amount]) => ({ name, amount }))
      .sort((left, right) => right.amount - left.amount)
  }, [store.expenses])

  const trendSeries = useMemo(() => {
    const monthWindow = getMonthWindow(selectedMonth, 6)
    return monthWindow.map((month) => ({
      month,
      label: formatMonthLabel(month).split(' ')[0],
      expenses: store.trendExpenses
        .filter((item) => item.month === month)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
      contributions: store.trendContributions
        .filter((item) => item.month === month)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    }))
  }, [selectedMonth, store.trendContributions, store.trendExpenses])

  const activeGroup = store.groups.find((group) => group.id === selectedGroupId)
  const utilization = totals.contributions > 0 ? Math.min((totals.expenses / totals.contributions) * 100, 100) : 0
  const largestExpense = store.expenses.reduce((largest, item) => (Number(item.amount) > Number(largest?.amount || 0) ? item : largest), null)
  const averageExpense = store.expenses.length ? totals.expenses / store.expenses.length : 0

  async function loadAppData(userId) {
    setErrorMessage('')
    const monthWindow = getMonthWindow(selectedMonth, 6)

    const profilePromise = supabase
      .from('users')
      .upsert(
        {
          id: userId,
          email: session.user.email,
          name: session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'User',
        },
        { onConflict: 'id' },
      )
      .select()
      .single()

    const groupsPromise = supabase
      .from('group_members')
      .select('group_id, role, groups!inner(id, name, invite_code, created_by)')
      .eq('user_id', userId)

    const categoriesPromise = supabase.from('categories').select('id, name').order('name')

    const [profileResult, groupsResult, categoriesResult] = await Promise.all([
      profilePromise,
      groupsPromise,
      categoriesPromise,
    ])

    if (profileResult.error) {
      setErrorMessage(profileResult.error.message)
      return
    }

    if (groupsResult.error) {
      setErrorMessage(groupsResult.error.message)
      return
    }

    const nextGroups = (groupsResult.data || []).map((entry) => ({ ...entry.groups, role: entry.role }))
    const profileData = profileResult.data
    if (profileData?.currency && profileData.currency !== currency) {
      setCurrency(profileData.currency)
    }
    const resolvedGroupId = selectedType === 'group'
      ? selectedGroupId || nextGroups[0]?.id || ''
      : ''

    if (selectedType === 'group' && resolvedGroupId !== selectedGroupId) {
      setSelectedGroupId(resolvedGroupId)
    }

    const membersPromise =
      selectedType === 'group' && resolvedGroupId
        ? supabase
            .from('group_members')
            .select('user_id, users!inner(id, name, email)')
            .eq('group_id', resolvedGroupId)
        : Promise.resolve({ data: [] })

    const expensesQuery = supabase
      .from('expenses')
      .select('id, title, amount, category, paid_by, date, month, type, group_id, paid_by_user:users!expenses_paid_by_fkey(id, name, email)')
      .eq('month', selectedMonth)
      .eq('type', selectedType)
      .order('date', { ascending: false })

    const contributionsQuery = supabase
      .from('contributions')
      .select('id, user_id, amount, month, type, group_id, users(id, name, email)')
      .eq('month', selectedMonth)
      .eq('type', selectedType)
      .order('created_at', { ascending: false })

    const trendExpensesQuery = supabase
      .from('expenses')
      .select('month, amount, type, group_id, paid_by')
      .gte('month', monthWindow[0])
      .lte('month', monthWindow[monthWindow.length - 1])
      .eq('type', selectedType)

    const trendContributionsQuery = supabase
      .from('contributions')
      .select('month, amount, type, group_id, user_id')
      .gte('month', monthWindow[0])
      .lte('month', monthWindow[monthWindow.length - 1])
      .eq('type', selectedType)

    const prevExpensesQuery = supabase
      .from('expenses')
      .select('amount')
      .lt('month', selectedMonth)
      .eq('type', selectedType)

    const prevContributionsQuery = supabase
      .from('contributions')
      .select('amount')
      .lt('month', selectedMonth)
      .eq('type', selectedType)

    if (selectedType === 'personal') {
      expensesQuery.eq('paid_by', userId)
      contributionsQuery.eq('user_id', userId)
      trendExpensesQuery.eq('paid_by', userId)
      trendContributionsQuery.eq('user_id', userId)
      prevExpensesQuery.eq('paid_by', userId)
      prevContributionsQuery.eq('user_id', userId)
    } else if (resolvedGroupId) {
      expensesQuery.eq('group_id', resolvedGroupId)
      contributionsQuery.eq('group_id', resolvedGroupId)
      trendExpensesQuery.eq('group_id', resolvedGroupId)
      trendContributionsQuery.eq('group_id', resolvedGroupId)
      prevExpensesQuery.eq('group_id', resolvedGroupId)
      prevContributionsQuery.eq('group_id', resolvedGroupId)
    }

    const [membersResult, expensesResult, contributionsResult, trendExpensesResult, trendContributionsResult, prevExpensesResult, prevContributionsResult] =
      await Promise.all([membersPromise, expensesQuery, contributionsQuery, trendExpensesQuery, trendContributionsQuery, prevExpensesQuery, prevContributionsQuery])

    if (expensesResult.error || contributionsResult.error || trendExpensesResult.error || trendContributionsResult.error || prevExpensesResult.error || prevContributionsResult.error) {
      setErrorMessage(
        expensesResult.error?.message ||
          contributionsResult.error?.message ||
          trendExpensesResult.error?.message ||
          trendContributionsResult.error?.message ||
          prevExpensesResult.error?.message ||
          prevContributionsResult.error?.message ||
          'Unable to load ledger data.',
      )
      return
    }

    const previousBalance = sumBy(prevContributionsResult.data || [], 'amount') - sumBy(prevExpensesResult.data || [], 'amount')

    setStore({
      profile: profileResult.data,
      groups: nextGroups,
      members: (membersResult.data || []).map((item) => ({ ...item.users, role: item.role })),
      expenses: expensesResult.data || [],
      contributions: contributionsResult.data || [],
      trendExpenses: trendExpensesResult.data || [],
      trendContributions: trendContributionsResult.data || [],
      categories: categoriesResult.data || [],
      previousBalance,
    })

    setExpenseForm((current) => ({
      ...current,
      paid_by: selectedType === 'group' ? resolvedGroupId && current.paid_by ? current.paid_by : userId : userId,
      date: current.date || currentDate,
    }))

    setContributionForm((current) => ({
      ...current,
      month: selectedMonth,
      user_id: current.user_id || userId,
    }))
  }

  const loadAppDataEvent = useEffectEvent(async (userId) => {
    await loadAppData(userId)
  })

  useEffect(() => {
    if (!session?.user || !supabase) return
    startTransition(() => {
      loadAppDataEvent(session.user.id)
    })
  }, [selectedGroupId, selectedMonth, selectedType, session?.user])

  const closeSheet = () => {
    setOpenSheet('')
    setExpenseForm(emptyExpenseForm(currentDate, currentUserId))
    setContributionForm(emptyContributionForm(selectedMonth, currentUserId))
    setGroupForm({ name: '', inviteCode: '' })
  }

  const onAuthSubmit = async (event) => {
    event.preventDefault()
    if (!supabase) return
    setErrorMessage('')
    setNotice('')

    if (authMode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({
        email: authForm.email,
        password: authForm.password,
      })

      if (error) {
        setErrorMessage(error.message)
        return
      }

      setNotice('Signed in successfully.')
      localStorage.setItem('et_visited', 'true')
      return
    }

    const { error } = await supabase.auth.signUp({
      email: authForm.email,
      password: authForm.password,
      options: {
        data: { name: authForm.name },
      },
    })

    if (error) {
      setErrorMessage(error.message)
      return
    }

    setNotice('Account created. If email confirmation is enabled, verify your inbox before signing in.')
    localStorage.setItem('et_visited', 'true')
  }

  const saveCategory = async (name) => {
    if (!name || !supabase) return
    await supabase.from('categories').upsert({ name, created_by: currentUserId }, { onConflict: 'name,created_by' })
  }

  const onCreateExpense = async (event) => {
    event.preventDefault()
    if (!supabase || pendingAction) return

    const title = normalizeText(expenseForm.title, titleMaxLength)
    const category = normalizeText(expenseForm.category, categoryMaxLength)
    const amount = parsePositiveAmount(expenseForm.amount)

    if (!title || !category || !amount || !isValidDateString(expenseForm.date)) {
      setErrorMessage('Enter a valid title, category, amount, and date.')
      return
    }

    if (selectedType === 'group' && (!selectedGroupId || !expenseForm.paid_by)) {
      setErrorMessage('Choose a group and member before saving a shared expense.')
      return
    }

    setPendingAction('expense')
    try {
      const derivedMonth = expenseForm.date.slice(0, 7)
      await saveCategory(category)
      const payload = {
        title,
        amount,
        category,
        paid_by: selectedType === 'personal' ? currentUserId : expenseForm.paid_by,
        date: expenseForm.date,
        month: derivedMonth,
        type: selectedType,
        group_id: selectedType === 'group' ? selectedGroupId : null,
      }
      const { error } = await supabase.from('expenses').insert(payload)
      if (error) {
        setErrorMessage(error.message)
        return
      }
      setSelectedMonth(derivedMonth)
      closeSheet()
      setNotice('Expense saved.')
      await loadAppData(currentUserId)
    } finally {
      setPendingAction('')
    }
  }

  const onCreateContribution = async (event) => {
    event.preventDefault()
    if (!supabase || pendingAction) return

    const amount = parsePositiveAmount(contributionForm.amount)
    if (!amount || !isValidMonthString(contributionForm.month)) {
      setErrorMessage('Enter a valid contribution amount and month.')
      return
    }

    if (selectedType === 'group' && (!selectedGroupId || !contributionForm.user_id)) {
      setErrorMessage('Choose a group and contributor before saving a shared contribution.')
      return
    }

    setPendingAction('contribution')
    try {
      const payload = {
        user_id: selectedType === 'personal' ? currentUserId : contributionForm.user_id,
        amount,
        month: contributionForm.month,
        type: selectedType,
        group_id: selectedType === 'group' ? selectedGroupId : null,
      }
      const { error } = await supabase.from('contributions').insert(payload)
      if (error) {
        setErrorMessage(error.message)
        return
      }
      setSelectedMonth(contributionForm.month)
      closeSheet()
      setNotice('Contribution added.')
      await loadAppData(currentUserId)
    } finally {
      setPendingAction('')
    }
  }

  const onCreateGroup = async (event) => {
    event.preventDefault()
    if (!supabase || pendingAction) return

    const name = normalizeText(groupForm.name, groupNameMaxLength)
    if (!name) {
      setErrorMessage('Enter a valid group name.')
      return
    }

    setPendingAction('group')
    try {
      const { data, error } = await supabase
        .from('groups')
        .insert({ name, created_by: currentUserId })
        .select()
        .single()
      if (error) {
        setErrorMessage(error.message)
        return
      }
      const joinResult = await supabase.from('group_members').insert({ user_id: currentUserId, group_id: data.id })
      if (joinResult.error) {
        setErrorMessage(joinResult.error.message)
        return
      }
      setSelectedType('group')
      setSelectedGroupId(data.id)
      closeSheet()
      await loadAppData(currentUserId)
    } finally {
      setPendingAction('')
    }
  }

  const onJoinGroup = async (event) => {
    event.preventDefault()
    if (!supabase || pendingAction) return

    const lookupCode = normalizeInviteCode(groupForm.inviteCode)
    if (lookupCode.length < 4) {
      setErrorMessage("Invite codes are usually around 10 characters. Please check yours.")
      return
    }

    setPendingAction('join')
    try {
      const { data, error } = await supabase.rpc('join_group_by_code', { lookup_code: lookupCode })
      if (error) {
        setErrorMessage(error.message)
        return
      }
      setSelectedType('group')
      setSelectedGroupId(data)
      closeSheet()
      await loadAppData(currentUserId)
    } finally {
      setPendingAction('')
    }
  }

  const onExport = async (format) => {
    if (!supabase || pendingAction) return
    if (!isValidDateString(exportRange.start) || !isValidDateString(exportRange.end) || exportRange.start > exportRange.end) {
      setErrorMessage('Choose a valid export date range.')
      return
    }
    if (getDaySpan(exportRange.start, exportRange.end) > maxExportRangeDays) {
      setErrorMessage(`Exports are limited to ${maxExportRangeDays} days at a time.`)
      return
    }
    if (selectedType === 'group' && !selectedGroupId) {
      setErrorMessage('Choose a group before exporting a shared report.')
      return
    }

    setPendingAction(`export-${format}`)
    try {
      const startMonth = exportRange.start.slice(0, 7)
      const endMonth = exportRange.end.slice(0, 7)

    const expenseQuery = supabase
      .from('expenses')
      .select('id, title, amount, category, paid_by, date, month, type, group_id, paid_by_user:users!expenses_paid_by_fkey(id, name, email)')
      .gte('date', exportRange.start)
      .lte('date', exportRange.end)
      .eq('type', selectedType)
      .order('date', { ascending: true })

    const contributionQuery = supabase
      .from('contributions')
      .select('id, user_id, amount, month, type, group_id, users(id, name, email)')
      .gte('month', startMonth)
      .lte('month', endMonth)
      .eq('type', selectedType)
      .order('month', { ascending: true })

    if (selectedType === 'personal') {
      expenseQuery.eq('paid_by', currentUserId)
      contributionQuery.eq('user_id', currentUserId)
    } else {
      expenseQuery.eq('group_id', selectedGroupId)
      contributionQuery.eq('group_id', selectedGroupId)
    }

      const [expensesResult, contributionsResult] = await Promise.all([expenseQuery, contributionQuery])
      if (expensesResult.error || contributionsResult.error) {
        setErrorMessage(expensesResult.error?.message || contributionsResult.error?.message || 'Unable to export report.')
        return
      }

      const expenses = expensesResult.data || []
      const contributions = contributionsResult.data || []
      const payload = {
        contextLabel: selectedType === 'personal' ? 'Personal Ledger' : `${activeGroup?.name || 'Group'} Ledger`,
        rangeLabel: `${exportRange.start}_to_${exportRange.end}`,
        currency,
        summary: {
          contributions: sumBy(contributions, 'amount'),
          expenses: sumBy(expenses, 'amount'),
          balance: sumBy(contributions, 'amount') - sumBy(expenses, 'amount'),
        },
        expenses,
        contributions,
        categoryTotals: groupTotals(expenses, 'category'),
      }

      const reporting = await import('./lib/reporting')
      if (format === 'csv') {
        reporting.exportCsvReport(payload)
      } else {
        await reporting.exportPdfReport(payload)
      }
    } finally {
      setPendingAction('')
    }
  }

  const signOut = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setStore({
      profile: null,
      groups: [],
      members: [],
      expenses: [],
      contributions: [],
      trendExpenses: [],
      trendContributions: [],
      categories: [],
    })
    setSelectedType('personal')
    setSelectedGroupId('')
  }

  const onClearData = async () => {
    if (!supabase || pendingAction) return

    const isGroup = selectedType === 'group'
    const activeGroupEntry = store.groups.find(g => g.id === selectedGroupId)
    
    if (isGroup && activeGroupEntry?.role !== 'admin') {
      setErrorMessage("Only group admins can clear the ledger.")
      return
    }

    const contextName = isGroup ? `group "${activeGroup?.name}"` : 'personal ledger'
    const confirmed = window.confirm(
      `Are you sure you want to clear all data for your ${contextName}? This will permanently delete all expenses and contributions in this context. This action cannot be undone.`
    )

    if (!confirmed) return

    setPendingAction('clear-data')
    try {
      const queryParams = isGroup ? { group_id: selectedGroupId } : { type: 'personal', [isGroup ? '' : 'user_id_field']: currentUserId }
      
      let expQuery = supabase.from('expenses').delete()
      let conQuery = supabase.from('contributions').delete()

      if (isGroup) {
        expQuery = expQuery.eq('group_id', selectedGroupId)
        conQuery = conQuery.eq('group_id', selectedGroupId)
      } else {
        expQuery = expQuery.eq('type', 'personal').eq('paid_by', currentUserId)
        conQuery = conQuery.eq('type', 'personal').eq('user_id', currentUserId)
      }

      const [expRes, conRes] = await Promise.all([expQuery, conQuery])

      if (expRes.error || conRes.error) {
        setErrorMessage(expRes.error?.message || conRes.error?.message || 'Failed to clear data.')
        return
      }

      setNotice(`All data for ${contextName} has been cleared.`)
      await loadAppData(currentUserId)
    } finally {
      setPendingAction('')
    }
  }

  const onPromoteMember = async (targetUserId) => {
    if (!supabase || pendingAction || selectedType !== 'group' || !selectedGroupId) return
    setPendingAction('promote')
    try {
      const { error } = await supabase
        .from('group_members')
        .update({ role: 'admin' })
        .eq('group_id', selectedGroupId)
        .eq('user_id', targetUserId)
      
      if (error) throw error
      setNotice("Member promoted to admin.")
      await loadAppData(currentUserId)
    } catch (err) {
      setErrorMessage(err.message)
    } finally {
      setPendingAction('')
    }
  }

  if (!isSupabaseConfigured) {
    return <SetupScreen />
  }

  if (loadingSession) {
    return <LoadingScreen label="Connecting to your workspace" />
  }

  if (!session) {
    return (
      <AuthScreen
        authForm={authForm}
        authMode={authMode}
        setAuthForm={setAuthForm}
        setAuthMode={setAuthMode}
        onSubmit={onAuthSubmit}
        errorMessage={errorMessage}
        notice={notice}
      />
    )
  }

  const ledgerReady = selectedType === 'personal' || selectedGroupId

  return (
    <div className="min-h-screen bg-transparent text-ink">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-28 pt-4 sm:px-6 lg:px-10">
        <header className="glass sticky top-4 z-20 mb-5 rounded-[24px] border border-white/60 px-4 py-4 shadow-panel">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-zinc-500">Expense Tracker</p>
                <h1 className="text-2xl font-extrabold tracking-tight">{store.profile?.name || 'Workspace'}</h1>
              </div>
              <button
                type="button"
                onClick={signOut}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-zinc-600 shadow-soft transition hover:-translate-y-0.5 hover:text-ink"
                aria-label="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex rounded-full bg-white p-1 shadow-soft">
                {['personal', 'group'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedType(type)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold capitalize transition ${
                      selectedType === type ? 'bg-ink text-white shadow-soft' : 'text-zinc-500 hover:text-ink'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {selectedType === 'group' && (
                  <select
                    value={selectedGroupId}
                    onChange={(event) => setSelectedGroupId(event.target.value)}
                    className="rounded-2xl border border-white/50 bg-white px-4 py-3 text-sm font-medium shadow-soft outline-none"
                  >
                    {store.groups.length === 0 ? <option value="">No groups yet</option> : null}
                    {store.groups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name}
                      </option>
                    ))}
                  </select>
                )}

                <MonthPicker month={selectedMonth} setMonth={setSelectedMonth} />
              </div>
            </div>
          </div>
        </header>

        {errorMessage ? (
          <div className="mb-4 rounded-[20px] bg-red-50 px-4 py-3 text-sm font-medium text-danger shadow-soft">{errorMessage}</div>
        ) : null}

        {notice ? (
          <div className="mb-4 rounded-[20px] bg-emerald-50 px-4 py-3 text-sm font-medium text-positive shadow-soft">{notice}</div>
        ) : null}

        {appLoading ? <LoadingScreen label="Refreshing your ledger" compact /> : null}

        {selectedType === 'group' && !ledgerReady ? (
          <EmptyGroupState onCreate={() => setOpenSheet('create-group')} onJoin={() => setOpenSheet('join-group')} />
        ) : (
          <>
            <main className="flex-1">
              <div key={`${activeView}-${selectedType}-${selectedGroupId || 'personal'}-${selectedMonth}`} className="view-enter">
                {activeView === 'overview' ? (
                  <OverviewScreen
                    selectedType={selectedType}
                    activeGroup={activeGroup}
                    totals={totals}
                    recentTransactions={recentTransactions}
                    onAddExpense={() => setOpenSheet('expense')}
                    onAddContribution={() => setOpenSheet('contribution')}
                    formatMoney={formatMoney}
                  />
                ) : null}

                {activeView === 'budgets' ? (
                  <BudgetsScreen
                    totals={totals}
                    utilization={utilization}
                    categoryBreakdown={categoryBreakdown}
                    formatMoney={formatMoney}
                    members={store.members}
                    contributions={store.contributions}
                    selectedType={selectedType}
                  />
                ) : null}

                {activeView === 'insights' ? (
                  <InsightsScreen
                    trendSeries={trendSeries}
                    categoryBreakdown={categoryBreakdown}
                    averageExpense={averageExpense}
                    largestExpense={largestExpense}
                    formatMoney={formatMoney}
                  />
                ) : null}

                {activeView === 'profile' ? (
                  <ProfileScreen
                    profile={store.profile}
                    selectedType={selectedType}
                    activeGroup={activeGroup}
                    groups={store.groups}
                    members={store.members}
                    contributions={store.contributions}
                    exportRange={exportRange}
                    setExportRange={setExportRange}
                    onExport={onExport}
                    onCreateGroup={() => setOpenSheet('create-group')}
                    onJoinGroup={() => setOpenSheet('join-group')}
                    currency={currency}
                    setCurrency={updateCurrency}
                    formatMoney={formatMoney}
                    pendingAction={pendingAction}
                    onClearData={onClearData}
                    onPromoteMember={onPromoteMember}
                  />
                ) : null}
              </div>
            </main>

            <BottomNav activeView={activeView} setActiveView={setActiveView} />

            <div className="fixed bottom-24 right-4 z-20 flex flex-col gap-3 md:hidden">
              <FloatingButton label="Add expense" icon={Plus} onClick={() => setOpenSheet('expense')} />
              <FloatingButton label="Add contribution" icon={CircleDollarSign} onClick={() => setOpenSheet('contribution')} tone="light" />
            </div>
          </>
        )}
      </div>

      <Modal open={openSheet === 'expense'} title="Add Expense" onClose={closeSheet}>
        <form className="space-y-4" onSubmit={onCreateExpense}>
          <Field label="Title">
            <input
              required
              value={expenseForm.title}
              maxLength={titleMaxLength}
              autoComplete="off"
              onChange={(event) => setExpenseForm({ ...expenseForm, title: event.target.value })}
              className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none"
              placeholder="Groceries, utilities, dinner..."
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <input
                required
                min="0"
                step="0.01"
                type="number"
                inputMode="decimal"
                value={expenseForm.amount}
                onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })}
                className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none"
              />
            </Field>
            <Field label="Date">
              <input
                required
                type="date"
                value={expenseForm.date}
                onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })}
                className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none"
              />
            </Field>
          </div>
          <Field label="Category">
            <input
              required
              list="category-options"
              maxLength={categoryMaxLength}
              value={expenseForm.category}
              onChange={(event) => setExpenseForm({ ...expenseForm, category: event.target.value })}
              className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none"
              placeholder="Choose or type a category"
            />
            <datalist id="category-options">
              {categoryOptions.map((category) => (
                <option key={category} value={category} />
              ))}
            </datalist>
          </Field>
          <Field label="Paid by">
            <select
              value={selectedType === 'personal' ? currentUserId : expenseForm.paid_by}
              disabled={selectedType === 'personal'}
              onChange={(event) => setExpenseForm({ ...expenseForm, paid_by: event.target.value })}
              className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none disabled:text-zinc-400"
            >
              {selectedType === 'personal' ? (
                <option value={currentUserId}>{store.profile?.name || session.user.email}</option>
              ) : (
                store.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email}
                  </option>
                ))
              )}
            </select>
          </Field>
          <button
            disabled={isBusy('expense')}
            className="w-full rounded-2xl bg-ink px-4 py-3 font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy('expense') ? 'Saving...' : 'Save expense'}
          </button>
        </form>
      </Modal>

      <Modal open={openSheet === 'contribution'} title="Add Contribution" onClose={closeSheet}>
        <form className="space-y-4" onSubmit={onCreateContribution}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <input
                required
                min="0"
                step="0.01"
                type="number"
                inputMode="decimal"
                value={contributionForm.amount}
                onChange={(event) => setContributionForm({ ...contributionForm, amount: event.target.value })}
                className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none"
              />
            </Field>
            <Field label="Month">
              <input
                required
                type="month"
                value={contributionForm.month}
                onChange={(event) => setContributionForm({ ...contributionForm, month: event.target.value })}
                className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none"
              />
            </Field>
          </div>
          <Field label="Contributor">
            <select
              value={selectedType === 'personal' ? currentUserId : contributionForm.user_id}
              disabled={selectedType === 'personal'}
              onChange={(event) => setContributionForm({ ...contributionForm, user_id: event.target.value })}
              className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none disabled:text-zinc-400"
            >
              {selectedType === 'personal' ? (
                <option value={currentUserId}>{store.profile?.name || session.user.email}</option>
              ) : (
                store.members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name || member.email}
                  </option>
                ))
              )}
            </select>
          </Field>
          <button
            disabled={isBusy('contribution')}
            className="w-full rounded-2xl bg-ink px-4 py-3 font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy('contribution') ? 'Saving...' : 'Save contribution'}
          </button>
        </form>
      </Modal>

      <Modal open={openSheet === 'create-group'} title="Create Group" onClose={closeSheet}>
        <form className="space-y-4" onSubmit={onCreateGroup}>
          <Field label="Group name">
              <input
                required
                value={groupForm.name}
                maxLength={groupNameMaxLength}
                autoComplete="off"
                onChange={(event) => setGroupForm({ ...groupForm, name: event.target.value })}
                className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none"
                placeholder="Family, Flatmates, Trip to Goa..."
              />
            </Field>
          <button
            disabled={isBusy('group')}
            className="w-full rounded-2xl bg-ink px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy('group') ? 'Creating...' : 'Create group'}
          </button>
        </form>
      </Modal>

      <Modal open={openSheet === 'join-group'} title="Join Group" onClose={closeSheet}>
        <form className="space-y-4" onSubmit={onJoinGroup}>
          <Field label="Invite code">
              <input
                required
                maxLength={inviteCodeLength}
                minLength={inviteCodeLength}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                pattern="[A-Z0-9]{10}"
                value={groupForm.inviteCode}
                onChange={(event) => setGroupForm({ ...groupForm, inviteCode: normalizeInviteCode(event.target.value) })}
                className="w-full rounded-2xl bg-canvas px-4 py-3 uppercase outline-none"
                placeholder="A1B2C3D4E5"
              />
            </Field>
          <button
            disabled={isBusy('join')}
            className="w-full rounded-2xl bg-ink px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isBusy('join') ? 'Joining...' : 'Join group'}
          </button>
        </form>
      </Modal>
    </div>
  )
}

function SetupScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-xl rounded-[32px] bg-white p-8 shadow-panel">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-3xl bg-sky text-brand">
          <ShieldCheck size={28} />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">Connect Supabase to start</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `expense-tracker-app/.env`, then run the SQL in
          `supabase/schema.sql`.
        </p>
      </div>
    </div>
  )
}

function LoadingScreen({ label, compact = false }) {
  return (
    <div className={compact ? 'mb-4 flex items-center gap-2 text-sm text-zinc-500' : 'flex min-h-screen items-center justify-center'}>
      <LoaderCircle className="animate-spin" size={compact ? 16 : 24} />
      <span className={compact ? '' : 'ml-3 text-sm font-medium text-zinc-500'}>{label}</span>
    </div>
  )
}

function AuthScreen({ authForm, authMode, setAuthForm, setAuthMode, onSubmit, errorMessage, notice }) {
  const isSignIn = authMode === 'signin'

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="grid min-h-screen w-full overflow-hidden lg:grid-cols-2">
        {/* Hero Section */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-black p-16 text-white lg:flex xl:p-24">
          <div className="relative z-10">
            <h1 className="text-5xl font-bold leading-tight tracking-tight">
              Take control of your <br />
              <span className="text-zinc-400">shared expenses.</span>
            </h1>
            <p className="mt-6 max-w-sm text-lg text-zinc-400">
              Personal tracking and group ledgers, all in one place. Simple, fast, and synced.
            </p>
          </div>
          
          {/* Abstract Glow Effect */}
          <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-[#f06b02] opacity-20 blur-[100px]" />
          <div className="absolute bottom-0 right-0 h-64 w-full bg-gradient-to-t from-[#f06b02]/30 to-transparent" />
          
          <div className="relative z-10 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-[#f06b02]" />
            <span className="font-bold tracking-tight">Expense Tracker</span>
          </div>
        </section>

        {/* Form Section */}
        <section className="flex flex-col items-center justify-center p-8 sm:p-16 lg:p-20">
          <div className="w-full max-w-md">
            <div className="mb-10 flex h-12 w-12 items-center justify-center rounded-xl bg-[#f06b02]/10 text-[#f06b02]">
             <Sparkles size={24} />
          </div>

          <header className="mb-10">
            <h2 className="text-4xl font-extrabold tracking-tight text-ink">
              {isSignIn ? 'Welcome Back' : 'Get Started'}
            </h2>
            <p className="mt-2 text-zinc-500">
              {isSignIn ? 'Sign in to your account' : 'Welcome to Expense Tracker — Let\'s get started'}
            </p>
          </header>

          <form className="space-y-6" onSubmit={onSubmit}>
            {!isSignIn && (
              <div>
                <label className="mb-2 block text-sm font-semibold text-zinc-600">Your name</label>
                <input
                  required
                  value={authForm.name}
                  onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-[#f06b02] focus:ring-2 focus:ring-[#f06b02]/10"
                  placeholder="Enter your name"
                />
              </div>
            )}
            
            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-600">Your email</label>
              <input
                required
                type="email"
                value={authForm.email}
                onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-[#f06b02] focus:ring-2 focus:ring-[#f06b02]/10"
                placeholder="hi@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-zinc-600">
                {isSignIn ? 'Your password' : 'Create new password'}
              </label>
              <input
                required
                type="password"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 outline-none transition focus:border-[#f06b02] focus:ring-2 focus:ring-[#f06b02]/10"
                placeholder="••••••••"
              />
            </div>

            {errorMessage && (
              <div className="rounded-xl bg-red-50 p-3 text-sm font-medium text-danger">
                {errorMessage}
              </div>
            )}
            
            {notice && (
              <div className="rounded-xl bg-emerald-50 p-3 text-sm font-medium text-positive">
                {notice}
              </div>
            )}

            <button className="w-full rounded-xl bg-[#f06b02] px-4 py-4 font-bold text-white shadow-lg shadow-[#f06b02]/20 transition hover:-translate-y-0.5 hover:bg-[#d96102] active:translate-y-0">
              {isSignIn ? 'Sign in' : 'Create new account'}
            </button>
          </form>

          <footer className="mt-10 text-center">
            <p className="text-sm text-zinc-500">
              {isSignIn ? "Don't have an account?" : "Already have an account?"}{' '}
              <button
                type="button"
                onClick={() => setAuthMode(isSignIn ? 'signup' : 'signin')}
                className="font-bold text-ink hover:underline"
              >
                {isSignIn ? 'Create one' : 'Login'}
              </button>
            </p>
          </footer>
          </div>
        </section>
      </div>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, copy }) {
  return (
    <div className="rounded-[24px] bg-white/10 p-4">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
        <Icon size={18} />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-white/70">{copy}</p>
    </div>
  )
}

function OverviewScreen({ selectedType, activeGroup, totals, recentTransactions, onAddExpense, onAddContribution, formatMoney }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-500">{selectedType === 'personal' ? 'Personal ledger' : activeGroup?.name || 'Group ledger'}</p>
            <h2 className="money mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">{formatMoney(totals.balance)}</h2>
            <p className="mt-3 text-sm text-zinc-500">
              {totals.previousBalance !== 0 
                ? `Including ${formatMoney(totals.previousBalance)} carried forward from previous months.`
                : 'Remaining balance for the selected month.'}
            </p>
          </div>
          <div className="rounded-[24px] bg-sky px-4 py-3 text-right text-brand">
            <p className="text-xs font-semibold uppercase tracking-[0.2em]">Live</p>
            <p className="mt-1 text-sm font-bold">Month ledger</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Contributions" value={formatMoney(totals.contributions)} tone="positive" icon={ArrowDownCircle} />
          <StatCard label="Expenses" value={formatMoney(totals.expenses)} tone="danger" icon={ArrowUpCircle} />
          <StatCard label="Balance" value={formatMoney(totals.balance)} tone={totals.balance >= 0 ? 'positive' : 'danger'} icon={Wallet} />
        </div>

        <div className="mt-6 flex flex-wrap gap-3 md:flex">
          <ActionButton icon={Plus} label="Add Expense" onClick={onAddExpense} />
          <ActionButton icon={CircleDollarSign} label="Add Contribution" onClick={onAddContribution} tone="light" />
        </div>
      </section>

      <section className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Recent transactions</p>
            <h3 className="text-xl font-bold">Latest activity</h3>
          </div>
        </div>

        <div className="space-y-3">
          {recentTransactions.length === 0 ? (
            <EmptyCard copy="No transactions yet for this month. Add a contribution or expense to start the ledger." />
          ) : (
            recentTransactions.map((item) => (
              <div key={`${item.entryType}-${item.id}`} className="flex items-center justify-between rounded-[22px] bg-canvas px-4 py-3">
                <div>
                  <p className="font-semibold text-ink">{item.entryType === 'expense' ? item.title : item.users?.name || item.users?.email}</p>
                  <p className="text-xs text-zinc-500">
                    {item.entryType === 'expense' ? `${item.category} • ${formatShortDate(item.date)}` : `${formatMonthLabel(item.month)} contribution`}
                  </p>
                </div>
                <p className={`money font-bold ${item.entryType === 'expense' ? 'text-danger' : 'text-positive'}`}>
                  {item.entryType === 'expense' ? '-' : '+'}
                  {formatMoney(item.amount)}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function BudgetsScreen({ totals, utilization, categoryBreakdown, formatMoney, members, contributions, selectedType }) {
  const isGroup = selectedType === 'group'
  const settlementInfo = useMemo(() => {
    if (!isGroup || members.length === 0) return null
    const sharePerPerson = totals.expenses / members.length
    return members.map(member => {
      const actualCont = contributions
        .filter(c => c.user_id === member.id)
        .reduce((sum, c) => sum + Number(c.amount || 0), 0)
      const diff = actualCont - sharePerPerson
      return { ...member, actualCont, sharePerPerson, diff }
    }).sort((a, b) => a.diff - b.diff)
  }, [isGroup, members, contributions, totals.expenses])

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid gap-4">
        <section className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
          <p className="text-sm font-medium text-zinc-500">Monthly runway</p>
          <h2 className="money mt-3 text-4xl font-extrabold tracking-tight">{formatMoney(totals.balance)}</h2>
          <div className="mt-6 rounded-full bg-canvas p-1">
            <div
              className={`h-3 rounded-full ${utilization > 85 ? 'bg-danger' : 'bg-positive'} animate-pulsebar`}
              style={{ width: `${Math.max(utilization, 8)}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-sm text-zinc-500">
            <span className="money">{utilization.toFixed(0)}% spent</span>
            <span className="money">{formatMoney(totals.contributions)} funded</span>
          </div>
        </section>

        {settlementInfo && (
          <section className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
            <div className="mb-4">
              <p className="text-sm font-medium text-zinc-500">Fair share insights</p>
              <h3 className="text-xl font-bold">Who needs to top up?</h3>
              <p className="mt-1 text-sm text-zinc-500">Target per person: {formatMoney(settlementInfo[0]?.sharePerPerson)}</p>
            </div>
            <div className="space-y-3">
              {settlementInfo.map(item => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl bg-canvas px-4 py-3">
                  <div>
                    <p className="text-sm font-bold">{item.name || item.email}</p>
                    <p className="text-xs text-zinc-500">Contributed: {formatMoney(item.actualCont)}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${item.diff < 0 ? 'text-danger' : 'text-positive'}`}>
                      {item.diff < 0 ? `Owes ${formatMoney(Math.abs(item.diff))}` : `Ahead ${formatMoney(item.diff)}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <section className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Category budget pulse</p>
            <h3 className="text-xl font-bold">Where the money went</h3>
          </div>
          <BarChart3 className="text-zinc-400" size={18} />
        </div>
        <div className="space-y-4">
          {categoryBreakdown.length === 0 ? (
            <EmptyCard copy="Category summaries appear as soon as this month has expenses." />
          ) : (
            categoryBreakdown.map((item, index) => (
              <div key={item.name}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{item.name}</span>
                  <span className="money text-zinc-500">{formatMoney(item.amount)}</span>
                </div>
                <div className="h-2 rounded-full bg-canvas">
                  <div
                    className="h-2 rounded-full bg-ink"
                    style={{ width: `${Math.max((item.amount / Math.max(totals.expenses, 1)) * 100, 8)}%`, opacity: 1 - index * 0.08 }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function InsightsScreen({ trendSeries, categoryBreakdown, averageExpense, largestExpense, formatMoney }) {
  const maxValue = Math.max(...trendSeries.map((item) => Math.max(item.expenses, item.contributions)), 1)

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-500">Monthly insight</p>
            <h3 className="text-xl font-bold">Six-month flow</h3>
          </div>
        </div>

        <div className="grid h-64 grid-cols-6 items-end gap-3">
          {trendSeries.map((item) => (
            <div key={item.month} className="flex h-full flex-col justify-end gap-2">
              <div className="flex h-full items-end justify-center gap-2">
                <div
                  className="w-4 rounded-full bg-emerald-300/90 transition-all"
                  style={{ height: `${Math.max((item.contributions / maxValue) * 100, item.contributions ? 10 : 4)}%` }}
                  title={`${item.label} contributions`}
                />
                <div
                  className="w-4 rounded-full bg-ink/85 transition-all"
                  style={{ height: `${Math.max((item.expenses / maxValue) * 100, item.expenses ? 10 : 4)}%` }}
                  title={`${item.label} expenses`}
                />
              </div>
              <p className="text-center text-xs font-medium text-zinc-500">{item.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4">
        <MetricPanel title="Average expense" value={formatMoney(averageExpense)} icon={Receipt} />
        <MetricPanel title="Largest expense" value={largestExpense ? formatMoney(largestExpense.amount) : formatMoney(0)} icon={ArrowUpCircle} />
        <section className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
          <p className="text-sm font-medium text-zinc-500">Category breakdown</p>
          <div className="mt-4 space-y-3">
            {categoryBreakdown.slice(0, 4).map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-[20px] bg-canvas px-4 py-3">
                <span className="font-medium">{item.name}</span>
                <span className="money text-sm text-zinc-500">{formatMoney(item.amount)}</span>
              </div>
            ))}
            {categoryBreakdown.length === 0 ? <EmptyCard copy="Insights sharpen as you log category spending." /> : null}
          </div>
        </section>
      </section>
    </div>
  )
}

function ProfileScreen({
  profile,
  selectedType,
  activeGroup,
  groups,
  members,
  contributions,
  exportRange,
  setExportRange,
  onExport,
  onCreateGroup,
  onJoinGroup,
  currency,
  setCurrency,
  formatMoney,
  pendingAction,
  onClearData,
  onPromoteMember,
}) {
  const currentGroupRole = groups.find(g => g.id === activeGroup?.id)?.role
  const isAdmin = selectedType === 'personal' || currentGroupRole === 'admin'

  return (
    <div className="grid gap-4 lg:grid-cols-1 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="space-y-4">
        <div className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
          <p className="text-sm font-medium text-zinc-500">Account</p>
          <h2 className="mt-2 text-2xl font-bold">{profile?.name}</h2>
          <p className="mt-1 text-sm text-zinc-500">{profile?.email}</p>
        </div>

        <div className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Preferences</p>
              <h3 className="text-xl font-bold">Currency</h3>
            </div>
            <Check size={18} className="text-zinc-400" />
          </div>
          <Field label="Display currency">
            <select
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
              className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none"
            >
              {currencyOptions.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.code} - {option.label}
                </option>
              ))}
            </select>
          </Field>
          <p className="mt-3 text-sm text-zinc-500">Your choice is saved to your profile and synced across devices.</p>
        </div>

        <div className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Groups</p>
              <h3 className="text-xl font-bold">Shared ledgers</h3>
            </div>
            <Users size={18} className="text-zinc-400" />
          </div>
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.id} className="rounded-[22px] bg-canvas px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold">{group.name}</p>
                    <p className="text-xs text-zinc-500">
                      {group.role === 'admin' ? `Invite code: ${group.invite_code}` : 'Invite members via admin'}
                    </p>
                  </div>
                  {activeGroup?.id === group.id && selectedType === 'group' ? (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-zinc-600">Active</span>
                  ) : null}
                </div>
            ))}
            {groups.length === 0 ? <EmptyCard copy="Create your first shared group or join one with an invite code." /> : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton icon={Plus} label="Create group" onClick={onCreateGroup} />
            <ActionButton icon={Users} label="Join group" onClick={onJoinGroup} tone="light" />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">Exports</p>
              <h3 className="text-xl font-bold">Monthly or custom reports</h3>
            </div>
            <Download size={18} className="text-zinc-400" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Start date">
              <input
                type="date"
                value={exportRange.start}
                onChange={(event) => setExportRange({ ...exportRange, start: event.target.value })}
                className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none"
              />
            </Field>
            <Field label="End date">
              <input
                type="date"
                value={exportRange.end}
                onChange={(event) => setExportRange({ ...exportRange, end: event.target.value })}
                className="w-full rounded-2xl bg-canvas px-4 py-3 outline-none"
              />
            </Field>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <ActionButton
              icon={Download}
              label={pendingAction === 'export-csv' ? 'Preparing CSV...' : 'Download CSV'}
              onClick={() => onExport('csv')}
              disabled={pendingAction === 'export-csv' || pendingAction === 'export-pdf'}
            />
            <ActionButton
              icon={Download}
              label={pendingAction === 'export-pdf' ? 'Preparing PDF...' : 'Download PDF'}
              onClick={() => onExport('pdf')}
              tone="light"
              disabled={pendingAction === 'export-pdf' || pendingAction === 'export-csv'}
            />
          </div>
        </div>

        <div className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-500">
                {selectedType === 'personal' ? 'Personal contributions' : `${activeGroup?.name || 'Group'} contributions`}
              </p>
              <h3 className="text-xl font-bold">Contribution breakdown</h3>
            </div>
            <CircleDollarSign size={18} className="text-zinc-400" />
          </div>
          <div className="space-y-3">
            {contributions.map((item) => (
              <div key={item.id} className="flex items-center justify-between rounded-[22px] bg-canvas px-4 py-3">
                <div>
                  <p className="font-semibold">{item.users?.name || item.users?.email}</p>
                  <p className="text-xs text-zinc-500">{formatMonthLabel(item.month)}</p>
                </div>
                <p className="money font-bold text-positive">{formatMoney(item.amount)}</p>
              </div>
            ))}
            {contributions.length === 0 ? <EmptyCard copy="This month doesn't have contribution entries yet." /> : null}
          </div>
        </div>

        {selectedType === 'group' ? (
          <div className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
            <p className="text-sm font-medium text-zinc-500">Members</p>
            <div className="mt-4 space-y-2">
              {members.map((member) => (
                <div key={member.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-canvas px-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-zinc-600">
                      {member.name || member.email}
                    </span>
                    {member.role === 'admin' && <span className="text-[10px] font-bold uppercase tracking-wider text-brand">Admin</span>}
                  </div>
                  {isAdmin && member.role !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => onPromoteMember(member.id)}
                      className="text-xs font-bold text-brand hover:underline"
                    >
                      Make Admin
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {isAdmin ? (
          <div className="surface rounded-[28px] border border-red-100 bg-red-50/30 p-5 shadow-panel sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-danger">Danger Zone</p>
                <h3 className="text-xl font-bold">Reset ledger</h3>
              </div>
            </div>
            <p className="text-sm text-zinc-600">
              Permanently delete all expenses and contributions from your {selectedType === 'personal' ? 'personal ledger' : `group "${activeGroup?.name}"`}.
            </p>
            <button
              type="button"
              disabled={pendingAction === 'clear-data'}
              onClick={() => onClearData()}
              className="mt-4 rounded-2xl bg-red-500 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              {pendingAction === 'clear-data' ? 'Clearing...' : 'Clear all data'}
            </button>
          </div>
        ) : (
          <div className="surface rounded-[28px] bg-canvas/50 p-5 shadow-panel sm:p-6">
             <p className="text-sm font-medium text-zinc-500">Permissions</p>
             <p className="mt-1 text-sm text-zinc-500">You are a member of this group. Only admins can reset data or see invite codes.</p>
          </div>
        )}
      </section>
    </div>
  )
}

function EmptyGroupState({ onCreate, onJoin }) {
  return (
    <div className="mx-auto flex flex-1 max-w-2xl items-center">
      <div className="w-full rounded-[32px] bg-white p-8 text-center shadow-panel">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[24px] bg-sky text-brand">
          <Users size={28} />
        </div>
        <h2 className="text-2xl font-bold">No group selected yet</h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-zinc-500">
          Create a group for family or friends, or join an existing one with an invite code. Shared expenses and
          contributions will appear here once you are in.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <ActionButton icon={Plus} label="Create group" onClick={onCreate} />
          <ActionButton icon={Users} label="Join group" onClick={onJoin} tone="light" />
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

function StatCard({ label, value, icon: Icon, tone }) {
  const toneClass =
    tone === 'positive' ? 'bg-emerald-50 text-positive' : tone === 'danger' ? 'bg-red-50 text-danger' : 'bg-canvas text-ink'
  return (
    <div className="surface rounded-[24px] bg-canvas p-4">
      <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${toneClass}`}>
        <Icon size={18} />
      </div>
      <p className="text-sm font-medium text-zinc-500">{label}</p>
      <p className="money mt-1 text-xl font-bold">{value}</p>
    </div>
  )
}

function ActionButton({ icon: Icon, label, onClick, tone = 'dark', disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`surface inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 ${
        tone === 'dark' ? 'bg-ink text-white' : 'bg-canvas text-ink'
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  )
}

function FloatingButton({ icon: Icon, label, onClick, tone = 'dark' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`surface flex h-14 w-14 items-center justify-center rounded-full shadow-panel transition hover:-translate-y-0.5 ${
        tone === 'dark' ? 'bg-ink text-white' : 'bg-white text-ink'
      }`}
    >
      <Icon size={18} />
    </button>
  )
}

function MetricPanel({ title, value, icon: Icon }) {
  return (
    <section className="surface rounded-[28px] bg-white p-5 shadow-panel sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">{title}</p>
          <h3 className="money mt-2 text-3xl font-extrabold tracking-tight">{value}</h3>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-canvas text-zinc-600">
          <Icon size={18} />
        </div>
      </div>
    </section>
  )
}

function EmptyCard({ copy }) {
  return <div className="surface rounded-[22px] bg-canvas px-4 py-5 text-sm leading-6 text-zinc-500">{copy}</div>
}

function BottomNav({ activeView, setActiveView }) {
  return (
    <nav className="glass fixed inset-x-4 bottom-4 z-30 mx-auto grid max-w-xl grid-cols-4 rounded-[28px] border border-white/60 p-2 shadow-panel">
      {navItems.map((item) => {
        const Icon = item.icon
        const active = item.id === activeView
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveView(item.id)}
            className={`surface flex flex-col items-center gap-1 rounded-[20px] px-3 py-2 text-xs font-semibold transition ${
              active ? 'bg-ink text-white' : 'text-zinc-500'
            }`}
          >
            <Icon size={18} />
            {item.label}
          </button>
        )
      })}
    </nav>
  )
}

function MonthPicker({ month, setMonth }) {
  return (
    <div className="surface flex items-center gap-2 rounded-full bg-white px-2 py-2 shadow-soft">
      <button
        type="button"
        onClick={() => setMonth(shiftMonth(month, -1))}
        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-canvas hover:text-ink"
        aria-label="Previous month"
      >
        <ChevronLeft size={18} />
      </button>
      <input
        type="month"
        value={month}
        onChange={(event) => setMonth(event.target.value)}
        className="bg-transparent text-sm font-semibold outline-none"
      />
      <button
        type="button"
        onClick={() => setMonth(shiftMonth(month, 1))}
        className="flex h-9 w-9 items-center justify-center rounded-full text-zinc-500 transition hover:bg-canvas hover:text-ink"
        aria-label="Next month"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  )
}

function Modal({ open, title, onClose, children }) {
  useEffect(() => {
    if (!open) return undefined

    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose, open])

  if (!open) return null
  return (
    <div className="overlay-enter fixed inset-0 z-40 flex items-end bg-black/30 p-3 sm:items-center sm:justify-center" onClick={onClose}>
      <div className="sheet-enter w-full max-w-lg rounded-t-[30px] bg-white p-5 shadow-panel sm:rounded-[30px] sm:p-6" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-full bg-canvas px-3 py-2 text-sm font-semibold text-zinc-500">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export default App
