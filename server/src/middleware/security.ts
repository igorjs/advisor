import { secureHeaders } from "hono/secure-headers";

export const securityMiddleware = secureHeaders();
