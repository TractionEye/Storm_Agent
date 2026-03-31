export interface StormClientConfig {
    agentToken: string;
    baseUrl?: string;
}
export interface StrategyInfo {
    strategy_id: number;
    strategy_name: string;
    pnl_day?: number;
    pnl_week?: number;
    pnl_month?: number;
    pnl_year?: number;
    ton_in_strategy?: number;
    total_win_rate?: number;
    trades_per_week?: number;
    max_drawdown?: number;
    low_balance_state?: boolean;
}
export interface OpenPositionRequest {
    /** Collateral (margin deposit) in nanoTON (1 TON = 1_000_000_000) */
    amount: number;
    /** "long" or "short" */
    direction: 'long' | 'short';
    /** Trading pair: "BTC/USD", "ETH/USD", "TON/USD", etc. */
    pair: string;
    /** Leverage multiplier (2.0–100.0) */
    leverage: number;
    /** "market" or "stopLimit" */
    deal_type: 'market' | 'stopLimit';
    /** Limit price in nanoTON (for limit orders, 0 otherwise) */
    limit_price?: number;
    /** Stop trigger price in nanoTON */
    stop_trigger_price?: number;
    /** Stop loss price in USD */
    stop_loss_price?: number;
    /** Take profit price in USD */
    take_profit_price?: number;
    /** Desired entry price in USD */
    entry_price?: number;
    /** Estimated liquidation price in USD */
    el_price?: number;
    /** Collateral (margin deposit) in nanoTON — same as amount, required by API */
    margin: number;
    /** Stop price in nanoTON */
    stop_price?: number;
}
export interface ClosePositionRequest {
    /** Deal ID to close */
    id: number;
    /** Amount to close in nanoTON (full margin for full close) */
    amount: number;
}
export interface ExecuteResponse {
    operation_id: string;
    operation_status: string;
    validation_outcome?: string;
    failure_reason: string | null;
    execution_result: {
        deal_id?: number;
        estimated_receive?: number;
        offer_amount?: number;
        swap_type?: string;
    } | null;
}
export interface CreateOrderRequest {
    /** "takeProfit" or "stopLoss" */
    order_type: 'takeProfit' | 'stopLoss';
    /** Margin in nanoTON */
    marginIn: number;
    /** Base asset: "BTC", "ETH", "TON", etc. */
    baseAsset: string;
    /** "long" or "short" */
    direction: 'long' | 'short';
    /** Order size in nanoTON */
    amount: number;
    /** Trigger price in nanoTON */
    triggerPrice: number;
}
export interface CreateOrderResponse {
    status: string;
    error_code: number;
    error: string;
}
export interface Deal {
    id: number;
    strategy_id: number;
    amount: number;
    direction: 'long' | 'short';
    asset: string;
    leverage: number;
    margin: number;
    entry_price: number;
    stop_loss_price: number;
    take_profit_price: number;
    deal_type: 'market' | 'stopLimit';
    swap_status: 'pending' | 'confirmed' | 'failed' | 'adjusted';
    opened_at: string;
    closed_at: string | null;
    profit_or_loss: number | null;
}
export interface Order {
    id: number;
    asset: string;
    created_at: string;
    size: number;
    trigger_price: number;
    status: string;
    direction: 'long' | 'short';
    order_type: 'take' | 'stop' | 'limit' | 'market' | 'liquidation';
}
export interface AggregatedPosition {
    token: string;
    token_address: string;
    token_symbol: string;
    token_name: string;
    token_image_url: string;
    token_icon: string;
    total_token_amount: number;
    total_ton_amount: number;
    realized_pnl: number;
    entry_price: number;
    initial_purchase_ton: number;
}
export interface SwapStatus {
    deal_id: number;
    status: 'pending' | 'confirmed' | 'failed' | 'adjusted';
    amount: number;
    token_amount: number | null;
    tx_hash: string | null;
    error: string | null;
    error_code: number;
}
export interface PortfolioToken {
    token_address: string;
    symbol: string;
    decimals: number;
    quantity_nano?: string;
    quantity?: string;
    realized_pnl_ton: number;
    unrealized_pnl_ton: number;
    entry_price?: number;
    current_value_ton?: number;
}
export interface PortfolioResponse {
    total_realized_pnl_ton: number;
    total_unrealized_pnl_ton: number;
    tokens: PortfolioToken[];
}
export interface OperationResponse {
    operation_id: string;
    operation_status: 'pending' | 'confirmed' | 'failed' | 'adjusted';
    failure_reason: string | null;
    execution_result: {
        swap_status?: string;
        tx_hash?: string | null;
        actual_token_amount?: number | null;
        actual_ton_amount?: number | null;
        deal_id?: number;
    } | null;
}
export interface Market {
    pair: string;
    settlement: string;
    type: string;
}
export declare const AVAILABLE_MARKETS: Market[];
