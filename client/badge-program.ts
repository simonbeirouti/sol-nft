import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { BadgePlatform } from "./badge_platform";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from "@solana/spl-token";

// Deployed to Devnet - Program ID
export const PROGRAM_ID = new PublicKey("hGDKLgKhMAYSJS4TNRnQJc3gRLSd6xYyK11JcnbUrn5");
// Platform wallet (receives 10% fee)
export const PLATFORM_WALLET = new PublicKey("2p8QvK4XLymfAFrdPxJChT5E44bKxHpsguL4K2rjJ1ZU");

export const getBadgePDA = (creator: PublicKey, badgeId: string, programId: PublicKey = PROGRAM_ID) => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("badge"), creator.toBuffer(), Buffer.from(badgeId)],
        programId
    );
};

export const getMintPDA = (badgePDA: PublicKey, programId: PublicKey = PROGRAM_ID) => {
    return PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), badgePDA.toBuffer()],
        programId
    );
};

export class BadgeClient {
    program: Program<BadgePlatform>;

    constructor(program: Program<BadgePlatform>) {
        this.program = program;
    }

    async createInitializeBadgeInstruction(
        creator: PublicKey,
        badgeId: string,
        uri: string,
        price: anchor.BN
    ) {
        const [badgePDA] = getBadgePDA(creator, badgeId, this.program.programId);
        const [mintPDA] = getMintPDA(badgePDA, this.program.programId);

        return await this.program.methods
            .initializeBadge(badgeId, uri, price)
            .accounts({
                creator,
                badge: badgePDA,
                mint: mintPDA,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .instruction();
    }

    async createMintBadgeInstruction(
        payer: PublicKey,
        creator: PublicKey, // The creator of the badge
        badgeId: string,
        platformWallet: PublicKey = PLATFORM_WALLET
    ) {
        const [badgePDA] = getBadgePDA(creator, badgeId, this.program.programId);
        const [mintPDA] = getMintPDA(badgePDA, this.program.programId);

        const recipientTokenAccount = getAssociatedTokenAddressSync(
            mintPDA,
            payer,
            false,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        return await this.program.methods
            .mintBadge()
            .accounts({
                payer,
                creator,
                badge: badgePDA,
                mint: mintPDA,
                recipientTokenAccount,
                platformWallet: platformWallet,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .instruction();
    }

    // FAN-06: Create burn badge instruction
    async createBurnBadgeInstruction(
        owner: PublicKey,
        creator: PublicKey,
        badgeId: string
    ) {
        const [badgePDA] = getBadgePDA(creator, badgeId, this.program.programId);
        const [mintPDA] = getMintPDA(badgePDA, this.program.programId);

        const ownerTokenAccount = getAssociatedTokenAddressSync(
            mintPDA,
            owner,
            false,
            TOKEN_2022_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );

        return await this.program.methods
            .burnBadge()
            .accounts({
                owner,
                badge: badgePDA,
                mint: mintPDA,
                ownerTokenAccount,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .instruction();
    }
}
