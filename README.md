# @tractioneye/storm-sdk

**AI agent SDK for autonomous futures trading on Storm Trade DEX via TractionEye.**

The Storm SDK gives AI agents everything needed to manage leveraged futures positions: open/close long and short positions, set Take Profit and Stop Loss orders, monitor deal lifecycle, and track strategy performance.

An agent becomes an autonomous futures strategy manager — opening positions with precise leverage, protecting them with TP/SL orders, and closing when conditions are met.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **11 agent tools** | Ready-to-use tool definitions for LLM agents (OpenClaw, LangChain, OpenAI, etc.) |
| **Futures trading** | Long/short positions with 2–100x leverage on Storm Trade DEX |
| **TP/SL orders** | Create Take Profit and Stop Loss orders for open positions |
| **Deal lifecycle** | Full async lifecycle: open → poll → confirmed → close → poll → confirmed |
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
                │     Uses 11 tools + trading skill           │
                └──────────────────┬──────────────────────────┘
                                   │
                          ┌────────▼─────────┐
                          │   Storm SDK      │
                          │   StormClient    │
                          └────────┬─────────┘
                                   │
                          ┌────────▼─────────┐
                          │  TractionEye     │
                          │  Backend API     │
                          │  (Storm Trade    │
                          │   integration)   │
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

// Get all 11 tools for your AI agent
const tools = createStormTools(client);
```

### 3. First trading session

```
storm_get_strategy_info     → check balance, PnL, available capital
  ↓
storm_get_open_positions    → see current positions (avoid duplicates)
  ↓
storm_get_available_markets → verify pair exists
  ↓
storm_open_position         → open long/short with leverage + TP/SL
  ↓
storm_wait_confirmation     → wait for on-chain settlement
  ↓
storm_create_order          → add TP/SL if not set at open time
  ↓
storm_close_position        → close when ready
  ↓
storm_wait_confirmation     → wait for on-chain settlement
```

---

## Agent Tools

`createStormTools(client)` returns **11 tools**. Each tool has a description that tells the agent when and how to use it.

### Read tools (safe, no side effects)

| Tool | Description |
|------|-------------|
| `storm_get_strategy_info` | Strategy summary: TON balance, daily/weekly/monthly/yearly PnL, win rate, max drawdown, low balance state. **Call first** to understand available capital. |
| `storm_get_open_positions` | All open futures positions: direction, asset, leverage, margin, entry price, PnL, TP/SL prices, swap status. **Call before opening** new positions. |
| `storm_get_all_deals` | Full trade history including closed deals. Use to analyze past performance and calculate cumulative PnL. |
| `storm_get_aggregated_positions` | Positions grouped by token: total amount, total TON invested, realized PnL, entry price per asset. Portfolio overview. |
| `storm_get_orders` | TP/SL order history with pagination: trigger prices, sizes, statuses, directions. Check before creating orders to avoid duplicates. |
| `storm_get_available_markets` | Supported trading pairs with settlement token and type. Verify pair exists before opening. |
| `storm_get_swap_status` | Check async deal status: pending → confirmed / failed / adjusted. Use for manual polling. |

### Write tools (execute trades)

| Tool | Description |
|------|-------------|
| `storm_open_position` | Open long/short with leverage (2–100x). Set collateral in nanoTON, optional TP/SL in USD. Returns deal ID for confirmation polling. |
| `storm_close_position` | Close position fully or partially. Amount in nanoTON. Returns "pending" status. |
| `storm_create_order` | Set Take Profit or Stop Loss on existing position. Trigger price in nanoTON. |
| `storm_wait_confirmation` | Block until deal is confirmed on-chain (polls every 3s, timeout 120s). Handles transient network errors. |

---

## Units — CRITICAL

The SDK uses two different price units. Confusing them will cause incorrect orders.

| Field | Unit | Example |
|-------|------|---------|
| `amount`, `margin`, `marginIn` | **nanoTON** | `100000000` = 0.1 TON |
| `limit_price`, `stop_trigger_price`, `triggerPrice` | **nanoTON** | `100000000000` |
| `entry_price`, `stop_loss_price`, `take_profit_price` | **USD** | `87150.5` |
| `leverage` | multiplier | `3.0` = 3x |
| `profit_or_loss` | nanoTON | `150000000` = 0.15 TON |

**1 TON = 1,000,000,000 nanoTON**

> **WARNING:** `stop_loss_price` and `take_profit_price` in `storm_open_position` are in **USD**. But `triggerPrice` in `storm_create_order` is in **nanoTON**. These are different units for price fields.

---

## Deal Lifecycle

Storm Trade positions are asynchronous — they go through on-chain settlement:

```
1. POST /deal/open      → deal created, swap_status = "pending"
2. GET  /swap/status/id  → poll: "pending" → "confirmed"
3. [position is open, trading on Storm Trade]
4. POST /deal/close     → close order sent, status = "pending"
5. GET  /swap/status/id  → poll: "pending" → "confirmed"
6. [position closed, PnL calculated]
```

### Automatic events (handled by backend)
- **TP/SL triggered** — `storm_processor` monitors Storm sequencer events, auto-closes deal
- **Liquidation** — deal closed automatically when margin is insufficient

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

> Storm Trade may add new markets over time. The SDK's hardcoded list may not include all pairs.

---

## Examples

### Open a 3x long BTC with 1 TON, SL at $80k, TP at $100k

```ts
// Step 1: Check balance
const info = await client.getStrategyInfo();
console.log('Available:', info.ton_in_strategy, 'nanoTON');

// Step 2: Check existing positions
const positions = await client.getOpenDeals();
console.log('Open positions:', positions.length);

// Step 3: Open position
const deal = await client.openPosition({
  direction: 'long',
  pair: 'BTC/USD',
  leverage: 3,
  amount: 1_000_000_000,        // 1 TON collateral
  margin: 1_000_000_000,        // same as amount
  deal_type: 'market',
  stop_loss_price: 80000,       // USD
  take_profit_price: 100000,    // USD
});
console.log('Deal ID:', deal.id);

// Step 4: Wait for confirmation
const status = await client.waitForConfirmation(deal.id);
console.log('Status:', status.status); // "confirmed"
```

### Close 50% of a position

```ts
const positions = await client.getOpenDeals();
const position = positions[0];

// Close half
const result = await client.closePosition({
  id: position.id,
  amount: Math.floor(position.margin / 2),
});

const status = await client.waitForConfirmation(position.id);
console.log('Closed:', status.status);
```

### Set TP/SL order on existing position

```ts
await client.createOrder({
  order_type: 'takeProfit',
  baseAsset: 'BTC',
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
{ id: 742, error_code: 200, error: "" }

// Error response from tool handler
{ error: "HTTP 400 for POST /strategy/365/deal/open", code: 400 }
{ error: "leverage must be 2–100, got 200" }
{ error: "Deal 999 not found" }
```

### Error codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid parameters or Storm keys not configured |
| 404 | Strategy or deal not found |
| 409 | Conflict (no open position to close) |
| 500 | Internal error |

### Error recovery

- **Timeout on confirmation** → Call `storm_get_swap_status` manually. If "failed", check error field. Do NOT blindly retry.
- **409 Conflict** → No open position to close. Call `storm_get_open_positions` to verify.
- **400 Bad Request** → Invalid parameters. Check leverage (2-100), amount > 0, pair exists.

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

The Storm SDK can be used alongside `@tractioneye/agent-sdk` (spot trading). Both use the same agent token format and TractionEye backend. Create separate clients for each:

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

## Trading Skill

The SDK includes `skills/storm-trading.md` — a behavioral specification for AI futures trading agents:

- **Decision flowchart**: check balance → check positions → verify pair → open → confirm → set TP/SL
- **Unit reference**: critical USD vs nanoTON distinction
- **Example workflows**: open position, partial close, error recovery
- **7 safety rules**: balance check, position check, pair verification, confirmation wait, no opposing positions, TP/SL requirement, risk limits

Designed for [OpenClaw](https://openclaw.com) agents. Compatible with any LLM agent framework that supports function calling.

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
