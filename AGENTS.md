# Project Guidelines: WsRouter (Deno Router)

Welcome to the WsRouter project! This file (`AGENTS.md`) is automatically injected into the AI's system instructions. You MUST strictly adhere to the following architectural rules and constraints when modifying or extending this codebase.

## 1. Runtime & Environment (Pure Deno)
- **Deno Only**: This project runs entirely on Deno. 
- **NO Node.js or Local NPM**: Do NOT use `npm install`, do NOT create a `node_modules` directory locally, and do NOT rely on Node.js specific APIs.
- **Dependency Management**: All dependencies are managed exclusively via `deno.json` using `npm:` and `jsr:` specifiers (e.g., `npm:preact`, `jsr:@std/testing`).

## 2. Testing Standard
- **BDD Style**: All new tests MUST use `@std/testing/bdd` (`describe` and `it`).
- **Assertions**: Use `@std/assert` (`assertEquals`, `assert`, etc.).
- **No Direct Deno.test**: Do NOT use the raw `Deno.test()` syntax for new tests.
- **Command**: Run tests using `deno task test` or `deno task check-all`.

## 6. AI Studio Environment Constraints & Bootstrapping
- **Port 3000**: The development server (Deno's native serve in `example/principal/main.ts`) MUST run on port 3000, as enforced by the AI Studio environment (config .env file with PORT=3000).
- **HMR**: Hot Module Replacement is disabled. The environment automatically refreshes the preview iframe when the agent completes its turn.
- **Node.js Bridge (`package.json` & `install-script.sh`)**: Although this is a pure Deno project, the underlying AI Studio container natively expects a Node.js ecosystem. We retain `package.json` EXCLUSIVELY as a bridge to expose the standard `dev`and `lint` scripts required by the platform. These scripts trigger `install-script.sh` to download and bootstrap the Deno CLI on the fly during container initialization, enabling our Deno-native workflow.

## 7. Development Workflow & Continuous Validation
- **Mandatory Verification**: After executing ANY task, feature request, or to-do list item, you MUST verify the project's integrity by running:
  - Linter & Type Check: `npm run lint` (which runs `deno check` under the hood).
  - Tests: `deno task test`.
- **Proactive Unit Testing**: Whenever you implement new functions, utilities, or complex logic, you MUST proactively create unit tests for them using the `@std/testing/bdd` standard. Do not wait for the user to explicitly ask for tests.

By following these guidelines, we maintain a fast, dependency-free, and cohesive Deno/Preact environment without the overhead of Node.js toolchains or complex CSS bundlers.

We are developing an PWA app following a planned directive and tasks. Follow instruction for actual status and next task at CURRENT.md file.
