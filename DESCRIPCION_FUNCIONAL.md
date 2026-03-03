# Descripción funcional — Contact Center Demo

## 1. Propósito del sistema

**Contact Center Demo** es una solución de **centro de contacto bancario** que unifica en un solo lugar la gestión de:

- **Llamadas** (voz, vía ElevenLabs)
- **WhatsApp** (builderbot.cloud)
- **SMS** (transaccional y OTP con Twilio)

El sistema registra todas las interacciones, las asocia a clientes (por teléfono), permite consultar historial y métricas, y ofrece flujos de OTP y envío de mensajes desde una consola web.

---

## 2. Usuarios y roles

- **Agentes / operadores**: consultan interacciones, ven historial por cliente, envían mensajes (WhatsApp/SMS) y gestionan clientes.
- **Administradores**: mismo acceso que agentes; además pueden ver datos PII sin enmascarar (cuando está habilitado el masking).
- **Sistemas externos**: envían eventos vía webhooks (ElevenLabs, BuilderBot, Twilio) para crear/actualizar interacciones.

No hay autenticación JWT implementada aún; el rol se indica con el header `X-Role: admin` donde aplica.

---

## 3. Canales de contacto

| Canal      | Proveedor   | Entrada de datos                    | Salida (desde la app)        |
|-----------|-------------|-------------------------------------|------------------------------|
| **Llamadas** | ElevenLabs  | Webhook al finalizar/eventos de llamada | Solo consulta (grabación, transcripción, resumen) |
| **WhatsApp** | BuilderBot  | Webhook por mensajes entrantes      | Envío de mensajes de texto   |
| **SMS**      | Twilio      | Webhook de estado (entregado, etc.) | Envío de SMS y OTP           |

Todas las interacciones se guardan con: canal, dirección (entrante/saliente), estado, fechas, teléfonos, agente asignado, proveedor e identificador de conversación en el proveedor.

---

## 4. Funcionalidades principales

### 4.1 Registro y consulta de interacciones

- **Alta de interacciones**: vía webhooks desde ElevenLabs, BuilderBot y Twilio. Los adapters normalizan los payloads y crean o actualizan `Interaction`, `InteractionEvent`, `Message` y `CallDetail` según el tipo de evento.
- **Listado**: filtros por canal, dirección, estado, rango de fechas, teléfono (from/to), agente, proveedor; paginación con `limit`/`skip`.
- **Detalle**: una interacción muestra eventos, mensajes (WhatsApp/SMS) y, en llamadas, grabación, transcripción, duración y resumen (AI si está disponible).
- **Idempotencia**: los eventos pueden llevar `idempotencyKey` para evitar duplicados.

### 4.2 Vista por cliente (teléfono)

- **Perfil de cliente**: búsqueda por número de teléfono muestra todas las interacciones de ese número (llamadas, WhatsApp, SMS), estadísticas agregadas (totales, resueltas, OTP confirmados, etc.) y última interacción.
- **Resumen con IA**: endpoint que devuelve un resumen del historial del cliente, puntos clave, acciones sugeridas y sentimiento (POSITIVE / NEUTRAL / NEGATIVE), generado a partir de las interacciones.

### 4.3 Gestión de clientes (CRM básico)

- **Clientes**: alta, edición y baja de clientes identificados por teléfono (normalizado). Campos: nombre, email, DNI, estado (ACTIVE, INACTIVE, BLOCKED, PENDING), segmento, canal preferido.
- **Etiquetas**: tipos predefinidos (PREFERRED, VIP, BLACKLIST, FRAUD_RISK, HIGH_VALUE, COMPLAINT, LOYAL, NEW, CUSTOM) con label, descripción y color.
- **Notas**: notas por cliente, con opción de marcar como internas (solo agentes).
- **Bloqueo**: acción para bloquear un cliente.
- **Estadísticas por cliente**: total de interacciones y métricas asociadas vía endpoint de stats.

### 4.4 OTP (códigos de un solo uso)

- **Crear OTP**: se genera un desafío OTP asociado a un teléfono y propósito (PASSWORD_RESET, TX_CONFIRMATION, IDENTITY_VERIFICATION, LOGIN_2FA). El envío del SMS se encola en Redis (BullMQ) y lo procesa el worker.
- **Verificar OTP**: se valida el código; el desafío pasa a VERIFIED o incrementa intentos hasta EXPIRED/LOCKED.
- **Límites**: TTL configurable, máximo de intentos por desafío y rate limiting por teléfono y propósito (ventana y máximo de envíos).

### 4.5 Envío de mensajes desde la consola

- **SMS**: envío de texto libre a un número; también flujos predefinidos: OTP, link de verificación, onboarding, activación de tarjeta (según endpoints implementados).
- **WhatsApp**: envío de mensaje de texto en el contexto de una conversación existente (indicando `providerConversationId` y destinatario).

### 4.6 Sincronización con proveedores

- **Sync manual**: endpoint `POST /sync/full` (opcional con `limit`) para traer conversaciones recientes (ej. últimas 24 h) desde los proveedores externos y persistirlas como interacciones/eventos/mensajes. Útil para poblar o reparar datos.

### 4.7 Auditoría y privacidad

- **Audit log**: registro de acciones relevantes (actor, acción, tipo de entidad, ID, IP, user-agent, metadata).
- **Enmascaramiento PII**: en listados de interacciones los teléfonos pueden enmascararse (configurable); los administradores o el uso de `includePII=true` pueden obtener datos sin enmascarar.

---

## 5. Frontend (consola de gestión)

Aplicación Next.js que consume la API del backend.

- **Dashboard**: resumen con tarjetas de métricas, gráficos (volumen, estados, motivos, etc.) e interacciones recientes.
- **Llamadas**: listado y detalle de interacciones de tipo llamada (transcripción, grabación, resumen).
- **WhatsApp**: listado y detalle de conversaciones WhatsApp con hilo de mensajes; envío de respuestas.
- **SMS**: listado y gestión de SMS; envío de SMS y uso de flujos (OTP, verificación, onboarding, activación de tarjeta).
- **Cliente**: búsqueda por teléfono, perfil de cliente con historial e indicador de resumen con IA.
- **Clientes (CRM)**: en `/customers`, listado de clientes con filtros, alta/edición, tags, notas y bloqueo.

La URL base del backend se configura con `NEXT_PUBLIC_API_URL` (por defecto `http://localhost:3000` en desarrollo).

---

## 6. Modelo de datos (resumen)

- **Interaction**: una conversación o llamada (canal, dirección, estado, from, to, fechas, agente, outcome, intent, proveedor, providerConversationId).
- **InteractionEvent**: evento crudo o normalizado de la interacción (tipo, payload JSON, idempotencyKey).
- **Message**: mensaje individual dentro de una interacción (canal, dirección, texto, media, estados de envío/lectura).
- **CallDetail**: datos de llamada (grabación, transcripción, resumen, duración, motivo de corte).
- **OtpChallenge**: desafío OTP (teléfono, propósito, hash, expiración, intentos, estado, correlationId, opcionalmente interactionId).
- **Customer**: cliente (teléfono normalizado, nombre, email, DNI, estado, segmento, canal preferido).
- **CustomerTag** y **CustomerNote**: etiquetas y notas del cliente.
- **AuditLog**: traza de auditoría.

---

## 7. Flujos típicos

1. **Llamada entrante (ElevenLabs)**  
   ElevenLabs envía eventos al webhook → el backend crea/actualiza `Interaction` (CALL) y `CallDetail` (transcripción, grabación, resumen). El agente ve la llamada y el detalle en la consola.

2. **Mensaje WhatsApp entrante**  
   BuilderBot envía el mensaje al webhook → se crea o actualiza la interacción y se guarda un `Message`. El agente responde desde la consola usando el endpoint de envío WhatsApp.

3. **Envío de OTP**  
   La consola (u otro sistema) llama a `POST /api/otp` → se crea un `OtpChallenge` y se encola el envío SMS en Redis → el worker envía el SMS vía Twilio. El usuario recibe el código y se valida con `POST /api/otp/verify`.

4. **Consulta de cliente**  
   El agente introduce un teléfono en “Cliente” → el frontend pide perfil e historial al backend → se muestran interacciones y, si se usa, el resumen con IA.

---

## 8. Consideraciones de despliegue

- **Backend (API)**: NestJS; requiere PostgreSQL y Redis; documentación Swagger en `/api/docs`.
- **Worker**: proceso aparte que consume la cola BullMQ (Redis) para envío de SMS (y en general jobs asíncronos).
- **Frontend**: Next.js; puede desplegarse en Vercel u otro host estático/SSR, apuntando `NEXT_PUBLIC_API_URL` al backend.
- **Webhooks**: deben configurarse en ElevenLabs, BuilderBot y Twilio con la URL pública del backend y el token correspondiente (`X-Webhook-Token` o el que use cada integración).

Esta descripción refleja el comportamiento funcional del proyecto a partir del código y de la documentación existente en el repositorio.
