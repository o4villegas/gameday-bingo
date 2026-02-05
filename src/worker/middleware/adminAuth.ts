import { createMiddleware } from "hono/factory";

const ADMIN_CODE = "kava60";

export const adminAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const code = c.req.header("X-Admin-Code");
  if (code !== ADMIN_CODE) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});
