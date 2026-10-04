import React, { useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  writeBatch, 
  doc, 
  serverTimestamp 
} from '../lib/restStore';
import { db, handleApiError, OperationType, auth } from '../lib/data';
import { useBusiness } from '../hooks/useBusiness';
import { useUI } from '../context/UIContext';
import { 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Database, 
  RefreshCw, 
  Play, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle,
  Beaker
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Voucher, Ledger, Product, AccountGroup, Party, Warehouse, Unit } from '../types';

interface TestResult {
  name: string;
  assertion: string;
  status: 'PASS' | 'FAIL' | 'PENDING';
  details: string;
  mathLogs?: string[];
}

export default function DemoAndTestingSuite({ 
  vouchers, 
  ledgers, 
  groups, 
  products, 
  parties 
}: { 
  vouchers: Voucher[]; 
  ledgers: Ledger[]; 
  groups: AccountGroup[]; 
  products: Product[]; 
  parties: Party[];
}) {
  const { business, currency } = useBusiness();
  const { notify } = useUI();
  const [isOpen, setIsOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [isRunningTests, setIsRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [consoleLogs, setConsoleLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setConsoleLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const handleSeedData = async () => {
    if (!business) {
      notify.error('Please load a business environment first');
      return;
    }
    
    setIsSeeding(true);
    setConsoleLogs([]);
    addLog(`INITIALIZING DEMO DATA SEEDING ENGINE FOR: ${business.name}`);
    
    try {
      // 1. Fetch or create account groups
      addLog('Step 1: Locating business account groups...');
      const groupSnap = await getDocs(query(collection(db, 'accountGroups'), where('businessId', '==', business.id)));
      let groupMap = new Map<string, string>();
      
      const defaultGroups = [
        { name: 'Fixed Assets', nature: 'Asset' },
        { name: 'Current Assets', nature: 'Asset' },
        { name: 'Sundry Debtors', nature: 'Asset' },
        { name: 'Sundry Creditors', nature: 'Liability' },
        { name: 'Bank & Cash', nature: 'Asset' },
        { name: 'Direct Income', nature: 'Income' },
        { name: 'Direct Expense', nature: 'Expense' },
        { name: 'Capital Account', nature: 'Equity' }
      ];

      if (groupSnap.empty) {
        addLog('No default account groups found. Bootstrapping them now...');
        for (const g of defaultGroups) {
          const docRef = await addDoc(collection(db, 'accountGroups'), {
            businessId: business.id,
            ...g
          });
          groupMap.set(g.name, docRef.id);
        }
        addLog('Account groups bootstrapped successfully.');
      } else {
        groupSnap.docs.forEach(doc => {
          groupMap.set(doc.data().name, doc.id);
        });
        addLog('Existing account groups mapped successfully.');
      }

      // Check for any missing groups
      for (const dg of defaultGroups) {
        if (!groupMap.has(dg.name)) {
          const docRef = await addDoc(collection(db, 'accountGroups'), {
            businessId: business.id,
            ...dg
          });
          groupMap.set(dg.name, docRef.id);
          addLog(`Added missing group: ${dg.name}`);
        }
      }

      // 2. Create warehouses and units
      addLog('Step 2: Checking units and warehouses...');
      const unitSnap = await getDocs(query(collection(db, 'units'), where('businessId', '==', business.id)));
      let unitId = '';
      if (unitSnap.empty) {
        const uRef = await addDoc(collection(db, 'units'), {
          businessId: business.id,
          name: 'Pcs',
          active: true
        });
        unitId = uRef.id;
        addLog('Created unit of measure: Pcs');
      } else {
        unitId = unitSnap.docs[0].id;
        addLog(`Mapped existing unit of measure: ${unitSnap.docs[0].data().name}`);
      }

      const whSnap = await getDocs(query(collection(db, 'warehouses'), where('businessId', '==', business.id)));
      let warehouseId = '';
      if (whSnap.empty) {
        const wRef = await addDoc(collection(db, 'warehouses'), {
          businessId: business.id,
          name: 'Central Store',
          active: true
        });
        warehouseId = wRef.id;
        addLog('Created storage facility: Central Store');
      } else {
        warehouseId = whSnap.docs[0].id;
        addLog(`Mapped existing storage facility: ${whSnap.docs[0].data().name}`);
      }

      // 3. Create products
      addLog('Step 3: Creating demo product line items...');
      const prodSnap = await getDocs(query(collection(db, 'products'), where('businessId', '==', business.id)));
      let widgetId = '';
      let gadgetId = '';
      
      if (prodSnap.empty) {
        const p1 = await addDoc(collection(db, 'products'), {
          businessId: business.id,
          name: 'Standard Widget',
          baseUnitId: unitId,
          sellingPrice: 150,
          active: true
        });
        widgetId = p1.id;
        
        const p2 = await addDoc(collection(db, 'products'), {
          businessId: business.id,
          name: 'Elite Gadget',
          baseUnitId: unitId,
          sellingPrice: 450,
          active: true
        });
        gadgetId = p2.id;
        
        addLog('Products incorporated: Standard Widget ($150) & Elite Gadget ($450)');
      } else {
        widgetId = prodSnap.docs[0].id;
        gadgetId = prodSnap.docs[1]?.id || prodSnap.docs[0].id;
        addLog('Demo product list matched from active master records.');
      }

      // 4. Create ledgers
      addLog('Step 4: Creating accounting charts and ledgers...');
      const ledgSnap = await getDocs(query(collection(db, 'ledgers'), where('businessId', '==', business.id)));
      let ledgerMap = new Map<string, string>();
      
      const defaultLedgers = [
        { name: 'Bank of Commerce', groupName: 'Bank & Cash', openingBalance: 10000, openingBalanceType: 'Dr' },
        { name: 'Cash Account', groupName: 'Bank & Cash', openingBalance: 1500, openingBalanceType: 'Dr' },
        { name: 'Nile Apex Customer Ledger', groupName: 'Sundry Debtors', openingBalance: 0, openingBalanceType: 'Dr' },
        { name: 'Globe Trade Supplier Ledger', groupName: 'Sundry Creditors', openingBalance: 0, openingBalanceType: 'Cr' },
        { name: 'Product Sales Account', groupName: 'Direct Income', openingBalance: 0, openingBalanceType: 'Cr' },
        { name: 'Goods Purchase Account', groupName: 'Direct Expense', openingBalance: 0, openingBalanceType: 'Dr' },
        { name: 'Salary & Wages Expense', groupName: 'Direct Expense', openingBalance: 0, openingBalanceType: 'Dr' },
        { name: 'Share Capital Account', groupName: 'Capital Account', openingBalance: 11500, openingBalanceType: 'Cr' }
      ];

      for (const dl of defaultLedgers) {
        const existingLedg = ledgSnap.docs.find(d => d.data().name === dl.name);
        if (existingLedg) {
          ledgerMap.set(dl.name, existingLedg.id);
        } else {
          const groupId = groupMap.get(dl.groupName);
          if (groupId) {
            const lRef = await addDoc(collection(db, 'ledgers'), {
              businessId: business.id,
              name: dl.name,
              groupId: groupId,
              openingBalance: dl.openingBalance,
              openingBalanceType: dl.openingBalanceType,
              active: true
            });
            ledgerMap.set(dl.name, lRef.id);
            addLog(`Ledger registered: ${dl.name}`);
          }
        }
      }

      // 5. Create Parties
      addLog('Step 5: Provisioning commercial trading parties...');
      const partySnap = await getDocs(query(collection(db, 'parties'), where('businessId', '==', business.id)));
      let customerPartyId = '';
      let supplierPartyId = '';

      if (partySnap.empty) {
        const cParty = await addDoc(collection(db, 'parties'), {
          businessId: business.id,
          name: 'Nile Apex Customer',
          type: 'Customer',
          ledgerId: ledgerMap.get('Nile Apex Customer Ledger') || '',
          active: true
        });
        customerPartyId = cParty.id;

        const sParty = await addDoc(collection(db, 'parties'), {
          businessId: business.id,
          name: 'Globe Trade Supplier',
          type: 'Supplier',
          ledgerId: ledgerMap.get('Globe Trade Supplier Ledger') || '',
          active: true
        });
        supplierPartyId = sParty.id;
        
        addLog('Registered: Nile Apex Customer (Debtor) & Globe Trade Supplier (Creditor)');
      } else {
        customerPartyId = partySnap.docs[0].id;
        supplierPartyId = partySnap.docs[1]?.id || partySnap.docs[0].id;
        addLog('Parties matched from existing registry.');
      }

      // 6. Post balanced vouchers
      addLog('Step 6: Posting clean, balanced accounting transaction entries...');
      const existingVouchSnap = await getDocs(query(collection(db, 'vouchers'), where('businessId', '==', business.id)));
      
      // Let's create fresh demo transactions if none or few exist
      const bankId = ledgerMap.get('Bank of Commerce') || '';
      const shareCapId = ledgerMap.get('Share Capital Account') || '';
      const purchaseLedgerId = ledgerMap.get('Goods Purchase Account') || '';
      const supplierLedgerId = ledgerMap.get('Globe Trade Supplier Ledger') || '';
      const salesLedgerId = ledgerMap.get('Product Sales Account') || '';
      const customerLedgerId = ledgerMap.get('Nile Apex Customer Ledger') || '';
      const salaryLedgerId = ledgerMap.get('Salary & Wages Expense') || '';

      const testVouchers = [
        // RCT-101: Capital Introduction
        {
          type: 'Receipt',
          number: 'RCT-101',
          date: '2026-05-10',
          narration: 'Additional investment capital injected in commercial bank account',
          status: 'Posted',
          lines: [
            { ledgerId: bankId, debit: 50000, credit: 0, txnDebit: 50000, txnCredit: 0 },
            { ledgerId: shareCapId, debit: 0, credit: 50000, txnDebit: 0, txnCredit: 50000 }
          ],
          stockLines: [],
        },
        // PUR-201: Stock Purchase from Globe Trade Supplier
        {
          type: 'Purchase',
          number: 'PUR-201',
          date: '2026-05-15',
          narration: 'Acquisition of standard inventory widgets & gadgets',
          status: 'Posted',
          partyId: supplierPartyId,
          lines: [
            { ledgerId: purchaseLedgerId, debit: 20000, credit: 0, txnDebit: 20000, txnCredit: 0 },
            { 
              ledgerId: supplierLedgerId, 
              debit: 0, 
              credit: 20000, 
              txnDebit: 0, 
              txnCredit: 20000,
              billDetails: [
                { billNo: 'SUP-BILL-201', amount: 20000, type: 'New Ref', dueDate: '2026-06-15' }
              ]
            }
          ],
          stockLines: [
            { productId: widgetId, warehouseId, unitId, quantity: 100, rate: 100 },
            { productId: gadgetId, warehouseId, unitId, quantity: 25, rate: 400 }
          ]
        },
        // PMT-301: Supplier Payment
        {
          type: 'Payment',
          number: 'PMT-301',
          date: '2026-06-05',
          narration: 'Settlement against supplier bill reference SUP-BILL-201',
          status: 'Posted',
          partyId: supplierPartyId,
          lines: [
            { 
              ledgerId: supplierLedgerId, 
              debit: 15000, 
              credit: 0, 
              txnDebit: 15000, 
              txnCredit: 0,
              billDetails: [
                { billNo: 'SUP-BILL-201', amount: 15000, type: 'Against Ref' }
              ]
            },
            { ledgerId: bankId, debit: 0, credit: 15000, txnDebit: 0, txnCredit: 15000 }
          ],
          stockLines: []
        },
        // SAL-401: Commercial Sale to Nile Apex Customer
        {
          type: 'Sale',
          number: 'SAL-401',
          date: '2026-06-18',
          narration: 'Dispatched merchandise consignment to customer',
          status: 'Posted',
          partyId: customerPartyId,
          lines: [
            { 
              ledgerId: customerLedgerId, 
              debit: 13500, 
              credit: 0, 
              txnDebit: 13500, 
              txnCredit: 0,
              billDetails: [
                { billNo: 'CUST-INV-401', amount: 13500, type: 'New Ref', dueDate: '2026-07-18' }
              ]
            },
            { ledgerId: salesLedgerId, debit: 0, credit: 13500, txnDebit: 0, txnCredit: 13500 }
          ],
          stockLines: [
            { productId: widgetId, warehouseId, unitId, quantity: -40, rate: 150 },
            { productId: gadgetId, warehouseId, unitId, quantity: -15, rate: 500 }
          ]
        },
        // PAY-501: Operating Payroll
        {
          type: 'Payroll',
          number: 'PAY-501',
          date: '2026-06-30',
          narration: 'June salary disbursements via bank transfer',
          status: 'Posted',
          lines: [
            { ledgerId: salaryLedgerId, debit: 4000, credit: 0, txnDebit: 4000, txnCredit: 0 },
            { ledgerId: bankId, debit: 0, credit: 4000, txnDebit: 0, txnCredit: 4000 }
          ],
          stockLines: []
        }
      ];

      for (const tv of testVouchers) {
        const alreadyExists = existingVouchSnap.docs.some(d => d.data().number === tv.number);
        if (!alreadyExists) {
          await addDoc(collection(db, 'vouchers'), {
            businessId: business.id,
            actorId: auth.currentUser?.uid || 'system-tester',
            currencyId: business.baseCurrencyId,
            exchangeRate: 1,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            ...tv
          });
          addLog(`Audit trail registered voucher: [${tv.type}] ${tv.number} - Date: ${tv.date}`);
        } else {
          addLog(`Skipped: Voucher ${tv.number} already exists in general journal.`);
        }
      }

      addLog('=============================================');
      addLog('DEMO ENVIRONMENT POPULATION COMPLETE!');
      addLog('All charts, indicators, and tables will now load real metrics.');
      addLog('=============================================');
      notify.success('Clean demo dataset successfully seeded through the API');
      
      // Auto run tests after seeding
      setTimeout(() => {
        runAutomatedTests();
      }, 1000);

    } catch (err) {
      handleApiError(err, OperationType.WRITE, 'demo_seeding');
      addLog(`FATAL SEED ERROR: ${err instanceof Error ? err.message : String(err)}`);
      notify.error('Failed to seed demo data. Check permissions.');
    } finally {
      setIsSeeding(false);
    }
  };

  const runAutomatedTests = () => {
    setIsRunningTests(true);
    setTestResults([]);
    
    // Create detailed logging steps
    const steps: string[] = [];
    steps.push('INITIALIZING COMPREHENSIVE FINANCIAL INTEGRITY AUDIT');
    steps.push('----------------------------------------------------');
    steps.push(`Target Profile: ${business?.name || 'N/A'}`);
    steps.push(`Base currency: ${currency?.code || 'USD'}`);
    steps.push(`Vouchers fetched for assertion: ${vouchers.length} units`);
    steps.push(`Registered chart accounts: ${ledgers.length} items`);
    steps.push(`Inventory categories matched: ${products.length} positions`);

    const results: TestResult[] = [];

    // TEST 1: Double-Entry Symmetry (Debits = Credits per Voucher)
    steps.push('\n[Assertion Suite 1] Verifying Double-Entry Symmetry...');
    const posted = vouchers.filter(v => v.status === 'Posted');
    if (posted.length === 0) {
      results.push({
        name: 'Double-Entry Symmetry',
        assertion: 'Sum of debits matches sum of credits for each transaction',
        status: 'FAIL',
        details: 'No posted vouchers exist in the general journal. Please seed demo data first.',
        mathLogs: ['Asserted: PostedVouchers.length > 0 | Found: 0']
      });
      steps.push('[FAIL] Test 1: No posted transactions found.');
    } else {
      let passed = true;
      let errorDetails = '';
      const mathLogs: string[] = [];

      posted.forEach(v => {
        const totalDebit = v.lines?.reduce((sum, l) => sum + (l.debit || 0), 0) || 0;
        const totalCredit = v.lines?.reduce((sum, l) => sum + (l.credit || 0), 0) || 0;
        const diff = Math.abs(totalDebit - totalCredit);
        
        mathLogs.push(`Voucher ${v.number} (${v.type}): Dr ${totalDebit.toFixed(2)} | Cr ${totalCredit.toFixed(2)} (Diff: ${diff.toFixed(2)})`);
        if (diff > 0.01) {
          passed = false;
          errorDetails += `Voucher ${v.number} is imbalanced by ${diff.toFixed(2)}. `;
        }
      });

      results.push({
        name: 'Double-Entry Symmetry',
        assertion: 'For every posted transaction, debits must exactly equal credits',
        status: passed ? 'PASS' : 'FAIL',
        details: passed 
          ? `Verified symmetry across all ${posted.length} active transaction vouchers with zero discrepancy.`
          : `Discrepancy detected: ${errorDetails}`,
        mathLogs
      });
      steps.push(passed ? `[PASS] Test 1: ${posted.length} journal entries balanced.` : '[FAIL] Test 1: Asymmetry found in journal.');
    }

    // TEST 2: Accounting Equivalence (Assets = Liabilities + Equity)
    steps.push('\n[Assertion Suite 2] Verifying Global Accounting Equation...');
    // We compute ledger balances
    const getBalance = (lId: string) => {
      const ledger = ledgers.find(l => l.id === lId);
      if (!ledger) return 0;
      let bal = (ledger.openingBalance || 0) * (ledger.openingBalanceType === 'Dr' ? 1 : -1);
      posted.forEach(v => {
        v.lines?.filter(l => l.ledgerId === lId).forEach(l => {
          bal += ((l.debit || 0) - (l.credit || 0));
        });
      });
      return bal;
    };

    // Calculate Assets, Liabilities, Equity, Net Profit/Loss
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let revenue = 0;
    let expenses = 0;

    ledgers.forEach(l => {
      const gp = groups.find(g => g.id === l.groupId);
      if (!gp) return;
      const bal = getBalance(l.id);

      if (gp.nature === 'Asset') {
        totalAssets += bal; // Assets are DR positive
      } else if (gp.nature === 'Liability') {
        totalLiabilities += Math.abs(bal); // Liabilities are CR positive (Dr - Cr will be negative, so take abs)
      } else if (gp.nature === 'Equity') {
        totalEquity += Math.abs(bal); // Equity is CR positive
      } else if (gp.nature === 'Income') {
        // Income is CR positive, Dr - Cr will be negative, so Credit side is -bal
        revenue += -bal;
      } else if (gp.nature === 'Expense') {
        // Expense is DR positive, Dr - Cr will be positive
        expenses += bal;
      }
    });

    const netProfit = revenue - expenses;
    const rightHandSide = totalLiabilities + totalEquity + netProfit;
    const equationDiff = Math.abs(totalAssets - rightHandSide);

    const matchLogs: string[] = [
      `Assets Ledger Debit Flow: ${totalAssets.toLocaleString()}`,
      `Liabilities Creditor Obligations: ${totalLiabilities.toLocaleString()}`,
      `Equity Capital Pool: ${totalEquity.toLocaleString()}`,
      `Sales Revenue: ${revenue.toLocaleString()}`,
      `Operating Expenses: ${expenses.toLocaleString()}`,
      `Derived Net Profit: ${netProfit.toLocaleString()}`,
      `Equation check: Assets (${totalAssets.toFixed(2)}) = Liabilities + Equity + Profit (${rightHandSide.toFixed(2)})`
    ];

    const bsBalanced = equationDiff < 0.1;
    results.push({
      name: 'Balance Sheet Equilibrium',
      assertion: 'Assets = Liabilities + Equity + Net Profit',
      status: bsBalanced ? 'PASS' : 'FAIL',
      details: bsBalanced 
        ? `Consolidated accounts in perfect equilibrium. Assets: ${currency?.symbol || '$'}${totalAssets.toLocaleString()} | Liabilities + Equity: ${currency?.symbol || '$'}${rightHandSide.toLocaleString()}.`
        : `Accounting variance detected. Out of sync by ${currency?.symbol || '$'}${equationDiff.toFixed(2)}.`,
      mathLogs: matchLogs
    });
    steps.push(bsBalanced 
      ? `[PASS] Test 2: Balance Sheet equation holds. Out of sync: ${equationDiff.toFixed(4)}` 
      : `[FAIL] Test 2: Out of sync by ${equationDiff.toFixed(2)}`
    );

    // TEST 3: Accounts Receivable Reconciliation
    steps.push('\n[Assertion Suite 3] Testing Trade Debtors Ledger vs Bills...');
    const debtorsGrp = groups.find(g => g.name.toLowerCase().includes('debtors'));
    const debtorLedgers = ledgers.filter(l => l.groupId === debtorsGrp?.id);
    let debtorLedgerBalSum = debtorLedgers.reduce((sum, l) => sum + getBalance(l.id), 0);
    
    // Sum of all outstanding customer bill details in Posted vouchers
    let customerBillDetailsSum = 0;
    posted.forEach(v => {
      v.lines?.forEach(line => {
        if (debtorLedgers.some(dl => dl.id === line.ledgerId) && line.billDetails) {
          line.billDetails.forEach(bd => {
            if (bd.type === 'New Ref') customerBillDetailsSum += bd.amount;
            if (bd.type === 'Against Ref') customerBillDetailsSum -= bd.amount;
          });
        }
      });
    });

    const arMatch = Math.abs(debtorLedgerBalSum - customerBillDetailsSum) < 0.1;
    results.push({
      name: 'Receivables Control Match',
      assertion: 'Trade Debtors General Ledger matches outstanding bill balances',
      status: arMatch ? 'PASS' : 'FAIL',
      details: arMatch
        ? `Reconciliation successful. Total receivables: ${currency?.symbol || '$'}${debtorLedgerBalSum.toLocaleString()} matched perfectly against outstanding invoices.`
        : `Discrepancy: Control Ledger = ${debtorLedgerBalSum.toFixed(2)}, Sum of Bills = ${customerBillDetailsSum.toFixed(2)}.`,
      mathLogs: [
        `Sundry Debtors Ledger Sum: ${debtorLedgerBalSum.toFixed(2)}`,
        `Commercial Bills Ref Sum: ${customerBillDetailsSum.toFixed(2)}`,
        `Variance: ${Math.abs(debtorLedgerBalSum - customerBillDetailsSum).toFixed(2)}`
      ]
    });
    steps.push(arMatch ? '[PASS] Test 3: Receivables accounts match bill tracking.' : '[FAIL] Test 3: Receivables mismatch.');

    // TEST 4: Accounts Payable Reconciliation
    steps.push('\n[Assertion Suite 4] Testing Trade Creditors Ledger vs Bills...');
    const creditorsGrp = groups.find(g => g.name.toLowerCase().includes('creditors'));
    const creditorLedgers = ledgers.filter(l => l.groupId === creditorsGrp?.id);
    let creditorLedgerBalSum = creditorLedgers.reduce((sum, l) => sum + Math.abs(getBalance(l.id)), 0);
    
    // Sum of all outstanding supplier bill details in Posted vouchers
    let supplierBillDetailsSum = 0;
    posted.forEach(v => {
      v.lines?.forEach(line => {
        if (creditorLedgers.some(cl => cl.id === line.ledgerId) && line.billDetails) {
          line.billDetails.forEach(bd => {
            if (bd.type === 'New Ref') supplierBillDetailsSum += bd.amount;
            if (bd.type === 'Against Ref') supplierBillDetailsSum -= bd.amount;
          });
        }
      });
    });

    const apMatch = Math.abs(creditorLedgerBalSum - supplierBillDetailsSum) < 0.1;
    results.push({
      name: 'Payables Control Match',
      assertion: 'Trade Creditors General Ledger matches outstanding supplier invoices',
      status: apMatch ? 'PASS' : 'FAIL',
      details: apMatch
        ? `Reconciliation successful. Total payables obligations: ${currency?.symbol || '$'}${creditorLedgerBalSum.toLocaleString()} matched perfectly against vendor invoice tracking.`
        : `Discrepancy: Control Ledger = ${creditorLedgerBalSum.toFixed(2)}, Sum of supplier invoices = ${supplierBillDetailsSum.toFixed(2)}.`,
      mathLogs: [
        `Sundry Creditors Ledger Sum: ${creditorLedgerBalSum.toFixed(2)}`,
        `Supplier Invoices Ref Sum: ${supplierBillDetailsSum.toFixed(2)}`,
        `Variance: ${Math.abs(creditorLedgerBalSum - supplierBillDetailsSum).toFixed(2)}`
      ]
    });
    steps.push(apMatch ? '[PASS] Test 4: Payables accounts match supplier invoice tracking.' : '[FAIL] Test 4: Payables mismatch.');

    // TEST 5: Stock Position Validity
    steps.push('\n[Assertion Suite 5] Testing Stock Movement Integrity...');
    const stockMap = new Map<string, number>();
    let totalStockValue = 0;
    
    posted.forEach(v => {
      v.stockLines?.forEach(line => {
        const key = line.productId;
        stockMap.set(key, (stockMap.get(key) || 0) + line.quantity);
      });
    });

    let stockIsNegative = false;
    let productsTested = 0;
    const stockLogs: string[] = [];

    stockMap.forEach((qty, prodId) => {
      productsTested++;
      const prod = products.find(p => p.id === prodId);
      const name = prod?.name || 'Unknown Product';
      const price = prod?.sellingPrice || 0;
      totalStockValue += qty * price;
      
      stockLogs.push(`Product: ${name} | Ending Units: ${qty} units | Standard Price: ${price} | Total Value: ${(qty * price).toFixed(2)}`);
      if (qty < 0) {
        stockIsNegative = true;
      }
    });

    const stockValid = !stockIsNegative && productsTested > 0;
    results.push({
      name: 'Inventory Movement Health',
      assertion: 'Product stock quantities should never fall below zero',
      status: stockValid ? 'PASS' : (productsTested === 0 ? 'PENDING' : 'FAIL'),
      details: stockValid
        ? `Stock levels audited. Total virtual warehouse assets: ${currency?.symbol || '$'}${totalStockValue.toLocaleString()} spread across ${productsTested} tracked items. Zero negative stock incidents.`
        : (productsTested === 0 ? 'No items tracked. Seed data to verify stock flow.' : 'Negative stock values detected. Physical balance violation!'),
      mathLogs: stockLogs
    });
    steps.push(stockValid ? `[PASS] Test 5: All warehouse positions verified healthy. Value: ${currency?.symbol || '$'}${totalStockValue.toFixed(2)}` : '[FAIL] Test 5: Inventory discrepancy found.');

    steps.push('----------------------------------------------------');
    steps.push(`AUTOMATED COMPLIANCE AUDIT DONE. STATUS: ${results.every(r => r.status === 'PASS') ? '100% INTEGRITY VERIFIED' : 'VARIANCE ENCOUNTERED'}`);

    setTestResults(results);
    setConsoleLogs(steps);
    setIsRunningTests(false);
    notify.success('Accounting diagnostic assertions executed successfully!');
  };

  return (
    <div className="bg-white rounded-[24px] border border-zinc-200/80 shadow-2xl p-6 no-print mb-6">
      <div 
        className="flex items-center justify-between cursor-pointer group"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-olive/10 flex items-center justify-center text-brand-olive group-hover:bg-brand-olive group-hover:text-white transition-all">
            <Beaker className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-serif italic text-lg text-zinc-900 group-hover:text-brand-olive transition-colors">Enterprise Diagnostic Suite</h3>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">Seed Demo Environment & Run Automated Integrity Assertions</p>
          </div>
        </div>
        <div className="text-zinc-400 group-hover:text-zinc-900 transition-colors">
          {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="pt-6 border-t border-zinc-100 mt-6 space-y-6">
              
              {/* Seeding & Testing Trigger Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleSeedData}
                  disabled={isSeeding || isRunningTests}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-zinc-900 text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-98 shadow-md"
                >
                  {isSeeding ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Seeding Database...
                    </>
                  ) : (
                    <>
                      <Database className="w-4 h-4" />
                      Seed Clean Demo Data
                    </>
                  )}
                </button>

                <button
                  onClick={runAutomatedTests}
                  disabled={isSeeding || isRunningTests}
                  className="flex-1 flex items-center justify-center gap-2 py-4 bg-brand-olive text-white rounded-2xl font-bold text-xs uppercase tracking-widest hover:brightness-110 disabled:opacity-50 transition-all active:scale-98 shadow-md"
                >
                  {isRunningTests ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Running Assertions...
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      Run Live Accounting Tests
                    </>
                  )}
                </button>
              </div>

              {/* Live Terminal & Logs */}
              {consoleLogs.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5" /> Diagnostic Console Logs
                    </span>
                    <button 
                      onClick={() => setConsoleLogs([])}
                      className="text-[8px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-900 transition-colors"
                    >
                      Clear Logs
                    </button>
                  </div>
                  <div className="bg-zinc-950 text-emerald-400 p-5 rounded-2xl font-mono text-[9px] leading-relaxed max-h-[160px] overflow-y-auto shadow-inner border border-zinc-800 scrollbar-thin">
                    {consoleLogs.map((log, index) => (
                      <div 
                        key={index} 
                        className={cn(
                          "whitespace-pre-wrap",
                          log.includes('[PASS]') && 'text-emerald-400 font-bold',
                          log.includes('[FAIL]') && 'text-rose-400 font-bold',
                          log.includes('FATAL') && 'text-red-400 underline font-extrabold',
                          log.includes('Step') && 'text-amber-300'
                        )}
                      >
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Test Assertion Status Cards */}
              {testResults.length > 0 && (
                <div className="space-y-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">
                    Diagnostic Suite Execution Report
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {testResults.map((result, idx) => {
                      const isPass = result.status === 'PASS';
                      const isFail = result.status === 'FAIL';
                      
                      return (
                        <div 
                          key={idx}
                          className={cn(
                            "p-4 rounded-2xl border transition-all flex flex-col justify-between h-40 relative overflow-hidden group",
                            isPass ? "bg-emerald-50/20 border-emerald-100" : isFail ? "bg-rose-50/20 border-rose-100" : "bg-zinc-50 border-zinc-100"
                          )}
                        >
                          <div className={cn("absolute left-0 top-0 bottom-0 w-1 group-hover:w-1.5 transition-all", isPass ? "bg-emerald-500" : isFail ? "bg-rose-500" : "bg-zinc-400")} />
                          
                          <div>
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="text-xs font-bold text-zinc-900 truncate pr-4">{result.name}</h4>
                              {isPass ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              ) : isFail ? (
                                <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              ) : (
                                <AlertTriangle className="w-4 h-4 text-zinc-400 shrink-0 animate-pulse" />
                              )}
                            </div>
                            <p className="text-[7.5px] font-black uppercase tracking-widest text-zinc-400 line-clamp-1 mb-1.5">{result.assertion}</p>
                            <p className="text-[10px] text-zinc-600 leading-snug line-clamp-3">{result.details}</p>
                          </div>

                          {/* Math Logs Expand tooltip or breakdown */}
                          {result.mathLogs && result.mathLogs.length > 0 && (
                            <div className="pt-2 border-t border-dashed border-zinc-100 mt-2">
                              <span className="text-[8px] font-black text-zinc-400 uppercase tracking-widest">
                                Verification Math:
                              </span>
                              <div className="text-[7.5px] font-mono text-zinc-500 line-clamp-1 mt-0.5">
                                {result.mathLogs[result.mathLogs.length - 1]}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
