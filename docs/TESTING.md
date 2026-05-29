# Testing Guide

This document explains how to run the FlowPay test suite, what is currently covered, and how to write new tests.

---

## Running the Tests

```bash
cd contract
cargo test
```

To see `println!` output during tests:

```bash
cargo test -- --nocapture
```

To run a single test by name:

```bash
cargo test test_cancel
```

---

## Test Environment

FlowPay tests use the Soroban SDK's built-in test utilities (`soroban-sdk` with the `testutils` feature). This gives us:

- `Env::default()` — an in-memory Soroban environment, no network required
- `env.mock_all_auths()` — bypasses `require_auth()` checks so tests don't need real signatures
- `env.register_stellar_asset_contract_v2()` — deploys a real SAC token in the test environment
- `env.ledger().with_mut()` — lets us fast-forward the ledger timestamp to simulate time passing

---

## Test Setup Helpers

### `setup()`

Every test calls the shared `setup()` helper which:

1. Creates a default `Env`
2. Deploys a test SAC token and mints 10,000 tokens to the test user
3. Approves the FlowPay contract to spend those tokens
4. Deploys the FlowPay contract
5. Calls `initialize()` with the test token address
6. Returns `(env, contract_id, token_addr, user, merchant)`

```rust
fn setup() -> (Env, Address, Address, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();

    let token_admin = Address::generate(&env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_addr = token_id.address();

    let contract_id = env.register_contract(None, FlowPay);

    let user = Address::generate(&env);
    let merchant = Address::generate(&env);

    let sac = StellarAssetClient::new(&env, &token_addr);
    sac.mint(&user, &10_000_0000000);

    let token = TokenClient::new(&env, &token_addr);
    token.approve(&user, &contract_id, &10_000_0000000, &200);

    let client = FlowPayClient::new(&env, &contract_id);
    client.initialize(&token_addr);

    (env, contract_id, token_addr, user, merchant)
}
```

### `setup_second_token()`

For multi-token tests, use `setup_second_token()` which:

1. Deploys a second SAC token and mints 10,000 tokens to the given user
2. Approves the FlowPay contract to spend those tokens
3. Returns the new token's address

```rust
fn setup_second_token(env: &Env, contract_id: &Address, user: &Address) -> Address {
    let token_admin = Address::generate(env);
    let token_id = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token_addr = token_id.address();

    let sac = StellarAssetClient::new(env, &token_addr);
    sac.mint(user, &10_000_0000000);

    let token = TokenClient::new(env, &token_addr);
    token.approve(user, contract_id, &10_000_0000000, &200);

    token_addr
}
```

---

## Current Test Coverage

The test suite covers the following areas:

1. Core functionality tests (subscribe, charge, cancel)
2. Multi-token + advanced features
3. Edge cases
4. Multi-user isolation
5. batch_charge tests
6. subscription_count tests
7. merchant_stats tests
8. spending_limit tests
9. referral tracking tests
10. migration tests
11. subscription metadata tests
12. charge history tests
13. TTL extension tests

### Core functionality tests
- `test_subscribe_and_charge` — Happy path subscribe + charge
- `test_charge_exact_transfer_amount` — Verify exact amount transferred
- `test_subscription_struct_fields_match_input` — Verify subscription struct matches
- `test_cancel` — Cancel subscription
- `test_charge_too_early` — Charge before interval elapsed (should panic)
- `test_double_initialize` — Second initialize call should panic
- `test_zero_amount` — Subscribe with 0 amount should panic
- `test_zero_interval` — Subscribe with 0 interval should panic
- `test_resubscribe` — Overwrite old subscription
- `test_subscribe_overwrites_cancelled_subscription` — Subscribe after cancel
- `test_charge_after_cancel` — Charge after cancel should panic

### Multi-token + advanced features
- `test_multi_token_independent_subscriptions` — Multiple users with different tokens
- `test_user_can_switch_token` — User switches subscription token
- `test_pay_per_use` — Basic pay_per_use
- `test_pay_per_use_inactive` — pay_per_use on cancelled subscription
- `test_pay_per_use_does_not_update_last_charged` — pay_per_use doesn't modify last_charged
- `test_pay_per_use_nonexistent` — pay_per_use on user without subscription
- `test_pay_per_use_zero_amount` — pay_per_use with 0 amount
- `test_initialize_backward_compat` — initialize still works for backward compatibility
- `test_initialize_without_valid_token` — initialize with invalid token address
- `test_get_subscription_nonexistent` — get_subscription returns None
- `test_charge_updates_last_charged` — Verify last_charged timestamp updates correctly
- `test_cancel_nonexistent` — Cancel nonexistent subscription should panic
- `test_multiple_users` — Two users with independent subscriptions
- `test_ttl_extension` — Verify TTL extension function exists and doesn't panic

### batch_charge tests
- `test_batch_charge_charged_and_skipped` — Batch with mixed eligible and ineligible users
- `test_batch_charge_no_subscription` — Batch includes user with no subscription
- `test_batch_charge_inactive` — Batch includes user with inactive subscription

### subscription_count tests
- `test_active_count_increments_on_subscribe` — Active count increments when subscribing
- `test_active_count_decrements_on_cancel` — Active count decrements when cancelling
- `test_active_count_multiple_users` — Active count tracks multiple users

### merchant_stats tests
- `test_merchant_revenue_from_charge` — Merchant revenue from charge
- `test_merchant_revenue_from_pay_per_use` — Merchant revenue from pay_per_use
- `test_merchant_revenue_accumulates` — Merchant revenue accumulates correctly

### spending_limit tests
- `test_daily_limit_allows_spend_within_limit` — Spend within limit works
- `test_daily_limit_blocks_overspend` — Over limit should panic
- `test_daily_limit_accumulates_across_calls` — Spending accumulates across pay_per_use calls
- `test_daily_limit_blocks_cumulative_overspend` — Cumulative over limit should panic
- `test_daily_limit_visibility_and_spend_tracking` — Track daily spent and limit correctly

### referral tracking tests
- `test_referral_stored_on_subscribe` — Referral address is stored
- `test_no_referral_returns_none` — No referral returns None

### migration tests
- `test_migrate_sets_schema_version` — Migrate sets correct schema version
- `test_migrate_is_idempotent` — Multiple migrate calls are safe

### subscription metadata tests
- `test_set_and_get_metadata` — Set and retrieve metadata label
- `test_get_metadata_none_when_not_set` — Metadata returns None when not set

### charge history tests
- `test_charge_history_recorded` — Charge history records charges
- `test_charge_history_capped_at_12` — Charge history capped at last 12 charges

---

## Writing New Tests

Add new tests to `contract/src/test.rs`. Always use the `setup()` helper to avoid boilerplate.

### Template

```rust
#[test]
fn test_your_feature() {
    let (env, contract_id, _token_addr, user, merchant) = setup();
    let client = FlowPayClient::new(&env, &contract_id);

    // arrange
    client.subscribe(&user, &merchant, &1_0000000, &86400, &_token_addr, &None, &None);

    // act
    // ...

    // assert
    // ...
}
```

### Testing panics

Use `#[should_panic(expected = "...")]` to assert that a function panics with a specific message:

```rust
#[test]
#[should_panic(expected = "subscription is not active")]
fn test_charge_after_cancel() {
    let (env, contract_id, token_addr, user, merchant) = setup();
    let client = FlowPayClient::new(&env, &contract_id);

    client.subscribe(&user, &merchant, &1_0000000, &86400, &token_addr, &None, &None);
    client.cancel(&user);

    env.ledger().with_mut(|l| { l.timestamp += 86401; });
    client.charge(&user); // should panic
}
```

### Advancing time

```rust
env.ledger().with_mut(|l| {
    l.timestamp += 86_400 + 1; // advance by 1 day + 1 second
});
```

---

## Frontend Tests

Frontend tests are implemented using Vitest and React Testing Library.

```bash
cd frontend
npm run test
```
