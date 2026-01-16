'use client'

import { useEffect, useState } from 'react'
import Header from '@/components/Header'
import { customersApi } from '@/lib/api'
import { Users, Plus, Search, Filter, Edit, Trash2, Ban, Tag, MessageSquare, Phone, Mail, User, X, Check } from 'lucide-react'
import Link from 'next/link'

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
  createdAt: string
  updatedAt: string
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [filters, setFilters] = useState({
    status: '',
    search: '',
  })
  const [formData, setFormData] = useState<{
    phone: string
    name: string
    email: string
    dni: string
    status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'PENDING'
    segment: string
    preferredChannel: string
  }>({
    phone: '',
    name: '',
    email: '',
    dni: '',
    status: 'ACTIVE',
    segment: '',
    preferredChannel: '',
  })

  useEffect(() => {
    fetchCustomers()
  }, [filters])

  const fetchCustomers = async () => {
    try {
      setLoading(true)
      const data = await customersApi.getAll({
        status: filters.status || undefined,
        search: filters.search || undefined,
      })
      setCustomers(data.customers || [])
    } catch (error) {
      console.error('Error fetching customers:', error)
      setCustomers([])
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      await customersApi.create(formData)
      setShowCreateModal(false)
      resetForm()
      fetchCustomers()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al crear cliente')
    }
  }

  const handleUpdate = async () => {
    if (!selectedCustomer) return
    try {
      await customersApi.update(selectedCustomer.id, formData)
      setShowEditModal(false)
      setSelectedCustomer(null)
      resetForm()
      fetchCustomers()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al actualizar cliente')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de eliminar este cliente?')) return
    try {
      await customersApi.delete(id)
      fetchCustomers()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al eliminar cliente')
    }
  }

  const handleBlock = async (id: string) => {
    if (!confirm('¿Estás seguro de bloquear este cliente?')) return
    try {
      await customersApi.block(id)
      fetchCustomers()
    } catch (error: any) {
      alert(error.response?.data?.message || 'Error al bloquear cliente')
    }
  }

  const resetForm = () => {
    setFormData({
      phone: '',
      name: '',
      email: '',
      dni: '',
      status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'PENDING',
      segment: '',
      preferredChannel: '',
    })
  }

  const openEditModal = (customer: Customer) => {
    setSelectedCustomer(customer)
    setFormData({
      phone: customer.phone,
      name: customer.name || '',
      email: customer.email || '',
      dni: customer.dni || '',
      status: customer.status as 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | 'PENDING',
      segment: customer.segment || '',
      preferredChannel: customer.preferredChannel || '',
    })
    setShowEditModal(true)
  }

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      ACTIVE: { bg: 'bg-green-100', text: 'text-green-700' },
      INACTIVE: { bg: 'bg-gray-100', text: 'text-gray-700' },
      BLOCKED: { bg: 'bg-red-100', text: 'text-red-700' },
      PENDING: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
    }
    return config[status] || config.ACTIVE
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-gray-50">
      <Header />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg">
                <Users className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900">Gestión de Clientes</h1>
                <p className="text-gray-600 mt-1">Administra clientes, etiquetas y notas</p>
              </div>
            </div>
            <button
              onClick={() => {
                resetForm()
                setShowCreateModal(true)
              }}
              className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg"
            >
              <Plus className="w-5 h-5" />
              <span>Nuevo Cliente</span>
            </button>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Filter className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Filtros</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Buscar</label>
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nombre, teléfono, email, DNI..."
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="ACTIVE">Activo</option>
                <option value="INACTIVE">Inactivo</option>
                <option value="BLOCKED">Bloqueado</option>
                <option value="PENDING">Pendiente</option>
              </select>
            </div>
          </div>
        </div>

        {/* Lista de clientes */}
        {loading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent"></div>
            <p className="mt-4 text-gray-600 font-medium">Cargando clientes...</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-16 text-center">
            <Users className="w-20 h-20 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No hay clientes registrados</h3>
            <p className="text-gray-600 mb-6">Crea tu primer cliente para comenzar</p>
            <button
              onClick={() => {
                resetForm()
                setShowCreateModal(true)
              }}
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
            >
              Crear Cliente
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customers.map((customer) => {
              const statusConfig = getStatusBadge(customer.status)
              return (
                <div
                  key={customer.id}
                  className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                        {customer.name?.charAt(0).toUpperCase() || customer.phone.charAt(0)}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">
                          {customer.name || 'Sin nombre'}
                        </h3>
                        <div className="flex items-center space-x-1 text-sm text-gray-600">
                          <Phone className="w-4 h-4" />
                          <span>{customer.phone}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.text}`}>
                      {customer.status}
                    </span>
                  </div>

                  {/* Información adicional */}
                  <div className="space-y-2 mb-4">
                    {customer.email && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span>{customer.email}</span>
                      </div>
                    )}
                    {customer.dni && (
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span>DNI: {customer.dni}</span>
                      </div>
                    )}
                    {customer.segment && (
                      <div className="text-sm text-gray-600">
                        Segmento: <span className="font-semibold">{customer.segment}</span>
                      </div>
                    )}
                  </div>

                  {/* Etiquetas */}
                  {customer.tags && customer.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {customer.tags.map((tag) => (
                        <span
                          key={tag.id}
                          className={`px-2 py-1 rounded-lg text-xs font-medium ${getTagColor(tag.type)}`}
                        >
                          {tag.label}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="flex items-center space-x-2 pt-4 border-t border-gray-100">
                    <Link
                      href={`/cliente/${encodeURIComponent(customer.phone)}`}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all text-center"
                    >
                      Ver Perfil
                    </Link>
                    <button
                      onClick={() => openEditModal(customer)}
                      className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                      title="Editar"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {customer.status !== 'BLOCKED' && (
                      <button
                        onClick={() => handleBlock(customer.id)}
                        className="p-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-all"
                        title="Bloquear"
                      >
                        <Ban className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(customer.id)}
                      className="p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Modal Crear/Editar */}
        {(showCreateModal || showEditModal) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">
                    {showCreateModal ? 'Nuevo Cliente' : 'Editar Cliente'}
                  </h2>
                  <button
                    onClick={() => {
                      setShowCreateModal(false)
                      setShowEditModal(false)
                      setSelectedCustomer(null)
                      resetForm()
                    }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Teléfono *
                  </label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="+54123456789"
                    disabled={showEditModal}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">DNI</label>
                    <input
                      type="text"
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="ACTIVE">Activo</option>
                      <option value="INACTIVE">Inactivo</option>
                      <option value="BLOCKED">Bloqueado</option>
                      <option value="PENDING">Pendiente</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Segmento</label>
                    <input
                      type="text"
                      value={formData.segment}
                      onChange={(e) => setFormData({ ...formData, segment: e.target.value })}
                      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Ej: Premium, Standard"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Canal Preferido</label>
                  <select
                    value={formData.preferredChannel}
                    onChange={(e) => setFormData({ ...formData, preferredChannel: e.target.value })}
                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Sin preferencia</option>
                    <option value="CALL">Llamada</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="SMS">SMS</option>
                  </select>
                </div>
              </div>
              <div className="p-6 border-t border-gray-200 flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setShowEditModal(false)
                    setSelectedCustomer(null)
                    resetForm()
                  }}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={showCreateModal ? handleCreate : handleUpdate}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
                >
                  {showCreateModal ? 'Crear' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
