use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    Mint, TokenAccount, TokenInterface, 
    MintTo, mint_to,
    FreezeAccount, freeze_account
};
use anchor_spl::associated_token::AssociatedToken;
use anchor_lang::system_program::{transfer, Transfer};
use crate::state::Badge;
use crate::constants::platform;

#[derive(Accounts)]
pub struct MintBadge<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: Verified by matching badge.creator
    #[account(mut, address = badge.creator)]
    pub creator: UncheckedAccount<'info>,

    #[account(
        mut,
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
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = payer,
        associated_token::token_program = token_program,
    )]
    pub recipient_token_account: InterfaceAccount<'info, TokenAccount>,
    
    /// CHECK: Platform wallet
    #[account(mut, address = platform::WALLET)]
    pub platform_wallet: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn handler(ctx: Context<MintBadge>) -> Result<()> {
    // DEV-01: Automatic 10% platform fee deduction
    // CRE-04: Creator receives 90% instantly
    // 1. Revenue Split - on-chain payment split at mint time
    let price = ctx.accounts.badge.price;
    if price > 0 {
        // DEV-01: Calculate exact 10/90 split
        let platform_fee = (price * platform::FEE_PERCENTAGE) / 100;
        let creator_amount = price - platform_fee;

        // DEV-01: Transfer 10% to platform wallet
        if platform_fee > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.platform_wallet.to_account_info(),
                    }
                ),
                platform_fee,
            )?;
        }

        // CRE-04: Transfer 90% to creator wallet instantly
        if creator_amount > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.payer.to_account_info(),
                        to: ctx.accounts.creator.to_account_info(),
                    }
                ),
                creator_amount,
            )?;
        }
    }

    // FAN-04: Mint badge token to user's wallet
    // 2. Mint Token - exactly 1 token (NFT)
    let creator_key = ctx.accounts.badge.creator.key();
    let badge_id_bytes = ctx.accounts.badge.badge_id.as_bytes();
    let bump = ctx.accounts.badge.bump;
    
    // Seeds for signing with badge PDA authority
    let signer_seeds = &[
        b"badge",
        creator_key.as_ref(),
        badge_id_bytes,
        &[bump]
    ];
    let signer_seeds_slice = &[&signer_seeds[..]];

    // FAN-04: Mint 1 token to recipient
    mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.recipient_token_account.to_account_info(),
                authority: ctx.accounts.badge.to_account_info(),
            },
            signer_seeds_slice
        ),
        1
    )?;

    // FAN-05: Freeze token account to make badge non-transferable (soulbound)
    // CRE-03: Permanent non-transferable enforcement using Token-2022 freeze authority
    freeze_account(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            FreezeAccount {
                account: ctx.accounts.recipient_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.badge.to_account_info(),
            },
            signer_seeds_slice
        )
    )?;

    Ok(())
}
