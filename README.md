# @tractioneye/storm-sdk

**AI agent SDK for autonomous futures trading on Storm Trade DEX via TractionEye.**

The Storm SDK gives AI agents everything needed to manage leveraged futures positions: open/close long and short positions, set Take Profit and Stop Loss orders, monitor operation lifecycle, and track strategy performance.

An agent becomes an autonomous futures strategy manager — opening positions with precise leverage, protecting them with TP/SL orders, and closing when conditions are met.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **12 agent tools** | Ready-to-use tool definitions for LLM agents (OpenClaw, LangChain, OpenAI, etc.) |
| **Futures trading** | Long/short positions with 2–100x leverage on Storm Trade DEX |
| **TP/SL orders** | Create Take Profit and Stop Loss orders for open positions |
| **Unified /agent/ API** | Same auth pattern as spot agent-kit — all requests via `/agent/*` endpoints |
| **Input validation** | Leverage range, amount, direction, required fields — validated before API call |
| **Retry with backoff** | Exponential backoff for transient errors (429, 502-504, network) |
| **Error wrapping** | All tools return `{error, code}` on failure — LLM can reason about errors |
| **Request timeout** | 30s timeout on all HTTP requests — no hung connections |
| **Logging** | Every client method logged with timestamp for debugging |

---

## Architecture

```
                ┌─────────────────────────────────────────────┐
                │     AI Agent (OpenClaw / LangChain / ...)   │
                │     Uses 12 tools + trading skill           │
                └──────────────────┬──────────────────────────┘
                                   │
                          ┌────────▼─────────┐
                          │   Storm SDK      │
                          │   StormClient    │
                          └────────┬─────────┘
                                   │  Authorization: agent <token>
                          ┌────────▼─────────┐
                          │  /agent/*        │
                          │  TractionEye API │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │  Storm Trade     │
                          │  DEX Sequencer   │
                          │  (on-chain)      │
                          └──────────────────┘
```

> **The SDK does not manage wallets or private keys.** All trade execution happens server-side on TractionEye infrastructure via Storm Trade sequencer.

---

## Install

```bash
npm install github:TractionEye/Storm_Agent
```

---

## Quick Start

### 1. Get your Agent Token

1. Open [TractionEye](https://t.me/TractionEyeTestBot/app) in Telegram
2. Create a strategy with **Storm Trade DEX** protocol
3. Go to your strategy → **Edit Strategy**
4. Tap **Generate Token**
5. Copy the token (shown only once)

> **One token = one strategy.** Tap **Regenerate** for a new token — the old one is revoked immediately.

### 2. Initialize the client

```ts
import { StormClient, createStormTools } from '@tractioneye/storm-sdk';

const client = await StormClient.create({
  agentToken: 'your-agent-token',
});

// Get all 12 tools for your AI agent
const tools = createStormTools(client);
```

### 3. First trading session

```
storm_get_strategy_info        → check balance, PnL, available capital
  ↓
storm_get_open_positions       → see current positions (avoid duplicates)
  ↓
storm_get_available_markets    → verify pair exists
  ↓
storm_open_position            → returns { operation_id, operation_status: "pending" }
  ↓
storm_wait_confirmation        → pass operation_id, wait for "confirmed"
  ↓
storm_create_order             → add TP/SL (AFTER position confirmed)
  ↓
storm_close_position           → returns { operation_id }
  ↓
storm_wait_confirmation        → wait for close to confirm
```

---

## Agent Tools

`createStormTools(client)` returns **12 tools**. Each tool has a description that tells the agent when and how to use it.

### Read tools (safe, no side effects)

| Tool | Description |
|------|-------------|
| `storm_get_strategy_info` | Strategy summary: TON balance, daily/weekly/monthly/yearly PnL, win rate, max drawdown, low balance state. **Call first** to understand available capital. |
| `storm_get_portfolio` | Portfolio overview: total realized/unrealized PnL in TON, token holdings with quantities and values. |
| `storm_get_open_positions` | All open futures positions: direction, asset, leverage, margin, entry price, PnL, TP/SL prices, swap status. **Call before opening** new positions. |
| `storm_get_all_deals` | Full trade history including closed deals. Use to analyze past performance and calculate cumulative PnL. |
| `storm_get_orders` | TP/SL order history with pagination: trigger prices, sizes, statuses, directions. Check before creating orders to avoid duplicates. |
| `storm_get_available_markets` | Supported trading pairs with settlement token and type. Verify pair exists before opening. |
| `storm_get_operation_status` | Check async operation status: pending → confirmed / failed / adjusted. Use for manual polling with `operation_id`. |

### Write tools (execute trades)

| Tool | Description |
|------|-------------|
| `storm_open_position` | Open long/short with leverage (2–100x). Set collateral in nanoTON, optional TP/SL in USD. Returns `{ operation_id }` for confirmation. |
| `storm_close_position` | Close position fully or partially. Amount in nanoTON. Returns `{ operation_id }`. |
| `storm_create_order` | Set Take Profit or Stop Loss on existing position. Call AFTER position is confirmed open. Trigger price in nanoTON. |
| `storm_wait_confirmation` | Wait until operation is confirmed on-chain (polls every 3s, timeout 120s). Pass `operation_id` from open/close. |

---

## API Endpoints Used

All requests go through `/agent/*` endpoints with `Authorization: agent <token>` — same auth pattern as the spot agent-kit.

| SDK Method | Endpoint | Method |
|------------|----------|--------|
| `getStrategyInfo()` | `/agent/strategy` | GET |
| `getPortfolio()` | `/agent/portfolio` | GET |
| `openPosition()` | `/agent/execute` | POST |
| `closePosition()` | `/agent/execute` | POST |
| `createOrder()` | `/agent/execute` | POST |
| `getOpenDeals()` | `/agent/execute` | POST |
| `getAllDeals()` | `/agent/execute` | POST |
| `getOrders()` | `/agent/execute` | POST |
| `getOperationStatus()` | `/agent/operation/{id}` | GET |

---

## Units — CRITICAL

The SDK uses two different price units. Confusing them will cause incorrect orders.

| Field | Unit | Example |
|-------|------|---------|
| `amount`, `margin`, `marginIn` | **nanoTON** | `100000000` = 0.1 TON |
| `limit_price`, `stop_trigger_price`, `triggerPrice` | **nanoTON** | `100000000000` |
| `entry_price`, `stop_loss_price`, `take_profit_price` | **USD** | `87150.5` |
| `leverage` | multiplier | `3.0` = 3x |

**1 TON = 1,000,000,000 nanoTON**

> **WARNING:** `stop_loss_price` and `take_profit_price` in `storm_open_position` are in **USD**. But `triggerPrice` in `storm_create_order` is in **nanoTON**. These are different units for price fields.

---

## Operation Lifecycle

All write operations (`openPosition`, `closePosition`, `createOrder`) return a unified response:

```ts
{
  operation_id: "abc-123",        // use this to poll status
  operation_status: "pending",    // pending → confirmed | failed | adjusted
  failure_reason: null,
  execution_result: {
    deal_id: 742,                 // deal ID for reference
    ...
  }
}
```

Settlement is asynchronous (on-chain). Poll with `storm_wait_confirmation(operation_id)` or `storm_get_operation_status(operation_id)`.

---

## Supported Markets

| Pair | Settlement | Type | Description |
|------|-----------|------|-------------|
| BTC/USD | TON | coinm | Bitcoin with TON margin |
| ETH/USD | TON | coinm | Ethereum with TON margin |
| TON/USD | TON | coinm | Toncoin |
| NOT/USD | NOT | coinm | Notcoin |
| TRUMP/USD | TON | coinm | Trump |
| BTC/USDT | USDT | base | Bitcoin with USDT margin |
| ETH/USDT | USDT | base | Ethereum with USDT margin |
| TON/USDT | USDT | base | Toncoin with USDT margin |

> Storm Trade may add new markets over time. The SDK's list may not include all pairs.

---

## Examples

### Open a 3x long BTC with 1 TON, SL at $80k, TP at $100k

```ts
const info = await client.getStrategyInfo();
console.log('Available:', info.ton_in_strategy, 'nanoTON');

const positions = await client.getOpenDeals();
console.log('Open positions:', positions.length);

// Open position
const result = await client.openPosition({
  direction: 'long',
  pair: 'BTC/USD',
  leverage: 3,
  amount: 1_000_000_000,        // 1 TON collateral
  margin: 1_000_000_000,        // same as amount
  deal_type: 'market',
  stop_loss_price: 80000,       // USD
  take_profit_price: 100000,    // USD
});
console.log('Operation ID:', result.operation_id);

// Wait for on-chain confirmation
const status = await client.waitForConfirmation(result.operation_id);
console.log('Status:', status.operation_status); // "confirmed"
console.log('Deal ID:', status.execution_result?.deal_id);
```

### Close 50% of a position

```ts
const positions = await client.getOpenDeals();
const position = positions[0];

const result = await client.closePosition({
  id: position.id,
  amount: Math.floor(position.margin / 2),
});

const status = await client.waitForConfirmation(result.operation_id);
console.log('Closed:', status.operation_status);
```

### Set TP/SL order on existing position

```ts
// Call AFTER position is confirmed open
const result = await client.createOrder({
  order_type: 'takeProfit',
  baseAsset: 'BTC',             // extract from pair "BTC/USD"
  direction: 'long',
  marginIn: 1_000_000_000,
  amount: 1_000_000_000,
  triggerPrice: 100_000_000_000_000, // nanoTON (NOT USD!)
});
```

---

## Error Handling

All tool handlers return structured errors instead of throwing:

```ts
// Successful response
{ operation_id: "abc-123", operation_status: "pending", ... }

// Error response from tool handler
{ error: "HTTP 400 for POST /agent/execute", code: 400 }
{ error: "leverage must be 2–100, got 200" }
{ error: "Operation abc-123 not found" }
```

### Error codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid parameters or Storm keys not configured |
| 404 | Strategy or deal not found |
| 409 | Conflict (no open position to close) |
| 500 | Internal error |

---

## Integration with Agent Frameworks

### OpenClaw

```ts
import { StormClient, createStormTools } from '@tractioneye/storm-sdk';

const client = await StormClient.create({ agentToken: process.env.AGENT_TOKEN! });
const tools = createStormTools(client);

// Convert to OpenAI function-calling format
const openaiTools = tools.map(t => ({
  type: 'function' as const,
  function: {
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }
}));

// Handle tool calls from the LLM
async function handleToolCall(name: string, args: Record<string, unknown>) {
  const tool = tools.find(t => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  return tool.handler(args);
}
```

### Using with spot trading agent-kit

The Storm SDK can be used alongside `@tractioneye/agent-sdk` (spot trading). Both use the same agent token format and `/agent/*` API. Create separate clients for each:

```ts
import { TractionEyeClient, createTractionEyeTools } from '@tractioneye/agent-sdk';
import { StormClient, createStormTools } from '@tractioneye/storm-sdk';

// Spot trading (Omniston protocol)
const spotClient = await TractionEyeClient.create({ agentToken: spotToken });
const spotTools = createTractionEyeTools(spotClient);

// Futures trading (Storm Trade protocol)
const futuresClient = await StormClient.create({ agentToken: futuresToken });
const futuresTools = createStormTools(futuresClient);

// Combined tools for the agent
const allTools = [...spotTools, ...futuresTools];
```

---

## HTTP Client Features

| Feature | Details |
|---------|---------|
| **Auth** | `Authorization: agent <token>` header on all requests |
| **Timeout** | 30 seconds per request (AbortController) |
| **Retry** | 3 retries with exponential backoff (1s, 2s, 4s) for 429/502/503/504 and network errors |
| **JSON validation** | Rejects empty and non-JSON responses (no silent `{}`) |
| **Logging** | All methods logged with `[storm-sdk <timestamp>]` prefix |

---

## Trading Skill

The SDK includes `skills/storm-trading.md` — a behavioral specification for AI futures trading agents:

- **Decision flowchart**: check balance → check positions → verify pair → open → confirm → set TP/SL
- **Unit reference**: critical USD vs nanoTON distinction
- **Example workflows**: open position, partial close, set TP/SL, error recovery
- **8 safety rules**: balance check, position check, pair verification, confirmation wait, no opposing positions, TP/SL requirement, risk limits, baseAsset extraction

Designed for [OpenClaw](https://openclaw.com) agents. Compatible with any LLM agent framework that supports function calling.

---

## Local Development

```bash
git clone https://github.com/TractionEye/Storm_Agent
cd Storm_Agent
npm install
npm run build
```

---

## License

MIT
