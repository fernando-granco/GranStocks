import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log("Fixing Crypto Asset types in DB...");

    // Find all assets that end with USDT or belong to crypto
    const assets = await prisma.asset.findMany();

    let updated = 0;
    for (const asset of assets) {
        if (asset.symbol.endsWith('USDT') && asset.type !== 'CRYPTO') {
            await prisma.asset.update({
                where: { symbol: asset.symbol },
                data: { type: 'CRYPTO' }
            });
            console.log(`Updated ${asset.symbol} to CRYPTO`);
            updated++;
        }
    }

    console.log(`Done. Updated ${updated} assets.`);
    await prisma.$disconnect();
}

main().catch(console.error);
