use anchor_lang::prelude::*;
use solana_program::pubkey;

pub mod platform {
    use super::*;
    // DEV-01: Platform wallet receives 10% fee on all badge purchases
    // TODO: Replace with actual platform wallet before mainnet deployment
    pub const WALLET: Pubkey = pubkey!("11111111111111111111111111111111"); // Placeholder
    
    // DEV-01: Fixed 10% platform fee
    // CRE-04: Remaining 90% goes to creator
    pub const FEE_PERCENTAGE: u64 = 10;
}
