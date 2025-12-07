// Solana Playground Script
// Copy and paste this into the client.ts file in Solana Playground

// --- Constants & Polyfills ---

// constants from @solana/spl-token
const TOKEN_2022_PROGRAM_ID = new web3.PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const ASSOCIATED_TOKEN_PROGRAM_ID = new web3.PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

// getAssociatedTokenAddressSync polyfill
function getAssociatedTokenAddressSync(
    mint,
    owner,
    allowOwnerOffCurve = false,
    programId = new web3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    associatedTokenProgramId = ASSOCIATED_TOKEN_PROGRAM_ID
) {
    if (!allowOwnerOffCurve && !web3.PublicKey.isOnCurve(owner.toBuffer())) {
        throw new Error('TokenOwnerOffCurveError');
    }

    const [address] = web3.PublicKey.findProgramAddressSync(
        [owner.toBuffer(), programId.toBuffer(), mint.toBuffer()],
        associatedTokenProgramId
    );

    return address;
}

// --- Client Logic (Adapted from badge-program.ts) ---

const PROGRAM_ID = pg.program.programId; // Use the deployed program ID from PG
// Note: In SolPG, wallet is available at pg.wallet. 
// We generally don't hardcode PLATFORM_WALLET. We'll generate one for testing.

const getBadgePDA = (creator, badgeId, programId = PROGRAM_ID) => {
    return web3.PublicKey.findProgramAddressSync(
        [Buffer.from("badge"), creator.toBuffer(), Buffer.from(badgeId)],
        programId
    );
};

const getMintPDA = (badgePDA, programId = PROGRAM_ID) => {
    return web3.PublicKey.findProgramAddressSync(
        [Buffer.from("mint"), badgePDA.toBuffer()],
        programId
    );
};

class BadgeClient {
    program: any;

    constructor(program) {
        this.program = program;
    }

    async createInitializeBadgeInstruction(
        creator,
        badgeId,
        uri,
        price
    ) {
        const [badgePDA] = getBadgePDA(creator, badgeId, this.program.programId);
        const [mintPDA] = getMintPDA(badgePDA, this.program.programId);

        return await this.program.methods
            .initializeBadge(badgeId, uri, new anchor.BN(price))
            .accounts({
                creator,
                badge: badgePDA,
                mint: mintPDA,
                systemProgram: web3.SystemProgram.programId,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
            })
            .instruction();
    }

    async createMintBadgeInstruction(
        payer,
        creator, // The creator of the badge
        badgeId,
        platformWallet
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
                systemProgram: web3.SystemProgram.programId,
                tokenProgram: TOKEN_2022_PROGRAM_ID,
                associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            })
            .instruction();
    }

    // FAN-06: Create burn badge instruction
    async createBurnBadgeInstruction(
        owner,
        creator,
        badgeId
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

// --- Execution / Test Logic ---

(async () => {
    console.log("Running Badge Platform Client Script...");

    const program = pg.program;
    const client = new BadgeClient(program);

    // Setup Test Accounts
    // In SolPG, pg.wallet is the default payer usually.
    // We will create fresh keypairs for creator/buyer to simulate the full flow properly, 
    // funded by the pg.wallet if possible, or just expect them to be funded.
    // Actually, in SolPG it's easier to use pg.wallet as the primary actor, 
    // but the test logic uses separate creator/buyer. Let's stick to generating them and funding them.

    // NOTE: Airdrops might be rate limited on devnet. 
    // If this fails, consider using pg.wallet.publicKey for one of roles.

    const creator = web3.Keypair.generate();
    const buyer = web3.Keypair.generate();
    // Use the specific platform wallet address expected by the program (from error logs)
    const platformWallet = new web3.PublicKey("GnA7QBSZKk1YAb1aGRk5Ze5Up6jqDqEwDCYEyEtHdy4s");

    const badgeId = "badge-" + Math.floor(Math.random() * 10000); // Random ID to avoid collision
    const uri = "https://example.com/badge.json";
    const price = 1000000; // 0.001 SOL

    console.log("Creator:", creator.publicKey.toString());
    console.log("Buyer:", buyer.publicKey.toString());
    console.log("Badge ID:", badgeId);

    // Fund accounts
    console.log("Funding accounts...");
    try {
        const tx = new web3.Transaction();
        tx.add(
            web3.SystemProgram.transfer({
                fromPubkey: pg.wallet.publicKey,
                toPubkey: creator.publicKey,
                lamports: 0.1 * web3.LAMPORTS_PER_SOL,
            }),
            web3.SystemProgram.transfer({
                fromPubkey: pg.wallet.publicKey,
                toPubkey: buyer.publicKey,
                lamports: 0.1 * web3.LAMPORTS_PER_SOL,
            })
        );
        await web3.sendAndConfirmTransaction(pg.connection, tx, [pg.wallet.keypair]);
        console.log("Accounts funded.");
    } catch (e) {
        console.error("Funding failed. Ensure you have SOL in your playground wallet.", e);
        // Fallback: Continue, maybe they have funds or we use localnet behavior
    }

    // 1. Initialize Badge
    console.log("Initializing Badge...");
    try {
        const initIx = await client.createInitializeBadgeInstruction(
            creator.publicKey,
            badgeId,
            uri,
            price
        );
        const initTx = new web3.Transaction().add(initIx);
        const initSig = await web3.sendAndConfirmTransaction(pg.connection, initTx, [creator]);
        console.log("Badge Initialized. Sig:", initSig);
    } catch (err) {
        console.error("Failed to initialize badge:", err);
    }

    // 2. Mint Badge
    console.log("Minting Badge...");
    try {
        const mintIx = await client.createMintBadgeInstruction(
            buyer.publicKey,
            creator.publicKey,
            badgeId,
            platformWallet
        );
        const mintTx = new web3.Transaction().add(mintIx);
        const mintSig = await web3.sendAndConfirmTransaction(pg.connection, mintTx, [buyer]);
        console.log("Badge Minted. Sig:", mintSig);
    } catch (err) {
        console.error("Failed to mint badge:", err);
    }

    // Verify token balance
    const [badgePDA] = getBadgePDA(creator.publicKey, badgeId, program.programId);
    const [mintPDA] = getMintPDA(badgePDA, program.programId);
    const recipientTokenAccount = getAssociatedTokenAddressSync(
        mintPDA,
        buyer.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
    );

    console.log("Verifying token balance...");
    try {
        const balance = await pg.connection.getTokenAccountBalance(recipientTokenAccount);
        console.log("Buyer Badge Balance:", balance.value.amount);
        if (balance.value.amount === "1") {
            console.log("✓ Badge minted successfully");
        } else {
            console.log("✗ Unexpected balance");
        }
    } catch (e) {
        console.log("Could not fetch token balance (might not exist if mint failed).");
    }

    // FAN-05: Verify Soulbound (Token Account is Frozen)
    console.log("\n--- Testing Soulbound Enforcement (FAN-05) ---");
    try {
        const tokenAccountInfo = await pg.connection.getAccountInfo(recipientTokenAccount);
        if (tokenAccountInfo) {
            // Parse token account data to check frozen status
            // Token-2022 account layout: state is at offset 108 (1 byte)
            // state: 0 = uninitialized, 1 = initialized, 2 = frozen
            const accountData = tokenAccountInfo.data;
            const state = accountData[108];

            if (state === 2) {
                console.log("✓ Token account is FROZEN (soulbound enforced)");
            } else {
                console.log("✗ Token account is NOT frozen (state:", state, ")");
            }
        }
    } catch (e) {
        console.log("Could not verify frozen status:", e.message);
    }

    // DEV-01, CRE-04: Test Payment Split (10% platform, 90% creator)
    console.log("\n--- Testing Payment Split (DEV-01, CRE-04) ---");
    const paymentTestBadgeId = "payment-test-" + Math.floor(Math.random() * 10000);
    const testPrice = 1_000_000_000; // 1 SOL for easier calculation

    try {
        // Fund creator with enough SOL for this test
        try {
            const sig = await pg.connection.requestAirdrop(creator.publicKey, 2 * web3.LAMPORTS_PER_SOL);
            await pg.connection.confirmTransaction(sig);
        } catch (e) {
            const tx = new web3.Transaction().add(
                web3.SystemProgram.transfer({
                    fromPubkey: pg.wallet.publicKey,
                    toPubkey: creator.publicKey,
                    lamports: 2 * web3.LAMPORTS_PER_SOL
                })
            );
            await web3.sendAndConfirmTransaction(pg.connection, tx, [pg.wallet.keypair]);
        }
        // Initialize payment test badge
        const initIx = await client.createInitializeBadgeInstruction(
            creator.publicKey,
            paymentTestBadgeId,
            uri,
            testPrice
        );
        await web3.sendAndConfirmTransaction(pg.connection, new web3.Transaction().add(initIx), [creator]);
        console.log("Payment test badge initialized");

        // Fund buyer with enough SOL to pay for the 1 SOL badge
        try {
            const sig = await pg.connection.requestAirdrop(buyer.publicKey, 2 * web3.LAMPORTS_PER_SOL);
            await pg.connection.confirmTransaction(sig);
        } catch (e) {
            const tx = new web3.Transaction().add(
                web3.SystemProgram.transfer({
                    fromPubkey: pg.wallet.publicKey,
                    toPubkey: buyer.publicKey,
                    lamports: 2 * web3.LAMPORTS_PER_SOL
                })
            );
            await web3.sendAndConfirmTransaction(pg.connection, tx, [pg.wallet.keypair]);
        }

        // Record balances before
        const platformBalanceBefore = await pg.connection.getBalance(platformWallet);
        const creatorBalanceBefore = await pg.connection.getBalance(creator.publicKey);

        console.log("Platform balance before:", platformBalanceBefore / web3.LAMPORTS_PER_SOL, "SOL");
        console.log("Creator balance before:", creatorBalanceBefore / web3.LAMPORTS_PER_SOL, "SOL");

        // Mint badge
        const mintIx = await client.createMintBadgeInstruction(
            buyer.publicKey,
            creator.publicKey,
            paymentTestBadgeId,
            platformWallet
        );
        await web3.sendAndConfirmTransaction(pg.connection, new web3.Transaction().add(mintIx), [buyer]);

        // Record balances after
        const platformBalanceAfter = await pg.connection.getBalance(platformWallet);
        const creatorBalanceAfter = await pg.connection.getBalance(creator.publicKey);

        console.log("Platform balance after:", platformBalanceAfter / web3.LAMPORTS_PER_SOL, "SOL");
        console.log("Creator balance after:", creatorBalanceAfter / web3.LAMPORTS_PER_SOL, "SOL");

        // Calculate received amounts
        const platformReceived = platformBalanceAfter - platformBalanceBefore;
        const creatorReceived = creatorBalanceAfter - creatorBalanceBefore;

        const expectedPlatformFee = testPrice * 0.1;
        const expectedCreatorAmount = testPrice * 0.9;

        console.log("\nPayment Split Results:");
        console.log("Platform received:", platformReceived / web3.LAMPORTS_PER_SOL, "SOL");
        console.log("Expected (10%):", expectedPlatformFee / web3.LAMPORTS_PER_SOL, "SOL");
        console.log("Creator received:", creatorReceived / web3.LAMPORTS_PER_SOL, "SOL");
        console.log("Expected (90%):", expectedCreatorAmount / web3.LAMPORTS_PER_SOL, "SOL");

        if (platformReceived === expectedPlatformFee) {
            console.log("✓ Platform received exactly 10%");
        } else {
            console.log("✗ Platform fee mismatch");
        }

        if (creatorReceived === expectedCreatorAmount) {
            console.log("✓ Creator received exactly 90%");
        } else {
            console.log("✗ Creator amount mismatch");
        }
    } catch (e) {
        console.log("Payment split test failed:", e.message);
    }

    // FAN-06: Test Burn Badge
    console.log("\n--- Testing Burn Badge (FAN-06) ---");
    const burnTestBadgeId = "burn-test-" + Math.floor(Math.random() * 10000);

    try {
        // Initialize and mint burn test badge
        const initIx = await client.createInitializeBadgeInstruction(
            creator.publicKey,
            burnTestBadgeId,
            uri,
            price
        );
        await web3.sendAndConfirmTransaction(pg.connection, new web3.Transaction().add(initIx), [creator]);

        const mintIx = await client.createMintBadgeInstruction(
            buyer.publicKey,
            creator.publicKey,
            burnTestBadgeId,
            platformWallet
        );
        await web3.sendAndConfirmTransaction(pg.connection, new web3.Transaction().add(mintIx), [buyer]);
        console.log("Burn test badge minted");

        // Get token account
        const [burnBadgePDA] = getBadgePDA(creator.publicKey, burnTestBadgeId, program.programId);
        const [burnMintPDA] = getMintPDA(burnBadgePDA, program.programId);
        const burnTokenAccount = getAssociatedTokenAddressSync(
            burnMintPDA,
            buyer.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );

        // Verify token exists before burn
        const balanceBefore = await pg.connection.getTokenAccountBalance(burnTokenAccount);
        console.log("Token balance before burn:", balanceBefore.value.amount);

        // Record buyer balance before burn
        const buyerBalanceBefore = await pg.connection.getBalance(buyer.publicKey);

        // Burn the badge
        const burnIx = await client.createBurnBadgeInstruction(
            buyer.publicKey,
            creator.publicKey,
            burnTestBadgeId
        );
        await web3.sendAndConfirmTransaction(pg.connection, new web3.Transaction().add(burnIx), [buyer]);
        console.log("Badge burned successfully");

        // Verify token account is closed
        try {
            await pg.connection.getTokenAccountBalance(burnTokenAccount);
            console.log("✗ Token account still exists after burn");
        } catch (e) {
            if (e.message.includes("could not find account")) {
                console.log("✓ Token account closed after burn");
            } else {
                console.log("Error checking token account:", e.message);
            }
        }

        // Verify no refund (only rent reclaimed)
        const buyerBalanceAfter = await pg.connection.getBalance(buyer.publicKey);
        const balanceChange = buyerBalanceAfter - buyerBalanceBefore;

        console.log("Buyer balance change:", balanceChange / web3.LAMPORTS_PER_SOL, "SOL");

        // Balance should increase due to rent reclaim, but not include badge price refund
        // Rent for token account is ~0.002 SOL, badge price is 0.001 SOL
        // So we expect balance to increase by rent amount (after tx fees)
        // The key is: balance increase should be LESS than (rent + badge_price)
        const maxExpectedIncrease = 0.003 * web3.LAMPORTS_PER_SOL; // Rent (~0.002) + some buffer
        if (balanceChange < maxExpectedIncrease) {
            console.log("✓ No badge price refund issued (only rent reclaimed)");
        } else {
            console.log("✗ Unexpected balance increase");
        }
    } catch (e) {
        console.log("Burn test failed:", e.message);
    }

    console.log("\n=== All Tests Complete ===");
})();

