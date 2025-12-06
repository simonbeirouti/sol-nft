use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenInterface};
use crate::state::Badge;

#[derive(Accounts)]
#[instruction(badge_id: String, uri: String, price: u64)]
pub struct InitializeBadge<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = Badge::LEN,
        seeds = [b"badge", creator.key().as_ref(), badge_id.as_bytes()],
        bump
    )]
    pub badge: Account<'info, Badge>,

    #[account(
        init,
        payer = creator,
        mint::decimals = 0,
        mint::authority = badge,
        mint::freeze_authority = badge,
        seeds = [b"mint", badge.key().as_ref()],
        bump
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<InitializeBadge>, badge_id: String, uri: String, price: u64) -> Result<()> {
    let badge = &mut ctx.accounts.badge;
    badge.creator = ctx.accounts.creator.key();
    badge.badge_id = badge_id;
    badge.price = price;
    badge.uri = uri;
    badge.mint = ctx.accounts.mint.key();
    badge.bump = ctx.bumps.badge;

    // Note: Token Metadata initialization could be done here via CPI to 
    // spl_token_metadata_interface using the Token-2022 program.

    Ok(())
}
