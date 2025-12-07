// Solana Playground Test File
// Copy and paste this into a test file (e.g. tests/anchor.test.ts) in Solana Playground

// --- Constants & Polyfills ---

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

const PROGRAM_ID = pg.program.programId;

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

// --- Test Suite (Adapted from anchor.test.ts) ---

describe("badge-program", () => {
    // SolPG automatically providers 'pg.program', 'pg.wallet', 'pg.connection'
    const program = pg.program;
    const startClient = new BadgeClient(program);

    const creator = web3.Keypair.generate();
    const buyer = web3.Keypair.generate();
    // Use the specific platform wallet address expected by the program (from error logs)
    const platformWallet = new web3.PublicKey("GnA7QBSZKk1YAb1aGRk5Ze5Up6jqDqEwDCYEyEtHdy4s"); // Mock platform wallet

    const badgeId = "badge-" + Math.floor(Math.random() * 10000);
    const uri = "https://example.com/badge.json";
    const price = 1000000; // 0.001 SOL

    it("Initialize Badge", async () => {
        // Airdrop SOL to creator
        // Note: Airdrops can be flaky on devnet. If this fails, assume pg.wallet has funds and maybe use that instead, 
        // or ensure these generated accounts get funded.
        try {
            const sig = await pg.connection.requestAirdrop(creator.publicKey, 2 * web3.LAMPORTS_PER_SOL);
            await pg.connection.confirmTransaction(sig);
        } catch (e) {
            console.log("Airdrop failed or skipped, transferring from pg.wallet...");
            const tx = new web3.Transaction().add(
                web3.SystemProgram.transfer({
                    fromPubkey: pg.wallet.publicKey,
                    toPubkey: creator.publicKey,
                    lamports: 0.1 * web3.LAMPORTS_PER_SOL
                })
            );
            await web3.sendAndConfirmTransaction(pg.connection, tx, [pg.wallet.keypair]);
        }

        const ix = await startClient.createInitializeBadgeInstruction(
            creator.publicKey,
            badgeId,
            uri,
            price
        );

        await web3.sendAndConfirmTransaction(pg.connection, new web3.Transaction().add(ix), [
            creator,
        ]);
        console.log("Badge initialized!");
    });

    it("Mint Badge", async () => {
        // Airdrop SOL to buyer
        try {
            const sig = await pg.connection.requestAirdrop(buyer.publicKey, 2 * web3.LAMPORTS_PER_SOL);
            await pg.connection.confirmTransaction(sig);
        } catch (e) {
            console.log("Airdrop failed or skipped, transferring from pg.wallet...");
            const tx = new web3.Transaction().add(
                web3.SystemProgram.transfer({
                    fromPubkey: pg.wallet.publicKey,
                    toPubkey: buyer.publicKey,
                    lamports: 0.1 * web3.LAMPORTS_PER_SOL
                })
            );
            await web3.sendAndConfirmTransaction(pg.connection, tx, [pg.wallet.keypair]);
        }

        const ix = await startClient.createMintBadgeInstruction(
            buyer.publicKey,
            creator.publicKey,
            badgeId,
            platformWallet
        );

        await web3.sendAndConfirmTransaction(pg.connection, new web3.Transaction().add(ix), [
            buyer,
        ]);
        console.log("Badge minted!");

        // Verify token balance
        const [badgePDA] = getBadgePDA(creator.publicKey, badgeId, program.programId);
        const [mintPDA] = getMintPDA(badgePDA, program.programId);

        const recipientTokenAccount = getAssociatedTokenAddressSync(
            mintPDA,
            buyer.publicKey,
            false,
            TOKEN_2022_PROGRAM_ID
        );

        // Check buyer has the token
        const balance = await pg.connection.getTokenAccountBalance(recipientTokenAccount);
        assert.equal(balance.value.amount, "1");

        // FAN-05: Verify token account is frozen (soulbound)
        const tokenAccountInfo = await pg.connection.getAccountInfo(recipientTokenAccount);
        assert.ok(tokenAccountInfo, "Token account should exist");

        // Token-2022 account layout: state is at offset 108 (1 byte)
        // state: 0 = uninitialized, 1 = initialized, 2 = frozen
        const state = tokenAccountInfo.data[108];
        assert.equal(state, 2, "Token account should be frozen (soulbound)");
        console.log("✓ Token account is frozen (soulbound enforced)");
    });

    // DEV-01, CRE-04: Test Payment Split (10% platform, 90% creator)
    it("Should split payment 10% platform, 90% creator", async () => {
        const paymentTestBadgeId = "payment-test-" + Math.floor(Math.random() * 10000);
        const testPrice = 1_000_000_000; // 1 SOL for easier calculation

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
        const initIx = await startClient.createInitializeBadgeInstruction(
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

        // Mint badge
        const mintIx = await startClient.createMintBadgeInstruction(
            buyer.publicKey,
            creator.publicKey,
            paymentTestBadgeId,
            platformWallet
        );
        await web3.sendAndConfirmTransaction(pg.connection, new web3.Transaction().add(mintIx), [buyer]);

        // Record balances after
        const platformBalanceAfter = await pg.connection.getBalance(platformWallet);
        const creatorBalanceAfter = await pg.connection.getBalance(creator.publicKey);

        // Calculate received amounts
        const platformReceived = platformBalanceAfter - platformBalanceBefore;
        const creatorReceived = creatorBalanceAfter - creatorBalanceBefore;

        const expectedPlatformFee = testPrice * 0.1;
        const expectedCreatorAmount = testPrice * 0.9;

        console.log("Platform received:", platformReceived / web3.LAMPORTS_PER_SOL, "SOL");
        console.log("Expected (10%):", expectedPlatformFee / web3.LAMPORTS_PER_SOL, "SOL");
        console.log("Creator received:", creatorReceived / web3.LAMPORTS_PER_SOL, "SOL");
        console.log("Expected (90%):", expectedCreatorAmount / web3.LAMPORTS_PER_SOL, "SOL");

        // DEV-01: Verify platform receives exactly 10%
        assert.equal(platformReceived, expectedPlatformFee, "Platform should receive exactly 10%");

        // CRE-04: Verify creator receives exactly 90%
        assert.equal(creatorReceived, expectedCreatorAmount, "Creator should receive exactly 90%");
        console.log("✓ Payment split verified: 10% platform, 90% creator");
    });

    // FAN-06: Test Burn Badge
    it("Should allow burning badge with no refund", async () => {
        const burnTestBadgeId = "burn-test-" + Math.floor(Math.random() * 10000);

        // Initialize and mint burn test badge
        const initIx = await startClient.createInitializeBadgeInstruction(
            creator.publicKey,
            burnTestBadgeId,
            uri,
            price
        );
        await web3.sendAndConfirmTransaction(pg.connection, new web3.Transaction().add(initIx), [creator]);

        const mintIx = await startClient.createMintBadgeInstruction(
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
        assert.equal(balanceBefore.value.amount, "1", "Should have 1 token before burn");

        // Record buyer balance before burn
        const buyerBalanceBefore = await pg.connection.getBalance(buyer.publicKey);

        // Burn the badge
        const burnIx = await startClient.createBurnBadgeInstruction(
            buyer.publicKey,
            creator.publicKey,
            burnTestBadgeId
        );
        await web3.sendAndConfirmTransaction(pg.connection, new web3.Transaction().add(burnIx), [buyer]);
        console.log("Badge burned successfully");

        // Verify token account is closed
        try {
            await pg.connection.getTokenAccountBalance(burnTokenAccount);
            assert.fail("Token account should be closed after burn");
        } catch (e) {
            assert.ok(e.message.includes("could not find account"), "Token account should not exist");
            console.log("✓ Token account closed after burn");
        }

        // FAN-06: Verify no refund (only rent reclaimed)
        const buyerBalanceAfter = await pg.connection.getBalance(buyer.publicKey);
        const balanceChange = buyerBalanceAfter - buyerBalanceBefore;

        console.log("Buyer balance change:", balanceChange / web3.LAMPORTS_PER_SOL, "SOL");

        // Balance should increase due to rent reclaim, but not include badge price refund
        // Rent for token account is ~0.002 SOL, badge price is 0.001 SOL
        // So we expect balance to increase by rent amount (after tx fees)
        // The key is: balance increase should be LESS than (rent + badge_price)
        const maxExpectedIncrease = 0.003 * web3.LAMPORTS_PER_SOL; // Rent (~0.002) + some buffer
        assert.ok(balanceChange < maxExpectedIncrease, "Should not receive badge price refund");
        console.log("✓ No badge price refund issued (only rent reclaimed)");
    });
});
