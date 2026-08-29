# Session Notes

## Why the AI Still Added All Plugins As Dependencies

Because you are using Vite as your Storybook builder (`@storybook/react-vite`), your AI likely ran into a generic Vite compilation or configuration error during a workspace-wide build.Instead of fixing the actual root cause (like a missing global style, an unconfigured Vite alias, or a misconfigured tsconfig.json paths mapping), the AI used a brute-force approach. It assumed that if every plugin knows about every other plugin's package path, whatever missing reference Storybook or Vite was complaining about would magically resolve.It worked to silence the compiler error, but it left you with a highly bloated and fragile dependency configuration.

## Event questions

The token event is a RAW string. All other event types are emitted as structured JSON objects.

In Roadie's architecture, text generation chunks are pumped directly to the Server-Sent Events (SSE) stream to minimize parsing overhead on the client side. Tokens are often small 3-byte payloads and wrapping them in JSON introduces stuttering in the frontend UI and network overhead.

- The data shape on the wire: data: " structured" or data: " code"
- The Danger: Passing this raw string chunk directly into JSON.parse() will instantly throw an exception and route execution directly into your catch block.
