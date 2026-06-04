# PRD — Reyf MVP
**Versión:** 1.0  
**Fecha:** Junio 2026  
**Autor:** Generado para el equipo de producto de Reyf  
**Estado:** Draft para revisión

---

## Tabla de Contenidos
1. [Project Overview](#1-project-overview)
2. [User Personas](#2-user-personas)
3. [User Stories & Acceptance Criteria](#3-user-stories--acceptance-criteria)
4. [UI/UX Requirements](#4-uiux-requirements)
5. [Technical Requirements](#5-technical-requirements)
6. [Business Model & Monetización](#6-business-model--monetización)
7. [Success Metrics](#7-success-metrics)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Riesgos y Mitigaciones](#9-riesgos-y-mitigaciones)

---

## 1. Project Overview

### 1.1 Problema

Los mexicanos entre 25 y 55 años no tienen una alternativa accesible, confiable y flexible a las Afores. El sistema actual presenta tres fallas estructurales:

- **Rendimientos bajos:** Las Afores promedian 4–6% anual real, insuficiente para una pensión digna.
- **Nula transparencia:** El usuario no entiende en qué está invertido su dinero ni cómo crece.
- **Liquidez nula:** Cualquier retiro anticipado implica penalizaciones severas o pérdida de beneficios.

El resultado: más del 75% de los mexicanos llega al retiro con menos del 30% del ingreso necesario para mantener su nivel de vida.

### 1.2 Solución: Reyf

Reyf es una plataforma web de ahorro e inversión para el retiro que combina:
- **Instrumentos soberanos diversificados** (CETES, US Treasuries, Tesouro brasileño, KTB coreanos) con rendimientos de 8–14% APY.
- **Infraestructura blockchain** (Arbitrum) para tokenizar posiciones, automatizar la bóveda y ofrecer liquidez sin vender activos.
- **UX sin fricción**: onboarding por correo, sin seed phrases, depósito por SPEI como cualquier banco mexicano.

### 1.3 Objetivos del MVP

| Objetivo | Métrica de Éxito |
|---|---|
| Validar confianza del usuario | 70% de usuarios activos hacen ≥2 depósitos en primeros 30 días |
| Validar conversión de onboarding | ≥60% de registros completan depósito inicial |
| Validar propuesta de valor vs Afore | ≥80% de usuarios interactúan con el comparativo Afore en dashboard |
| Validar liquidez como diferenciador | ≥20% de usuarios exploran la función de acceso a liquidez |

### 1.4 Usuario Target

Mexicanos de **25–55 años**, urbanos, con acceso a banca digital, que ya piensan en su retiro pero no confían en las Afores ni tienen acceso a alternativas sofisticadas. Ver Sección 2 para personas detalladas.

### 1.5 Scope MVP

**Dentro del MVP:**
- Registro por correo + wallet automática en Arbitrum
- Cuestionario de perfil de riesgo (4 estrategias)
- Depósito vía SPEI con CLABE dedicada
- Bóveda de retiro con rendimientos 8–14% APY
- Dashboard con proyecciones a 10/20/30 años y comparativa vs Afore
- Acceso a liquidez usando el fondo como colateral

**Fuera del MVP:**
- App móvil nativa (iOS/Android)
- Múltiples bóvedas por objetivo
- Calculadora de pensión IMSS
- Transferencia automatizada desde Afore existente
- Programa de referidos
- Notificaciones push
- Asesor financiero humano

---

## 2. User Personas

### Persona A — "La Profesionista Independiente"
**Nombre ficticio:** Daniela, 32 años  
**Perfil:** Diseñadora UX freelance en CDMX. Ingreso mensual: $35,000–$50,000 MXN. Bancarizada, usa BBVA y Nu. No tiene Afore activa porque es independiente. Ahorra en CETESDirecto pero siente que no es suficiente.  
**Dolor principal:** "Sé que debería ahorrar para el retiro pero no sé por dónde empezar y lo que existe me parece burocrático o aburrido."  
**Motivación en Reyf:** Proyección clara de cuánto tendrá en 30 años. UI que no se siente como banco del gobierno. Flexibilidad de sacar dinero si lo necesita.  
**Perfil de riesgo esperado:** Balanceado o Crecimiento.

---

### Persona B — "El Empleado Corporativo Consciente"
**Nombre ficticio:** Roberto, 44 años  
**Perfil:** Gerente de logística en empresa manufacturera en Monterrey. Ingreso: $65,000 MXN/mes. Tiene Afore con Sura pero cree que no va a ser suficiente. Tiene ahorros en CETES y un departamento.  
**Dolor principal:** "Mi Afore va a darme muy poco. Necesito algo adicional que realmente crezca y que pueda ver claramente."  
**Motivación en Reyf:** Comparativa clara vs su Afore actual. Diversificación en instrumentos internacionales. Dashboard de proyección a 20 años.  
**Perfil de riesgo esperado:** Conservador o Moderado.

---

### Persona C — "El Emprendedor Tardío"
**Nombre ficticio:** Sofía, 51 años  
**Perfil:** Dueña de boutique en Guadalajara. Nunca tuvo Afore. Ingreso variable: $80,000–$120,000 MXN/mes. Tiene miedo de no tener dinero a los 65.  
**Dolor principal:** "Empecé tarde. Necesito que mi dinero crezca más que en el banco pero no entiendo de inversiones."  
**Motivación en Reyf:** Simplicidad total, sin jerga financiera. Depósito fácil por SPEI. Perfil conservador con rendimiento real mayor al banco.  
**Perfil de riesgo esperado:** Conservador.

---

## 3. User Stories & Acceptance Criteria

> **Convención:** `US-[número]` — cada historia incluye criterios de aceptación verificables para generar tickets de desarrollo.

---

### MÓDULO 1: Registro y Onboarding

#### US-01: Registro con correo electrónico
**Como** usuario nuevo,  
**quiero** registrarme solo con mi correo electrónico,  
**para** acceder a Reyf sin necesidad de conocimientos técnicos ni crypto.

**Criterios de Aceptación:**
- [ ] El formulario de registro solo requiere correo y contraseña (mínimo 8 caracteres, 1 mayúscula, 1 número).
- [ ] Se envía un correo de verificación en < 30 segundos.
- [ ] Al verificar el correo, se crea automáticamente una Smart Wallet en Arbitrum sin intervención del usuario.
- [ ] El usuario no ve ni interactúa con seed phrases, claves privadas ni terminología blockchain en ningún punto del onboarding.
- [ ] El gas de la wallet es patrocinado (no requiere ETH del usuario).
- [ ] El flujo completo de registro toma < 3 minutos.
- [ ] Error states: correo ya registrado, correo inválido, contraseña débil — todos con mensajes claros en español.

---

#### US-02: Cuestionario de perfil de riesgo
**Como** usuario recién registrado,  
**quiero** responder un cuestionario breve sobre mi edad y horizonte de retiro,  
**para** que Reyf me asigne la estrategia de inversión más adecuada para mí.

**Criterios de Aceptación:**
- [ ] El cuestionario tiene máximo 5 preguntas, completable en < 2 minutos.
- [ ] Preguntas obligatorias: edad actual, edad de retiro esperada, tolerancia a volatilidad (con opciones visuales, no texto técnico), objetivo principal (preservar capital / crecer capital), situación de emergencia (¿tienes fondo de emergencia?).
- [ ] Al finalizar, el sistema asigna uno de 4 perfiles: Conservador, Moderado, Balanceado, Crecimiento.
- [ ] Se muestra al usuario su perfil asignado con: nombre, descripción en lenguaje simple, rango de APY esperado, composición de instrumentos en % (ej: 40% CETES, 30% Treasuries, etc.).
- [ ] El usuario puede ver los 4 perfiles y cambiar su selección manualmente con confirmación.
- [ ] El perfil queda almacenado y es visible en su dashboard.

---

#### US-03: CLABE dedicada y primer depósito
**Como** usuario con perfil de riesgo asignado,  
**quiero** recibir una CLABE interbancaria única a mi nombre,  
**para** depositar desde cualquier banco vía SPEI como si fuera una transferencia normal.

**Criterios de Aceptación:**
- [ ] Cada usuario recibe exactamente una CLABE de 18 dígitos asignada de forma permanente.
- [ ] La CLABE se muestra claramente en la pantalla de "Depositar" con opción de copiar al portapapeles.
- [ ] Se incluyen instrucciones paso a paso para transferir desde los 5 bancos más comunes en México (BBVA, Santander, Banamex, HSBC, Nu).
- [ ] El depósito mínimo es de $500 MXN.
- [ ] Al recibir el SPEI, el sistema convierte automáticamente MXN → MXNB (1:1) y deposita en la bóveda del usuario en < 15 minutos.
- [ ] El usuario recibe una notificación por correo al confirmar el depósito con monto, conversión y saldo actualizado.
- [ ] El historial de depósitos muestra: fecha, monto en MXN, equivalente en MXNB, estado (pendiente / confirmado).

---

### MÓDULO 2: Bóveda de Retiro

#### US-04: Visualización de la bóveda
**Como** usuario con fondos depositados,  
**quiero** ver el estado actual de mi bóveda de retiro,  
**para** entender cuánto tengo, cómo crece y en qué está invertido.

**Criterios de Aceptación:**
- [ ] La bóveda muestra: saldo total en MXN, rendimiento acumulado (MXN y %), APY actual del perfil, composición de instrumentos con %.
- [ ] El saldo se actualiza en tiempo real o con refresh manual (latencia < 5 segundos).
- [ ] La composición de instrumentos se muestra como gráfica de dona con etiquetas legibles.
- [ ] El rendimiento acumulado se muestra en verde/rojo según ganancia/pérdida.
- [ ] Existe una sección de "actividad reciente" con los últimos 10 movimientos.

---

#### US-05: Cambio de perfil de riesgo
**Como** usuario activo,  
**quiero** poder cambiar mi perfil de riesgo después de registrarme,  
**para** ajustar mi estrategia si mi situación de vida cambia.

**Criterios de Aceptación:**
- [ ] El cambio de perfil está disponible en Configuración > Perfil de Inversión.
- [ ] El sistema muestra un aviso claro de que el cambio aplica a nuevas ganancias, no retroactivo al capital existente.
- [ ] El cambio se ejecuta en < 24 horas hábiles.
- [ ] El usuario recibe confirmación por correo con el nuevo perfil y fecha de aplicación.
- [ ] Solo se permite 1 cambio de perfil por período de 30 días (con mensaje explicativo si intenta cambiar antes).

---

### MÓDULO 3: Dashboard y Proyecciones

#### US-06: Dashboard principal con proyección
**Como** usuario activo,  
**quiero** ver una proyección personalizada de mi retiro a 10, 20 y 30 años,  
**para** entender concretamente cuánto dinero tendré y si es suficiente para vivir.

**Criterios de Aceptación:**
- [ ] El dashboard muestra la proyección en tres horizontes temporales: 10, 20 y 30 años.
- [ ] La proyección usa: saldo actual, APY del perfil actual, depósito mensual promedio (calculado de los últimos 3 meses o ingresado manualmente).
- [ ] El monto proyectado se muestra en MXN nominal con nota de inflación estimada.
- [ ] El usuario puede ingresar manualmente un "depósito mensual objetivo" para simular escenarios.
- [ ] El gráfico de proyección es interactivo: al pasar el cursor sobre un punto muestra monto exacto y fecha.
- [ ] La proyección se recalcula automáticamente si el usuario cambia el depósito mensual objetivo.

---

#### US-07: Comparativa vs Afore
**Como** usuario activo,  
**quiero** ver cuánto tendría en una Afore promedio vs cuánto tendré con Reyf,  
**para** entender concretamente la ventaja de seguir con Reyf.

**Criterios de Aceptación:**
- [ ] La comparativa usa el mismo horizonte temporal y monto de aportación.
- [ ] Afore benchmark: rendimiento promedio del sistema Afore publicado por CONSAR (actualizado mensualmente). Si no disponible, usar 5.5% APY como default con nota explicativa.
- [ ] La diferencia se muestra como: monto adicional en MXN Y porcentaje adicional de riqueza acumulada.
- [ ] Se muestra una frase de impacto: ej. "Con Reyf tendrás $2.3M MXN más en 30 años".
- [ ] Hay un tooltip con la metodología del cálculo (transparencia).
- [ ] El módulo es prominente en el dashboard — no oculto en una pestaña secundaria.

---

### MÓDULO 4: Liquidez

#### US-08: Acceso a liquidez sin vender posiciones
**Como** usuario con fondos en la bóveda,  
**quiero** poder acceder a pesos en caso de emergencia usando mis fondos como colateral,  
**para** no tener que interrumpir el crecimiento de mi ahorro de retiro.

**Criterios de Aceptación:**
- [ ] El usuario puede solicitar un advance de hasta **≈1 año de rendimiento proyectado** de su bóveda (saldo × APY del perfil). Ej: $10,000 con perfil 11.5% → máx $1,150 de advance.
- [ ] La solicitud muestra claramente: monto a recibir, **0% de costo para el usuario**, y la nota: "tu rendimiento futuro cubre este advance automáticamente".
- [ ] Se muestra el impacto: "Tu rendimiento seguirá creciendo; el advance se cubre solo en aproximadamente X meses" (calculado con APY del perfil y monto del advance).
- [ ] El desembolso se realiza vía SPEI a la CLABE del banco del usuario en < 24 horas hábiles.
- [ ] El usuario puede registrar su CLABE bancaria personal en Configuración > Datos Bancarios (con validación de cuenta).
- [ ] El usuario puede repagar parcial o totalmente en cualquier momento para liberar su colateral antes.
- [ ] Si el usuario no registra CLABE bancaria, el botón de liquidez está visible pero solicita completar ese paso primero.
- [ ] No hay liquidación forzada: el colateral permanece bloqueado hasta repago voluntario o cobertura automática vía rendimiento.

---

### MÓDULO 5: Configuración y Perfil

#### US-09: Gestión de cuenta
**Como** usuario registrado,  
**quiero** poder gestionar mis datos personales y preferencias,  
**para** mantener mi cuenta actualizada y segura.

**Criterios de Aceptación:**
- [ ] El usuario puede actualizar: nombre completo, teléfono, CLABE bancaria personal.
- [ ] El correo electrónico es inmutable (identificador principal) — puede contactar a soporte para cambiarlo.
- [ ] Cambio de contraseña requiere contraseña actual + nueva + confirmación.
- [ ] Hay opción de "Ver mi dirección de wallet" con botón de copiar (para usuarios técnicos).
- [ ] El historial completo de transacciones es descargable en CSV.

---

## 4. UI/UX Requirements

### 4.1 Principios de Diseño

1. **Confianza sobre innovación:** El diseño debe sentirse como fintech sólido, no como app crypto arriesgada. Colores sobrios, tipografía clara, datos verificables.
2. **Español como idioma nativo:** Todo el copy en español mexicano, sin anglicismos innecesarios. Términos financieros siempre explicados en lenguaje simple.
3. **Mobile-first responsive:** Aunque es web, el 70%+ del tráfico será móvil. Toda pantalla debe funcionar perfectamente en 375px+.
4. **Progresión visible:** El usuario siempre debe saber en qué paso está y cuánto falta para completar una acción.

### 4.2 Paleta y Sistema de Diseño

| Token | Valor sugerido | Uso |
|---|---|---|
| `color-primary` | `#1A3A2A` (verde oscuro) | CTAs principales, nav activo |
| `color-accent` | `#4CAF7D` (verde medio) | Ganancias, confirmaciones |
| `color-warning` | `#E8A838` | Alertas, warnings |
| `color-error` | `#D94F3D` | Errores, pérdidas |
| `color-bg` | `#F8F9FA` | Fondo principal |
| `color-surface` | `#FFFFFF` | Cards, modales |
| `font-display` | DM Serif Display | Números grandes, headlines |
| `font-body` | Inter o Figtree | Cuerpo de texto, UI |

### 4.3 Flujos de Usuario — Descripción de Pantallas

#### FLUJO A: Onboarding Completo (Nuevo Usuario)

**Pantalla A1 — Landing/Login:**
- Hero con propuesta de valor en 1 línea: "Tu retiro, con el doble de rendimiento que tu Afore."
- CTA primario: "Comenzar gratis"
- CTA secundario: "Ya tengo cuenta — Iniciar sesión"
- Social proof: número de usuarios activos + rendimiento promedio actual

**Pantalla A2 — Registro:**
- Formulario minimalista: campo correo + campo contraseña
- Botón "Crear mi cuenta"
- Texto legal breve con link a ToS y Política de Privacidad
- Estado de carga post-submit: "Creando tu cuenta segura..." (con animación)

**Pantalla A3 — Verificación de Correo:**
- Ilustración de envelope + instrucción clara
- "Revisa tu correo en [email]. Puede tardar hasta 2 minutos."
- Botón "Reenviar correo" (habilitado después de 60 segundos)
- Link de "Cambiar correo" por si cometió error

**Pantalla A4 — Cuestionario (5 pasos con progress bar):**
- Cada pregunta ocupa toda la pantalla (diseño tipo Typeform)
- Opciones visuales con íconos, no solo texto
- Botón "Anterior" siempre visible
- Progress bar numerada: "Pregunta 2 de 5"

**Pantalla A5 — Resultado de Perfil:**
- Card prominente con: nombre del perfil, descripción 2 líneas, APY rango, gráfica de composición
- Botón primario: "Empezar a ahorrar con este perfil"
- Botón secundario: "Ver otros perfiles"

**Pantalla A6 — Primera CLABE / Depósito:**
- CLABE mostrada grande con botón copiar
- Instrucciones en acordeón por banco (BBVA, Santander, Nu, Banamex, HSBC)
- Mensaje: "Tu primer depósito puede tardar hasta 15 minutos en reflejarse"
- Botón: "Ya deposité — ir a mi dashboard" (no bloquear si no han depositado aún)

---

#### FLUJO B: Dashboard Principal (Usuario Activo)

**Layout:**
- Nav lateral (desktop) / Tab bar inferior (móvil): Inicio, Bóveda, Proyecciones, Liquidez, Configuración

**Sección B1 — Resumen Hero:**
- Saldo total en número grande centrado: "$124,500 MXN"
- Sub-línea: "+$8,200 (7.0%) rendimiento total"
- Chip de perfil: "● Balanceado · 10.5% APY"

**Sección B2 — Proyección (módulo más prominente):**
- Toggle de horizonte: 10 / 20 / 30 años
- Número proyectado grande en verde
- Línea comparativa: "vs $X en Afore promedio · $Y más con Reyf"
- Gráfico de línea simple mostrando crecimiento Reyf vs Afore

**Sección B3 — Acciones Rápidas:**
- Botón primario: "Depositar"
- Botón secundario: "Acceder a liquidez"

**Sección B4 — Composición de Bóveda:**
- Gráfica de dona con instrumentos
- Lista debajo: instrumento, %, rendimiento individual

**Sección B5 — Actividad Reciente:**
- Lista de últimas 5 transacciones con fecha, tipo y monto
- Link "Ver historial completo"

---

#### FLUJO C: Solicitud de Liquidez

**Pantalla C1 — Inicio:**
- Explicación en 2 líneas de cómo funciona (colateral, no venta de activos)
- Slider para seleccionar monto (hasta 50% del saldo)
- Resumen dinámico: monto a recibir, tasa APR, plazo estimado

**Pantalla C2 — Confirmación:**
- Resumen completo de condiciones
- Campo: "CLABE donde recibirás el dinero" (pre-llenado si ya configuró)
- Checkbox de términos
- Botón "Confirmar solicitud"

**Pantalla C3 — Éxito:**
- Confirmación con número de folio
- "El dinero llegará a tu cuenta en máximo 24 horas hábiles"
- Botón "Volver al dashboard"

---

### 4.4 Estados de Error y Vacíos

| Situación | Comportamiento |
|---|---|
| Dashboard sin depósito | Estado vacío con CTA "Haz tu primer depósito" |
| SPEI pendiente de confirmar | Banner amarillo con spinner y tiempo estimado |
| Error de red en carga | Mensaje + botón "Reintentar" |
| Solicitud de liquidez rechazada | Explicación clara de por qué + alternativas |
| Saldo insuficiente para liquidez | Indicar monto mínimo requerido |

---

## 5. Technical Requirements

### 5.1 Stack Tecnológico

#### Frontend
| Capa | Tecnología | Justificación |
|---|---|---|
| Framework | Next.js 14 (App Router) | SSR para SEO, performance, routing nativo |
| UI Library | shadcn/ui + Tailwind CSS | Velocidad de desarrollo, consistencia |
| Gráficas | Recharts | Ligero, customizable, compatible con React |
| Estado global | Zustand | Simple, sin boilerplate excesivo |
| Auth UI | Auth.js (NextAuth) | Integración nativa con Next.js |
| Animaciones | Framer Motion | Transiciones de onboarding y dashboard |

#### Backend
| Capa | Tecnología | Justificación |
|---|---|---|
| Runtime | Node.js + tRPC o REST | Type-safe si tRPC, REST si equipo prefiere simplicidad |
| Base de datos | PostgreSQL (Supabase) | Relacional, RLS para seguridad, real-time opcional |
| ORM | Prisma | Type-safe, migraciones declarativas |
| Autenticación | Supabase Auth | Email/password nativo, extensible a OAuth |
| Queue / Jobs | BullMQ + Redis | Procesamiento de SPEI entrante, conversión MXNB |
| Storage | Supabase Storage | Documentos KYC si se requiere |

#### Blockchain / Web3
| Capa | Tecnología | Justificación |
|---|---|---|
| Red | Arbitrum One | L2 de Ethereum, bajas fees, alto throughput |
| Smart Wallets | Pimlico + ERC-4337 | Account Abstraction, gas patrocinado sin seed phrases |
| Stablecoin | MXNB (Bitso) | 1:1 MXN, regulado, on-chain |
| Bóveda | ERC-4626 Vault custom | Estándar de bóvedas tokenizadas, auditable |
| Proveedor RPC | Alchemy o Infura | Disponibilidad 99.9%, fallback automático |

#### Infraestructura
| Capa | Tecnología |
|---|---|
| Hosting Frontend | Vercel |
| Hosting Backend | Railway o Render |
| CDN | Cloudflare |
| Monitoreo | Sentry (errores) + Posthog (producto) |
| Logs | Logflare o Axiom |
| CI/CD | GitHub Actions |

---

### 5.2 Integraciones Externas

#### 5.2.1 SPEI / Pagos MXN
- **Proveedor:** Conekta, Clip o CUENCA (API de CLABE dedicadas)
- **Flujo:** Usuario transfiere a su CLABE → webhook notifica a backend → backend valida → convierte a MXNB → deposita en bóveda en Arbitrum
- **SLA:** Confirmación en < 15 minutos en horario bancario (7am–10pm)
- **Requirement:** Cada usuario tiene una CLABE única e inmutable asignada al registrarse

#### 5.2.2 MXNB (Bitso/Brale)
- **Uso:** Convertir MXN recibido por SPEI a MXNB on-chain
- **API:** Bitso API para mint/burn de MXNB según flujo de fondos
- **Requirement:** La conversión debe ser 1:1 sin fee visible al usuario (absorber en el modelo de negocio)

#### 5.2.3 Instrumentos Soberanos (Bóveda)
- **Proveedores potenciales:** Percent, Backed Finance, o protocolo propio con custodio regulado
- **Datos de rendimiento:** API del proveedor de bóveda para APY en tiempo real
- **Rebalanceo:** Automático según perfil, ejecutado on-chain por el smart contract de la bóveda

#### 5.2.4 Datos CONSAR (Comparativa Afore)
- **Fuente:** Portal público CONSAR — rendimiento promedio del sistema
- **Frecuencia de actualización:** Mensual (cron job que scrape o API si disponible)
- **Fallback:** Si no disponible, usar constante 5.5% APY con nota al usuario

#### 5.2.5 Notificaciones por Correo
- **Proveedor:** Resend o Postmark
- **Triggers:** Registro, verificación, depósito confirmado, rendimiento mensual, solicitud de liquidez

---

### 5.3 Seguridad y Compliance

| Área | Requirement |
|---|---|
| Autenticación | Email + contraseña con hash bcrypt. Sesiones JWT con refresh tokens. |
| Datos en reposo | Encriptación AES-256 en base de datos para datos sensibles (CLABE, dirección wallet) |
| Datos en tránsito | HTTPS/TLS 1.3 obligatorio en todos los endpoints |
| KYC/AML | MVP puede operar con registro simplificado hasta $30,000 MXN acumulado (revisar límites CNBV). Plan: integrar Metamap o Truora para KYC en V1.1 |
| Smart Contract | Auditoría de terceros antes de lanzar con fondos reales. Usar timelock en funciones administrativas. |
| Rate Limiting | Implementar en endpoints de autenticación y depósito (máx 10 intentos/min por IP) |
| GDPR/LFPDPPP | Política de privacidad conforme a ley mexicana. Opción de eliminar cuenta y datos. |

---

### 5.4 Performance Requirements

| Métrica | Target |
|---|---|
| Time to Interactive (home) | < 2.5 segundos |
| Dashboard load time | < 3 segundos |
| SPEI a depósito confirmado | < 15 minutos en horario bancario |
| Uptime | 99.5% mensual |
| Tiempo de respuesta API | < 500ms en p95 |

---

### 5.5 Modelo de Datos (Esquema Simplificado)

```sql
-- Usuarios
users (id, email, created_at, kyc_status, risk_profile)

-- Wallets
wallets (id, user_id, address, chain, created_at)

-- CLABEs
clabes (id, user_id, clabe_number, provider, created_at)

-- Bóvedas
vaults (id, user_id, risk_profile, balance_mxnb, balance_mxn_equivalent, created_at)

-- Transacciones
transactions (id, user_id, type [deposit|withdrawal|yield], amount_mxn, amount_mxnb, status, created_at, tx_hash)

-- Préstamos de liquidez
liquidity_loans (id, user_id, amount_mxn, collateral_mxnb, apr, status, created_at, repaid_at)

-- Rendimientos
yield_snapshots (id, vault_id, apy, instruments_breakdown jsonb, recorded_at)
```

---

## 6. Business Model & Monetización

### 6.1 Fuentes de Ingreso

| Fuente | Detalle | Aplica en MVP |
|---|---|---|
| **Management Fee** | 0.5–1% anual sobre AUM (assets under management). Cobrado mensualmente de los rendimientos. | ✅ Sí |
| **Spread en conversión MXN↔MXNB** | Margen pequeño (0.1–0.3%) en conversión, invisible al usuario | ✅ Sí |
| **Diferencial de liquidez** | El usuario recibe MXNB hoy a **0% de costo**; su colateral (1:1) queda bloqueado en la bóveda y sigue generando rendimiento off-chain. Reyf obtiene el diferencial entre el APR de los instrumentos subyacentes (8–14%) y el 0% que adelanta al usuario durante el plazo del advance. Si el usuario nunca repaga manualmente, el rendimiento acumulado cubre la deuda de forma natural. | ✅ Sí |
| **Seguros financieros** | Comisión por intermediar seguros de retiro, invalidez o vida integrados a la bóveda (fase futura) | ❌ Post-MVP |
| **Referidos B2B** | Fee por conectar usuarios a servicios financieros complementarios (seguros, crédito) | ❌ Post-MVP |

### 6.2 Unit Economics Target (MVP)

- **Depósito mínimo:** $500 MXN
- **Depósito promedio esperado:** $5,000–$15,000 MXN/usuario/mes
- **AUM necesario para break-even operativo:** ~$50M MXN (con 0.8% management fee)
- **Usuarios necesarios al break-even:** ~500–1,000 usuarios activos con $50K–$100K MXN en bóveda

---

## 7. Success Metrics

### 7.1 North Star Metric
> **70% de usuarios activos realizan ≥ 2 depósitos en sus primeros 30 días**

Este es el indicador primario de confianza real en el producto.

---

### 7.2 KPIs por Área

#### Adquisición
| KPI | Meta MVP (primeros 90 días) |
|---|---|
| Registros totales | 500 usuarios |
| % registros que completan onboarding (perfil + primer depósito) | ≥ 60% |
| Costo de adquisición (CAC) | < $500 MXN |

#### Activación
| KPI | Meta |
|---|---|
| % usuarios que hacen primer depósito en < 7 días de registro | ≥ 70% |
| Monto promedio primer depósito | ≥ $2,000 MXN |
| Tiempo promedio hasta primer depósito | < 48 horas |

#### Retención (North Star)
| KPI | Meta |
|---|---|
| % usuarios activos con ≥ 2 depósitos en 30 días | ≥ 70% |
| Retención de fondos a 90 días (% usuarios sin retiros) | ≥ 85% |
| Depósito mensual promedio por usuario activo | ≥ $5,000 MXN |

#### Producto / UX
| KPI | Meta |
|---|---|
| Tasa de completación del onboarding (inicio → primer depósito) | ≥ 55% |
| % usuarios que abren comparativa vs Afore | ≥ 80% |
| % usuarios que exploran función de liquidez | ≥ 20% |
| NPS (encuesta a 30 días) | ≥ 45 |
| CSAT de onboarding (encuesta post-registro) | ≥ 4.2/5 |

#### Negocio
| KPI | Meta a 90 días |
|---|---|
| AUM total en bóveda | ≥ $5M MXN |
| Ingresos por management fee | ≥ $40K MXN/mes al día 90 |
| Ingresos por préstamos de liquidez | Cualquier actividad — validar demanda |

#### Técnico
| KPI | Meta |
|---|---|
| Uptime de plataforma | ≥ 99.5% |
| Tiempo promedio SPEI → depósito confirmado | < 15 minutos |
| Tasa de error en conversión MXNB | < 0.1% de transacciones |

---

### 7.3 Eventos de Analytics a Instrumentar

```
onboarding_started
onboarding_email_verified  
onboarding_profile_completed (risk_profile: string)
onboarding_clabe_copied
first_deposit_initiated (amount: number)
first_deposit_confirmed (amount: number)
second_deposit_confirmed (days_since_first: number)  ← evento crítico del North Star
dashboard_projection_viewed (horizon: 10|20|30)
afore_comparison_viewed
liquidity_explored
liquidity_requested (amount: number)
profile_changed (from: string, to: string)
```

---

## 8. Implementation Roadmap

### Fase 0 — Fundamentos (Semanas 1–3)

**Objetivo:** Infraestructura base que no bloquea ninguna fase posterior.

| Tarea | Responsable | Prioridad |
|---|---|---|
| Setup repositorio, CI/CD, ambientes (dev/staging/prod) | Backend + DevOps | P0 |
| Setup base de datos PostgreSQL + Supabase Auth | Backend | P0 |
| Integración Smart Wallet (ERC-4337 via Pimlico) | Backend/Blockchain | P0 |
| Setup proveedor SPEI/CLABE (Conekta o equivalente) | Backend | P0 |
| Diseño de sistema (design tokens, componentes base) | Frontend/Design | P0 |

---

### Fase 1 — Onboarding (Semanas 4–6)

**Objetivo:** Un usuario puede registrarse, completar su perfil y recibir su CLABE.  
**Criterio de salida:** 10 usuarios internos completan el flujo de punta a punta.

| Tarea | Story |
|---|---|
| Pantalla de registro + verificación de correo | US-01 |
| Creación automática de wallet en Arbitrum | US-01 |
| Cuestionario de perfil de riesgo (5 preguntas) | US-02 |
| Pantalla de resultado de perfil + cambio manual | US-02 |
| Asignación y display de CLABE dedicada | US-03 |
| Instrucciones de depósito por banco | US-03 |
| Correos transaccionales (registro, verificación) | US-01/03 |

---

### Fase 2 — Bóveda y Depósito (Semanas 7–10)

**Objetivo:** Un usuario puede depositar por SPEI y ver su dinero crecer en la bóveda.  
**Criterio de salida:** Primer depósito real procesado exitosamente en staging.

| Tarea | Story |
|---|---|
| Webhook de SPEI entrante + validación | US-03 |
| Conversión MXN → MXNB (integración Bitso/MXNB) | US-03 |
| Depósito automático a bóveda ERC-4626 en Arbitrum | US-04 |
| Display de bóveda: saldo, rendimiento, composición | US-04 |
| Historial de transacciones | US-04 |
| Correo de confirmación de depósito | US-03 |
| Smart contract de bóveda (auditoría básica) | US-04 |

---

### Fase 3 — Dashboard y Proyecciones (Semanas 11–13)

**Objetivo:** Usuario entiende el valor de Reyf vs Afore con proyecciones claras.  
**Criterio de salida:** 80% de usuarios beta abren la comparativa Afore en primeras 24 horas.

| Tarea | Story |
|---|---|
| Gráfico de proyección interactivo (10/20/30 años) | US-06 |
| Cálculo de proyección con parámetros del usuario | US-06 |
| Módulo comparativa vs Afore (benchmark CONSAR) | US-07 |
| Simulador de depósito mensual objetivo | US-06 |
| Cron job de actualización datos CONSAR | US-07 |

---

### Fase 4 — Liquidez y Configuración (Semanas 14–16)

**Objetivo:** Usuario puede acceder a liquidez y gestionar su cuenta.  
**Criterio de salida:** Flow de liquidez completo en staging con préstamo de prueba.

| Tarea | Story |
|---|---|
| Pantalla de solicitud de liquidez con slider | US-08 |
| Lógica de colateral y LTV en smart contract | US-08 |
| Desembolso vía SPEI a CLABE del usuario | US-08 |
| Registro y validación de CLABE bancaria personal | US-08 |
| Pantalla de configuración de cuenta | US-09 |
| Cambio de perfil de riesgo (con restricción 30 días) | US-05 |
| Descarga de historial CSV | US-09 |

---

### Fase 5 — QA, Seguridad y Lanzamiento (Semanas 17–20)

**Objetivo:** Producto listo para usuarios reales con dinero real.

| Tarea | Responsable |
|---|---|
| Auditoría de smart contracts por tercero | Blockchain + externo |
| Pentest básico de backend y APIs | Backend + externo |
| QA end-to-end en todos los flujos principales | QA |
| Beta cerrada con 50 usuarios reales | Producto |
| Instrumentación de analytics (Posthog) | Frontend |
| Configuración de alertas de monitoreo (Sentry) | DevOps |
| Documentación de runbooks operativos | Backend |
| Lanzamiento público con waiting list | Producto/Marketing |

---

## 9. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Proveedor SPEI/CLABE rechaza integración o tarda en contratar | Media | Alto | Iniciar proceso de contratos en Semana 1. Tener 2 opciones (Conekta + Cuenca). |
| Falla en smart contract de bóveda → pérdida de fondos | Baja | Crítico | Auditoría antes de fondos reales. Empezar con límite máximo de $10K MXN por usuario en beta. |
| Regulación CNBV / Banxico requiere licencia que no tenemos | Media | Alto | Consultar abogado fintech en Semana 1. Operar dentro de límites de actividad no regulada mientras se obtiene licencia. |
| Volatilidad en MXNB o illiquidez | Baja | Alto | MXNB es 1:1 con MXN, reservas auditadas. Monitorear y tener plan de contingencia para cambio de stablecoin. |
| Bajo rendimiento de bóveda vs lo prometido | Media | Medio | Rangos APY siempre mostrados como estimados. Histórico actualizado mensualmente. |
| Fraude en depósitos SPEI (CLABE comprometida) | Baja | Medio | Validación de nombre y CURP del remitente donde posible. Límites de depósito diario en beta. |
| Baja conversión en onboarding | Alta | Medio | A/B testing desde Semana 1 de beta. Entrevistas con usuarios que no completan el flujo. |

---

*Este PRD es un documento vivo. Se actualiza al cierre de cada Fase con aprendizajes del producto.*

**Próximos pasos:**
1. [ ] Revisar y validar Stack Técnico con el equipo de desarrollo
2. [ ] Contratar proveedor SPEI/CLABE y firmar acuerdo
3. [ ] Consulta legal sobre regulación CNBV para actividad de inversión
4. [ ] Kick-off de Fase 0 con equipo de ingeniería
5. [ ] Definir herramienta de design system (Figma) y comenzar componentes base
