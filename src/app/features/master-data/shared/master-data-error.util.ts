export function isReferentialIntegrityError(err: unknown): boolean {
  const payload = (err as { error?: { code?: string; error?: string; message?: string } })?.error;
  const code = `${payload?.code ?? ''} ${payload?.error ?? ''}`.toUpperCase();
  const message = `${payload?.message ?? ''}`.toUpperCase();
  return (
    code.includes('P2003') ||
    message.includes('P2003') ||
    message.includes('FOREIGN KEY') ||
    message.includes('CONSTRAINT') ||
    message.includes('RECORD IN USE')
  );
}
