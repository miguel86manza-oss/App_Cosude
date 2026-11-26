import { useEffect, useRef, useState } from 'react';

const SESIONES = {
  A: {
    etiqueta: 'Sesión 1',
    titulo: 'Mirar hacia adentro',
    descripcion: 'Después de tu autoevaluación: lo que sé y lo que aún no sé de mí.',
    ayuda:
      'Transcribe aquí lo que escribiste a mano: tu mapa de lo que te mueve, tu autoevaluación y lo que quisieras explorar. Tal cual, aunque esté desordenado.',
  },
  B: {
    etiqueta: 'Sesión 2',
    titulo: 'Mirar hacia afuera',
    descripcion: 'Después de tus escenarios de futuro: continuidad, evolución, reinvención.',
    ayuda:
      'Transcribe aquí lo que escribiste a mano: tu capital profesional y tus tres escenarios (qué harías, qué te atrae, qué perderías, qué ganarías…). Tal cual, aunque esté desordenado.',
  },
};

const MENSAJE_CIERRE = 'Me gustaría ir cerrando esta conversación.';

export default function App() {
  const [modulo, setModulo] = useState(null);
  const [messages, setMessages] = useState([]);

  const reiniciar = () => {
    if (messages.length && !confirm('Se borrará esta conversación de la pantalla. ¿Continuar?')) return;
    setMessages([]);
    setModulo(null);
  };

  // Aviso si la persona intenta cerrar o recargar la pestaña en medio de la conversación.
  useEffect(() => {
    if (!messages.length) return;
    const h = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [messages.length]);

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

      <main className="main">
        {!modulo && <Inicio onElegir={setModulo} />}
        {modulo && messages.length === 0 && (
          <Hojas sesion={SESIONES[modulo]} onVolver={() => setModulo(null)}
            onEnviar={(texto) => setMessages([{ role: 'user', content: texto }])} />
        )}
        {modulo && messages.length > 0 && (
          <Chat modulo={modulo} messages={messages} setMessages={setMessages} onNueva={reiniciar} />
        )}
      </main>

      <footer className="pie">
        Nada de lo que escribes se guarda: la conversación existe solo en esta pantalla.
      </footer>
    </div>
  );
}

function Inicio({ onElegir }) {
  return (
    <section className="inicio">
      <p className="kicker">Sesiones sobre el futuro · COSUDE</p>
      <h1>Un espacio para pensar en voz alta<span className="cursor">_</span></h1>
      <p className="lead">
        Pega lo que escribiste a mano y conversa con un acompañante de reflexión. No te va a decir qué
        hacer: te va a hacer preguntas sobre lo que tú escribiste.
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

function Hojas({ sesion, onVolver, onEnviar }) {
  const [texto, setTexto] = useState('');
  const listo = texto.trim().length >= 40;
  return (
    <section className="hojas">
      <button className="link" onClick={onVolver}>← Cambiar sesión</button>
      <h2>Tus hojas</h2>
      <p className="lead">{sesion.ayuda}</p>
      <textarea
        className="area"
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Escribe o pega aquí tus 2-3 hojas…"
        autoFocus
      />
      <div className="acciones">
        <span className="nota">{listo ? 'Cuando estés listo/a, comienza.' : 'Escribe al menos unas líneas para comenzar.'}</span>
        <button className="btn" disabled={!listo}
          onClick={() => onEnviar(`Estas son mis hojas:\n\n${texto.trim()}`)}>
          Comenzar conversación
        </button>
      </div>
    </section>
  );
}

function Chat({ modulo, messages, setMessages, onNueva }) {
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
        body: JSON.stringify({ modulo, messages: historial }),
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
            {i === 0 ? <Plegable texto={m.content} /> : m.content}
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
          placeholder="Escribe tu respuesta…  (Enter para enviar, Shift+Enter para salto de línea)"
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

function Plegable({ texto }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <div>
      <button className="link claro" onClick={() => setAbierto(!abierto)}>
        {abierto ? 'Ocultar mis hojas' : 'Mis hojas (ver)'}
      </button>
      {abierto && <div className="hojas-texto">{texto.replace(/^Estas son mis hojas:\n\n/, '')}</div>}
    </div>
  );
}
