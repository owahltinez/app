import { Hono } from "hono";
import { cors } from "hono/cors";

function urlFetchAuthOptions(url, env) {
  switch (url.hostname) {
    case "trackapi.nutritionix.com":
      return {
        headers: {
          "Content-Type": "application/json",
          "x-app-id": env.NUTRITIONIX_APP_ID,
          "x-app-key": env.NUTRITIONIX_API_KEY,
        },
      };
    default:
      return {};
  }
}

const app = new Hono();
app.use(cors());

app.all("/", async (ctx) => {
  const params = new URL(ctx.req.url).searchParams;
  const targetUrl = params.get("url");
  params.delete("url");

  const url = new URL(targetUrl);
  params.forEach((value, key) => url.searchParams.set(key, value));

  // If the request has a body, append it to the forwarded request.
  const body = (await ctx.req.text()) || undefined;

  const authOptions = urlFetchAuthOptions(url, ctx.env);
  return fetch(url, { method: ctx.req.method, body, ...authOptions });
});

export default app;
