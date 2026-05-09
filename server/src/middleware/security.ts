// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (c) 2026 igorjs

import { secureHeaders } from "hono/secure-headers";

export const securityMiddleware = secureHeaders();
