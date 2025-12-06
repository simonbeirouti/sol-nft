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
    });
});
