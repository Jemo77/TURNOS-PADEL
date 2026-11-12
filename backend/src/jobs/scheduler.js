// Scheduler interno de tareas periódicas.
//
// Los endpoints /api/cron/* existen para que un cron externo (Railway, Render,
// GitHub Actions) pueda pegarle, pero si nadie los dispara los holds quedan
// bloqueando turnos para siempre. Este módulo es la red de seguridad: corre los
// mismos jobs dentro del propio proceso cada N minutos.
//
// Se activa con CRON_INTERNO=true en el .env. En despliegues con réplicas múltiples
// o con cron externo configurado conviene dejarlo en false para no duplicar trabajo
// (los jobs son idempotentes, pero así se evita hacer la misma query N veces).
const { expirarReservasVencidas } = require('./expirarReservas.job');
const { conciliarConMp } = require('./conciliarMp.job');

const UN_MINUTO = 60 * 1000;

const tareas = [
  {
    nombre: 'expirar-reservas',
    intervaloMin: 2,
    ejecutar: () => expirarReservasVencidas()
  },
  {
    nombre: 'conciliar-mp',
    intervaloMin: 15,
    ejecutar: () => conciliarConMp()
  }
];

let timers = [];

async function correrTarea(tarea) {
  try {
    const resultado = await tarea.ejecutar();
    console.log(`[cron:${tarea.nombre}] ok`, JSON.stringify(resultado));
  } catch (error) {
    // Un job que falla no debe tumbar el proceso: se loguea y se reintenta en el
    // próximo ciclo.
    console.error(`[cron:${tarea.nombre}] error:`, error.message || error);
  }
}

function iniciarSchedulerInterno({ habilitado = false } = {}) {
  if (!habilitado) {
    console.log('[cron] Scheduler interno desactivado (CRON_INTERNO=false). Configurá un cron externo contra /api/cron/*.');
    return;
  }

  for (const tarea of tareas) {
    // El primer disparo espera un intervalo completo para no correr apenas arranca el
    // proceso (en despliegues con reinicios frecuentes eso sería ruido para la DB).
    const timer = setInterval(() => correrTarea(tarea), tarea.intervaloMin * UN_MINUTO);
    if (typeof timer.unref === 'function') timer.unref();
    timers.push(timer);
    console.log(`[cron:${tarea.nombre}] cada ${tarea.intervaloMin} min`);
  }
}

function detenerSchedulerInterno() {
  timers.forEach(clearInterval);
  timers = [];
}

module.exports = { iniciarSchedulerInterno, detenerSchedulerInterno, tareas };
