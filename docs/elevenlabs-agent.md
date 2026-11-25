# Agente de voz — Centro de citas (Hospital Central La Paz)

Configuración propuesta para Conversational AI. El agente se crea/ajusta **después** del deploy; este documento deja la API y el prompt listos.

Zona horaria: `America/La_Paz`. Idioma: español de Bolivia. Moneda: Bs (si se menciona costo administrativo).

Auth de tools/webhooks: header `X-Agent-Secret: $AGENT_API_SECRET` (alias aceptado: `X-Webhook-Token`).

Base URL: `https://TU-API.easypanel.host`

---

## Prompt de sistema (propuesto)

```
Sos la recepcionista telefónica del Hospital Central La Paz, en Bolivia. Hablás español boliviano, de forma natural, cálida y clara. No sos un menú: llevás la conversación como una persona.

Tu trabajo:
1) Identificar al paciente (teléfono que llama, o pedile CI / nombre) con identificar_paciente.
2) Si no lo encuentra, ofrecé registrarlo: pedí nombre, apellido, CI y teléfono de forma natural, confirmá los datos y usá registrar_paciente. Después seguí con la reserva.
3) Entender si quiere sacar cita, consultar, reprogramar o cancelar.
4) Consultar especialidades, doctores y disponibilidad con las herramientas.
5) Ofrecer 2 o 3 opciones de horario en voz alta (día, hora, doctor).
6) Confirmar datos antes de reservar, reprogramar o cancelar.
7) Si no hay cupo, proponé otras fechas o especialidades cercanas.
8) Si el paciente pide hablar con una persona, derivá.

Reglas:
- Nunca inventes horarios ni digas que reservaste si la herramienta falló.
- No menciones proveedores de tecnología, APIs ni nombres de sistemas internos.
- Usá fechas en español (“el lunes 3 de marzo a las 09:30”).
- Si el paciente ya está identificado (variables dinámicas), saludalo por su nombre.
- Pedí CI solo si hace falta confirmar identidad.
- Sé breve: respuestas cortas, una pregunta a la vez.
- Horario de atención telefónica: el configurado en el hospital (típicamente 07:00–20:00 La Paz).
```

First message sugerido:

```
Buenos días, habla el asistente de citas del Hospital Central La Paz. ¿En qué puedo ayudarle?
```

---

## Server tools (JSON)

Todas: método `POST` salvo `listar_especialidades` (`GET`). Header `X-Agent-Secret`.

### 1. identificar_paciente

```json
{
  "name": "identificar_paciente",
  "description": "Busca un paciente existente por teléfono y/o CI. Si no existe, ofrecer registrar_paciente.",
  "url": "{{BASE}}/api/agent/identificar-paciente",
  "method": "POST",
  "headers": { "X-Agent-Secret": "{{SECRET}}", "Content-Type": "application/json" },
  "body": {
    "telefono": "{{system__caller_id}}",
    "ci": "{{ci}}",
    "nombre": "{{nombre}}",
    "apellido": "{{apellido}}",
    "seguro": "{{seguro}}"
  }
}
```

### 1b. registrar_paciente

```json
{
  "name": "registrar_paciente",
  "description": "Registra un paciente nuevo (idempotente por CI o teléfono). Pedir y confirmar nombre, apellido, CI y teléfono antes de llamar.",
  "url": "{{BASE}}/api/agent/registrar-paciente",
  "method": "POST",
  "headers": { "X-Agent-Secret": "{{SECRET}}", "Content-Type": "application/json" },
  "body": {
    "nombre": "{{nombre}}",
    "apellido": "{{apellido}}",
    "documento": "{{ci}}",
    "telefono": "{{telefono}}",
    "fechaNacimiento": "{{fecha_nacimiento}}",
    "conversationId": "{{system__conversation_id}}"
  }
}
```

### 2. listar_especialidades

```json
{
  "name": "listar_especialidades",
  "description": "Lista especialidades médicas activas del hospital.",
  "url": "{{BASE}}/api/agent/especialidades",
  "method": "GET",
  "headers": { "X-Agent-Secret": "{{SECRET}}" }
}
```

### 3. buscar_doctores

```json
{
  "name": "buscar_doctores",
  "description": "Busca doctores por especialidad o nombre.",
  "url": "{{BASE}}/api/agent/buscar-doctores",
  "method": "POST",
  "headers": { "X-Agent-Secret": "{{SECRET}}", "Content-Type": "application/json" },
  "body": {
    "especialidad": "{{especialidad}}",
    "especialidadId": "{{especialidadId}}",
    "nombre": "{{nombre_doctor}}",
    "doctor": "{{doctor}}"
  }
}
```

### 4. consultar_disponibilidad

```json
{
  "name": "consultar_disponibilidad",
  "description": "Devuelve hasta 5 horarios libres. periodo: manana | tarde | cualquiera.",
  "url": "{{BASE}}/api/agent/disponibilidad",
  "method": "POST",
  "headers": { "X-Agent-Secret": "{{SECRET}}", "Content-Type": "application/json" },
  "body": {
    "especialidad": "{{especialidad}}",
    "especialidadId": "{{especialidadId}}",
    "doctor": "{{doctor}}",
    "doctorId": "{{doctorId}}",
    "desde": "{{desde_iso}}",
    "hasta": "{{hasta_iso}}",
    "periodo": "cualquiera"
  }
}
```

### 5. reservar_cita

```json
{
  "name": "reservar_cita",
  "description": "Reserva un slot libre para el paciente. Confirmar en voz solo si ok=true.",
  "url": "{{BASE}}/api/agent/reservar",
  "method": "POST",
  "headers": { "X-Agent-Secret": "{{SECRET}}", "Content-Type": "application/json" },
  "body": {
    "pacienteId": "{{paciente_id}}",
    "slotId": "{{slotId}}",
    "motivo": "{{motivo}}"
  }
}
```

### 6. listar_citas_paciente

```json
{
  "name": "listar_citas_paciente",
  "description": "Lista citas activas próximas del paciente.",
  "url": "{{BASE}}/api/agent/citas-paciente",
  "method": "POST",
  "headers": { "X-Agent-Secret": "{{SECRET}}", "Content-Type": "application/json" },
  "body": { "pacienteId": "{{paciente_id}}" }
}
```

### 7. reprogramar_cita

```json
{
  "name": "reprogramar_cita",
  "description": "Cambia la cita a un nuevo slot libre.",
  "url": "{{BASE}}/api/agent/reprogramar",
  "method": "POST",
  "headers": { "X-Agent-Secret": "{{SECRET}}", "Content-Type": "application/json" },
  "body": {
    "citaId": "{{cita_id}}",
    "nuevoSlotId": "{{slotId}}",
    "motivo": "{{motivo}}"
  }
}
```

### 8. cancelar_cita

```json
{
  "name": "cancelar_cita",
  "description": "Cancela una cita a pedido del paciente.",
  "url": "{{BASE}}/api/agent/cancelar",
  "method": "POST",
  "headers": { "X-Agent-Secret": "{{SECRET}}", "Content-Type": "application/json" },
  "body": {
    "citaId": "{{cita_id}}",
    "motivo": "{{motivo}}"
  }
}
```

---

## Webhooks

### Inicio de llamada (conversation initiation)

`POST {{BASE}}/api/webhooks/voice/call-init`  
Header: `X-Webhook-Token: {{SECRET}}`

Responde `dynamic_variables` (`paciente_conocido`, `paciente_nombre`, `citas_resumen`, etc.).

Alias: `/api/webhooks/elevenlabs/call-init`

### Post-llamada

`POST {{BASE}}/api/webhooks/voice/post-call`  
Header: `X-Webhook-Token: {{SECRET}}`

Guarda transcripción, resumen, duración, grabación y vincula paciente por teléfono.

Alias: `/api/webhooks/elevenlabs/call`

Preferir webhook **del agente** (override), no el global del workspace.

---

## Simulador en el panel (`/telefono`)

El frontend pide `GET /api/voice/signed-url` (JWT del operador). El backend usa `ELEVENLABS_API_KEY` + `ELEVENLABS_AGENT_ID` y devuelve la signed URL sin exponer la key.

Al iniciar, el cliente envía `dynamicVariables.caller_phone` (demo Juan Pérez: `59170111222`). El webhook `call-init` también lee ese valor para identificar al paciente.
