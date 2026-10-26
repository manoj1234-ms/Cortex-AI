# Cortex AI

Cortex AI is a web-based AI workspace for chatting with AI agents, managing conversations, and using tools for coding, debugging, web search, document processing, presentations, and image understanding. Users sign in with Google through Firebase, and the app provides account credits and paid plans through Razorpay.

## Features

- Google sign-in with Firebase Authentication
- Persistent, user-specific conversations
- AI agent endpoints for chat, coding, debugging, search, PDF, PowerPoint, and vision tasks
- File upload support for chat and document workflows
- User credits, plan management, and Razorpay checkout
- React-based single-page application backed by Express services

## Architecture

```text
React + Vite frontend
        |
        | HTTPS API requests and session cookie
        v
Express gateway
  ├── Auth service     Firebase Admin, MongoDB, Redis sessions
  ├── Chat service     MongoDB conversations and messages
  ├── Agent service    AI providers, document tools, and AWS S3
  └── Billing service  Razorpay and MongoDB
```

The gateway is the frontend's API entry point. After Firebase sign-in, the auth service verifies the Firebase ID token and issues an HTTP-only session cookie. Protected gateway routes validate that session in Redis before forwarding requests to the relevant service.

## Technology

- Frontend: React, Vite, Redux Toolkit, Axios, Tailwind CSS
- Backend: Node.js, Express, MongoDB with Mongoose, Redis
- Authentication: Firebase Authentication and Firebase Admin
- AI and tools: LangChain integrations and configured model/search providers
- Payments and storage: Razorpay and AWS S3

## Prerequisites

- Node.js and npm
- A MongoDB deployment
- A Redis deployment
- Firebase project credentials for client and server authentication
- API credentials for the AI/search providers and integrations you intend to use
- Razorpay credentials to enable payments
- AWS credentials and an S3 bucket if using S3-backed features

## Local development

### 1. Configure environment variables

Create local `.env` files for the gateway and each backend service. Do not commit real credentials.

The gateway requires:

- `PORT`
- `FRONTEND_URL` — the exact frontend origin
- `AUTH_SERVICE`
- `CHAT_SERVICE`
- `AGENT_SERVICE`
- `BILLING_SERVICE`
- `REDIS_URL`

The auth, chat, and billing services require `PORT` and `MONGO_URI`. Auth and chat also require `REDIS_URL`. Billing additionally needs its Razorpay configuration and the auth service URL.

The agent service requires `PORT`, `MONGO_URI`, `REDIS_URL`, and the provider configuration for the features you use. Depending on enabled features, this may include model/search API keys, service URLs, Qdrant settings, and AWS S3 configuration.

The frontend needs a `frontend/.env` file with:

- `VITE_SERVER_URL` — the gateway's public base URL
- `VITE_FIREBASE_API_KEY` — the Firebase web app API key
- `VITE_RAZORPAY_KEY_ID` — the Razorpay key ID used by the checkout UI

Use the Firebase project configuration that matches the backend Firebase Admin credentials. Keep private keys, service-account JSON files, and secret values out of source control.

### 2. Install dependencies

Run `npm install` in each of these directories:

- `frontend`
- `backend/gateway`
- `backend/services/auth`
- `backend/services/chat`
- `backend/services/agent`
- `backend/services/billing`

### 3. Start Redis

From the `backend` directory:

```sh
docker compose up -d redis
```

### 4. Start backend services

Open a terminal for each service and run `npm run dev` from its directory:

- `backend/services/auth`
- `backend/services/chat`
- `backend/services/agent`
- `backend/services/billing`
- `backend/gateway`

Configure the gateway service URLs to point to the corresponding running services. Make sure each service can reach the same Redis deployment where required.

### 5. Start the frontend

From `frontend`:

```sh
npm run dev
```

Open the local URL printed by Vite. The gateway's `FRONTEND_URL` must match that origin for credentialed browser requests.

## Frontend commands

Run from `frontend`:

```sh
npm run dev
npm run build
npm run preview
npm run lint
```

## API routes

All browser API requests use `VITE_SERVER_URL` and the gateway's `/api` routes:

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Exchange a Firebase ID token for an application session |
| `GET` | `/api/auth/logout` | End the current session |
| `GET` | `/api/me` | Load the signed-in user's profile |
| `POST` | `/api/chat/create-conversation` | Create a conversation |
| `GET` | `/api/chat/get-conversations` | List the user's conversations |
| `POST` | `/api/chat/update-conversation` | Update conversation details |
| `GET` | `/api/chat/get-message/:conversationId` | Get conversation messages |
| `POST` | `/api/agent/chat` | Send a chat request, optionally with a file |
| `POST` | `/api/agent/debug` | Use the debugging agent |
| `POST` | `/api/agent/coding` | Use the coding agent |
| `POST` | `/api/agent/search` | Use the search agent |
| `POST` | `/api/agent/pdf` | Use the PDF agent |
| `POST` | `/api/agent/ppt` | Use the presentation agent |
| `POST` | `/api/agent/vision` | Use the vision agent |
| `POST` | `/api/billing/create` | Create a Razorpay order |
| `POST` | `/api/billing/verify` | Verify a Razorpay payment |

Except for login, application API routes require an authenticated session.

## AWS deployment notes

- Serve the frontend and API over HTTPS.
- Set `VITE_SERVER_URL` to the public gateway/API origin and rebuild the frontend after changing it.
- Set gateway `FRONTEND_URL` to the exact deployed frontend origin.
- For a CloudFront API behavior, forward cookies to the gateway and disable caching for authenticated API responses.
- Deploy Redis as a shared, network-reachable service for the auth service and gateway; `localhost` is not shared across separate containers or hosts.
- Configure backend service URLs and secrets in the deployment environment, not in the frontend bundle.

## Conclusion

Cortex AI brings authentication, conversation history, AI-powered tools, and billing together in one application. Its service-based backend separates gateway, auth, chat, agent, and billing responsibilities, while the React frontend provides a unified workspace. For reliable local and AWS deployments, configure each service with the correct environment values, keep the session cookie and Redis path consistent, and ensure CloudFront forwards authenticated cookies to the gateway.
