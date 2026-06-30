# SEYF en Stellar — PULSO Hackathon

Versión de **SEYF** (super-app fintech) que lleva sus **bóvedas de rendimiento** a
**Stellar/Soroban**, usando **[DeFindex](https://www.defindex.io/)** como infraestructura
de yield. El usuario abre una bóveda, deposita y retira un asset real on-chain, y ve su
saldo y APY reales — todo firmado desde una wallet embebida Stellar sin que tenga que
salir de la app.

> Rama: `Stellar-PulsoImplementation`. La versión EVM (Arbitrum) original queda intacta
> en `main`; aquí solo se **activa el riel Stellar** mediante una env flag.

## Por qué toca Stellar de forma load-bearing

El núcleo del producto — el ahorro con rendimiento — corre sobre una **DeFindex vault de
Soroban**. No es un adorno: cada depósito/retiro es una transacción Soroban firmada por la
wallet del usuario y liquidada en la red de Stellar. La app ya integraba Stellar para
on-ramp SPEI→CETES (Etherfuse) y KYC; esta versión suma el motor de rendimiento.

## Arquitectura

```
Pantalla Ahorro (invest.tsx)
   └─ useVaultsRail  ── NEXT_PUBLIC_STELLAR_VAULTS=true ──> useStellarVaults
                                                              │
       metadata (nombre/meta/color) ── store (Supabase/localStorage)
       saldo + APY reales ───────────── /api/defindex/*  ── @defindex/sdk ──> api.defindex.io
       firma de transacciones ───────── Pollar (wallet embebida Stellar)
```

**Flujo de un depósito (mismo patrón para retiro):**

1. `POST /api/defindex/deposit { caller, amount }` → el server llama `sdk.depositToVault(...)`
   y devuelve el **XDR sin firmar** (ya simulado/preparado por DeFindex).
2. El cliente firma con Pollar: `getClient().signAndSubmitTx(xdr)` — firma **sin re-simular**
   (respeta el footprint de Soroban) y envía a la red.
3. Se relee el saldo desde DeFindex.

La **API key de DeFindex vive solo en el servidor** (route handlers `/api/defindex/*`),
igual que los secrets de Juno/Bitso/Etherfuse. El navegador nunca la ve.

### Archivos clave

| Pieza | Ruta |
|---|---|
| Cliente SDK (server) | `src/lib/defindex/client.ts` |
| Config vault + unidades | `src/lib/defindex/vaults.ts` |
| Route handlers | `src/app/api/defindex/{vault-info,balance,deposit,withdraw,submit}/route.ts` |
| Hook de bóvedas Stellar | `src/hooks/useStellarVaults.ts` |
| Selector de riel | `src/hooks/useVaultsRail.ts` |
| Wallet Stellar (Pollar) | `src/lib/seyf/use-seyf-stellar-wallet.ts` |

## Configuración

1. Crea una API key en `https://api.defindex.io/register` → login → dashboard.
2. Crea (o reusa) una vault de **testnet** en `app.defindex.io` y anota su dirección `C...`
   y su asset subyacente (p.ej. USDC, 7 decimales).
3. Copia `.env.example` a `.env.local` y completa:

```bash
NEXT_PUBLIC_STELLAR_VAULTS=true
DEFINDEX_API_KEY=sk_...
NEXT_PUBLIC_DEFINDEX_VAULT_ADDRESS=C...
NEXT_PUBLIC_DEFINDEX_ASSET_SYMBOL=USDC
NEXT_PUBLIC_DEFINDEX_ASSET_DECIMALS=7
NEXT_PUBLIC_POLLAR_API_KEY=...
NEXT_PUBLIC_POLLAR_STELLAR_NETWORK=testnet
```

4. `npm install && npm run dev`.

## Demo (testnet)

1. Inicia sesión y enrola la wallet Pollar (OTP por correo).
2. Fondea la wallet de testnet con el asset subyacente de la vault (faucet / trustline).
3. Crea una bóveda → **Abonar** → firma con Pollar → confirma el saldo y APY reales.
4. **Retirar** para cerrar el ciclo. La tx se puede verificar en un explorer de Stellar testnet.

## Pendiente / siguiente

- **Blend** → adelanto de liquidez (préstamo sobre-colateralizado) sobre la posición de la bóveda.
- **SDEX** → conversión XLM↔USDC on-chain (Stellar DEX vía Horizon).
- Conectar el on-ramp SPEI→Stellar directamente al depósito en la vault.
- UI: el copy de la pantalla aún dice "MXN"; al usar un asset distinto (USDC) conviene
  mostrar el símbolo del asset subyacente.
