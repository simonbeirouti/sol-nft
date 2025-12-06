import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Keypair, SystemProgram, PublicKey } from "@solana/web3.js";
import { BadgeClient } from "../client/badge-program";
import { BadgePlatform } from "../client/badge_platform";
import { assert } from "chai";
import { TOKEN_2022_PROGRAM_ID, getAccount } from "@solana/spl-token";

describe("badge-program", () => {
    // Configure the client to use the local cluster.
    const provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);

    // We assume the program name in Anchor.toml is "badge_platform" matches the IDL
    const program = anchor.workspace.BadgePlatform as Program<BadgePlatform>;
    const startClient = new BadgeClient(program);

    const creator = Keypair.generate();
    const buyer = Keypair.generate();
    const platformWallet = Keypair.generate(); // Mock platform wallet

    const badgeId = "badge-123";
    const uri = "https://example.com/badge.json";
    const price = new anchor.BN(1000000); // 0.001 SOL

    it("Initialize Badge", async () => {
        // Airdrop SOL to creator
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(creator.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
        );

        const ix = await startClient.createInitializeBadgeInstruction(
            creator.publicKey,
            badgeId,
            uri,
            price
        );

        await anchor.web3.sendAndConfirmTransaction(provider.connection, new anchor.web3.Transaction().add(ix), [
            creator,
        ]);

        // Verify account state (optional, if we could fetch the Badge account)
        // For now assuming success if transaction confirms
    });

    it("Mint Badge", async () => {
        // Airdrop SOL to buyer
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(buyer.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL)
        );

        // Initial check of platform wallet balance
        const initialPlatformBalance = await provider.connection.getBalance(platformWallet.publicKey);

        const ix = await startClient.createMintBadgeInstruction(
            buyer.publicKey,
            creator.publicKey,
            badgeId,
            platformWallet.publicKey
        );

        await anchor.web3.sendAndConfirmTransaction(provider.connection, new anchor.web3.Transaction().add(ix), [
            buyer,
        ]);

        // Verify token balance
        const [badgePDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("badge"), creator.publicKey.toBuffer(), Buffer.from(badgeId)],
            program.programId
        );
        const [mintPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from("mint"), badgePDA.toBuffer()],
            program.programId
        );

        const recipientTokenAccount = await anchor.utils.token.associatedAddress({
            mint: mintPDA,
            owner: buyer.publicKey,
        });

        // Check buyer has the token
        const tokenAccount = await getAccount(provider.connection, recipientTokenAccount, undefined, TOKEN_2022_PROGRAM_ID);
        assert.equal(tokenAccount.amount.toString(), "1");
    });
});
