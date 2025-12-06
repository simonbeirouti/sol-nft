use anchor_lang::prelude::*;

#[account]
pub struct Badge {
    pub creator: Pubkey,
    pub price: u64,
    pub mint: Pubkey, // The "Master" mint (if using editions) or just tracking; 
                      // actually if we mint NEW mints per user, this might be a "Class" identifier.
                      // For this draft, let's assume One Mint Per Badge Class (Fungible Non-Transferable),
                      // where the user gets 1 token of this Mint.
    pub badge_id: String,
    pub uri: String,
    pub bump: u8,
}

impl Badge {
    // 8 discriminator + 32 creator + 8 price + 32 mint + (4+32) badge_id + (4+200) uri + 1 bump
    pub const LEN: usize = 8 + 32 + 8 + 32 + (4 + 32) + (4 + 200) + 1;
}
