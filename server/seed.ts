import { db, generateNextInvoiceNumber, getSetting, setSetting, withTransaction } from './db.ts';

function formatLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getOffsetDate(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return formatLocalDate(d);
}

import { OLD_GROUP_IMAGES } from './productImages.ts';

const DEMO_PRODUCTS = [
  {
    name: 'Chini (White Sugar)',
    barcode: '896100100101',
    code: 'KR-001',
    category: 'Sugar & Salt',
    purchase: 135,
    sales: 150,
    stock: 85,
    min: 20,
    unit: 'Kg',
    image: '/src/assets/images/products/chini_white_sugar_e83c70cc.jpg',
  },
  {
    name: 'Super Kernel Basmati Rice',
    barcode: '896100100102',
    code: 'KR-002',
    category: 'Rice & Flour',
    purchase: 290,
    sales: 340,
    stock: 62,
    min: 15,
    unit: 'Kg',
    image: '/src/assets/images/products/super_kernel_basmati_rice_6ec7caf9.jpg',
  },
  {
    name: 'Chakki Atta (10 Kg Bag)',
    barcode: '896100100103',
    code: 'KR-003',
    category: 'Rice & Flour',
    purchase: 1050,
    sales: 1200,
    stock: 18,
    min: 5,
    unit: 'Packet',
    image: '/src/assets/images/products/chakki_atta_10_kg_bag_9c2240d6.jpg',
  },
  {
    name: 'Dalda Cooking Oil (1L Pouch)',
    barcode: '896100100104',
    code: 'KR-004',
    category: 'Oil & Ghee',
    purchase: 485,
    sales: 530,
    stock: 8,
    min: 10,
    unit: 'Liter',
    image: '/src/assets/images/products/dalda_cooking_oil_1l_pouch_1464e4a8.png',
  },
  {
    name: 'Habib Banaspati Ghee (1 Kg)',
    barcode: '896100100105',
    code: 'KR-005',
    category: 'Oil & Ghee',
    purchase: 475,
    sales: 520,
    stock: 24,
    min: 8,
    unit: 'Kg',
    image: '/src/assets/images/products/habib_banaspati_ghee_1_kg_a5dbe424.jpg',
  },
  {
    name: 'Tapal Danedar Tea (190g)',
    barcode: '896100100106',
    code: 'KR-006',
    category: 'Tea & Milk',
    purchase: 380,
    sales: 430,
    stock: 4,
    min: 6,
    unit: 'Packet',
    image: '/src/assets/images/products/tapal_danedar_tea_190g_67ab8e92.jpg',
  },
  {
    name: "Olper's Full Cream Milk (1L)",
    barcode: '896100100107',
    code: 'KR-007',
    category: 'Tea & Milk',
    purchase: 295,
    sales: 330,
    stock: 30,
    min: 12,
    unit: 'Liter',
    image: '/src/assets/images/products/olper_s_full_cream_milk_1l_b9f7a59f.png',
  },
  {
    name: 'LU Prince Biscuits (Half Roll)',
    barcode: '896100100108',
    code: 'KR-008',
    category: 'Biscuits & Drinks',
    purchase: 32,
    sales: 40,
    stock: 48,
    min: 15,
    unit: 'Packet',
    image: '/src/assets/images/products/lu_prince_biscuits_half_roll_6d58ca8e.jpg',
  },
  {
    name: 'Coca-Cola (1.5 Liter)',
    barcode: '896100100109',
    code: 'KR-009',
    category: 'Biscuits & Drinks',
    purchase: 175,
    sales: 210,
    stock: 22,
    min: 10,
    unit: 'Piece',
    image: '/src/assets/images/products/coca_cola_1_5_liter_3e77de96.jpg',
  },
  {
    name: 'Lux Velvet Glow Soap (115g)',
    barcode: '896100100110',
    code: 'KR-010',
    category: 'Soap & Detergent',
    purchase: 115,
    sales: 140,
    stock: 3,
    min: 8,
    unit: 'Piece',
    image: '/src/assets/images/products/lux_velvet_glow_soap_115g_8a37fcc2.jpg',
  },
  {
    name: 'Surf Excel Washing Powder (500g)',
    barcode: '896100100111',
    code: 'KR-011',
    category: 'Soap & Detergent',
    purchase: 240,
    sales: 280,
    stock: 16,
    min: 6,
    unit: 'Packet',
    image: '/src/assets/images/products/surf_excel_washing_powder_500g_6be9de0c.jpg',
  },
  {
    name: 'Sunsilk Black Shine Shampoo (170ml)',
    barcode: '896100100112',
    code: 'KR-012',
    category: 'Personal Care',
    purchase: 390,
    sales: 450,
    stock: 11,
    min: 4,
    unit: 'Piece',
    image: '/src/assets/images/products/sunsilk_black_shine_shampoo_170ml_ee35d872.jpg',
  },
  {
    name: 'National Iodized Salt (800g)',
    barcode: '896100100113',
    code: 'KR-013',
    category: 'Sugar & Salt',
    purchase: 55,
    sales: 70,
    stock: 40,
    min: 10,
    unit: 'Packet',
    image: '/src/assets/images/products/national_iodized_salt_800g_73aa9776.png',
  },
  {
    name: 'Shan Bombay Biryani Masala (50g)',
    barcode: '896100100114',
    code: 'KR-014',
    category: 'Spices',
    purchase: 105,
    sales: 130,
    stock: 25,
    min: 8,
    unit: 'Box',
    image: '/src/assets/images/products/shan_bombay_biryani_masala_50g_4e79e1f2.jpg',
  },
  {
    name: 'Daal Chana (Split Chickpeas)',
    barcode: '896100100115',
    code: 'KR-015',
    category: 'Pulses',
    purchase: 260,
    sales: 310,
    stock: 5,
    min: 10,
    unit: 'Kg',
    image: '/src/assets/images/products/daal_chana_split_chickpeas_7563261c.jpg',
  },
  {
    name: 'Daal Masoor (Red Lentils)',
    barcode: '896100100116',
    code: 'KR-016',
    category: 'Pulses',
    purchase: 270,
    sales: 320,
    stock: 19,
    min: 8,
    unit: 'Kg',
    image: '/src/assets/images/products/daal_masoor_red_lentils_9b3542b7.jpg',
  },
  {
    name: 'Tang Mango Drink (375g)',
    barcode: '896100100117',
    code: 'KR-017',
    category: 'Biscuits & Drinks',
    purchase: 350,
    sales: 410,
    stock: 9,
    min: 4,
    unit: 'Box',
    image: '/src/assets/images/products/tang_mango_drink_375g_725abda6.png',
  },
  {
    name: 'Sooper Biscuits (Family Pack)',
    barcode: '896100100118',
    code: 'KR-018',
    category: 'Biscuits & Drinks',
    purchase: 95,
    sales: 120,
    stock: 35,
    min: 10,
    unit: 'Packet',
    image: '/src/assets/images/products/sooper_biscuits_family_pack_e3604b93.png',
  },
  {
    name: 'National Red Chilli Powder (200g)',
    barcode: '896100100119',
    code: 'KR-019',
    category: 'Spices',
    purchase: 230,
    sales: 275,
    stock: 2,
    min: 5,
    unit: 'Packet',
    image: '/src/assets/images/products/national_red_chilli_powder_200g_73a5952e.png',
  },
  {
    name: 'Lifebuoy Total Soap (115g)',
    barcode: '896100100120',
    code: 'KR-020',
    category: 'Soap & Detergent',
    purchase: 108,
    sales: 130,
    stock: 28,
    min: 10,
    unit: 'Piece',
    image: '/src/assets/images/products/lifebuoy_total_soap_115g_5c0063a6.png',
  },
];

export function backfillDemoProductImages(): void {
  const getStmt = db.prepare('SELECT id, image_data FROM products WHERE product_code = ? AND is_demo = 1');
  const updateStmt = db.prepare('UPDATE products SET image_data = ? WHERE id = ?');
  for (const p of DEMO_PRODUCTS) {
    const rows = getStmt.all(p.code) as Array<{ id: number; image_data: string }>;
    for (const row of rows) {
      const current = String(row.image_data ?? '').trim();
      if (!current || OLD_GROUP_IMAGES.has(current)) {
        updateStmt.run(p.image, row.id);
      }
    }
  }
}

const DEMO_CUSTOMERS = [
  { name: 'Haji Abdul Rehman', mobile: '0300-4123456', address: 'Gali No. 4, Mohalla Islamnagar', opening: 500 },
  { name: 'Muhammad Bilal', mobile: '0321-7654321', address: 'House 12, Block B, Model Colony', opening: 0 },
  { name: 'Tariq Mahmood', mobile: '0333-9871234', address: 'Near Masjid Al-Noor, Main Bazar', opening: 1200 },
  { name: 'Ayesha Siddiqui', mobile: '0345-5511223', address: 'Flat 3, Rehman Plaza', opening: 0 },
  { name: 'Imran Qureshi', mobile: '0301-8899001', address: 'Chak 45 Road, Near Tailors', opening: 300 },
  { name: 'Zubair Ahmed', mobile: '0312-4455667', address: 'Street 7, Gulshan Colony', opening: 0 },
  { name: 'Kashif Ali', mobile: '0322-3344556', address: 'Opposite Govt School', opening: 0 },
  { name: 'Salma Bibi', mobile: '0334-1122334', address: 'House 88, Noor Street', opening: 0 },
];

export function seedDemoData(force = false): { seeded: boolean; message: string } {
  if (!force) {
    const dismissed = getSetting('demo_dismissed', '0');
    const alreadySeeded = getSetting('demo_seeded', '0');
    const productCount = (db.prepare('SELECT COUNT(*) as c FROM products').get() as { c: number }).c;
    if (dismissed === '1' || alreadySeeded === '1' || productCount > 0) {
      return { seeded: false, message: 'Skipped automatic demo seed.' };
    }
  }

  const existingDemoCount = (db.prepare('SELECT COUNT(*) as c FROM products WHERE is_demo = 1').get() as { c: number }).c;
  if (existingDemoCount > 0) {
    return { seeded: false, message: 'Demo data is already loaded.' };
  }

  return withTransaction(() => {
    const dayMinus2 = getOffsetDate(-2);
    const dayMinus1 = getOffsetDate(-1);
    const dayToday = getOffsetDate(0);

    const productIds: number[] = [];
    const insertProduct = db.prepare(`
      INSERT INTO products (
        name, barcode, product_code, category, purchase_price, sales_price,
        current_stock, min_stock, unit, image_data, is_archived, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
    `);
    const insertMove = db.prepare(`
      INSERT INTO stock_movements (
        product_id, product_name, change_qty, previous_stock, new_stock,
        movement_type, reference_id, note, created_at, is_demo
      ) VALUES (?, ?, ?, ?, ?, 'INITIAL', 'DEMO-SEED', 'Initial demo stock', ?, 1)
    `);

    const seedCreatedAt = `${dayMinus2}T08:00:00`;
    for (const p of DEMO_PRODUCTS) {
      const res = insertProduct.run(
        p.name,
        p.barcode,
        p.code,
        p.category,
        p.purchase,
        p.sales,
        p.stock,
        p.min,
        p.unit,
        p.image,
        seedCreatedAt,
        seedCreatedAt
      );
      const pid = Number(res.lastInsertRowid);
      productIds.push(pid);
      insertMove.run(pid, p.name, p.stock, 0, p.stock, seedCreatedAt);
    }

    const customerIds: number[] = [];
    const customerBalances: Record<number, number> = {};
    const insertCustomer = db.prepare(`
      INSERT INTO customers (
        name, mobile, address, opening_balance, total_udhaar, total_paid, remaining_balance,
        is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, ?)
    `);
    const insertLedger = db.prepare(`
      INSERT INTO customer_ledger (
        customer_id, sale_id, payment_id, invoice_number, description,
        debit, credit, balance_after, created_at, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (const c of DEMO_CUSTOMERS) {
      const res = insertCustomer.run(
        c.name,
        c.mobile,
        c.address,
        c.opening,
        c.opening,
        c.opening,
        seedCreatedAt,
        seedCreatedAt
      );
      const cid = Number(res.lastInsertRowid);
      customerIds.push(cid);
      customerBalances[cid] = c.opening;
      if (c.opening > 0) {
        insertLedger.run(cid, null, null, '', 'Opening Udhaar Balance', c.opening, 0, c.opening, seedCreatedAt);
      }
    }

    // 15 invoices across the last 3 days (5 on day -2, 5 on day -1, 5 today)
    const invoiceSpecs = [
      // Day -2 (5 bills)
      { date: dayMinus2, time: '09:15:10', customerIdx: 0, method: 'Udhaar', paidRatio: 0, discount: 0, items: [[0, 3], [5, 1], [6, 2]] },
      { date: dayMinus2, time: '11:40:22', customerIdx: null, method: 'Cash', paidRatio: 1, discount: 20, items: [[1, 2.5], [3, 1], [12, 1]] },
      { date: dayMinus2, time: '14:05:48', customerIdx: 1, method: 'Partial', paidRatio: 0.5, discount: 0, items: [[2, 1], [4, 1], [14, 1.5]] },
      { date: dayMinus2, time: '17:30:12', customerIdx: null, method: 'Cash', paidRatio: 1, discount: 10, items: [[7, 4], [8, 2], [17, 1]] },
      { date: dayMinus2, time: '20:10:05', customerIdx: 2, method: 'Udhaar', paidRatio: 0, discount: 0, items: [[10, 2], [11, 1], [19, 2]] },

      // Day -1 (Yesterday - 5 bills)
      { date: dayMinus1, time: '09:45:33', customerIdx: 3, method: 'Cash', paidRatio: 1, discount: 50, items: [[1, 5], [4, 2], [13, 2]] },
      { date: dayMinus1, time: '12:20:19', customerIdx: 4, method: 'Partial', paidRatio: 0.6, discount: 0, items: [[0, 2.5], [6, 3], [15, 1.5]] },
      { date: dayMinus1, time: '15:50:44', customerIdx: null, method: 'Cash', paidRatio: 1, discount: 0, items: [[8, 3], [7, 5], [16, 1]] },
      { date: dayMinus1, time: '18:15:27', customerIdx: 0, method: 'Udhaar', paidRatio: 0, discount: 30, items: [[2, 1], [3, 2], [18, 1]] },
      { date: dayMinus1, time: '21:05:11', customerIdx: 5, method: 'Cash', paidRatio: 1, discount: 0, items: [[9, 2], [10, 1], [19, 3]] },

      // Today (5 bills)
      { date: dayToday, time: '08:30:14', customerIdx: null, method: 'Cash', paidRatio: 1, discount: 0, items: [[0, 2], [6, 2], [7, 3]] },
      { date: dayToday, time: '10:12:50', customerIdx: 6, method: 'Partial', paidRatio: 0.4, discount: 25, items: [[1, 3], [5, 1], [14, 1]] },
      { date: dayToday, time: '11:45:08', customerIdx: 2, method: 'Udhaar', paidRatio: 0, discount: 0, items: [[2, 1], [4, 1], [12, 2]] },
      { date: dayToday, time: '13:20:39', customerIdx: null, method: 'Cash', paidRatio: 1, discount: 15, items: [[8, 2], [13, 2], [17, 2]] },
      { date: dayToday, time: '15:05:21', customerIdx: 7, method: 'Cash', paidRatio: 1, discount: 0, items: [[3, 1], [11, 1], [15, 1]] },
    ];

    const insertSale = db.prepare(`
      INSERT INTO sales (
        invoice_number, idempotency_key, sale_date, sale_time, created_at,
        subtotal, discount, grand_total, total_purchase_cost, gross_profit,
        paid_amount, remaining_amount, payment_method, customer_id, customer_name, notes, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const insertSaleItem = db.prepare(`
      INSERT INTO sale_items (
        sale_id, product_id, product_name, unit, quantity,
        purchase_price_at_sale, selling_price, item_total, item_profit, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const insertPayment = db.prepare(`
      INSERT INTO payments (
        customer_id, sale_id, invoice_number, amount, payment_type, note, created_at, is_demo
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);

    for (let i = 0; i < invoiceSpecs.length; i++) {
      const spec = invoiceSpecs[i];
      const invoiceNumber = generateNextInvoiceNumber();
      const createdAt = `${spec.date}T${spec.time}`;
      let subtotal = 0;
      let totalCost = 0;

      const lineRows: Array<{
        pid: number;
        name: string;
        unit: string;
        qty: number;
        purchase: number;
        selling: number;
        total: number;
        profit: number;
      }> = [];

      for (const [pIdx, qty] of spec.items) {
        const prod = DEMO_PRODUCTS[pIdx];
        const pid = productIds[pIdx];
        const itemTotal = Math.round(prod.sales * qty * 100) / 100;
        const itemCost = Math.round(prod.purchase * qty * 100) / 100;
        subtotal += itemTotal;
        totalCost += itemCost;
        lineRows.push({
          pid,
          name: prod.name,
          unit: prod.unit,
          qty,
          purchase: prod.purchase,
          selling: prod.sales,
          total: itemTotal,
          profit: Math.round((itemTotal - itemCost) * 100) / 100,
        });
      }

      const grandTotal = Math.max(0, Math.round((subtotal - spec.discount) * 100) / 100);
      const grossProfit = Math.round((subtotal - totalCost - spec.discount) * 100) / 100;
      const paidAmount =
        spec.method === 'Cash'
          ? grandTotal
          : spec.method === 'Udhaar'
            ? 0
            : Math.round(grandTotal * spec.paidRatio);
      const remainingAmount = Math.max(0, Math.round((grandTotal - paidAmount) * 100) / 100);
      const cid = spec.customerIdx !== null ? customerIds[spec.customerIdx] : null;
      const cname = spec.customerIdx !== null ? DEMO_CUSTOMERS[spec.customerIdx].name : 'Walk-in Customer';

      const saleRes = insertSale.run(
        invoiceNumber,
        `demo-seed-${i + 1}-${Date.now()}`,
        spec.date,
        spec.time,
        createdAt,
        subtotal,
        spec.discount,
        grandTotal,
        totalCost,
        grossProfit,
        paidAmount,
        remainingAmount,
        spec.method,
        cid,
        cname,
        'Demo Invoice',
      );
      const saleId = Number(saleRes.lastInsertRowid);

      for (const line of lineRows) {
        insertSaleItem.run(
          saleId,
          line.pid,
          line.name,
          line.unit,
          line.qty,
          line.purchase,
          line.selling,
          line.total,
          line.profit
        );
      }

      if (cid !== null && remainingAmount > 0) {
        const prevBal = customerBalances[cid] ?? 0;
        const newBal = Math.round((prevBal + remainingAmount) * 100) / 100;
        customerBalances[cid] = newBal;

        db.prepare(`
          UPDATE customers
          SET total_udhaar = total_udhaar + ?,
              total_paid = total_paid + ?,
              remaining_balance = ?,
              updated_at = ?
          WHERE id = ?
        `).run(grandTotal, paidAmount, newBal, createdAt, cid);

        insertLedger.run(
          cid,
          saleId,
          null,
          invoiceNumber,
          `${spec.method} Bill (${invoiceNumber})`,
          grandTotal,
          paidAmount,
          newBal,
          createdAt
        );

        if (paidAmount > 0) {
          insertPayment.run(cid, saleId, invoiceNumber, paidAmount, 'PARTIAL_AT_SALE', 'Partial payment at counter', createdAt);
        }
      }
    }

    // Add 1 sample Udhaar repayment yesterday from Haji Abdul Rehman
    const hajiId = customerIds[0];
    const hajiPay = 1000;
    const hajiBalBefore = customerBalances[hajiId] ?? 0;
    const hajiBalAfter = Math.max(0, Math.round((hajiBalBefore - hajiPay) * 100) / 100);
    customerBalances[hajiId] = hajiBalAfter;
    const payTime = `${dayMinus1}T19:40:00`;
    const payRes = insertPayment.run(hajiId, null, '', hajiPay, 'UDHAAR_PAYMENT', 'Cash received at counter', payTime);
    db.prepare(`
      UPDATE customers SET total_paid = total_paid + ?, remaining_balance = ?, updated_at = ? WHERE id = ?
    `).run(hajiPay, hajiBalAfter, payTime, hajiId);
    insertLedger.run(hajiId, null, Number(payRes.lastInsertRowid), '', 'Cash Payment Received', 0, hajiPay, hajiBalAfter, payTime);

    // Sample expenses for Monthly Report Net Profit demonstration
    const insertExp = db.prepare(`
      INSERT INTO expenses (title, category, amount, expense_date, note, created_at, is_demo)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    insertExp.run('Shop Electricity Bill Share', 'Utilities', 850, dayMinus2, 'Demo expense', `${dayMinus2}T10:00:00`);
    insertExp.run('Helper Daily Tea & Snacks', 'Staff', 250, dayMinus1, 'Demo expense', `${dayMinus1}T16:00:00`);
    insertExp.run('Plastic Carry Bags Bundle', 'Packaging', 400, dayToday, 'Demo expense', `${dayToday}T09:00:00`);

    setSetting('demo_seeded', '1');
    setSetting('demo_dismissed', '0');

    return { seeded: true, message: 'Loaded 20 products, 8 customers, and 15 invoices across the last 3 days.' };
  });
}

export function clearDemoData(): { cleared: boolean; message: string } {
  return withTransaction(() => {
    // Protect any demo product or customer that was used in a real (is_demo = 0) transaction
    db.exec(`
      UPDATE products SET is_demo = 0
      WHERE is_demo = 1 AND id IN (SELECT DISTINCT product_id FROM sale_items WHERE is_demo = 0);

      UPDATE customers SET is_demo = 0
      WHERE is_demo = 1 AND (
        id IN (SELECT DISTINCT customer_id FROM sales WHERE is_demo = 0 AND customer_id IS NOT NULL)
        OR id IN (SELECT DISTINCT customer_id FROM customer_ledger WHERE is_demo = 0)
      );
    `);

    db.exec(`
      DELETE FROM customer_ledger WHERE is_demo = 1;
      DELETE FROM payments WHERE is_demo = 1;
      DELETE FROM sale_items WHERE is_demo = 1;
      DELETE FROM sales WHERE is_demo = 1;
      DELETE FROM stock_movements WHERE is_demo = 1;
      DELETE FROM expenses WHERE is_demo = 1;
      DELETE FROM customers WHERE is_demo = 1;
      DELETE FROM products WHERE is_demo = 1;
    `);

    setSetting('demo_seeded', '0');
    setSetting('demo_dismissed', '1');

    return { cleared: true, message: 'All demo data removed. Real business records remain untouched.' };
  });
}
