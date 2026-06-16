# Etherfuse + Pollar + Bóveda soberana — bitácora de implementación

**Rama:** `etherfuse-kyc-stablebonds`
**App:** Reyf (`Seyf2/`)
**Fecha:** junio 2026
**PR:** #4 → `main` (https://github.com/MarxMad/EthMex2026/pull/4)

> Doc complementario de `docs/etherfuse-kyc-stablebonds.md` (estado general de la
> integración). Este archivo documenta específicamente la sesión donde movimos el
> KYC a Perfil, hicimos Pollar headless y designamos una bóveda soberana.

---

## 1. Objetivo / visión del producto

- El usuario **no debe ver jerga**: nada de "CETES", "Stablebonds", "Etherfuse",
  "Stellar" ni "Pollar" en la UI. Todo va por detrás.
- Reyf ofrece **distintas bóvedas de ahorro**. Una de ellas está respaldada por
  bonos soberanos tokenizados (Etherfuse). Las demás se irán conectando a otros
  proveedores de yield.
- **Rieles separados**: no se unifica todo on-chain. MXNB/DeFi viven en Arbitrum;
  los bonos soberanos en Stellar. Solo se unifica la **identidad** y la
  **presentación** (todo se ve como "bóvedas").
- El **KYC de Etherfuse** es la pieza clave y debe vivir en **Perfil**, simple.
  Reyf no tenía KYC propio; se usa el de Etherfuse, presentado como propio.

---

## 2. Decisiones tomadas (forks resueltos con el usuario)

| Decisión | Elección |
|---|---|
| Wallet Stellar invisible | **Pollar headless con 1 OTP** (no custodial). Se maneja el OTP desde nuestra UI, sin el modal de Pollar, reusando el correo de Privy. |
| Alcance del cambio | Reorg de front + KYC en Perfil **+ designar/gatear** la bóveda soberana. |
| Página explícita de CETES | **Eliminada del front.** |
| Bóveda respaldada por Etherfuse | El plan **`conservador`** (deuda soberana de corto plazo). |

### Por qué 1 OTP es inevitable

Pollar es una wallet embebida **self-custodial**; su `PollarClientConfig` solo
acepta una `apiKey` publishable (de cliente) — **no hay llave de servidor** para
provisionar la wallet. Su auth es por **código de email (OTP)**:
`/auth/email` → `/auth/email/verify-code` → `/auth/login`. Por eso el usuario captura
**un código una sola vez** la primera vez; después la sesión persiste. No hay forma
de evitarlo sin dejar de usar Pollar (la alternativa era custodiar nosotros un
keypair Stellar en servidor, que el usuario descartó).

---

## 3. Arquitectura resultante

```
Usuario (1 correo)
  │
  ├─► Privy (email OTP) ──► Arbitrum ──► MXNB, bóvedas DeFi, SPEI Juno/Bitso
  │                         (login a la app)
  │
  └─► Pollar (email OTP, headless) ──► Stellar ──► bonos soberanos (Etherfuse)
                           (se crea al verificar identidad en Perfil)
```

- **`PollarProvider` ahora es global** (`src/components/Providers.tsx`), antes solo
  envolvía `/app/etherfuse/*`. Necesario porque el KYC vive dentro del shell.
- El KYC es una **pantalla interna** del router por estado (`Screen = "kyc"`), no una
  ruta de Next.js.

---

## 4. Qué se construyó / cambió

### KYC dentro del shell, sin jerga
- **`src/components/app/screens/kyc.tsx`** (`ScreenKyc`): pantalla nueva. Pasos:
  cuenta segura (OTP) → tus datos → identificación → términos → listo. Email
  autollenado desde Privy. Sin nombrar proveedores ni instrumentos.
- **`src/components/app/screens/account.tsx`**: tarjeta "Verifica tu identidad" en
  Perfil que enruta a `kyc`.
- **`src/components/app/nav.ts`**: `Screen` incluye `"kyc"`.
- **`src/components/app/ReyfApp.tsx`**: `kyc` en el mapa de screens; oculta tabs.

### Pollar headless
- **`src/lib/reyf/use-reyf-stellar-wallet.ts`**: maneja el OTP vía
  `getClient().login({provider:'email', email})` + `verifyEmailCode(code)`, con un
  state machine (`phase`: idle → sending → code → verifying → connected → error)
  alimentado por `onAuthStateChange`. El check `enabled` acepta
  `NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY` **o** `NEXT_PUBLIC_POLLAR_API_KEY` (igual que
  el provider).

### Bóveda soberana + gating KYC
- **`src/components/app/data.ts`**: `VaultPlan` gana `backend?: "etherfuse" | "defi"`
  y `kycGated?: boolean`. El plan `conservador` queda `backend:"etherfuse"`,
  `kycGated:true`.
- **`src/hooks/useKycStatus.ts`**: hook que devuelve `{ verified, loading, enabled }`.
  Degrada con gracia: si el servicio no está configurado, no bloquea.
- **`src/components/app/screens/invest.tsx`**: al abrir una bóveda `kycGated` sin
  verificación → `go("kyc")`.

### Limpieza de jerga / front
- Quitada la tarjeta "CETES tokenizados" de Ahorro.
- Eliminadas rutas `src/app/app/etherfuse/*` y componentes `src/components/etherfuse/*`.
- Reescritos los `blend`/textos en `data.ts`, `RiskQuiz.tsx`, `core.tsx`: de
  "CETES · Treasuries · …" a "Deuda soberana diversificada".

---

## 5. Flujo de usuario (end-to-end)

```
1. Perfil → "Verifica tu identidad"
2. ScreenKyc: "Enviar código" → Pollar manda OTP al correo de Privy
3. Usuario captura el código → wallet Stellar creada/recuperada (Pollar)
4. "Código verificado" → formulario de datos (CURP/RFC, dirección)
5. POST /api/reyf/kyc/submit → Etherfuse (idNumbers: mx_curp, mx_rfc)
6. Subir INE frente/reverso + selfie → /api/reyf/kyc/documents
7. Aceptar términos → /api/reyf/kyc/agreements
8. Listo → trustline asegurada en background. Ya puede abrir la bóveda soberana.
```

---

## 6. Bugs corregidos en esta sesión

| Síntoma | Causa | Fix |
|---|---|---|
| Pantalla "servicio no configurado" en local y Vercel | `NEXT_PUBLIC_POLLAR_API_KEY` no incrustada (dev stale / falta en Vercel) | Reiniciar dev / setear env en Vercel + redeploy. Las `NEXT_PUBLIC_*` se incrustan al **compilar**. |
| CORS `sdk.api.pollar.xyz` 403 | Dominio no autorizado en Pollar | Agregar el dominio de Vercel en el dashboard de Pollar. |
| `POST /api/reyf/kyc/submit` → 400 | idNumbers enviados como `curp`/`rfc`; Etherfuse espera `mx_curp`/`mx_rfc` | Cambiados los tipos en `ScreenKyc`. |
| Error mostrado como `[object Object]` | `new Error(j.error)` con `error` siendo objeto | Helper `readApiError()` (prioriza `debug_message` / `message_es`). |
| Sin feedback al verificar OTP | Transición directa a datos | Barra "Código verificado" antes del formulario. |
| Fix `enabled` perdido | Squash `(#3)` + merge de `main` sobrescribió el hook | Re-aplicado el fallback `PUBLISHABLE_KEY`. |

### ¿Se confunden el OTP de Privy y el de Pollar?

**No técnicamente.** Son SDKs y backends independientes, con sesiones y storage
separados; el código de uno no valida al otro ni sobreescribe su sesión. Lo único
compartido es el string del correo. El único riesgo es **UX** (dos correos con
código), mitigado porque ocurren en momentos distintos (login vs. verificación) y
porque la pantalla de OTP avisa: *"usa el código de verificación de identidad más
reciente; es distinto al de inicio de sesión"*.

---

## 7. Configuración (Vercel / env)

Variables necesarias en el entorno de despliegue (no se heredan del `.env` local):

```env
NEXT_PUBLIC_POLLAR_API_KEY=pub_testnet_...        # o NEXT_PUBLIC_POLLAR_PUBLISHABLE_KEY
NEXT_PUBLIC_POLLAR_STELLAR_NETWORK=testnet
ETHERFUSE_API_BASE_URL=https://api.sand.etherfuse.com
ETHERFUSE_API_KEY=...
ETHERFUSE_ONBOARDING_MODE=programmatic
ETHERFUSE_DEFAULT_BLOCKCHAIN=stellar
REYF_ALLOW_ETHERFUSE_RAMP=true
```

- Marcar las `NEXT_PUBLIC_*` para **Production y Preview**.
- Tras cambiar cualquier `NEXT_PUBLIC_*` → **redeploy** (se incrustan al build).
- Registrar el **dominio de Vercel** como origen permitido en el dashboard de Pollar.

---

## 8. Decisión pendiente — riel de fondeo de la bóveda soberana

El onramp de Etherfuse es **fiat MXN (SPEI/CLABE) → bono en Stellar**: **no acepta
MXNB** como origen. Las bóvedas de Reyf se fondean con **MXNB on-chain (Arbitrum)**.
Para que "fondear la bóveda soberana compre el bono por detrás" hay que elegir el
flujo de dinero:

- **(A)** SPEI directo a la CLABE de Etherfuse para esa bóveda *(la más simple; reusa el onramp tal cual)*.
- **(B)** Off-ramp MXNB→fiat + on-ramp por SPEI *(dos rampas, más fricción/costo)*.
- **(C)** Swap on-chain stable→bono *(Etherfuse no lo expone hoy; a confirmar)*.

**Estado:** la bóveda queda **designada y gateada por KYC**, pero el disparo del
onramp al fondear **no está cableado** hasta resolver el riel. El usuario lo dejó
pendiente a propósito.

---

## 9. Pendientes / siguientes pasos

1. Resolver la decisión de riel (sección 8) y cablear la orquestación.
2. Unificar perfil Privy ↔ Stellar en Supabase (`stellar_public_key`,
   `etherfuse_customer_id`) — hoy la sesión de onboarding vive en cookie.
3. Conectar las otras bóvedas a sus proveedores de yield (rieles separados).
4. Probar el submit KYC end-to-end en sandbox tras el fix `mx_curp`.
5. Decidir si el nombre "etherfuse" en los aliados de la landing se mantiene.

---

## 10. Referencias

- Doc general: `docs/etherfuse-kyc-stablebonds.md`
- [Etherfuse docs](https://docs.etherfuse.com/)
- [Pollar docs](https://docs.pollar.xyz/)
- PR: https://github.com/MarxMad/EthMex2026/pull/4
