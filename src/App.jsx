import { useEffect, useRef, useState } from 'react';

const SESIONES = {
  A: {
    etiqueta: 'Sesión 1',
    titulo: 'Mirar hacia adentro',
    descripcion: 'Después de tu autoevaluación: lo que sé y lo que aún no sé de mí.',
    hojas: 'tu mapa de lo que te mueve, tu autoevaluación y lo que quisieras explorar',
  },
  B: {
    etiqueta: 'Sesión 2',
    titulo: 'Mirar hacia afuera',
    descripcion: 'Después de tus escenarios de futuro: continuidad, evolución, reinvención.',
    hojas: 'tu capital profesional y tus tres escenarios',
  },
};

const MENSAJE_CIERRE = 'Me gustaría ir cerrando esta conversación.';
const MAX_FOTOS = 4;

const nuevoId = () =>
  (crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export default function App() {
  const [vioIntro, setVioIntro] = useState(false);
  const [modulo, setModulo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [fotos, setFotos] = useState([]);
  const [conversacion, setConversacion] = useState(nuevoId);

  const reiniciar = () => {
    if (messages.length && !confirm('Se borrará esta conversación de la pantalla. ¿Continuar?')) return;
    setMessages([]);
    setFotos([]);
    setModulo(null);
    setConversacion(nuevoId());
  };

  // Aviso si la persona intenta cerrar o recargar la pestaña en medio de la conversación.
  useEffect(() => {
    if (!messages.length) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [messages.length]);

  useEffect(() => { window.scrollTo(0, 0); }, [vioIntro, modulo]);

  let contenido;
  if (!vioIntro) contenido = <ComoFunciona onSeguir={() => setVioIntro(true)} />;
  else if (!modulo) contenido = <Inicio onElegir={setModulo} onAyuda={() => setVioIntro(false)} />;
  else if (messages.length === 0) {
    contenido = (
      <Hojas modulo={modulo} conversacion={conversacion} onVolver={() => setModulo(null)}
        onEnviar={(texto, urls) => { setFotos(urls); setMessages([{ role: 'user', content: texto }]); }} />
    );
  } else {
    contenido = (
      <Chat modulo={modulo} conversacion={conversacion} fotos={fotos}
        messages={messages} setMessages={setMessages} onNueva={reiniciar} />
    );
  }

  return (
    <div className="app">
      <header className="top">
        <button className="marca" onClick={reiniciar} aria-label="Volver al inicio">
          adapsys<span className="cursor">_</span>
        </button>
        {modulo && (
          <span className="chip">
            {SESIONES[modulo].etiqueta} · {SESIONES[modulo].titulo}
          </span>
        )}
      </header>

      <main className="main">{contenido}</main>

      <footer className="pie">
        Nada de lo que escribes ni tus fotos se guardan: la conversación existe solo en esta pantalla.
      </footer>
    </div>
  );
}

function ComoFunciona({ onSeguir }) {
  const pasos = [
    ['Elige tu sesión', 'La 1 o la 2, según el ejercicio que acabas de hacer en papel.'],
    ['Saca una foto a tus hojas', 'Con tu celular, una foto por hoja. Si prefieres, también puedes escribirlas.'],
    ['Conversa', 'Un acompañante te hará preguntas sobre lo que escribiste. No te dice qué hacer: te ayuda a pensar.'],
    ['Cierra', 'En unos 20 minutos te invitará a quedarte con una frase. Si quieres, descargas la conversación.'],
  ];
  return (
    <section className="intro">
      <p className="kicker">Sesiones sobre el futuro · COSUDE</p>
      <h1>Cómo funciona<span className="cursor">_</span></h1>
      <p className="lead">
        Un espacio breve para seguir pensando en lo que escribiste a mano. Son cuatro pasos:
      </p>
      <ol className="pasos">
        {pasos.map(([t, d], i) => (
          <li key={t} className="paso">
            <span className="paso-num">{i + 1}</span>
            <span><strong>{t}</strong><br />{d}</span>
          </li>
        ))}
      </ol>
      <div className="privado">
        <strong>Es privado.</strong> Tus fotos y lo que escribes no se guardan en ningún lado. Al cerrar
        la página, la conversación desaparece. Si tienes dudas, pregúntale al facilitador.
      </div>
      <button className="btn btn-grande" onClick={onSeguir}>Empezar</button>
    </section>
  );
}

function Inicio({ onElegir, onAyuda }) {
  return (
    <section className="inicio">
      <p className="kicker">Sesiones sobre el futuro · COSUDE</p>
      <h1>¿Qué sesión hiciste hoy?<span className="cursor">_</span></h1>
      <p className="lead">
        Elige la sesión que corresponde a las hojas que escribiste.{' '}
        <button className="link" onClick={onAyuda}>¿Cómo funciona?</button>
      </p>
      <div className="tarjetas">
        {Object.entries(SESIONES).map(([k, s]) => (
          <button key={k} className="tarjeta" onClick={() => onElegir(k)}>
            <span className="tarjeta-etq">{s.etiqueta}</span>
            <span className="tarjeta-tit">{s.titulo}</span>
            <span className="tarjeta-desc">{s.descripcion}</span>
            <span className="tarjeta-cta">Comenzar →</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// Reduce la foto en el navegador (máx. 1600 px, JPEG) para que suba rápido incluso con datos móviles.
async function comprimir(file) {
  const MAX = 1600;
  let fuente;
  try {
    fuente = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    fuente = await new Promise((ok, mal) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => mal(new Error('formato'));
      img.src = URL.createObjectURL(file);
    });
  }
  const escala = Math.min(1, MAX / Math.max(fuente.width, fuente.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(fuente.width * escala);
  canvas.height = Math.round(fuente.height * escala);
  canvas.getContext('2d').drawImage(fuente, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.8);
  return { url, mimeType: 'image/jpeg', data: url.split(',')[1] };
}

function Hojas({ modulo, conversacion, onVolver, onEnviar }) {
  const sesion = SESIONES[modulo];
  const [fotos, setFotos] = useState([]);
  const [texto, setTexto] = useState('');
  const [escribir, setEscribir] = useState(false);
  const [estado, setEstado] = useState(''); // '' | 'preparando' | 'leyendo'
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const hayTexto = texto.trim().length >= 40;
  const listo = (fotos.length > 0 || hayTexto) && !estado;

  async function agregar(e) {
    const archivos = [...e.target.files].slice(0, MAX_FOTOS - fotos.length);
    e.target.value = '';
    if (!archivos.length) return;
    setError('');
    setEstado('preparando');
    try {
      const nuevas = await Promise.all(archivos.map(comprimir));
      setFotos((f) => [...f, ...nuevas].slice(0, MAX_FOTOS));
    } catch {
      setError('No pudimos abrir esa imagen. Prueba sacando la foto de nuevo.');
    } finally {
      setEstado('');
    }
  }

  async function comenzar() {
    setError('');
    let leido = '';
    if (fotos.length) {
      setEstado('leyendo');
      try {
        const r = await fetch('/api/leer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            modulo, conversacion,
            imagenes: fotos.map(({ mimeType, data }) => ({ mimeType, data })),
          }),
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.texto) throw new Error(d.error || 'No pudimos leer las fotos.');
        leido = d.texto;
      } catch (e) {
        setError(e.message || 'Problema de conexión.');
        setEstado('');
        return;
      }
    }
    const partes = [];
    if (leido) partes.push(`(Transcrito de fotos de mis hojas; puede haber palabras marcadas como [ilegible].)\n\n${leido}`);
    if (hayTexto) partes.push(texto.trim());
    onEnviar(`Estas son mis hojas:\n\n${partes.join('\n\n')}`, fotos.map((f) => f.url));
  }

  return (
    <section className="hojas">
      <button className="link" onClick={onVolver} disabled={!!estado}>← Cambiar sesión</button>
      <h2>Tus hojas</h2>
      <p className="lead">
        Saca una foto a cada hoja: {sesion.hojas}. Que se vea la hoja completa y con buena luz.
      </p>

      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={agregar} />

      {fotos.length > 0 && (
        <div className="fotos">
          {fotos.map((f, i) => (
            <figure key={f.url.slice(-32) + i} className="foto">
              <img src={f.url} alt={`Hoja ${i + 1}`} />
              <figcaption>Hoja {i + 1}</figcaption>
              {!estado && (
                <button className="quitar" aria-label={`Quitar hoja ${i + 1}`}
                  onClick={() => setFotos(fotos.filter((_, j) => j !== i))}>×</button>
              )}
            </figure>
          ))}
        </div>
      )}

      {fotos.length < MAX_FOTOS && (
        <button className={fotos.length ? 'btn-secundario' : 'btn btn-grande btn-camara'}
          onClick={() => inputRef.current?.click()} disabled={!!estado}>
          {estado === 'preparando' ? 'Preparando foto…' : fotos.length ? '+ Agregar otra hoja' : '📷  Sacar foto de mis hojas'}
        </button>
      )}

      {!escribir ? (
        <p className="nota alt">
          ¿Prefieres escribir?{' '}
          <button className="link" onClick={() => setEscribir(true)} disabled={!!estado}>Escribir mis hojas</button>
        </p>
      ) : (
        <textarea
          className="area"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder={fotos.length ? 'Si quieres, agrega aquí algo más…' : 'Escribe o pega aquí lo que anotaste en tus hojas…'}
          disabled={!!estado}
          autoFocus
        />
      )}

      {error && <div className="error">{error}</div>}

      <div className="acciones">
        <span className="nota">
          {estado === 'leyendo' ? 'Leyendo tus hojas… puede tardar unos segundos.'
            : listo ? 'Cuando estés listo/a, comienza.'
            : 'Saca al menos una foto (o escribe unas líneas) para comenzar.'}
        </span>
        <button className="btn" disabled={!listo} onClick={comenzar}>
          {estado === 'leyendo' ? 'Leyendo…' : 'Comenzar conversación'}
        </button>
      </div>
    </section>
  );
}

function Chat({ modulo, conversacion, fotos, messages, setMessages, onNueva }) {
  const [input, setInput] = useState('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const finRef = useRef(null);
  const enVuelo = useRef(false);
  const pendiente = messages[messages.length - 1]?.role === 'user';

  // Pide respuesta cada vez que el último mensaje es de la persona.
  useEffect(() => {
    if (!pendiente || cargando || error) return;
    pedir(messages);
  }, [messages, pendiente]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, cargando, error]);

  async function pedir(historial) {
    if (enVuelo.current) return;
    enVuelo.current = true;
    setCargando(true);
    setError('');
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modulo, conversacion, messages: historial }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.reply) throw new Error(data.error || 'No pudimos obtener respuesta.');
      setMessages([...historial, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setError(e.message || 'Problema de conexión.');
    } finally {
      enVuelo.current = false;
      setCargando(false);
    }
  }

  function enviar(texto) {
    const t = texto.trim();
    if (!t || cargando || pendiente) return;
    setInput('');
    setMessages([...messages, { role: 'user', content: t }]);
  }

  function descargar() {
    const txt = messages
      .map((m) => `${m.role === 'user' ? 'Yo' : 'Acompañante'}:\n${m.content}`)
      .join('\n\n---\n\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/plain;charset=utf-8' }));
    a.download = `mi-reflexion-sesion-${modulo === 'A' ? '1' : '2'}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const intercambios = messages.filter((m) => m.role === 'user').length;

  return (
    <section className="chat">
      <div className="mensajes">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}`}>
            {i === 0 ? <Plegable texto={m.content} fotos={fotos} /> : m.content}
          </div>
        ))}
        {cargando && <div className="msg assistant pensando"><span /><span /><span /></div>}
        {error && (
          <div className="error">
            {error}
            <button className="link" onClick={() => pedir(messages)}>Reintentar</button>
          </div>
        )}
        <div ref={finRef} />
      </div>

      <form className="entrada" onSubmit={(e) => { e.preventDefault(); enviar(input); }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(input); }
          }}
          placeholder="Escribe tu respuesta…"
          rows={2}
          disabled={cargando || pendiente}
        />
        <button className="btn" disabled={!input.trim() || cargando || pendiente}>Enviar</button>
      </form>

      <div className="herramientas">
        {intercambios >= 3 && (
          <button className="link" disabled={cargando || pendiente} onClick={() => enviar(MENSAJE_CIERRE)}>
            Quiero ir cerrando
          </button>
        )}
        <button className="link" onClick={descargar}>Descargar mi conversación</button>
        <button className="link" onClick={onNueva}>Terminar y borrar</button>
      </div>
    </section>
  );
}

function Plegable({ texto, fotos }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div>
      <button className="link claro" onClick={() => setAbierto(!abierto)}>
        {abierto ? 'Ocultar mis hojas' : 'Mis hojas (ver)'}
      </button>
      {abierto && (
        <>
          {fotos.length > 0 && (
            <div className="fotos mini">
              {fotos.map((u, i) => <img key={i} src={u} alt={`Hoja ${i + 1}`} />)}
            </div>
          )}
          <div className="hojas-texto">{texto.replace(/^Estas son mis hojas:\n\n/, '')}</div>
        </>
      )}
    </div>
  );
}
