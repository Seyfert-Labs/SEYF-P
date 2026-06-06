# 🏦 Reyf — La AFORE del futuro

> **El retiro digno que el sistema no te va a dar: en pesos y dólares digitales, rindiendo desde el día uno, on-chain y para todos — incluido el 57% que ninguna AFORE cubre.**

**Reyf** es una super app de ahorro para el retiro construida sobre **MXNB** (el peso digital de Bitso/Juno en Arbitrum). Convierte rieles cripto en una experiencia de neobanco que cualquiera entiende: sin gas, sin seed phrases, sin saber que hay blockchain debajo.

- 🔗 **Demo en vivo:** https://eth-mex2026.vercel.app
- 💻 **Código:** https://github.com/MarxMad/EthMex2026
- 🎬 **Video demo:** _[pega tu link de YouTube]_

---

## 🔴 El problema

El sistema de pensiones en México está roto por diseño:

- **Tasa de reemplazo ~30%** → te retiras con menos de un tercio de tu último sueldo.
- **~57% de informalidad** → más de la mitad de los trabajadores (gig, freelancers, independientes) **no tienen AFORE**.
- **Concentración + inflación** → las SIEFOREs están casi todas en activos en pesos; 40 años de devaluación se comen tu poder de compra.
- **Opacidad** → nadie lee su estado de cuenta anual; el ahorro voluntario, con beneficio fiscal, está subutilizado.

## 🟢 La solución

Reyf es **la AFORE del futuro**: voluntaria, global, on-chain y para todos. Cada peso que ahorras vive on-chain como MXNB — es genuinamente tuyo, rinde y se mueve global — pero la app se siente como cualquier banco.

| Feature | Por qué importa para el retiro |
|---|---|
| 💰 **MXNB que rinde diario** | Interés compuesto desde el peso 1 |
| 💵 **Diversificación en dólares (FX justo)** | Blindaje contra 40 años de devaluación del peso |
| 🏛️ **Bonos soberanos de 4 países desde $50** | El portafolio de una pensión, global y sin mínimos |
| 🎯 **Bóvedas con aporte automático** | El ahorro voluntario vuelto hábito |
| ⚡ **Adelanto de liquidez** | Emergencias sin romper tu retiro |
| 👁️ **On-chain y en tiempo real** | Ves tu retiro crecer hoy, no en un PDF anual |

---

## ✨ Lo verdaderamente innovador (la arquitectura)

El reto: ¿cómo ofrece un fintech chico **FX y rendimiento grado-exchange** sin que cada usuario tenga una cuenta en un exchange? Bitso/Juno ve **una sola cuenta de negocio** (pooled). La atribución per-usuario no se le pide al exchange — **vive en nuestro ledger reconciliado**.

```
1. Smart wallets de usuarios  (on-chain, por-usuario, tienen MXNB)
          |  transfieren MXNB
          v
2. Pool del negocio — UNA cuenta Bitso/Juno (MXN/USDT revuelto)
          |  cada movimiento se atribuye al wallet_address
          v
3. Ledger per-usuario (Supabase, keyed por wallet_address)
          |
          v
4. Invariante de solvencia:  SUMA(todos los usuarios) <= saldo real del pool
```

**Conversión orquestada, atómica e idempotente** (`/api/convert`):

```ts
// 1. reserva idempotente (un reintento NO duplica la orden)
await beginConversion(wallet, { id: key, from, to, kind });
// 2. orden de mercado real en Bitso
const order = await placeConversionOrder(from, to, amount);
// 3. (inverso) emite MXNB on-chain a la wallet del usuario vía Juno
if (inverse) await withdrawMXNB(address, filledTo, key);
// 4. liquida el ledger con los montos EJECUTADOS reales
await completeConversion(key, { amountFrom, amountTo, oid: order.oid });
```

Y un **invariante de solvencia** verificable (`/api/treasury/reconcile`): para cada activo, `SUMA(ledger de todos los usuarios) <= saldo real del pool`. El sobrante es la reserva del negocio.

---

## 🔌 Integración Bitso / Juno / MXNB (sponsor track)

- **MXNB on Arbitrum** como activo base (ERC-20, 6 decimales) — saldo, transferencias y rendimiento.
- **Juno Mint Platform** — issuance (depósito SPEI → mint MXNB), **withdrawals** (MXNB on-chain a la wallet del usuario), **redemptions** (MXNB→MXN, fondeo del pool).
- **Bitso Exchange API** — órdenes de mercado para FX real (MXNB ↔ USDT) a tipo de cambio interbancario.
- **Firma HMAC server-side** — las llaves de Bitso/Juno **nunca** tocan el cliente; toda orden se firma en route handlers.
- ✅ **Probado end-to-end en stage:** redemption fondea el pool; forward (MXN→USDT) e inverse (USDT→MXNB on-chain) ejecutan con ledger + reconciliación sana.

## 🧱 Stack técnico

- **Next.js 16** (App Router) · **React 19** · **TypeScript** · **Tailwind v4**
- **Privy** — auth + embedded wallet + **smart wallet ERC-4337 con gas patrocinado** (UX sin gas)
- **viem 2 + permissionless 0.2** — onchain
- **Supabase** — persistencia + ledger per-usuario reconciliado
- **Foundry** — contratos (`ReyfVaults`, `ReyfAdvance`)
- **Arbitrum** — settlement L2 barato y rápido

## 📲 Features

- Onboarding con quiz de perfil de riesgo
- Bóvedas de ahorro con meta y aporte automático
- Convertir MXN ⇄ divisas con tipo de cambio real (pop-up de confirmación + estado pendiente en historial)
- Bonos soberanos de 4 países
- Adelanto de liquidez contra tu ahorro
- Tarjeta global (gasto multi-divisa)
- Bono de bienvenida, CLABE de depósito (SPEI), límites mensuales

## 🛣️ Roadmap

1. **Hoy** — capa de ahorro para el retiro **voluntario** (100% legal, sin licencia de AFORE)
2. **Next** — nómina en USD que aterriza en segundos · ahorro recurrente automatizado · reconciliación + auth server-side
3. **Visión** — el estándar de retiro on-chain para LatAm conforme madura la regulación de activos digitales

> **No esperes una pensión. Constrúyela.**

---

## 👥 Equipo

- _[Nombre] — Full-stack / Web3_
- _[Nombre] — [rol]_
