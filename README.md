# Pase · Agregar al calendario · BTC Américas

Página pública que muestra un evento y permite agregarlo al calendario, más un panel
interno de edición. Sin backend: los datos viven en un JSON del repo.

## Estructura

```
pase.html                              Página pública (lo único que ve el asistente)
admin.html                             Panel de edición (noindex)
assets/calendario.js                   Lógica compartida: iCalendar RFC 5545, zonas horarias, deeplinks
assets/pase.css                        Estilos del pase
eventos/reunion-elegidos-assemble.json Datos del evento
```

Respetar las carpetas. Si `assets/` o `eventos/` quedan planos, el pase no carga.

## Publicar

1. Subir los archivos al repo.
2. Settings → Pages → branch `main`, folder `/root`.
3. Abrir `https://TU-USUARIO.github.io/REPO/admin.html` **desde la URL de Pages**
   (con `file://` el `fetch` del JSON está bloqueado por CORS).
4. Llenar los campos, poner la URL base, descargar el JSON y subirlo a `eventos/`.
5. Verificar en `pase.html?e=reunion-elegidos-assemble`.

## Editar un evento ya publicado

En el panel: escribir el slug → *Traer JSON publicado* → carga los datos con
`secuencia` ya subida +1 → editar → descargar → reemplazar el archivo en `eventos/`.

El pase se actualiza al recargar. Quien ya agregó el evento a su calendario **no**
recibe el cambio: hay que reenviarle el enlace.

## Campos del JSON

| Campo | Nota |
|---|---|
| `titulo` | `SUMMARY` del evento |
| `sede` | `LOCATION` |
| `descripcion` | `DESCRIPTION`, se le concatena el enlace |
| `enlace` | Sitio o registro. Alimenta el mensaje de WhatsApp |
| `inicio` / `fin` | `YYYY-MM-DDTHH:MM` en hora local de `zona` |
| `zona` | IANA, ej. `America/Mexico_City` |
| `todoElDia` | `DTEND` exclusivo, se calcula solo |
| `recordatorio` | Minutos antes. `VALARM`. Google lo ignora si el usuario tiene preferencia propia |
| `uid` | Llave del evento. **No cambiar nunca** una vez difundido |
| `secuencia` | +1 en cada cambio publicado, o los clientes ignoran la actualización |
| `invitacion` | `METHOD:REQUEST` + `ORGANIZER` + `ATTENDEE` con merge tag `{{email}}` |

## Límites conocidos

- **Preview de WhatsApp único**: los meta OG se leen antes de que corra el JS, así que
  el crawler ve siempre lo mismo. Para tarjeta por evento, duplicar `pase.html` con sus
  propios meta.
- **`admin.html` es privado por convención**, no por seguridad. Está `noindex`, pero en
  repo público la URL es accesible. No contiene nada sensible.
- **Un `.ics` ya agregado no se sincroniza solo.** Para eso hace falta suscripción
  `webcal://` con `REFRESH-INTERVAL`.
