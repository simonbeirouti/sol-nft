use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface, 
    Burn, burn,
    ThawAccount, thaw_account,
    CloseAccount, close_account
};
use anchor_spl::associated_token::AssociatedToken;
use crate::state::Badge;

#[derive(Accounts)]
pub struct BurnBadge<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [
            b"badge", 
            badge.creator.as_ref(), 
            badge.badge_id.as_bytes()
        ], 
        bump = badge.bump
    )]
    pub badge: Account<'info, Badge>,

    #[account(
        mut,
        seeds = [b"mint", badge.key().as_ref()], 
        bump
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
        associated_token::token_program = token_program,
    )]
    pub owner_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

// FAN-06: Burn badge with no refund
pub fn handler(ctx: Context<BurnBadge>) -> Result<()> {
    // FAN-06: Verify user owns exactly 1 token
    require!(
        ctx.accounts.owner_token_account.amount == 1,
        BurnBadgeError::InvalidTokenAmount
    );

    // FAN-05: Thaw the frozen token account first (soulbound accounts are frozen)
    // Use badge PDA as freeze authority to thaw
    let creator_key = ctx.accounts.badge.creator.key();
    let badge_id_bytes = ctx.accounts.badge.badge_id.as_bytes();
    let bump = ctx.accounts.badge.bump;
    
    let signer_seeds = &[
        b"badge",
        creator_key.as_ref(),
        badge_id_bytes,
        &[bump]
    ];
    let signer_seeds_slice = &[&signer_seeds[..]];

    thaw_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            ThawAccount {
                account: ctx.accounts.owner_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.badge.to_account_info(),
            },
            signer_seeds_slice
        )
    )?;

    // FAN-06: Burn the token (no refund issued)
    burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.owner_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            }
        ),
        1
    )?;

    // Close the token account to reclaim rent (no badge price refund)
    close_account(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            CloseAccount {
                account: ctx.accounts.owner_token_account.to_account_info(),
                destination: ctx.accounts.owner.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            }
        )
    )?;

    Ok(())
}

#[error_code]
pub enum BurnBadgeError {
    #[msg("Invalid token amount - must own exactly 1 badge")]
    InvalidTokenAmount,
}
