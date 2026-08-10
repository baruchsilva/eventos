/* calendario.js · BTC Américas
   Lógica compartida entre pase.html (público) y admin.html (edición).
   Sin dependencias. Expone window.CAL. */
(function (global) {
  'use strict';

  const pad = n => String(n).padStart(2, '0');

  /* ---------- zonas horarias ---------- */
  function tzOffset(date, tz) {
    const p = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hour12: false, year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).formatToParts(date).reduce((a, x) => (a[x.type] = x.value, a), {});
    return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second) - date.getTime();
  }

  // 'YYYY-MM-DDTHH:MM' interpretado en la zona indicada -> instante UTC
  function toUTC(local, tz) {
    const guess = new Date(local.length === 10 ? local + 'T00:00:00Z' : local + ':00Z');
    let d = new Date(guess.getTime() - tzOffset(guess, tz));
    return new Date(guess.getTime() - tzOffset(d, tz)); // 2ª pasada: bordes DST
  }

  const stampUTC = d => d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' +
    pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z';
  const stampDay = s => s.slice(0, 10).replace(/-/g, '');
  const nextDay = s => {
    const d = new Date(s.slice(0, 10) + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10).replace(/-/g, '');
  };

  /* ---------- normalización ---------- */
  function normaliza(ev) {
    const e = Object.assign({
      titulo: '', sede: '', descripcion: '', enlace: '',
      inicio: '', fin: '', zona: 'America/Mexico_City',
      todoElDia: false, recordatorio: 0, uid: '', secuencia: 0,
      invitacion: false, organizador: { nombre: '', correo: '' }
    }, ev || {});
    e.zona = e.zona || 'America/Mexico_City';
    e.inicioUTC = toUTC(e.inicio, e.zona);
    e.finUTC = toUTC(e.fin || e.inicio, e.zona);
    if (e.finUTC <= e.inicioUTC) e.finUTC = new Date(e.inicioUTC.getTime() + 36e5);
    if (!e.uid) e.uid = 'btc-' + Math.abs([...(e.titulo + e.inicio)]
      .reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)).toString(36) + '@btcamericas.com';
    return e;
  }

  /* ---------- iCalendar RFC 5545 ---------- */
  const esc = s => (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;')
    .replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

  const octetos = ch => { const c = ch.codePointAt(0); return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; };

  // Corta a 75 octetos (no caracteres): los acentos ocupan 2 bytes en UTF-8
  function fold(line) {
    const partes = [];
    let actual = '', n = 0, primera = true;
    for (const ch of line) {
      const b = octetos(ch), limite = primera ? 75 : 74; // las continuaciones llevan espacio inicial
      if (n + b > limite) { partes.push(actual); actual = ''; n = 0; primera = false; }
      actual += ch; n += b;
    }
    partes.push(actual);
    return partes.join('\r\n ');
  }

  function ics(ev) {
    const e = normaliza(ev);
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BTC Americas//Pase//ES',
      'CALSCALE:GREGORIAN', 'METHOD:' + (e.invitacion ? 'REQUEST' : 'PUBLISH'),
      'BEGIN:VEVENT', 'UID:' + e.uid, 'DTSTAMP:' + stampUTC(new Date()),
      'SEQUENCE:' + (e.secuencia || 0), 'STATUS:CONFIRMED', 'TRANSP:OPAQUE'];

    if (e.todoElDia) {
      L.push('DTSTART;VALUE=DATE:' + stampDay(e.inicio), 'DTEND;VALUE=DATE:' + nextDay(e.fin || e.inicio));
    } else {
      L.push('DTSTART:' + stampUTC(e.inicioUTC), 'DTEND:' + stampUTC(e.finUTC));
    }
    L.push('SUMMARY:' + esc(e.titulo));
    if (e.descripcion || e.enlace) L.push('DESCRIPTION:' + esc(e.descripcion + (e.enlace ? '\n\n' + e.enlace : '')));
    if (e.sede) L.push('LOCATION:' + esc(e.sede));
    if (e.enlace) L.push('URL:' + e.enlace);
    if (e.invitacion && e.organizador && e.organizador.correo) {
      L.push('ORGANIZER;CN=' + esc(e.organizador.nombre || 'BTC') + ':mailto:' + e.organizador.correo);
      L.push('ATTENDEE;CN=Invitado;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:{{email}}');
    }
    if (e.recordatorio) L.push('BEGIN:VALARM', 'TRIGGER:-PT' + e.recordatorio + 'M',
      'ACTION:DISPLAY', 'DESCRIPTION:' + esc(e.titulo), 'END:VALARM');
    L.push('END:VEVENT', 'END:VCALENDAR');
    return L.map(fold).join('\r\n');
  }

  const icsDataURI = ev => 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics(ev));
  const nombreArchivo = ev => (ev.titulo || 'evento').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) + '.ics';

  /* ---------- deeplinks ---------- */
  function links(ev) {
    const e = normaliza(ev), q = encodeURIComponent;
    const cuerpo = e.descripcion + (e.enlace ? '\n\n' + e.enlace : '');
    const gd = e.todoElDia ? stampDay(e.inicio) + '/' + nextDay(e.fin || e.inicio)
      : stampUTC(e.inicioUTC) + '/' + stampUTC(e.finUTC);
    const iso = d => d.toISOString().slice(0, 19) + 'Z';
    const outlook = base => base + '?path=/calendar/action/compose&rru=addevent'
      + '&subject=' + q(e.titulo) + '&location=' + q(e.sede) + '&body=' + q(cuerpo)
      + (e.todoElDia
        ? '&allday=true&startdt=' + e.inicio.slice(0, 10) + '&enddt=' + (e.fin || e.inicio).slice(0, 10)
        : '&startdt=' + q(iso(e.inicioUTC)) + '&enddt=' + q(iso(e.finUTC)));
    return {
      google: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + q(e.titulo)
        + '&dates=' + gd + '&details=' + q(cuerpo) + '&location=' + q(e.sede) + '&trp=false',
      outlook: outlook('https://outlook.live.com/calendar/0/deeplink/compose'),
      office: outlook('https://outlook.office.com/calendar/0/deeplink/compose'),
      yahoo: 'https://calendar.yahoo.com/?v=60&title=' + q(e.titulo)
        + (e.todoElDia ? '&st=' + stampDay(e.inicio) + '&dur=allday'
          : '&st=' + stampUTC(e.inicioUTC) + '&et=' + stampUTC(e.finUTC))
        + '&desc=' + q(cuerpo) + '&in_loc=' + q(e.sede)
    };
  }

  /* ---------- formato humano ---------- */
  function fechaLarga(ev) {
    const e = normaliza(ev);
    const d = e.todoElDia ? new Date(e.inicio.slice(0, 10) + 'T12:00:00Z') : e.inicioUTC;
    const t = new Intl.DateTimeFormat('es-MX', {
      timeZone: e.zona, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(d);
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  function horas(ev) {
    const e = normaliza(ev);
    if (e.todoElDia) return 'Todo el día';
    const h = d => new Intl.DateTimeFormat('es-MX', {
      timeZone: e.zona, hour: '2-digit', minute: '2-digit', hour12: false
    }).format(d);
    return h(e.inicioUTC) + ' a ' + h(e.finUTC) + ' h';
  }
  function textoWhatsApp(ev, urlPase) {
    const e = normaliza(ev);
    return '*' + (e.titulo || 'Evento') + '*\n\n'
      + '📅 ' + fechaLarga(e) + '\n'
      + '🕘 ' + horas(e) + '\n'
      + (e.sede ? '📍 ' + e.sede + '\n' : '')
      + (e.descripcion ? '\n' + e.descripcion + '\n' : '')
      + (urlPase ? '\nAgregalo a tu calendario:\n' + urlPase : '');
  }

  global.CAL = { normaliza, ics, icsDataURI, nombreArchivo, links, fechaLarga, horas, textoWhatsApp };
})(window);
