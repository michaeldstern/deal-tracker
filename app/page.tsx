'use client'

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

type Deal = {
  id: string
  name: string
  asset_type: 'storage' | 'carwash'
  market: string
  state: string
  price: number
  cap_rate: number
  units: number
  equity: number
  pure_storage: boolean
  status: string
  source: string
  notes: string
  created_at: string
}

type Comment = {
  id: string
  deal_id: string
  author: string
  body: string
  created_at: string
}

const STORAGE_CRITERIA = { minCap: 7, minPrice: 2000000, maxPrice: 2500000 }
const CARWASH_CRITERIA = { minPrice: 1000000, maxPrice: 3000000 }

const STATUS_COLORS: Record<string, string> = {
  Prospect: 'bg-blue-100 text-blue-800',
  LOI: 'bg-yellow-100 text-yellow-800',
  'Due diligence': 'bg-purple-100 text-purple-800',
  Passed: 'bg-gray-100 text-gray-600',
  Closed: 'bg-green-100 text-green-800',
}

export default function Home() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [filter, setFilter] = useState('all')
  const [assetFilter, setAssetFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editDeal, setEditDeal] = useState<Deal | null>(null)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [newComment, setNewComment] = useState('')
  const [commentAuthor, setCommentAuthor] = useState('')
  const [form, setForm] = useState<Partial<Deal>>({ asset_type: 'storage', status: 'Prospect' })

  useEffect(() => { fetchDeals() }, [])

  async function fetchDeals() {
    const { data } = await supabase.from('deals').select('*').order('created_at', { ascending: false })
    if (data) setDeals(data)
  }

  async function fetchComments(dealId: string) {
    const { data } = await supabase.from('comments').select('*').eq('deal_id', dealId).order('created_at')
    if (data) setComments(prev => ({ ...prev, [dealId]: data }))
  }

  async function saveDeal() {
    if (!form.name) return
    if (editDeal) {
      await supabase.from('deals').update(form).eq('id', editDeal.id)
    } else {
      await supabase.from('deals').insert([form])
    }
    setShowModal(false)
    setEditDeal(null)
    setForm({ asset_type: 'storage', status: 'Prospect' })
    fetchDeals()
  }

  async function deleteDeal(id: string) {
    await supabase.from('deals').delete().eq('id', id)
    fetchDeals()
    if (selectedDeal?.id === id) setSelectedDeal(null)
  }

  async function addComment() {
    if (!newComment || !selectedDeal || !commentAuthor) return
    await supabase.from('comments').insert([{ deal_id: selectedDeal.id, author: commentAuthor, body: newComment }])
    setNewComment('')
    fetchComments(selectedDeal.id)
  }

  function openEdit(deal: Deal) {
    setEditDeal(deal)
    setForm(deal)
    setShowModal(true)
  }

  function openDetail(deal: Deal) {
    setSelectedDeal(deal)
    fetchComments(deal.id)
  }

  function passFlags(deal: Deal) {
    const flags = []
    if (deal.asset_type === 'storage') {
      if (deal.cap_rate) flags.push({ ok: deal.cap_rate >= STORAGE_CRITERIA.minCap, label: `Cap ${deal.cap_rate}%` })
      if (deal.price) flags.push({ ok: deal.price >= STORAGE_CRITERIA.minPrice && deal.price <= STORAGE_CRITERIA.maxPrice, label: `$${(deal.price/1000000).toFixed(1)}M` })
    } else {
      if (deal.price) flags.push({ ok: deal.price >= CARWASH_CRITERIA.minPrice && deal.price <= CARWASH_CRITERIA.maxPrice, label: `$${(deal.price/1000000).toFixed(1)}M` })
    }
    return flags
  }

  const filtered = deals.filter(d => {
    if (assetFilter !== 'all' && d.asset_type !== assetFilter) return false
    if (filter !== 'all' && d.status !== filter) return false
    return true
  })

  const metrics = {
    total: deals.length,
    active: deals.filter(d => !['Passed','Closed'].includes(d.status)).length,
    storage: deals.filter(d => d.asset_type === 'storage').length,
    carwash: deals.filter(d => d.asset_type === 'carwash').length,
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Deal Tracker</h1>
            <p className="text-sm text-gray-500">Self-Storage & Car Wash Acquisitions</p>
          </div>
          <button onClick={() => { setEditDeal(null); setForm({ asset_type: 'storage', status: 'Prospect' }); setShowModal(true) }}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
            + Add Deal
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Deals', val: metrics.total },
            { label: 'Active', val: metrics.active },
            { label: 'Storage', val: metrics.storage },
            { label: 'Car Wash', val: metrics.carwash },
          ].map(m => (
            <div key={m.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="text-sm text-gray-500">{m.label}</div>
              <div className="text-3xl font-semibold text-gray-900 mt-1">{m.val}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {['all','storage','carwash'].map(f => (
            <button key={f} onClick={() => setAssetFilter(f)}
              className={`px-3 py-1 rounded-full text-sm border ${assetFilter===f ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
              {f === 'all' ? 'All Assets' : f === 'storage' ? '🏢 Storage' : '🚗 Car Wash'}
            </button>
          ))}
          <div className="w-px bg-gray-200 mx-1" />
          {['all','Prospect','LOI','Due diligence','Passed','Closed'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-sm border ${filter===f ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>
              {f === 'all' ? 'All Status' : f}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Property','Type','Market','Price','Cap Rate','Units','Status','Flags',''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-400">No deals yet. Add your first one.</td></tr>
              ) : filtered.map(deal => (
                <tr key={deal.id} className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(deal)}>
                  <td className="px-4 py-3 font-medium text-gray-900">{deal.name}<div className="text-xs text-gray-400">{deal.source}</div></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${deal.asset_type === 'storage' ? 'bg-indigo-100 text-indigo-700' : 'bg-cyan-100 text-cyan-700'}`}>{deal.asset_type === 'storage' ? 'Storage' : 'Car Wash'}</span></td>
                  <td className="px-4 py-3 text-gray-600">{deal.market}{deal.state ? `, ${deal.state}` : ''}</td>
                  <td className="px-4 py-3 text-gray-600">{deal.price ? `$${Number(deal.price).toLocaleString()}` : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{deal.cap_rate ? `${deal.cap_rate}%` : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{deal.units || '—'}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[deal.status]}`}>{deal.status}</span></td>
                  <td className="px-4 py-3">{passFlags(deal).map((f,i) => <div key={i} className={`text-xs ${f.ok ? 'text-green-600' : 'text-red-500'}`}>{f.ok ? '✓' : '✗'} {f.label}</div>)}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(deal)} className="text-gray-400 hover:text-gray-600 mr-2">✏️</button>
                    <button onClick={() => deleteDeal(deal.id)} className="text-gray-400 hover:text-red-500">🗑️</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Deal Detail Sidebar */}
        {selectedDeal && (
          <div className="fixed inset-0 bg-black/30 z-40 flex justify-end" onClick={() => setSelectedDeal(null)}>
            <div className="bg-white w-full max-w-md h-full overflow-y-auto p-6 shadow-xl" onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedDeal.name}</h2>
                  <p className="text-sm text-gray-500">{selectedDeal.market}{selectedDeal.state ? `, ${selectedDeal.state}` : ''}</p>
                </div>
                <button onClick={() => setSelectedDeal(null)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-6">
                {[
                  ['Price', selectedDeal.price ? `$${Number(selectedDeal.price).toLocaleString()}` : '—'],
                  ['Cap Rate', selectedDeal.cap_rate ? `${selectedDeal.cap_rate}%` : '—'],
                  ['Units', selectedDeal.units || '—'],
                  ['Equity', selectedDeal.equity ? `$${Number(selectedDeal.equity).toLocaleString()}` : '—'],
                  ['Status', selectedDeal.status],
                  ['Source', selectedDeal.source || '—'],
                ].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="text-sm font-medium text-gray-900 mt-0.5">{val}</div>
                  </div>
                ))}
              </div>
              {selectedDeal.notes && <div className="mb-6"><div className="text-xs text-gray-500 mb-1">Notes</div><p className="text-sm text-gray-700">{selectedDeal.notes}</p></div>}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Comments</h3>
                {(comments[selectedDeal.id] || []).map(c => (
                  <div key={c.id} className="mb-3 bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">{c.author} · {new Date(c.created_at).toLocaleDateString()}</div>
                    <div className="text-sm text-gray-700">{c.body}</div>
                  </div>
                ))}
                <div className="mt-3 space-y-2">
                  <input value={commentAuthor} onChange={e => setCommentAuthor(e.target.value)} placeholder="Your name" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Add a comment..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" rows={3} />
                  <button onClick={addComment} className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Post Comment</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 overflow-y-auto max-h-screen" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold mb-4">{editDeal ? 'Edit Deal' : 'Add Deal'}</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><label className="text-xs text-gray-500">Property Name *</label><input value={form.name||''} onChange={e => setForm({...form, name: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
                <div><label className="text-xs text-gray-500">Asset Type</label>
                  <select value={form.asset_type} onChange={e => setForm({...form, asset_type: e.target.value as 'storage'|'carwash'})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
                    <option value="storage">Storage</option>
                    <option value="carwash">Car Wash</option>
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Status</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
                    {['Prospect','LOI','Due diligence','Passed','Closed'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div><label className="text-xs text-gray-500">Market / City</label><input value={form.market||''} onChange={e => setForm({...form, market: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
                <div><label className="text-xs text-gray-500">State</label><input value={form.state||''} onChange={e => setForm({...form, state: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
                <div><label className="text-xs text-gray-500">Price ($)</label><input type="number" value={form.price||''} onChange={e => setForm({...form, price: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
                <div><label className="text-xs text-gray-500">Cap Rate (%)</label><input type="number" step="0.1" value={form.cap_rate||''} onChange={e => setForm({...form, cap_rate: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
                <div><label className="text-xs text-gray-500">Units</label><input type="number" value={form.units||''} onChange={e => setForm({...form, units: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
                <div><label className="text-xs text-gray-500">Equity ($)</label><input type="number" value={form.equity||''} onChange={e => setForm({...form, equity: Number(e.target.value)})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
                <div><label className="text-xs text-gray-500">Source</label><input value={form.source||''} onChange={e => setForm({...form, source: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" /></div>
                <div className="col-span-2"><label className="text-xs text-gray-500">Notes</label><textarea value={form.notes||''} onChange={e => setForm({...form, notes: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" rows={3} /></div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                <button onClick={saveDeal} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Deal</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
