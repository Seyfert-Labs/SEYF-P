import { NextResponse } from 'next/server';
import { JunoApiError } from './client';

// Helpers para uniformar las respuestas de los route handlers /api/juno/*.

export function ok(payload: unknown, metadata: Record<string, unknown> = {}) {
  return NextResponse.json({
    success: true,
    payload,
    metadata: { timestamp: new Date().toISOString(), ...metadata },
  });
}

export function fail(error: unknown, fallbackStatus = 500) {
  const status = error instanceof JunoApiError ? error.status : fallbackStatus;
  const message =
    error instanceof Error ? error.message : 'Error desconocido en la integración Juno';
  const details = error instanceof JunoApiError ? error.payload : undefined;
  return NextResponse.json(
    { success: false, error: { message, details } },
    { status },
  );
}

export function badRequest(message: string) {
  return NextResponse.json({ success: false, error: { message } }, { status: 400 });
}
