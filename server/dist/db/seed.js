import { connectDb, disconnectDb } from './db.js';
import { InventoryLog, Product } from '../models.js';
const seedProducts = [
    { name: 'Crochet Baby Blanket', category: 'Blankets', price: 45, stock: 10, low_stock_threshold: 3 },
    { name: 'Amigurumi Octopus', category: 'Toys', price: 15, stock: 20, low_stock_threshold: 5 },
    { name: 'Crochet Beanie', category: 'Apparel', price: 12.5, stock: 15, low_stock_threshold: 4 },
    { name: 'Cotton Yarn - Blue', category: 'Supplies', price: 5, stock: 50, low_stock_threshold: 10 }
];
async function main() {
    await connectDb();
    for (const p of seedProducts) {
        const exists = await Product.findOne({ name: p.name }).lean();
        if (exists)
            continue;
        const created = await Product.create(p);
        if (p.stock > 0) {
            await InventoryLog.create({
                product_id: created._id,
                product_name: created.name,
                change_type: 'RESTOCK',
                qty_change: p.stock,
                reason: 'Initial stock'
            });
        }
    }
    console.log('Seed complete.');
    await disconnectDb();
}
main().catch(async (err) => {
    console.error(err);
    try {
        await disconnectDb();
    }
    catch {
        // ignore
    }
    process.exit(1);
});
