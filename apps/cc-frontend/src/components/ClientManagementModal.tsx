'use client'

import { useState, useEffect } from 'react'
import { customersApi } from '@/lib/api'
import { X, Tag, MessageSquare, Edit, Ban, Trash2, Plus, Check, XCircle } from 'lucide-react'
import Link from 'next/link'

interface ClientManagementModalProps {
  phone: string
  customerName?: string
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}

interface Customer {
  id: string
  phone: string
  name?: string
  email?: string
  dni?: string
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'PENDING'
  segment?: string
  preferredChannel?: string
  tags: Array<{
    id: string
    type: string
    label: string
    description?: string
    color?: string
  }>
  notes: Array<{
    id: string
    title?: string
    content: string
    isInternal: boolean
    createdAt: string
  }>
}

export default function ClientManagementModal({
  phone,
  customerName,
  isOpen,
  onClose,
  onUpdate,
}: ClientManagementModalProps) {
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'info' | 'tags' | 'notes'>('info')
  const [showAddTag, setShowAddTag] = useState(false)
  const [showAddNote, setShowAddNote] = useState(false)
  const [newTag, setNewTag] = useState({ type: 'CUSTOM', label: '', description: '' })
  const [newNote, setNewNote] = useState({ title: '', content: '', isInternal: false })
  const [editData, setEditData] = useState({
    name: '',
    email: '',
    dni: '',
    segment: '',
    preferredChannel: '',
  })

  useEffect(() => {
    if (isOpen) {
      fetchCustomer()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, phone])

  const fetchCustomer = async () => {
    try {
      setLoading(true)
      const data = await customersApi.getByPhone(phone)
      if (data) {
        setCustomer(data)
        setEditData({
          name: data.name || '',
          email: data.email || '',
          dni: data.dni || '',
          segment: data.segment || '',
          preferredChannel: data.preferredChannel || '',
        })
      }
    } catch (error) {
      console.error('Error fetching customer:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async () => {
    if (!customer) return
    try {
      await customersApi.update(customer.id, editData)
      await fetchCustomer()
      onUpdate()
      alert('Cliente actualizado correctamente')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al actualizar cliente')
    }
  }

  const handleAddTag = async () => {
    if (!customer || !newTag.label) return
    try {
      await customersApi.addTag(customer.id, newTag)
      setNewTag({ type: 'CUSTOM', label: '', description: '' })
      setShowAddTag(false)
      await fetchCustomer()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al agregar etiqueta')
    }
  }

  const handleRemoveTag = async (tagId: string) => {
    if (!customer) return
    if (!confirm('¿Eliminar esta etiqueta?')) return
    try {
      await customersApi.removeTag(customer.id, tagId)
      await fetchCustomer()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al eliminar etiqueta')
    }
  }

  const handleAddNote = async () => {
    if (!customer || !newNote.content) return
    try {
      await customersApi.addNote(customer.id, newNote)
      setNewNote({ title: '', content: '', isInternal: false })
      setShowAddNote(false)
      await fetchCustomer()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al agregar nota')
    }
  }

  const handleBlock = async () => {
    if (!customer) return
    if (!confirm('¿Estás seguro de bloquear este cliente?')) return
    try {
      await customersApi.block(customer.id)
      await fetchCustomer()
      onUpdate()
      alert('Cliente bloqueado')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al bloquear cliente')
    }
  }

  const handleDelete = async () => {
    if (!customer) return
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return
    try {
      await customersApi.delete(customer.id)
      onClose()
      onUpdate()
      alert('Cliente eliminado')
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al eliminar cliente')
    }
  }

  const getTagColor = (type: string) => {
    const colors: Record<string, string> = {
      PREFERRED: 'bg-green-100 text-green-700',
      VIP: 'bg-purple-100 text-purple-700',
      BLACKLIST: 'bg-red-100 text-red-700',
      FRAUD_RISK: 'bg-orange-100 text-orange-700',
      HIGH_VALUE: 'bg-blue-100 text-blue-700',
      COMPLAINT: 'bg-pink-100 text-pink-700',
      LOYAL: 'bg-indigo-100 text-indigo-700',
      NEW: 'bg-cyan-100 text-cyan-700',
      CUSTOM: 'bg-gray-100 text-gray-700',
    }
    return colors[type] || colors.CUSTOM
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Gestionar Cliente</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-blue-100 mt-1">{customerName || phone}</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <button
            onClick={() => setActiveTab('info')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'info'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Edit className="w-4 h-4 inline mr-2" />
            Información
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'tags'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Tag className="w-4 h-4 inline mr-2" />
            Etiquetas
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-6 py-3 font-semibold transition-all ${
              activeTab === 'notes'
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <MessageSquare className="w-4 h-4 inline mr-2" />
            Notas
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
              <p className="mt-4 text-gray-600">Cargando...</p>
            </div>
          ) : !customer ? (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">Cliente no encontrado en la base de datos</p>
              <Link
                href="/customers"
                className="inline-block px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700"
              >
                Crear Cliente
              </Link>
            </div>
          ) : (
            <>
              {/* Tab: Información */}
              {activeTab === 'info' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre</label>
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                      <input
                        type="email"
                        value={editData.email}
                        onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">DNI</label>
                      <input
                        type="text"
                        value={editData.dni}
                        onChange={(e) => setEditData({ ...editData, dni: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Segmento</label>
                      <input
                        type="text"
                        value={editData.segment}
                        onChange={(e) => setEditData({ ...editData, segment: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Canal Preferido</label>
                      <select
                        value={editData.preferredChannel}
                        onChange={(e) => setEditData({ ...editData, preferredChannel: e.target.value })}
                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Sin preferencia</option>
                        <option value="CALL">Llamada</option>
                        <option value="WHATSAPP">WhatsApp</option>
                        <option value="SMS">SMS</option>
                      </select>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600 mb-4">Estado: <span className="font-semibold">{customer.status}</span></p>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={handleUpdate}
                        className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
                      >
                        Guardar Cambios
                      </button>
                      {customer.status !== 'BLOCKED' && (
                        <button
                          onClick={handleBlock}
                          className="px-6 py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-all"
                        >
                          <Ban className="w-4 h-4 inline mr-2" />
                          Bloquear
                        </button>
                      )}
                      <button
                        onClick={handleDelete}
                        className="px-6 py-3 bg-gray-600 text-white rounded-xl font-semibold hover:bg-gray-700 transition-all"
                      >
                        <Trash2 className="w-4 h-4 inline mr-2" />
                        Eliminar
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Etiquetas */}
              {activeTab === 'tags' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Etiquetas del Cliente</h3>
                    <button
                      onClick={() => setShowAddTag(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Etiqueta</span>
                    </button>
                  </div>

                  {showAddTag && (
                    <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Tipo</label>
                          <select
                            value={newTag.type}
                            onChange={(e) => setNewTag({ ...newTag, type: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2"
                          >
                            <option value="PREFERRED">Preferente</option>
                            <option value="VIP">VIP</option>
                            <option value="BLACKLIST">Lista Negra</option>
                            <option value="FRAUD_RISK">Riesgo de Fraude</option>
                            <option value="HIGH_VALUE">Alto Valor</option>
                            <option value="COMPLAINT">Queja</option>
                            <option value="LOYAL">Leal</option>
                            <option value="NEW">Nuevo</option>
                            <option value="CUSTOM">Personalizada</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Etiqueta</label>
                          <input
                            type="text"
                            value={newTag.label}
                            onChange={(e) => setNewTag({ ...newTag, label: e.target.value })}
                            placeholder="Ej: Cliente Preferente"
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={handleAddTag}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            <Check className="w-4 h-4 inline mr-2" />
                            Agregar
                          </button>
                          <button
                            onClick={() => {
                              setShowAddTag(false)
                              setNewTag({ type: 'CUSTOM', label: '', description: '' })
                            }}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                          >
                            <XCircle className="w-4 h-4 inline mr-2" />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    {customer.tags && customer.tags.length > 0 ? (
                      customer.tags.map((tag) => (
                        <div
                          key={tag.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                        >
                          <div>
                            <span className={`px-3 py-1 rounded-lg text-sm font-medium ${getTagColor(tag.type)}`}>
                              {tag.label}
                            </span>
                            {tag.description && (
                              <p className="text-sm text-gray-600 mt-1">{tag.description}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleRemoveTag(tag.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-8">No hay etiquetas asignadas</p>
                    )}
                  </div>
                </div>
              )}

              {/* Tab: Notas */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Notas del Cliente</h3>
                    <button
                      onClick={() => setShowAddNote(true)}
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Agregar Nota</span>
                    </button>
                  </div>

                  {showAddNote && (
                    <div className="bg-gray-50 p-4 rounded-xl border-2 border-gray-200">
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Título (opcional)</label>
                          <input
                            type="text"
                            value={newNote.title}
                            onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Contenido *</label>
                          <textarea
                            value={newNote.content}
                            onChange={(e) => setNewNote({ ...newNote, content: e.target.value })}
                            rows={4}
                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2"
                          />
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={newNote.isInternal}
                            onChange={(e) => setNewNote({ ...newNote, isInternal: e.target.checked })}
                            className="w-4 h-4"
                          />
                          <label className="text-sm text-gray-700">Nota interna (solo visible para agentes)</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={handleAddNote}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                          >
                            <Check className="w-4 h-4 inline mr-2" />
                            Agregar
                          </button>
                          <button
                            onClick={() => {
                              setShowAddNote(false)
                              setNewNote({ title: '', content: '', isInternal: false })
                            }}
                            className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
                          >
                            <XCircle className="w-4 h-4 inline mr-2" />
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {customer.notes && customer.notes.length > 0 ? (
                      customer.notes.map((note) => (
                        <div
                          key={note.id}
                          className={`p-4 rounded-xl border-2 ${
                            note.isInternal ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-200'
                          }`}
                        >
                          {note.title && (
                            <h4 className="font-semibold text-gray-900 mb-2">{note.title}</h4>
                          )}
                          <p className="text-gray-700 whitespace-pre-line">{note.content}</p>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                            <span className="text-xs text-gray-500">
                              {new Date(note.createdAt).toLocaleDateString('es-AR')}
                            </span>
                            {note.isInternal && (
                              <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">
                                Interna
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-gray-500 text-center py-8">No hay notas registradas</p>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
