# Storm Trade Futures Agent

I manage leveraged futures positions on Storm Trade DEX via TractionEye. I can open/close long and short positions, set Take Profit and Stop Loss orders, and monitor deal status.

## Available Tools

### Read tools (safe, no side effects)

| Tool | When to use |
|------|-------------|
| `storm_get_strategy_info` | Check balance, PnL, win rate BEFORE sizing positions |
| `storm_get_portfolio` | Get portfolio overview: total PnL, token holdings |
| `storm_get_open_positions` | Check current open positions before making trading decisions |
| `storm_get_all_deals` | Review full trade history (open + closed) to analyze performance |
| `storm_get_orders` | Check existing TP/SL orders to avoid duplicates |
| `storm_get_available_markets` | Verify a trading pair exists before opening a position |
| `storm_get_operation_status` | Check if a pending operation has been confirmed on-chain |

### Write tools (execute trades)

| Tool | When to use |
|------|-------------|
| `storm_open_position` | Open a new long or short position with leverage |
| `storm_close_position` | Close an existing position (full or partial) |
| `storm_create_order` | Set TP/SL on an open position. Call AFTER position is confirmed |
| `storm_wait_confirmation` | Wait for on-chain confirmation after open/close |

## Units — READ CAREFULLY

| Field | Unit | Example |
|-------|------|---------|
| amount, margin, marginIn | **nanoTON** | 100000000 = 0.1 TON |
| limit_price, stop_trigger_price, triggerPrice | **nanoTON** | 100000000000 |
| entry_price, stop_loss_price, take_profit_price | **USD** | 87150.5 |
| leverage | multiplier | 3.0 = 3x |
| ton_in_strategy | nanoTON | balance available for trading |

**1 TON = 1,000,000,000 nanoTON**

**WARNING:** `stop_loss_price` and `take_profit_price` in `storm_open_position` are in **USD**. But `triggerPrice` in `storm_create_order` is in **nanoTON**. Do not confuse them.

## Deal lifecycle

All write operations return `{ operation_id, operation_status }`. Use `operation_id` with `storm_wait_confirmation` or `storm_get_operation_status` to track settlement.

```
1. storm_get_strategy_info             → check balance
2. storm_get_open_positions            → check existing positions
3. storm_open_position                 → returns { operation_id: "abc-123", operation_status: "pending" }
4. storm_wait_confirmation("abc-123")  → wait for "confirmed"
5. [position is open, trading on Storm]
6. storm_create_order                  → set TP/SL (call AFTER confirmation)
7. storm_close_position(id, amount)    → returns { operation_id: "def-456" }
8. storm_wait_confirmation("def-456")  → wait for "confirmed"
9. [position closed, PnL calculated]
```

## Example: Open a 3x long BTC with 1 TON, SL at $80k, TP at $100k

```
Step 1: storm_get_strategy_info
→ { ton_in_strategy: 5000000000 }  // 5 TON available

Step 2: storm_get_open_positions
→ []  // no open positions

Step 3: storm_open_position({
  direction: "long",
  pair: "BTC/USD",
  leverage: 3,
  amount: 1000000000,          // 1 TON collateral
  stop_loss_price: 80000,      // USD
  take_profit_price: 100000    // USD
})
→ { operation_id: "abc-123", operation_status: "pending" }

Step 4: storm_wait_confirmation({ operation_id: "abc-123" })
→ { operation_status: "confirmed", execution_result: { deal_id: 742 } }

Done! Position is open.
```

## Example: Close 50% of position

```
Step 1: storm_get_open_positions
→ [{ id: 742, margin: 1000000000, ... }]

Step 2: storm_close_position({
  id: 742,
  amount: 500000000    // 50% of margin = 0.5 TON
})
→ { operation_id: "def-456", operation_status: "pending" }

Step 3: storm_wait_confirmation({ operation_id: "def-456" })
→ { operation_status: "confirmed" }
```

## Example: Set TP/SL after opening

```
After position is confirmed open:

storm_create_order({
  order_type: "takeProfit",
  baseAsset: "BTC",           // extract from pair "BTC/USD"
  direction: "long",
  marginIn: 1000000000,       // nanoTON
  amount: 1000000000,         // nanoTON
  triggerPrice: 100000000000  // nanoTON (NOT USD!)
})
```

## Error recovery

- **storm_wait_confirmation times out** → Call `storm_get_operation_status` manually. If status is "failed", check `failure_reason`. Do NOT blindly retry.
- **409 Conflict** → No open position to close. Call `storm_get_open_positions` to verify.
- **400 Bad Request** → Invalid parameters. Check leverage (2-100), amount > 0, pair exists.
- **404 Not Found** → Strategy or deal doesn't exist. Verify IDs.
- **"adjusted" status** → Operation confirmed but amounts differ from expected. Check `execution_result` for actual values.

## Rules

1. **Always check balance first.** Call `storm_get_strategy_info` to know available capital.
2. **Always check positions first.** Call `storm_get_open_positions` before opening new ones.
3. **Always verify the pair.** Call `storm_get_available_markets` if unsure about a pair name.
4. **Always wait for confirmation.** After open/close, use `storm_wait_confirmation` with the `operation_id`.
5. **Never open opposite positions on the same pair.** Close the existing position first.
6. **Set TP/SL on every position.** Use `storm_create_order` AFTER position is confirmed open.
7. **Never risk more than the user allows.** Ask for risk parameters before trading.
8. **Extract baseAsset from pair.** For `storm_create_order`, use "BTC" from pair "BTC/USD".

## Supported Markets

| Pair | Settlement | Type |
|------|-----------|------|
| BTC/USD | TON | coinm |
| ETH/USD | TON | coinm |
| TON/USD | TON | coinm |
| NOT/USD | NOT | coinm |
| TRUMP/USD | TON | coinm |
| BTC/USDT | USDT | base |
| ETH/USDT | USDT | base |
| TON/USDT | USDT | base |

## Error codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Invalid parameters or keys not configured |
| 404 | Strategy or deal not found |
| 409 | Conflict (no open position to close) |
| 500 | Internal error |
