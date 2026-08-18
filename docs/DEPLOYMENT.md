# Deployment and OpenAI configuration

## Visitor access and identity

The production site uses the Sites dispatch-owned **Sign in with ChatGPT** flow. `app/page.tsx` enforces identity on the server before rendering the client workspace, and both Agent API routes require the injected authenticated-user header. The application never handles Google, Microsoft, Apple or email passwords directly.

To admit external reviewers, publish the tested revision and set the Sites access policy to public. “Public” means the sign-in page is reachable; the application itself remains identity-gated. Do not add a second app-owned OAuth client or commit OAuth secrets.

The application has two independent AI authentication paths:

1. **Platform key** — configure `OPENAI_API_KEY` as a server-side Sites runtime secret. Optionally set `OPENAI_MODEL`; the default is `gpt-5.6`.
2. **Session key (BYOK)** — a user enters their own OpenAI API key in the Agent workspace. It is held in React memory, sent in a same-origin request to the server proxy, used for that request and never written to local storage, cookies, logs, project files or the model trace. Refreshing or closing the page clears it.

Do not place a real key in `.env.example`, Git, client JavaScript, a `NEXT_PUBLIC_` variable or a screenshot. A ChatGPT or Codex subscription is separate from OpenAI API billing.

## Local verification

```bash
cp .env.example .env.local
# Add OPENAI_API_KEY only if testing the platform-key path.
npm run dev
```

Open `/`, choose **Agent → OpenAI**, select the authentication method and model, then use **Test connection**. For BYOK testing, type the key only into the masked field in the local application—not into an issue, terminal transcript or chat message.

Create and manage personal or project-scoped keys at <https://platform.openai.com/api-keys>. The full secret is displayed only at creation time. If it was not saved, revoke the old key and create a replacement; an existing secret cannot be revealed again.

The model receives the user's question, recent conversation messages, structured findings and active rule metadata. Raw IFC bytes and uploaded PDF/DOCX/XLSX source files remain in the browser and are not sent by this Agent endpoint.

Before publication, run `npm run preupload`, configure the Sites runtime secret separately, deploy the tested commit, and repeat the connection and fallback browser smoke tests against the published URL.
