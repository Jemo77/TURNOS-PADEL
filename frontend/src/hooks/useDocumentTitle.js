import { useEffect } from 'react';

// <title> dinámico por sección. El sitio público se identifica como "Turnos Padel" y el
// panel como "Panel Turnos Padel", así las pestañas del navegador distinguen las dos
// superficies.
//
// Dos detalles importantes:
//
// 1) NO se restaura el título anterior al desmontar. En una navegación el efecto de
//    limpieza de la página saliente corre después de que la entrante ya puso su título, y
//    restaurarlo dejaba el <title> de la página anterior pegado en la nueva (por ejemplo
//    "Cancha 1 · Disponibilidad" arriba del checkout). Cada página que monte escribe su
//    propio título y listo.
//
// 2) `sufijo` permite que el panel se llame a sí mismo sin repetirse: el admin pasa
//    sufijo: null para que quede "Panel Turnos Padel" y no "Panel Turnos Padel · Turnos
//    Padel".
const TITULO_BASE = 'Turnos Padel';

export default function useDocumentTitle(titulo, { sufijo = TITULO_BASE } = {}) {
  useEffect(() => {
    document.title = titulo && sufijo ? `${titulo} · ${sufijo}` : titulo || sufijo || '';
  }, [titulo, sufijo]);
}
