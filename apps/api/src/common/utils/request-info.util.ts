export function extractRequestInfo(req: any) {
  return {
    ipAddress: req?.ip || req?.headers?.['x-forwarded-for'] || req?.socket?.remoteAddress || null,
    userAgent: req?.headers?.['user-agent'] || null,
  };
}
