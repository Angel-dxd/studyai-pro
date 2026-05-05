# StudyAI Pro

Genera tests personalizados con IA a partir de tus PDFs. Sube un temario, configura dificultad y tiempo, y obtén un quiz interactivo con revisión detallada y exportación a PDF.

## Características

| Área | Detalle |
|---|---|
| Autenticación | Login, registro y recuperación de contraseña vía Supabase |
| Carga de PDF | Drag & drop o selector de archivos (límite 10 MB) |
| Configuración | 5/10/15/20 preguntas · dificultad fácil/media/difícil · timer por pregunta (sin límite, 20s, 30s, 60s, 90s) |
| Generación | Extracción de texto con `pdf-parse` (+ fallback manual) y construcción de preguntas con distractores inteligentes |
| Quiz | Barra de progreso, temporizador, feedback inmediato y explicaciones |
| Resultados | Anillo de puntuación, estadísticas (correctas, incorrectas, sin tiempo, racha máx.) y revisión pregunta a pregunta |
| Acciones | Repetir test, repasar fallos, exportar resultado a PDF (jsPDF) |
| Historial | Sesiones guardadas por usuario |
| UI | Tema claro/oscuro, diseño responsive, toasts de notificación |

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | HTML5 + CSS3 + JavaScript vanilla (modular) |
| Auth & DB | Supabase (`@supabase/supabase-js@2`) |
| Backend | Vercel Serverless Functions (Node.js) |
| Parsing PDF | `pdf-parse` ^1.1.1 |
| Export PDF | jsPDF 2.5.1 (CDN) |
| Deploy | Vercel |

## Estructura del proyecto

```
studyai-pro/
├── api/
│   └── generate.js        # Serverless function: parseo + generación de preguntas
├── css/
│   └── styles.css
├── js/
│   ├── app.js             # Bootstrap
│   ├── auth.js            # Login / registro / logout
│   ├── config.js          # Cliente Supabase
│   ├── history.js         # Historial de sesiones
│   ├── pdf.js             # Lectura del PDF en cliente
│   ├── quiz.js            # Lógica del test
│   ├── results.js         # Pantalla de resultados + export
│   ├── state.js           # Estado global
│   └── ui.js              # Vistas, toasts, tema
├── index.html
├── package.json
└── vercel.json
```

## Requisitos previos

- Node.js 18+
- Cuenta de Vercel
- Proyecto de Supabase (URL + anon key)

## Instalación

```bash
git clone <repo-url>
cd studyai-pro
npm install
```

## Configuración

Edita `js/config.js` con tus credenciales de Supabase:

```js
const SUPABASE_URL = 'https://<tu-proyecto>.supabase.co';
const SUPABASE_ANON_KEY = '<tu-anon-key>';
```

> ⚠️ Para producción mueve estas claves a variables de entorno y no las commitees.

## Desarrollo local

```bash
npx vercel dev
```

Servirá los archivos estáticos y la función `api/generate.js` en `http://localhost:3000`.

## Deploy

```bash
npx vercel --prod
```

Configuración (`vercel.json`):

| Función | Memoria | Duración máx |
|---|---|---|
| `api/generate.js` | 256 MB | 30 s |

## Endpoint API

`POST /api/generate`

| Campo | Tipo | Descripción |
|---|---|---|
| `prompt` | string | Debe contener `EXACTAMENTE N preguntas` para fijar el número |
| `pdfBase64` | string | PDF codificado en base64 |

Respuesta:

```json
{
  "content": [
    { "type": "text", "text": "{\"questions\":[ ... ]}" }
  ]
}
```

Errores:

| Código | Causa |
|---|---|
| 400 | PDF con poco contenido útil / no se pudo generar contenido suficiente |
| 405 | Método distinto a POST |
| 500 | Error interno |

## Flujo de uso

1. El usuario inicia sesión.
2. Sube un PDF y configura nº de preguntas, dificultad y timer.
3. El cliente envía el PDF en base64 a `/api/generate`.
4. La función extrae texto, lo limpia y genera preguntas tipo "afirmación correcta/incorrecta" con 4 opciones.
5. El cliente renderiza el quiz, mide tiempos y rachas.
6. Al terminar, muestra resultados, permite repasar fallos y exportar a PDF.

## Scripts

```bash
npm install          # Instalar dependencias
npx vercel dev       # Servidor local
npx vercel --prod    # Deploy a producción
```

## Licencia

Privado — todos los derechos reservados.
