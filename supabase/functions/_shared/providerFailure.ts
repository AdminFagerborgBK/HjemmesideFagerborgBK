/** Never interpolate provider bodies or exceptions: they may contain credentials. */
export function providerFailure(service: 'Facebook' | 'Resend', status: number): string {
  const code = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 502;
  return `${service} avviste forespørselen (HTTP ${code}). Kontroller tilkoblingen før du prøver igjen.`;
}