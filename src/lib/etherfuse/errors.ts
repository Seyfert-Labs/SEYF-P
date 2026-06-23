import { AppError } from "@/lib/reyf/api-error";

/**
 * Maps an Etherfuse HTTP error status code to a structured AppError.
 *
 * The raw providerMessage is stored in AppError.message for server-side
 * logging only — it is never forwarded to the client in response bodies.
 */
export function mapEtherfuseHttpError(
  status: number,
  providerMessage: string,
): AppError {
  // Status inválido (p. ej. 0) — no caer en el fallback generic_error silencioso
  if (!Number.isFinite(status) || status < 100 || status > 599) {
    return new AppError("provider_unavailable", {
      statusCode: 502,
      retryable: true,
      message: `HTTP status inválido (${String(status)}): ${providerMessage}`,
    });
  }

  // 429 — rate limited, retryable
  if (status === 429) {
    return new AppError("provider_unavailable", {
      statusCode: 429,
      retryable: true,
      message: providerMessage,
    });
  }

  // 502, 503 — bad gateway / service unavailable, retryable
  if (status === 502 || status === 503) {
    return new AppError("provider_unavailable", {
      statusCode: 502,
      retryable: true,
      message: providerMessage,
    });
  }

  // 504 — gateway timeout, retryable
  if (status === 504) {
    return new AppError("provider_unavailable", {
      statusCode: 504,
      retryable: true,
      message: providerMessage,
    });
  }

  // Other 5xx — not retryable
  if (status >= 500 && status <= 599) {
    return new AppError("provider_unavailable", {
      statusCode: 502,
      retryable: false,
      message: providerMessage,
    });
  }

  // 4xx (excluding 429, handled above) — client error, not retryable
  if (status >= 400 && status <= 499) {
    const low = providerMessage.toLowerCase();
    // 401/403 o "invalid organization id" / "invalid api key": problema de
    // credencial/configuración del proveedor (no es culpa del usuario). No filtrar
    // el detalle crudo; mostrar mensaje claro y registrar el técnico en el server.
    if (
      status === 401 ||
      status === 403 ||
      low.includes("organization id") ||
      low.includes("invalid api key") ||
      low.includes("unauthorized")
    ) {
      return new AppError("provider_unavailable", {
        statusCode: 503,
        retryable: false,
        message: providerMessage,
        messageEs:
          "El servicio de verificación de identidad no está disponible en este momento. Inténtalo de nuevo más tarde.",
      });
    }
    const messageEs = low.includes("proxy account")
      ? "Etherfuse no localizó la cuenta proxy Stellar de tu wallet. Ve a /anadir y activa la cuenta CLABE, asegúrate de que el KYC esté listo y que en Etherfuse la wallet y la cuenta bancaria estén activas; luego reintenta el bono."
      : low.includes("expired") ||
          low.includes("expire") ||
          low.includes("caduc") ||
          low.includes("invalid quote") ||
          low.includes("quote not found")
        ? "La cotización ya no es válida (~2 min) o no coincide con tu sesión. Vuelve atrás y pulsa de nuevo «Genera datos de depósito»."
        : low.includes("nonstable") ||
            low.includes("non_stable") ||
            low.includes("nonstableasset")
          ? "El activo de destino no es válido para esta rampa. Revisa en Etherfuse que CETES/MXNe figuren en /ramp/assets para tu wallet."
          : (low.includes("bank") && low.includes("account")) ||
              low.includes("clabe") ||
              low.includes("fiat account")
            ? "Revisa en devnet que la cuenta bancaria y la CLABE estén activas y coincidan con /identidad."
            : low.includes("not eligible") || low.includes("not_eligible")
              ? "Tu perfil en Etherfuse aún no puede cotizar esta operación. Completa KYC y términos en devnet y vuelve a intentar."
              : low.includes("pending onramp order already exists") ||
                  low.includes("already exists for this bank account and amount")
                ? "Ya tienes una orden de depósito pendiente con ese monto. Usa los mismos datos en Etherfuse o espera a que se procese; si acabas de intentar de nuevo, recarga la pantalla."
                : undefined;
    return new AppError("provider_rejected", {
      statusCode: 400,
      retryable: false,
      message: providerMessage,
      ...(messageEs ? { messageEs } : {}),
    });
  }

  // Fallback for unexpected status codes
  return new AppError("generic_error", {
    statusCode: 500,
    retryable: false,
    message: providerMessage,
  });
}

/**
 * Maps a network-level error (e.g. fetch failure, abort) to a structured AppError.
 *
 * AbortError signals a request timeout → 504 provider_unavailable.
 * All other network errors → 502 provider_unavailable.
 */
export function mapEtherfuseNetworkError(cause: unknown): AppError {
  if (cause instanceof Error && cause.name === "AbortError") {
    return new AppError("provider_unavailable", {
      statusCode: 504,
      message: "Request timed out",
    });
  }

  return new AppError("provider_unavailable", {
    statusCode: 502,
  });
}
