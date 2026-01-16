# Capacidades Funcionales del Contact Center Demo

## 📋 Descripción General

Sistema de Contact Center bancario que centraliza y gestiona todas las interacciones con clientes a través de múltiples canales de comunicación (llamadas, WhatsApp, SMS), proporcionando un dashboard unificado, gestión de OTP, sincronización automática y auditoría completa.

---

## 🎯 Canales de Comunicación Soportados

### 1. **Llamadas Telefónicas (ElevenLabs)**
- **Recepción de llamadas**: Webhooks en tiempo real desde ElevenLabs
- **Registro automático**: Cada llamada se registra como una interacción
- **Transcripciones**: Almacenamiento automático de transcripciones completas
- **Grabaciones**: URLs de grabaciones de audio almacenadas
- **Resúmenes**: Resúmenes generados por IA de cada conversación
- **Duración**: Tiempo de duración de cada llamada
- **Estado de llamada**: NEW, IN_PROGRESS, COMPLETED, ABANDONED, FAILED
- **Sincronización**: Sincronización automática cada 5 minutos y manual desde API
- **Detalles adicionales**: 
  - Motivo de cierre (hangupReason)
  - Agente asignado
  - Intent (intención detectada)
  - Outcome (resultado: RESOLVED, ESCALATED, TICKETED, TRANSFERRED, UNKNOWN)
  - Cola de atención
  - Referencia de cliente

### 2. **WhatsApp (BuilderBot.cloud)**
- **Mensajes entrantes (INBOUND)**: Recepción automática vía webhooks
- **Mensajes salientes (OUTBOUND)**: Envío programático desde la API
- **Agrupación inteligente**: 
  - Los mensajes se agrupan en la misma interacción si hay actividad en las últimas 24 horas
  - Después de 24 horas de inactividad, se crea una nueva interacción
- **Mensajes multimedia**: Soporte para archivos adjuntos (imágenes, documentos, audio)
- **Estado de mensajes**: Seguimiento de estado de entrega
- **Normalización de números**: Normalización automática de números de teléfono (formato internacional)
- **Historial completo**: Todos los mensajes de una conversación se almacenan en orden cronológico
- **Asignación de agentes**: Cada interacción puede tener un agente asignado

### 3. **SMS (Twilio)**
- **Envío de SMS personalizados**: Mensajes de texto personalizados a clientes
- **Envío de códigos OTP**: Generación y envío automático de códigos de verificación
- **Links de verificación**: Envío de enlaces de verificación de identidad
- **Links de onboarding**: Envío de enlaces para completar registro
- **Instructivos**: Envío de mensajes predefinidos (ej: activación de tarjeta)
- **Estado de entrega**: Webhooks de Twilio para actualizar estado (sent, delivered, failed)
- **Procesamiento asíncrono**: Los SMS se procesan mediante cola de trabajos (BullMQ + Redis)
- **Rate limiting**: Control de límites de envío para prevenir spam

---

## 📊 Gestión de Interacciones

### **Modelo de Datos Unificado**
Todas las interacciones (llamadas, WhatsApp, SMS) se almacenan en un modelo unificado con:
- **Identificador único**: UUID para cada interacción
- **Canal**: CALL, WHATSAPP, SMS
- **Dirección**: INBOUND (cliente inicia) o OUTBOUND (sistema inicia)
- **Estado**: NEW, IN_PROGRESS, COMPLETED, ABANDONED, FAILED
- **Timestamps**: startedAt, endedAt, createdAt, updatedAt
- **Información de contacto**: from, to (números de teléfono)
- **Metadata**: 
  - provider (ELEVENLABS, BUILDERBOT, TWILIO)
  - providerConversationId (ID único del proveedor)
  - assignedAgent (agente asignado)
  - customerRef (referencia del cliente)
  - queue (cola de atención)
  - intent (intención detectada)
  - outcome (resultado)
  - aiHandled (si fue manejada por IA)

### **Operaciones Disponibles**
- **Listar interacciones**: Con filtros avanzados (canal, dirección, estado, fecha, agente, proveedor)
- **Obtener detalle**: Información completa de una interacción específica
- **Contar interacciones**: Estadísticas con los mismos filtros
- **Perfil de cliente**: Vista consolidada de todas las interacciones de un cliente
- **Actualización automática**: El campo `updatedAt` se actualiza automáticamente con cada mensaje/evento
- **Ordenamiento**: Las interacciones se ordenan por `updatedAt` descendente (más recientes primero)

---

## 🔐 Sistema de OTP (One-Time Password)

### **Propósitos Soportados**
- **PASSWORD_RESET**: Restablecimiento de contraseña
- **TX_CONFIRMATION**: Confirmación de transacciones
- **IDENTITY_VERIFICATION**: Verificación de identidad
- **LOGIN_2FA**: Autenticación de dos factores

### **Características de Seguridad**
- **Hash seguro**: Los códigos se almacenan con hash (Argon2), nunca en texto plano
- **Expiración**: Códigos expiran después de un tiempo configurable (default: 5 minutos)
- **Límite de intentos**: Máximo de intentos de verificación (default: 5)
- **Rate limiting**: Límite de solicitudes por teléfono y propósito (default: 3 por 15 minutos)
- **Estado del desafío**: PENDING, SENT, VERIFIED, EXPIRED, LOCKED, FAILED
- **Correlación**: Cada OTP tiene un correlationId único para rastreo
- **Asociación con interacción**: Cada OTP se asocia a una interacción SMS

### **Flujo de Trabajo**
1. Crear OTP challenge → Genera código, lo hashea, crea registro en BD
2. Encolar envío SMS → Job asíncrono envía el código por SMS
3. Verificar código → Cliente ingresa código, se verifica contra hash
4. Actualizar estado → El estado cambia a VERIFIED o FAILED según corresponda

---

## 📱 Funcionalidades de WhatsApp

### **Envío de Mensajes**
- **API REST**: Endpoint para enviar mensajes programáticamente
- **Búsqueda inteligente**: Busca interacción existente o crea nueva
- **Normalización**: Normaliza números de teléfono automáticamente
- **Asignación de agente**: Permite asignar un agente al enviar mensaje
- **Verificación**: Endpoint de diagnóstico para verificar mensajes de una interacción

### **Recepción de Mensajes**
- **Webhook en tiempo real**: Recibe mensajes entrantes y salientes
- **Idempotencia**: Previene duplicados mediante idempotencyKey
- **Manejo de errores**: Logging detallado para diagnóstico
- **Múltiples formatos**: Soporta diferentes estructuras de payload de BuilderBot

---

## 📨 Funcionalidades de SMS

### **Tipos de SMS Disponibles**
1. **SMS Personalizado**: Mensaje de texto libre
2. **Código OTP**: Generación y envío automático
3. **Link de Verificación**: Enlace para verificar identidad
4. **Link de Onboarding**: Enlace para completar registro
5. **Instructivo de Activación**: Mensaje predefinido para activar tarjeta

### **Procesamiento**
- **Cola de trabajos**: Procesamiento asíncrono con BullMQ
- **Worker dedicado**: Procesa jobs de SMS en background
- **Reintentos**: Manejo automático de errores y reintentos
- **Logging**: Registro detallado de cada envío

---

## 🔄 Sincronización y Actualización

### **Sincronización Automática (ElevenLabs)**
- **Cron job**: Se ejecuta cada 5 minutos automáticamente
- **Ventana de tiempo**: Sincroniza llamadas de las últimas 2 horas
- **Actualización de detalles**: Actualiza transcripciones, grabaciones y resúmenes
- **Prevención de duplicados**: Verifica si la interacción ya existe antes de crear

### **Sincronización Manual**
- **Endpoint API**: Permite ejecutar sincronización completa manualmente
- **Rango configurable**: Últimas 24 horas (configurable)
- **Límite configurable**: Máximo de conversaciones a sincronizar (default: 500)
- **Sincronización de detalles**: Opción para sincronizar detalles completos o solo metadata

### **Actualización de Detalles de Llamadas**
- **Refresh manual**: Endpoint para actualizar detalles de una llamada específica
- **Fetch desde API**: Obtiene transcripción, resumen y grabación desde ElevenLabs
- **Actualización automática**: Se actualiza cuando se recibe webhook con nueva información

---

## 🎨 Dashboard y Frontend

### **Vista Principal (Dashboard)**
- **Métricas en tiempo real**: 
  - Total de interacciones del día
  - Interacciones por canal (CALL, WHATSAPP, SMS)
  - Interacciones por estado
  - Interacciones por dirección (INBOUND/OUTBOUND)
- **Gráficos**: Visualización de distribución de interacciones
- **Tabla de agentes**: Actividad por agente asignado
- **Interacciones recientes**: Lista de últimas interacciones
- **Auto-refresh**: Actualización automática cada 30 segundos

### **Vistas Específicas por Canal**
- **Vista de Llamadas**: Lista filtrada de todas las llamadas
- **Vista de WhatsApp**: Lista de conversaciones de WhatsApp con auto-refresh cada 10 segundos
- **Vista de SMS**: Interfaz para enviar SMS y ver historial

### **Vista de Detalle de Interacción**
- **Información completa**: Todos los datos de la interacción
- **Mensajes**: Historial completo de mensajes (WhatsApp/SMS) en orden cronológico
- **Eventos**: Timeline de eventos asociados
- **Detalles de llamada**: Transcripción, resumen, grabación, duración
- **Envío de mensajes**: Permite enviar mensajes WhatsApp desde la vista de detalle
- **Auto-refresh**: Actualización automática cada 5 segundos para ver nuevos mensajes

### **Vista de Cliente**
- **Perfil consolidado**: Todas las interacciones de un cliente
- **Estadísticas**: Métricas de interacciones del cliente
- **Historial completo**: Timeline de todas las comunicaciones

---

## 🔍 Búsqueda y Filtrado

### **Filtros Disponibles**
- **Por canal**: CALL, WHATSAPP, SMS
- **Por dirección**: INBOUND, OUTBOUND
- **Por estado**: NEW, IN_PROGRESS, COMPLETED, ABANDONED, FAILED
- **Por número**: from, to (búsqueda parcial)
- **Por fecha**: dateFrom, dateTo (rango de fechas)
- **Por agente**: assignedAgent
- **Por proveedor**: ELEVENLABS, BUILDERBOT, TWILIO, GENERIC

### **Paginación**
- **Límite**: Número de resultados por página (default: 100)
- **Skip**: Número de resultados a saltar (paginación)

### **Inclusión de Datos**
- **includeAllEvents**: Incluir todos los eventos (default: últimos 10)
- **includeAllMessages**: Incluir todos los mensajes (default: últimos 10)
- **includePII**: Incluir información personal identificable sin enmascarar

---

## 🔒 Seguridad y Privacidad

### **Enmascaramiento de PII (Personal Identifiable Information)**
- **Enmascaramiento automático**: Números de teléfono se enmascaran por defecto
- **Control por rol**: Los administradores pueden ver PII sin enmascarar
- **Header de rol**: Control mediante header `X-Role: admin`
- **Configuración**: Variable de entorno `PII_MASKING_ENABLED`

### **Validación de Webhooks**
- **Tokens de autenticación**: Cada webhook valida token en header
- **ElevenLabs**: `X-Webhook-Token`
- **BuilderBot**: `X-Webhook-Token`
- **Twilio**: `X-Webhook-Token` (opcional, también usa firma)

### **Idempotencia**
- **Claves únicas**: Cada evento tiene un idempotencyKey único
- **Prevención de duplicados**: Evita procesar el mismo evento dos veces
- **Índice único**: Base de datos garantiza unicidad

### **Auditoría**
- **Logs de auditoría**: Todas las acciones importantes se registran
- **Información capturada**:
  - Tipo de actor (USER, SYSTEM, AGENT)
  - ID del actor
  - Acción realizada
  - Tipo de entidad afectada
  - ID de entidad
  - IP y User-Agent
  - Metadata adicional (JSON)

---

## 📈 Eventos y Tracking

### **InteractionEvent**
Cada interacción puede tener múltiples eventos asociados:
- **Tipo de evento**: Identificador del tipo de evento
- **Timestamp**: Fecha y hora del evento
- **Payload completo**: JSON con datos raw del proveedor
- **Payload normalizado**: Datos estructurados normalizados
- **Provider Event ID**: ID del evento en el sistema del proveedor
- **Idempotency Key**: Clave única para prevenir duplicados

### **Eventos Automáticos**
- **Creación de interacción**: Evento cuando se crea una nueva interacción
- **Actualización de estado**: Evento cuando cambia el estado
- **Recepción de mensaje**: Evento cuando llega un mensaje
- **Envío de mensaje**: Evento cuando se envía un mensaje
- **Cambio de agente**: Evento cuando se asigna un agente
- **Finalización**: Evento cuando se completa una interacción

---

## 🛠️ API y Endpoints

### **Health Check**
- `GET /api/health`: Estado general del servicio
- `GET /api/health/tables`: Lista de tablas en la base de datos
- `GET /__whoami`: Identificación del servicio (nombre, Railway info, puerto)

### **Interacciones**
- `GET /api/interactions`: Listar interacciones (con filtros)
- `GET /api/interactions/:id`: Detalle de interacción
- `GET /api/interactions/count`: Contar interacciones
- `GET /api/interactions/client/:phone`: Perfil completo del cliente

### **WhatsApp**
- `POST /api/whatsapp/send`: Enviar mensaje WhatsApp
- `POST /api/whatsapp/diagnostic`: Diagnóstico de interacción

### **SMS**
- `POST /api/sms/send`: Enviar SMS personalizado
- `POST /api/sms/otp`: Enviar código OTP
- `POST /api/sms/verification-link`: Enviar link de verificación
- `POST /api/sms/onboarding`: Enviar link de onboarding
- `POST /api/sms/activate-card`: Enviar instructivo de activación

### **OTP**
- `POST /api/otp`: Crear OTP challenge
- `POST /api/otp/verify`: Verificar código OTP

### **ElevenLabs**
- `GET /api/elevenlabs/conversations`: Listar todas las conversaciones
- `GET /api/elevenlabs/conversations/:conversationId`: Detalles de conversación
- `GET /api/elevenlabs/audio/:conversationId`: Obtener audio de conversación
- `POST /api/elevenlabs/sync`: Sincronizar llamadas desde API

### **Sincronización**
- `POST /api/sync/full`: Sincronización completa manual

### **Webhooks**
- `POST /webhooks/elevenlabs/call`: Webhook de llamadas ElevenLabs
- `POST /webhooks/builderbot/whatsapp`: Webhook de WhatsApp BuilderBot
- `POST /webhooks/twilio/sms/status`: Webhook de estado SMS Twilio

### **Documentación**
- `GET /api/docs`: Documentación Swagger/OpenAPI interactiva

---

## 🗄️ Modelo de Datos

### **Interaction**
Modelo principal que representa cualquier interacción con un cliente.

### **Message**
Mensajes individuales dentro de una interacción (WhatsApp o SMS).

### **CallDetail**
Detalles específicos de llamadas telefónicas (transcripción, grabación, resumen).

### **InteractionEvent**
Eventos asociados a interacciones (webhooks, cambios de estado, etc.).

### **OtpChallenge**
Desafíos OTP para autenticación/verificación.

### **AuditLog**
Logs de auditoría de todas las acciones importantes.

---

## ⚙️ Configuración y Variables de Entorno

### **Base de Datos**
- `DATABASE_URL`: URL de conexión a PostgreSQL

### **Redis**
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`: Configuración de Redis

### **ElevenLabs**
- `ELEVENLABS_WEBHOOK_TOKEN`: Token para validar webhooks
- `ELEVENLABS_API_KEY`: API key de ElevenLabs
- `ELEVENLABS_AGENT_ID`: ID del agente de voz
- `ELEVENLABS_API_URL`: URL de la API (default: https://api.elevenlabs.io)

### **BuilderBot**
- `BUILDERBOT_WEBHOOK_TOKEN`: Token para validar webhooks
- `BUILDERBOT_API_URL`: URL de la API
- `BUILDERBOT_API_KEY`: API key

### **Twilio**
- `TWILIO_ACCOUNT_SID`: Account SID
- `TWILIO_AUTH_TOKEN`: Auth Token
- `TWILIO_FROM_NUMBER`: Número de teléfono emisor
- `TWILIO_WEBHOOK_TOKEN`: Token para validar webhooks

### **OTP**
- `OTP_TTL_SECONDS`: Tiempo de expiración (default: 300)
- `OTP_MAX_ATTEMPTS`: Máximo de intentos (default: 5)
- `OTP_RATE_LIMIT_WINDOW_SECONDS`: Ventana de rate limiting (default: 900)
- `OTP_RATE_LIMIT_MAX`: Máximo de OTPs por ventana (default: 3)

### **Aplicación**
- `APP_PORT`: Puerto del servidor (default: 3000)
- `PII_MASKING_ENABLED`: Habilitar enmascaramiento de PII (default: true)
- `FRONTEND_URL`: URL del frontend (para links)

---

## 🚀 Despliegue

### **Backend (Railway)**
- Servicio único que incluye API y worker de SMS
- Migraciones automáticas al iniciar
- Health checks integrados
- Logging estructurado (JSON)

### **Frontend (Vercel)**
- Next.js con auto-refresh
- Consumo de API del backend
- Responsive design

---

## 📝 Características Adicionales

### **Logging Detallado**
- Logging estructurado en formato JSON
- Niveles de log: ERROR, WARN, INFO, DEBUG
- Contexto completo en cada log
- Stack traces en errores

### **Manejo de Errores**
- Errores descriptivos con códigos HTTP apropiados
- Validación de datos de entrada
- Manejo de errores de proveedores externos
- Logging de errores para diagnóstico

### **Normalización de Datos**
- Adapters para cada proveedor normalizan payloads
- Formato consistente independientemente del proveedor
- Tolerancia a diferentes formatos de payload

### **Performance**
- Índices en base de datos para consultas rápidas
- Paginación para grandes volúmenes
- Procesamiento asíncrono de SMS
- Caché de datos cuando es apropiado

---

## 🎯 Casos de Uso Principales

1. **Atención al Cliente**: Gestionar todas las interacciones con clientes desde un solo lugar
2. **Verificación de Identidad**: Envío y verificación de códigos OTP
3. **Notificaciones Transaccionales**: Envío de SMS para confirmaciones y alertas
4. **Seguimiento de Conversaciones**: Historial completo de comunicaciones por cliente
5. **Análisis y Reportes**: Métricas y estadísticas de interacciones
6. **Auditoría y Compliance**: Logs completos de todas las acciones
7. **Automatización**: Respuestas automáticas y gestión de colas

---

## 🔮 Extensiones Futuras (No Implementadas)

- Autenticación JWT para endpoints de consola
- Métricas agregadas (endpoints de dashboard)
- Más validaciones y tests automatizados
- Integración con más proveedores
- Chat en vivo con agentes
- Análisis de sentimiento
- Routing inteligente de interacciones
