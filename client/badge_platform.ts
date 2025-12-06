export type BadgePlatform = {
    version: "0.1.0";
    name: "badge_platform";
    instructions: [
        {
            name: "initializeBadge";
            discriminator: [96, 16, 131, 182, 237, 29, 205, 74];
            accounts: [
                { name: "creator"; isMut: true; isSigner: true },
                { name: "badge"; isMut: true; isSigner: false },
                { name: "mint"; isMut: true; isSigner: false },
                { name: "systemProgram"; isMut: false; isSigner: false },
                { name: "tokenProgram"; isMut: false; isSigner: false }
            ];
            args: [
                { name: "badgeId"; type: "string" },
                { name: "uri"; type: "string" },
                { name: "price"; type: "u64" }
            ];
        },
        {
            name: "mintBadge";
            discriminator: [242, 234, 237, 183, 232, 245, 146, 1];
            accounts: [
                { name: "payer"; isMut: true; isSigner: true },
                { name: "creator"; isMut: true; isSigner: false },
                { name: "badge"; isMut: true; isSigner: false },
                { name: "mint"; isMut: true; isSigner: false },
                { name: "recipientTokenAccount"; isMut: true; isSigner: false },
                { name: "platformWallet"; isMut: true; isSigner: false },
                { name: "systemProgram"; isMut: false; isSigner: false },
                { name: "tokenProgram"; isMut: false; isSigner: false },
                { name: "associatedTokenProgram"; isMut: false; isSigner: false }
            ];
            args: [];
        }
    ];
    accounts: [
        {
            name: "Badge";
            discriminator: [40, 127, 127, 162, 181, 177, 154, 1, 48];
            type: {
                kind: "struct";
                fields: [
                    { name: "creator"; type: "publicKey" },
                    { name: "price"; type: "u64" },
                    { name: "mint"; type: "publicKey" },
                    { name: "badgeId"; type: "string" },
                    { name: "uri"; type: "string" },
                    { name: "bump"; type: "u8" }
                ];
            };
        }
    ];
    events: [];
    errors: [];
    types: [];
    address: string;
    metadata: {
        name: "badge_platform";
        version: "0.1.0";
        spec: "0.1.0";
        description?: string;
        repository?: string;
        homepage?: string;
        contact?: string;
        deployments?: Record<string, string>;
        address: string;
    };
};

export const IDL: BadgePlatform = {
    version: "0.1.0",
    name: "badge_platform",
    instructions: [
        {
            name: "initializeBadge",
            discriminator: [96, 16, 131, 182, 237, 29, 205, 74],
            accounts: [
                { name: "creator", isMut: true, isSigner: true },
                { name: "badge", isMut: true, isSigner: false },
                { name: "mint", isMut: true, isSigner: false },
                { name: "systemProgram", isMut: false, isSigner: false },
                { name: "tokenProgram", isMut: false, isSigner: false },
            ],
            args: [
                { name: "badgeId", type: "string" },
                { name: "uri", type: "string" },
                { name: "price", type: "u64" },
            ],
        },
        {
            name: "mintBadge",
            discriminator: [242, 234, 237, 183, 232, 245, 146, 1],
            accounts: [
                { name: "payer", isMut: true, isSigner: true },
                { name: "creator", isMut: true, isSigner: false },
                { name: "badge", isMut: true, isSigner: false },
                { name: "mint", isMut: true, isSigner: false },
                { name: "recipientTokenAccount", isMut: true, isSigner: false },
                { name: "platformWallet", isMut: true, isSigner: false },
                { name: "systemProgram", isMut: false, isSigner: false },
                { name: "tokenProgram", isMut: false, isSigner: false },
                { name: "associatedTokenProgram", isMut: false, isSigner: false },
            ],
            args: [],
        },
    ],
    accounts: [
        {
            name: "Badge",
            discriminator: [40, 127, 127, 162, 181, 177, 154, 1, 48],
            type: {
                kind: "struct",
                fields: [
                    { name: "creator", type: "publicKey" },
                    { name: "price", type: "u64" },
                    { name: "mint", type: "publicKey" },
                    { name: "badgeId", type: "string" },
                    { name: "uri", type: "string" },
                    { name: "bump", type: "u8" },
                ],
            },
        },
    ],
    events: [],
    errors: [],
    types: [],
    address: "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
    metadata: {
        name: "badge_platform",
        version: "0.1.0",
        spec: "0.1.0",
        address: "Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS",
    },
};
