import crypto from 'crypto';
import { NextResponse } from 'next/server';
import { withdrawMXNB } from '@/lib/juno/issue';
import { getWalletByClabe, addTransaction, addMonthlyUsage } from '@/lib/supabase/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  try {
    const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    const a = Buffer.from(signature, 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

interface JunoIssuance {
  network: string;
  amount: string;
  method: string;
  asset: string;
  deposit_receiver_clabe?: string;
  refunded: boolean;
}

interface JunoTransactionPayload {
  type: string;
  id: string;
  status: string;
  issuance?: JunoIssuance;
}

interface JunoWebhookEvent {
  event: string;
  payload?: JunoTransactionPayload;
}

// POST /api/juno/webhook — recibe eventos asíncronos de Juno/Bitso.
// Flujo principal: SPEI confirmado → busca wallet por CLABE → emite MXNB on-chain.
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get('x-bitso-signature');
  const webhookSecret = process.env.JUNO_WEBHOOK_SECRET;

  if (webhookSecret && signature) {
    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: 'Firma inválida' }, { status: 401 });
    }
  }

  let event: JunoWebhookEvent | null = null;
  try {
    event = rawBody ? (JSON.parse(rawBody) as JunoWebhookEvent) : null;
  } catch {
    return NextResponse.json({ error: 'Cuerpo JSON inválido' }, { status: 400 });
  }

  if (!event) {
    return NextResponse.json({ received: true, skipped: true });
  }

  console.log('[juno:webhook] evento recibido', JSON.stringify(event));

  // Solo procesar depósitos SPEI completados (ISSUANCE vía SPEI, status COMPLETE).
  const p = event.payload;
  if (
    event.event === 'TRANSACTION' &&
    p?.type === 'ISSUANCE' &&
    p.status === 'COMPLETE' &&
    p.issuance?.method === 'SPEI' &&
    !p.issuance.refunded &&
    p.issuance.deposit_receiver_clabe
  ) {
    const { deposit_receiver_clabe: clabe, amount } = p.issuance;
    const txId = p.id;
    const numericAmount = Number(amount);

    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      console.warn('[juno:webhook] monto inválido', amount);
      return NextResponse.json({ received: true, skipped: true, reason: 'monto inválido' });
    }

    // Buscar la wallet del usuario dueña de esta CLABE.
    const walletAddress = await getWalletByClabe(clabe);
    if (!walletAddress) {
      // CLABE no registrada — puede ser un depósito a la CLABE principal del negocio.
      console.warn('[juno:webhook] CLABE sin wallet asociada', clabe);
      return NextResponse.json({ received: true, skipped: true, reason: 'clabe sin wallet' });
    }

    try {
      // Emitir MXNB on-chain a la wallet del usuario (idempotente por txId de Juno).
      await withdrawMXNB(walletAddress, numericAmount, `spei-${txId}`);

      // Registrar en el ledger y acumular uso mensual.
      const period = new Date().toISOString().slice(0, 7); // "YYYY-MM"
      await addTransaction(walletAddress, {
        kind: 'deposit',
        amount: numericAmount,
        status: 'completed',
      });
      await addMonthlyUsage(walletAddress, period, 'deposit', numericAmount);

      console.log(`[juno:webhook] MXNB emitido: ${numericAmount} → ${walletAddress} (tx Juno: ${txId})`);
    } catch (e) {
      // No retornamos error 5xx para no provocar reintentos infinitos de Juno.
      // El problema queda logueado; se puede reprocessar manualmente.
      console.error('[juno:webhook] error al emitir MXNB', e);
      return NextResponse.json(
        { received: true, error: e instanceof Error ? e.message : 'error al emitir MXNB' },
        { status: 200 },
      );
    }
  }

  return NextResponse.json({ received: true, timestamp: new Date().toISOString() });
}
