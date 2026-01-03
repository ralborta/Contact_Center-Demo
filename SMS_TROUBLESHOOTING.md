# 🔍 Troubleshooting: SMS no llegan

## Problema: Los SMS se envían pero no llegan al destinatario

### ✅ Solución 1: Verificar formato del número

**Problema común:** El número tiene espacios o formato incorrecto.

**Solución:** El código ahora normaliza automáticamente los números, pero verifica:

1. **Formato correcto:** `+541134567890` (sin espacios)
2. **Formato incorrecto:** `+54 11 3456 7890` (con espacios) ❌

El código ahora convierte automáticamente `+54 11 3456 7890` → `+541134567890`

### ✅ Solución 2: Verificar modo Trial de Twilio

**Si tu cuenta de Twilio está en modo Trial:**

- Solo puedes enviar SMS a **números verificados**
- No puedes enviar a números no verificados

**Cómo verificar números en Twilio:**

1. Ve a [Twilio Console](https://console.twilio.com)
2. Ve a **Phone Numbers** → **Verified Caller IDs**
3. Agrega el número de destino que quieres usar para pruebas
4. Twilio enviará un código de verificación
5. Ingresa el código para verificar el número

**Solución alternativa:** Actualiza tu cuenta de Twilio a una cuenta pagada.

### ✅ Solución 3: Verificar crédito en Twilio

**Problema:** Tu cuenta de Twilio no tiene crédito suficiente.

**Cómo verificar:**

1. Ve a [Twilio Console](https://console.twilio.com)
2. Revisa el saldo en el dashboard
3. Si no tienes crédito, agrega fondos

### ✅ Solución 4: Verificar logs en Railway

**Revisa los logs del backend para ver qué está pasando:**

1. Ve a Railway Dashboard
2. Selecciona `cc-backend`
3. Ve a la pestaña **Logs**
4. Busca mensajes que empiecen con `[Twilio]`

**Logs esperados (éxito):**
```
[Twilio] Enviando SMS: {
  toOriginal: '+54 11 3456 7890',
  toNormalized: '+541134567890',
  from: '+541152382487',
  bodyLength: 50
}
[Twilio] ✅ SMS enviado exitosamente: {
  messageSid: 'SM...',
  status: 'queued',
  to: '+541134567890'
}
```

**Logs de error comunes:**

1. **Error 21211:** Número inválido
   ```
   [Twilio] ❌ Error al enviar SMS: {
     code: 21211,
     error: 'Invalid 'To' Phone Number'
   }
   ```
   **Solución:** Verifica que el número esté en formato internacional correcto

2. **Error 21610:** Número no verificado (modo trial)
   ```
   [Twilio] ❌ Error al enviar SMS: {
     code: 21610,
     error: 'Unable to create record'
   }
   ```
   **Solución:** Verifica el número en Twilio Console o actualiza a cuenta pagada

3. **Error 21614:** No es un número móvil
   ```
   [Twilio] ❌ Error al enviar SMS: {
     code: 21614,
     error: 'Not a valid mobile number'
   }
   ```
   **Solución:** Twilio solo puede enviar SMS a números móviles, no a líneas fijas

### ✅ Solución 5: Verificar en Twilio Console

**Revisa el estado del mensaje en Twilio:**

1. Ve a [Twilio Console](https://console.twilio.com)
2. Ve a **Monitor** → **Logs** → **Messaging**
3. Busca el `Message SID` que aparece en los logs
4. Revisa el estado:
   - **Queued:** En cola (normal)
   - **Sent:** Enviado a la operadora
   - **Delivered:** Entregado al teléfono ✅
   - **Failed:** Falló ❌
   - **Undelivered:** No entregado ❌

**Si el estado es "Failed" o "Undelivered":**
- Revisa el código de error
- Verifica que el número sea válido y móvil
- Verifica que tu cuenta tenga crédito

### ✅ Solución 6: Verificar variables de entorno

**Asegúrate de que estas variables estén configuradas en Railway:**

```bash
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_FROM_NUMBER=+541152382487
```

**Importante:**
- `TWILIO_FROM_NUMBER` debe estar en formato internacional: `+541152382487`
- No debe tener espacios
- Debe ser un número de Twilio que tengas activo

### ✅ Solución 7: Probar con un número verificado

**Para pruebas rápidas:**

1. Verifica tu propio número en Twilio Console
2. Envía un SMS a tu propio número
3. Si llega, el problema es con el número de destino
4. Si no llega, el problema es con la configuración

### ✅ Solución 8: Verificar región del número

**Problema:** Algunos números pueden tener restricciones regionales.

**Solución:**
- Verifica que el número de destino sea de una región soportada
- Algunos países tienen restricciones para SMS internacionales

## 📊 Checklist de Diagnóstico

Usa este checklist para diagnosticar el problema:

- [ ] El número está en formato internacional (`+541234567890`)
- [ ] El número está verificado en Twilio (si estás en trial)
- [ ] La cuenta de Twilio tiene crédito
- [ ] Las variables de entorno están configuradas en Railway
- [ ] El número `TWILIO_FROM_NUMBER` es válido y activo
- [ ] Los logs muestran que el SMS se envió exitosamente
- [ ] El estado en Twilio Console es "Delivered"
- [ ] El número de destino es un número móvil (no fijo)
- [ ] No hay restricciones regionales

## 🔧 Mejoras Implementadas

El código ahora incluye:

1. **Normalización automática de números:** Convierte `+54 11 3456 7890` → `+541134567890`
2. **Mejor logging:** Muestra el número original y normalizado
3. **Mensajes de error específicos:** Indica exactamente qué salió mal
4. **Validación de errores de Twilio:** Detecta errores comunes y da soluciones

## 📝 Ejemplo de Logs Correctos

```
[Twilio] Cliente inicializado: {
  accountSid: 'ACxxxxxx...',
  fromNumber: '+541152382487'
}
[SmsController] 📤 Enviando SMS personalizado a +54 11 3456 7890
[Twilio] Enviando SMS: {
  toOriginal: '+54 11 3456 7890',
  toNormalized: '+541134567890',
  from: '+541152382487',
  bodyLength: 35,
  bodyPreview: 'Hola! Este es un mensaje de prueba'
}
[Twilio] ✅ SMS enviado exitosamente: {
  messageSid: 'SM1234567890abcdef1234567890abcdef',
  status: 'queued',
  to: '+541134567890',
  price: '-0.00750',
  priceUnit: 'USD'
}
[SmsController] ✅ SMS enviado exitosamente: Interaction abc123, MessageId: SM1234567890abcdef
```

## 🆘 Si nada funciona

1. **Verifica en Twilio Console:**
   - Ve a **Monitor** → **Logs** → **Messaging**
   - Busca el mensaje por `Message SID`
   - Revisa el estado y código de error

2. **Contacta a Twilio Support:**
   - Si el mensaje está en estado "Failed" o "Undelivered"
   - Twilio Support puede ayudar a diagnosticar el problema

3. **Verifica la configuración del número FROM:**
   - Asegúrate de que el número de Twilio esté activo
   - Verifica que tenga permisos para enviar SMS
