use anchor_lang::prelude::*;
use solana_program::pubkey;

pub mod platform {
    use super::*;
    pub const WALLET: Pubkey = pubkey!("11111111111111111111111111111111"); // Placeholder: Replace with actual platform wallet
    pub const FEE_PERCENTAGE: u64 = 10;
}
