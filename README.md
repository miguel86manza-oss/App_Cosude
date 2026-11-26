# App COSUDE · Sesiones sobre el futuro

Mini-app sin login para las sesiones del 1 y 2 de diciembre. El participante elige la sesión,
pega lo que escribió a mano y conversa con un "acompañante de reflexión" (Gemini) que sigue la
pauta de Adapsys. **No se guarda nada**: no hay base de datos y la conversación vive solo en el navegador.

## Estructura
```
api/_prompt.js   ← la pauta (system prompt). Editar aquí para ajustar tono/reglas.
api/chat.js      ← función serverless de Vercel que llama a Gemini
src/App.jsx      ← interfaz: inicio → hojas → conversación
```

## Desplegar en Vercel
1. Crear una API key en https://aistudio.google.com/apikey
   - **Importante:** activar facturación (plan pagado) en ese proyecto de Google Cloud.
     En el plan gratuito Google puede usar el contenido para mejorar sus productos;
     en el pagado no. El costo para ~12 personas × 2 sesiones es de centavos de dólar.
2. En Vercel: *Add New → Project* → importar `App_Cosude` (framework Vite, se detecta solo).
3. *Settings → Environment Variables*:
   - `GEMINI_API_KEY` = la clave
   - `GEMINI_MODEL` (opcional) = por defecto `gemini-2.5-flash`
4. Deploy. Cada `git push` a `main` vuelve a desplegar.

## Probar en local
```bash
echo "GEMINI_API_KEY=tu_clave" > .env.local
npm install
npm run dev
```

## Plan B en sala
Si falla el wifi: llevar impresa la pauta de preguntas (Opción A) para que el facilitador la use.
