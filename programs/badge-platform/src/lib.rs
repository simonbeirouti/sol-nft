pub mod constants;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;
use instructions::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS"); 

#[program]
pub mod badge_platform {
    use super::*;

    pub fn initialize_badge(
        ctx: Context<InitializeBadge>, 
        badge_id: String, 
        uri: String, 
        price: u64
    ) -> Result<()> {
        instructions::initialize_badge::handler(ctx, badge_id, uri, price)
    }

    pub fn mint_badge(
        ctx: Context<MintBadge>
    ) -> Result<()> {
        instructions::mint_badge::handler(ctx)
    }

    // FAN-06: Burn badge functionality
    pub fn burn_badge(
        ctx: Context<BurnBadge>
    ) -> Result<()> {
        instructions::burn_badge::handler(ctx)
    }
}
