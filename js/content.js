/* Lidex Academy - curriculum (courses, lessons, exercises) and trusted-source registry.
   Explanations are original writing. Every lesson's exercise is graded by re-running the
   lab computation (js/labs.js) or a real hash/encoding check, never a stored answer key. */
(function (root) {
  "use strict";
  const C = root.LidexCrypto || require("./crypto.js");
  const L = root.LidexLabs || require("./labs.js");
  const LABS = root.LIDEX_LABS || L.LABS;
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const toNum = (s) => { const t = String(s).replace(/,/g, "").trim(); if (t === "") return NaN; const n = Number(t); return Number.isFinite(n) ? n : NaN; };
  const run = (id, params) => Promise.resolve(LABS[id].compute(params));
  const row = (res, label) => res.rows.find(r => r.label === label);

  const CHECKED = "2026-10-09";

  /* ---------- Trusted Sources Registry ---------- */
  const SOURCES = {
    "bitcoin-whitepaper": { title: "Bitcoin: A Peer-to-Peer Electronic Cash System", publisher: "Satoshi Nakamoto (bitcoin.org)", url: "https://bitcoin.org/bitcoin.pdf", type: "primary" },
    "bitcoin-dev": { title: "Bitcoin Developer Documentation", publisher: "Bitcoin Developer Community", url: "https://developer.bitcoin.org/", type: "official" },
    "eth-transactions": { title: "Transactions", publisher: "ethereum.org", url: "https://ethereum.org/en/developers/docs/transactions/", type: "official" },
    "eth-gas": { title: "Gas and fees", publisher: "ethereum.org", url: "https://ethereum.org/en/developers/docs/gas/", type: "official" },
    "eth-rlp": { title: "Recursive Length Prefix (RLP)", publisher: "ethereum.org", url: "https://ethereum.org/en/developers/docs/data-structures-and-encoding/rlp/", type: "official" },
    "eth-trie": { title: "Patricia Merkle Tries", publisher: "ethereum.org", url: "https://ethereum.org/en/developers/docs/data-structures-and-encoding/patricia-merkle-trie/", type: "official" },
    "eip-155": { title: "EIP-155: Simple replay attack protection", publisher: "Ethereum Improvement Proposals", url: "https://eips.ethereum.org/EIPS/eip-155", type: "specification" },
    "eip-1559": { title: "EIP-1559: Fee market change for ETH 1.0 chain", publisher: "Ethereum Improvement Proposals", url: "https://eips.ethereum.org/EIPS/eip-1559", type: "specification" },
    "keccak": { title: "The Keccak SHA-3 submission", publisher: "Keccak Team", url: "https://keccak.team/keccak.html", type: "primary" },
    "fips-202": { title: "FIPS 202: SHA-3 Standard", publisher: "NIST", url: "https://csrc.nist.gov/pubs/fips/202/final", type: "standard" },
    "uni-v2-swaps": { title: "Swaps (Uniswap v2 core concepts)", publisher: "Uniswap Labs docs", url: "https://docs.uniswap.org/contracts/v2/concepts/core-concepts/swaps", type: "official" },
    "uni-whitepaper": { title: "Uniswap whitepaper", publisher: "Uniswap Labs", url: "https://uniswap.org/whitepaper.pdf", type: "primary" },
    "aave-docs": { title: "Aave developer documentation", publisher: "Aave", url: "https://aave.com/docs/developers/smart-contracts", type: "official" },
    "oz-docs": { title: "OpenZeppelin Contracts documentation (finance: vesting)", publisher: "OpenZeppelin", url: "https://docs.openzeppelin.com/contracts/5.x/api/finance", type: "official" },
    "lidex-labs": { title: "Lidex lab formula reference (js/labs.js)", publisher: "Lidex Academy (original derivation)", url: "#/labs", type: "internal", note: "Simplified textbook model; not a specific protocol's margin engine." },
  };
  const sourceMeta = (ids) => ids.map(id => ({ id, ...SOURCES[id], accessed: CHECKED, linkCheckedAt: SOURCES[id].type === "internal" ? null : CHECKED }));

  /* ---------- Courses ---------- */
  const COURSES = [
    {
      id: "blockchain-bitcoin-foundations", path: "blockchain-bitcoin", title: "Blockchain & Bitcoin Foundations",
      description: "How hashes, Merkle trees and issuance schedules make a blockchain verifiable.",
      lessons: [
        {
          id: "hash-and-pow", title: "Hash functions and proof of work", labId: "hash-pow",
          preset: { text: "lidex-block-1", algo: "sha256d", nonce: 0 }, sources: ["bitcoin-whitepaper", "bitcoin-dev"],
          body: [
            "A cryptographic hash function turns any input into a fixed-length fingerprint. A tiny change in the input produces a completely different output, and you cannot run the function backwards to recover the input.",
            "Proof of work uses that unpredictability. A miner changes a nonce field until the hash of the whole block header falls below a target. Because each attempt is an independent lottery ticket, the only way to win faster is to spend more computation.",
            "Bitcoin uses double SHA-256. Ethereum uses Keccak-256, which is related to SHA-3 but uses different padding, so the two never produce the same digest for the same input.",
          ],
          formula: "digest = SHA256(SHA256(data ‖ nonce))\nvalid  ⇔  leadingZeroBits(digest) ≥ difficulty",
          exercise: {
            prompt: "Find a nonce so that double SHA-256 of \"lidex-block-1:NONCE\" has at least 12 leading zero bits. Use the miner in the lab, then submit the nonce. The checker re-hashes your value.",
            fields: [{ id: "nonce", label: "Nonce", kind: "number" }],
            check: async (a) => {
              const n = toNum(a.nonce);
              if (!Number.isInteger(n) || n < 0 || String(a.nonce).trim() === "") return { ok: false, msg: "Enter a whole number nonce ≥ 0." };
              const d = await C.sha256d(C.utf8("lidex-block-1:" + n));
              const bits = C.leadingZeroBits(d);
              return bits >= 12 ? { ok: true, msg: "Valid. Digest " + C.toHex(d).slice(0, 12) + "… has " + bits + " leading zero bits." }
                : { ok: false, msg: "Only " + bits + " leading zero bits. Need 12." };
            },
          },
        },
        {
          id: "merkle-trees", title: "Merkle trees: one root for many items", labId: "merkle",
          preset: { leaves: "lidex,academy,web3" }, sources: ["keccak", "eth-trie"],
          body: [
            "A Merkle tree hashes each item, then repeatedly hashes pairs of hashes until one root remains. The root commits to every item: change any leaf and the root changes.",
            "This lets a light client check that a transaction is included in a block by downloading only a logarithmic-size proof, not the whole block. Lidex's simulator uses Keccak-256 at every level and duplicates the last node when a level has an odd count.",
          ],
          formula: "leaf_i = Keccak(item_i)\nnode = Keccak(left ‖ right)",
          exercise: {
            prompt: "Compute the Keccak Merkle root for the leaves lidex, academy, web3 (in that order). Enter it as hex, with or without 0x.",
            fields: [{ id: "root", label: "Root (hex)", kind: "text" }],
            check: async (a) => {
              const expected = C.toHex(C.merkleRoot(["lidex", "academy", "web3"]).root);
              const got = String(a.root || "").trim().replace(/^0x/i, "").toLowerCase();
              return got === expected ? { ok: true, msg: "Correct root: 0x" + expected }
                : { ok: false, msg: "Root does not match. Check leaf order and that you hash each leaf before pairing." };
            },
          },
        },
        {
          id: "issuance-halving", title: "Bitcoin issuance and the halving", labId: "btc-issuance",
          preset: { height: 630000 }, sources: ["bitcoin-whitepaper", "bitcoin-dev"],
          body: [
            "Bitcoin's block subsidy starts at 50 BTC and halves every 210,000 blocks. Because each halving is a right shift of the satoshi amount, the subsidy stays an exact integer until it reaches zero.",
            "Summing the subsidies over the epochs gives the total supply, which converges to just under 21 million BTC. Working in satoshis avoids floating-point error entirely.",
          ],
          formula: "subsidy(h) = 5,000,000,000 sat >> floor(h / 210,000)",
          exercise: {
            prompt: "Use the lab to answer both questions. (1) What is the block subsidy at height 840,000, in satoshis? (2) How many BTC are issued through block 209,999 inclusive?",
            fields: [{ id: "sat", label: "Subsidy at 840,000 (sat)", kind: "number" }, { id: "btc", label: "Issued through 209,999 (BTC)", kind: "number" }],
            check: async (a) => {
              const sat = L.subsidyAt(840000n), issued = L.issuedThrough(209999n);
              const okSat = toNum(a.sat) === Number(sat);
              const okBtc = toNum(a.btc) === Number(issued / 100000000n);
              if (okSat && okBtc) return { ok: true, msg: "Both correct: 312,500,000 sat and 10,500,000 BTC." };
              return { ok: false, msg: (okSat ? "Q1 correct. " : "Q1 wrong (hint: 840,000 is 4 halvings). ") + (okBtc ? "Q2 correct." : "Q2 wrong (hint: 210,000 blocks × 50 BTC for the first epoch).") };
            },
          },
        },
      ],
    },
    {
      id: "ethereum-transactions-gas", path: "ethereum-evm", title: "Ethereum Transactions & Gas",
      description: "What a transaction contains, what gets signed, and how EIP-1559 sets the fee.",
      lessons: [
        {
          id: "tx-anatomy-signing-hash", title: "Anatomy of a transaction and its signing hash", labId: "eth-tx",
          preset: { nonce: 9, gasPriceGwei: 20, gasLimit: 21000, to: "3535353535353535353535353535353535353535", valueEth: 1, data: "", chainId: 1 },
          sources: ["eth-transactions", "eth-rlp", "eip-155"],
          body: [
            "A legacy Ethereum transaction carries a nonce, gas price, gas limit, recipient, value, data, and then a signature. The nonce orders the sender's transactions and prevents replay.",
            "Before signing, the fields are RLP-encoded (a compact, length-prefixed format) together with the chain ID, as specified by EIP-155. The Keccak-256 of that payload is the digest the wallet signs. Including the chain ID means a signature for one network cannot be replayed on another.",
            "This lab computes that signing digest for you. It does not sign anything and uses no private key.",
          ],
          formula: "signingHash = Keccak256(RLP([nonce, gasPrice, gasLimit, to, value, data, chainId, 0, 0]))",
          exercise: {
            prompt: "RLP-encode the byte string \"dog\" (UTF-8 bytes 64 6f 67). Enter the encoding as hex.",
            fields: [{ id: "rlp", label: "RLP(\"dog\") hex", kind: "text" }],
            check: async (a) => {
              const got = String(a.rlp || "").trim().toLowerCase().replace(/^0x/, "");
              const exp = C.toHex(C.rlpEncode(C.utf8("dog")));
              return got === exp ? { ok: true, msg: "Correct: 0x" + exp + " (length prefix 0x83 + 3 bytes)." }
                : { ok: false, msg: "Not quite. A 3-byte string is prefixed with 0x80 + 3 = 0x83." };
            },
          },
        },
        {
          id: "eip-1559-fees", title: "EIP-1559 fees: base fee, tip and burn", labId: "gas-1559",
          preset: { baseFeeGwei: 100, gasLimit: 30000000, gasUsed: 30000000, txGasUsed: 21000, maxFeeGwei: 120, maxPriorityGwei: 2 },
          sources: ["eip-1559", "eth-gas"],
          body: [
            "Under EIP-1559 each block has a gas target of half its gas limit. If blocks run above target, the base fee rises by up to 12.5% per block. If they run below target, it falls by up to 12.5%.",
            "A transaction pays the base fee plus a tip, capped by its max fee. The base fee is burned and the tip goes to the block proposer. Your max fee must cover the next base fee or the transaction cannot be included.",
          ],
          formula: "nextBase = base + base × (used − target) / target / 8\neffective = min(maxFee, base + min(maxPriority, maxFee − base))",
          exercise: {
            prompt: "Parent base fee is 100 gwei and the block gas limit is 30,000,000. (1) If the block used 30,000,000 gas, what is the next base fee in gwei? (2) If it used 0 gas?",
            fields: [{ id: "full", label: "Next base fee, full block (gwei)", kind: "number" }, { id: "empty", label: "Next base fee, empty block (gwei)", kind: "number" }],
            check: async (a) => {
              const full = Number(L.nextBaseFee(100000000000n, 30000000n, 30000000n)) / 1e9;
              const empty = Number(L.nextBaseFee(100000000000n, 0n, 30000000n)) / 1e9;
              const ok1 = near(toNum(a.full), full, 1e-9), ok2 = near(toNum(a.empty), empty, 1e-9);
              if (ok1 && ok2) return { ok: true, msg: "Correct: 112.5 gwei when full, 87.5 gwei when empty." };
              return { ok: false, msg: (ok1 ? "Full-block answer correct. " : "Full block: the target is 15M, so you move up by 1/8 of the excess ratio. ") + (ok2 ? "Empty-block answer correct." : "Empty block: fall by 1/8 of the shortfall ratio.") };
            },
          },
        },
      ],
    },
    {
      id: "constant-product-amm", path: "dex-amm", title: "Constant-Product AMMs",
      description: "How a DEX prices a swap from two reserves, and what liquidity providers earn and risk.",
      lessons: [
        {
          id: "xy-equals-k-swaps", title: "The x·y = k pool and swap math", labId: "amm",
          preset: { amountIn: 1000, reserveIn: 10000, reserveOut: 20000, feeBps: 30 }, sources: ["uni-v2-swaps", "uni-whitepaper"],
          body: [
            "A constant-product pool holds two reserves, x and y. Every swap must keep the product k = x·y at or above its previous value. Because the price is the ratio of reserves, a large trade moves the price against the trader. This is price impact.",
            "Uniswap v2 charges a 0.3% fee by counting only 997/1000 of the input toward the swap formula. The fee stays in the pool, so k grows slightly with every trade.",
          ],
          formula: "amountOut = (amountIn·997 · reserveOut) / (reserveIn·1000 + amountIn·997)",
          challenge: {
            prompt: "Write getAmountOut(amountIn, reserveIn, reserveOut) in JavaScript using BigInt. Use the 0.3% fee and floor the result, as the lab does. The runner checks it against the reference implementation on five cases.",
            fn: "getAmountOut",
            starter: "// Arguments and return value are BigInt.\n// Fee: 0.3%. Output: floored BigInt.\nfunction getAmountOut(amountIn, reserveIn, reserveOut) {\n  // your code here\n}\n",
            tests: [[1000n, 10000n, 20000n], [5n, 100n, 100n], [1000000n, 5000000n, 300n], [123456789n, 987654321n, 111111111n], [1n, 1000n, 1000n]]
              .map(args => ({ args: args.map(String), expected: String(L.getAmountOut(args[0], args[1], args[2])) })),
          },
          exercise: {
            prompt: "Pool has 10,000 token A and 20,000 token B. You sell 1,000 A with the 0.3% fee. How many B do you receive (floored, integer)?",
            fields: [{ id: "out", label: "Amount out (B, integer)", kind: "number" }],
            check: async (a) => {
              const exp = L.getAmountOut(1000n, 10000n, 20000n);
              return toNum(a.out) === Number(exp) ? { ok: true, msg: "Correct: " + exp + " B." } : { ok: false, msg: "Not equal to the floored constant-product output. Check the 997/1000 factor on the input." };
            },
          },
        },
        {
          id: "lp-impermanent-loss", title: "Liquidity providers and impermanent loss", labId: "amm-lp",
          preset: { depA: 10000, depB: 20000, totalSupply: 0, reserveA: 0, reserveB: 0, priceChange: 2 }, sources: ["uni-whitepaper", "uni-v2-swaps"],
          body: [
            "Liquidity providers deposit both tokens in equal value and receive LP tokens for their share of the pool. The first depositor's shares are sqrt(a·b) minus 1000 units, which are burned to a dead address so no one can corner the pool.",
            "Impermanent loss is the gap between what you hold in the pool and what you would have had by holding the two tokens. If the price ratio changes by a factor r, the pool rebalances and the loss is 2·√r/(1+r) − 1. It is 'impermanent' only while the price stays where it was. Trading fees can offset it.",
          ],
          formula: "shares0 = √(a·b) − 1000\nIL(r) = 2·√r / (1 + r) − 1",
          exercise: {
            prompt: "The price of token A rises 4x compared with token B after you deposit. What is your impermanent loss in percent versus simply holding? Enter a negative number, to two decimals.",
            fields: [{ id: "il", label: "Impermanent loss (%)", kind: "number" }],
            check: async (a) => {
              const exp = L.LABS["amm-lp"].ilFactor(4) * 100;
              return near(toNum(a.il), exp, 0.005) ? { ok: true, msg: "Correct: " + exp.toFixed(2) + " %." }
                : { ok: false, msg: "Expected about " + exp.toFixed(2) + " % (negative). Use r = 4 in 2·√r/(1+r) − 1." };
            },
          },
        },
      ],
    },
    {
      id: "collateral-and-lending", path: "defi", title: "Collateral & Lending",
      description: "How overcollateralised loans stay safe, and how interest compounds.",
      lessons: [
        {
          id: "health-factor", title: "Collateral, LTV and health factor", labId: "lending",
          preset: { collAmt: 10, collPrice: 2000, lt: 80, debt: 10000, apr: 5, periods: 365 }, sources: ["aave-docs"],
          body: [
            "In an overcollateralised lending market you deposit collateral and borrow less than it is worth. The liquidation threshold is the share of collateral value that counts toward borrowing power.",
            "The health factor compares that weighted collateral with your debt. Above 1.0 you are safe. At or below 1.0, anyone can repay part of the debt in exchange for a discount on your collateral.",
          ],
          formula: "healthFactor = (collateralValue × liquidationThreshold) / debt\nliquidationPrice = debt / (collateralAmount × liquidationThreshold)",
          exercise: {
            prompt: "You deposited 5 ETH, the liquidation threshold is 80%, and you borrowed 6,000 USD. At what ETH price (USD) does your position become liquidatable?",
            fields: [{ id: "px", label: "Liquidation price (USD)", kind: "number" }],
            check: async (a) => {
              const exp = (await run("lending", { collAmt: 5, collPrice: 3000, lt: 80, debt: 6000, apr: 5, periods: 365 })).liquidationPrice;
              return near(toNum(a.px), exp, 0.01) ? { ok: true, msg: "Correct: $" + exp.toFixed(2) + "." }
                : { ok: false, msg: "Expected $" + exp.toFixed(2) + ". Use debt / (amount × threshold)." };
            },
          },
        },
        {
          id: "interest-and-apy", title: "Interest rates and APY", labId: "lending",
          preset: { collAmt: 10, collPrice: 2000, lt: 80, debt: 10000, apr: 12, periods: 365 }, sources: ["aave-docs"],
          body: [
            "An APR is a simple annual rate. If interest compounds n times a year, the effective annual rate, or APY, is higher: (1 + APR/n)^n − 1.",
            "The difference is small at low rates and noticeable at high ones. Daily compounding of 12% APR gives about 12.75%.",
          ],
          formula: "APY = (1 + APR / n)^n − 1",
          exercise: {
            prompt: "A market quotes 12% APR compounded daily (n = 365). What is the APY in percent, to three decimals?",
            fields: [{ id: "apy", label: "APY (%)", kind: "number" }],
            check: async (a) => {
              const exp = (await run("lending", { collAmt: 10, collPrice: 2000, lt: 80, debt: 10000, apr: 12, periods: 365 })).apy * 100;
              return near(toNum(a.apy), exp, 0.0005) ? { ok: true, msg: "Correct: " + exp.toFixed(3) + " %." }
                : { ok: false, msg: "Expected " + exp.toFixed(3) + " %. Compute (1 + 0.12/365)^365 − 1." };
            },
          },
        },
      ],
    },
    {
      id: "perpetual-futures", path: "trading-perps", title: "Perpetual Futures",
      description: "Leverage, liquidation and funding in perpetual futures markets.",
      lessons: [
        {
          id: "perp-mechanics", title: "Perpetual futures mechanics", labId: "perps",
          preset: { side: "long", margin: 1000, leverage: 10, entry: 3000, mark: 3100, mmr: 0.5, fundingPct: 0.01 }, sources: ["lidex-labs"],
          body: [
            "A perpetual future is a derivative with no expiry. Its price is anchored to the spot market by a funding mechanism. Leverage multiplies your exposure: notional equals margin times leverage.",
            "Liquidation happens when losses erode the margin down to the maintenance requirement. This lab uses a simplified isolated-margin model that ignores fees and cross-margin effects. Real venues publish their own formulas, which you should check before trading.",
          ],
          formula: "long liq  = entry × (1 − 1/L + m)\nshort liq = entry × (1 + 1/L − m)",
          exercise: {
            prompt: "You open a short at 2,000 USD with 5x leverage and a 0.5% maintenance margin rate. What is the liquidation price in USD?",
            fields: [{ id: "liq", label: "Liquidation price (USD)", kind: "number" }],
            check: async (a) => {
              const exp = (await run("perps", { side: "short", margin: 1000, leverage: 5, entry: 2000, mark: 2000, mmr: 0.5, fundingPct: 0 })).liq;
              return near(toNum(a.liq), exp, 0.01) ? { ok: true, msg: "Correct: $" + exp.toFixed(2) + "." }
                : { ok: false, msg: "Expected $" + exp.toFixed(2) + ". Shorts are liquidated when price rises: entry × (1 + 1/L − m)." };
            },
          },
        },
        {
          id: "funding-rates", title: "Funding rates", labId: "perps",
          preset: { side: "long", margin: 10000, leverage: 5, entry: 3000, mark: 3000, mmr: 0.5, fundingPct: 0.03 }, sources: ["lidex-labs"],
          body: [
            "Funding is a periodic payment between longs and shorts. When the perpetual trades above spot, the funding rate is positive, so longs pay shorts. When it trades below spot, shorts pay longs.",
            "The payment is the position's notional value multiplied by the funding rate for that period. It transfers value between traders and does not go to the exchange, though venues may charge separate fees.",
          ],
          formula: "fundingPayment = notional × fundingRate × (long ? −1 : +1)",
          exercise: {
            prompt: "You hold a long with 10,000 USD margin at 5x leverage. The funding rate for the period is +0.03%. How many USD do you pay (positive number)?",
            fields: [{ id: "pay", label: "Amount paid (USD)", kind: "number" }],
            check: async (a) => {
              const r = await run("perps", { side: "long", margin: 10000, leverage: 5, entry: 3000, mark: 3000, mmr: 0.5, fundingPct: 0.03 });
              const exp = Math.abs(r.funding);
              return near(toNum(a.pay), exp, 0.0001) ? { ok: true, msg: "Correct: $" + exp.toFixed(2) + "." }
                : { ok: false, msg: "Expected $" + exp.toFixed(2) + ". Notional is margin × leverage = $50,000." };
            },
          },
        },
      ],
    },
    {
      id: "tokenomics-mechanics", path: "tokenomics", title: "Tokenomics Mechanics",
      description: "Vesting schedules and bonding curves, the two most common supply mechanics.",
      lessons: [
        {
          id: "vesting-schedules", title: "Vesting schedules and cliffs", labId: "tokenomics",
          preset: { total: 1000000, cliff: 12, duration: 48, month: 30, p0: 0.01, k: 0.0001, s0: 0, s1: 1000 }, sources: ["oz-docs"],
          body: [
            "Vesting releases an allocation over time, which keeps early holders from selling everything at once. A cliff withholds all tokens until a set date, after which the schedule usually releases linearly.",
            "This lab uses linear vesting after a cliff, measured from the start of the schedule. Between the cliff and the end, unlocked tokens are proportional to elapsed months.",
          ],
          formula: "vested(m) = 0 if m < cliff\nvested(m) = total × m / duration (capped at total)",
          exercise: {
            prompt: "An allocation of 1,000,000 tokens has a 12-month cliff and a 48-month duration, with linear vesting from month 0. How many tokens are vested at month 30?",
            fields: [{ id: "v", label: "Vested tokens", kind: "number" }],
            check: async (a) => {
              const exp = L.vestedAt(1000000, 12, 48, 30);
              return near(toNum(a.v), exp, 0.01) ? { ok: true, msg: "Correct: " + exp.toLocaleString("en-US") + " tokens." }
                : { ok: false, msg: "Expected " + exp.toLocaleString("en-US") + ". Vesting is linear from month 0, not from the cliff." };
            },
          },
        },
        {
          id: "bonding-curves", title: "Bonding curves", labId: "tokenomics",
          preset: { total: 1000000, cliff: 12, duration: 48, month: 30, p0: 0.01, k: 0.0001, s0: 0, s1: 1000 }, sources: ["oz-docs"],
          body: [
            "A bonding curve sets the token's price as a function of supply. With a linear curve, p(s) = p0 + k·s, buying tokens raises the price for the next buyer and selling lowers it.",
            "The cost to move supply from s0 to s1 is the integral of the price curve, not the price at one point. Integrating gives a closed form, so the lab computes the exact cost rather than an estimate.",
          ],
          formula: "cost(s0 → s1) = p0·(s1 − s0) + k·(s1² − s0²) / 2",
          exercise: {
            prompt: "On a linear curve with p0 = 0.01 and k = 0.0001, how many USD does it cost to buy from supply 0 to supply 1,000?",
            fields: [{ id: "cost", label: "Cost (USD)", kind: "number" }],
            check: async (a) => {
              const exp = L.curveCost(0.01, 0.0001, 0, 1000);
              return near(toNum(a.cost), exp, 1e-6) ? { ok: true, msg: "Correct: $" + exp.toFixed(2) + "." }
                : { ok: false, msg: "Expected $" + exp.toFixed(2) + ". Integrate the price from 0 to 1,000 instead of multiplying by one price." };
            },
          },
        },
      ],
    },
  ];

  /* ---------- Paths (only paths with published courses are listed) ---------- */
  const PATHS = [
    { id: "blockchain-bitcoin", title: "Blockchain & Bitcoin", blurb: "Hashes, proof of work, Merkle trees and Bitcoin issuance." },
    { id: "ethereum-evm", title: "Ethereum & EVM", blurb: "Transactions, signing and the EIP-1559 fee market." },
    { id: "dex-amm", title: "DEX & AMM", blurb: "Constant-product pools, swap math and impermanent loss." },
    { id: "defi", title: "DeFi", blurb: "Collateral, health factors, liquidation and interest." },
    { id: "trading-perps", title: "Trading & Perpetuals", blurb: "Leverage, liquidation and funding payments." },
    { id: "tokenomics", title: "Tokenomics", blurb: "Vesting schedules and bonding curves." },
  ];

  /* ---------- Glossary (original definitions, tied to lessons) ---------- */
  const GLOSSARY = [
    { term: "Nonce", def: "A counter that changes an otherwise identical message. In proof of work, miners vary it to find a valid hash. In Ethereum it orders an account's transactions." },
    { term: "Keccak-256", def: "The hash function Ethereum uses. It is from the Keccak family, but it uses different padding from the NIST SHA-3 standard." , src: "fips-202"},
    { term: "RLP", def: "Recursive Length Prefix: Ethereum's serialization format for nested byte arrays." },
    { term: "Merkle root", def: "A single hash that commits to a whole list of items through a tree of pairwise hashes." },
    { term: "Halving", def: "A scheduled halving of Bitcoin's block subsidy every 210,000 blocks." },
    { term: "Base fee", def: "The per-gas price set by the protocol under EIP-1559. It is burned, not paid to validators." },
    { term: "Priority fee (tip)", def: "The extra per-gas amount paid to the block proposer on top of the base fee." },
    { term: "Constant-product AMM", def: "An exchange that prices swaps so that reserve_x × reserve_y stays at or above its previous value." },
    { term: "Impermanent loss", def: "The shortfall of a liquidity position compared with holding the same tokens, caused by price divergence." },
    { term: "Health factor", def: "Weighted collateral divided by debt in a lending market. Below 1.0 the position can be liquidated." },
    { term: "APY", def: "Annual percentage yield: the effective yearly return after compounding." },
    { term: "Perpetual future", def: "A futures contract with no expiry, kept near spot by periodic funding payments." },
    { term: "Funding rate", def: "The periodic payment between longs and shorts that keeps a perpetual's price near spot." },
    { term: "Vesting cliff", def: "A period at the start of a vesting schedule during which no tokens unlock." },
    { term: "Bonding curve", def: "A price function of token supply, so that the cost of a purchase depends on how many tokens are already issued." },
  ];

  const api = { COURSES, PATHS, SOURCES, sourceMeta, GLOSSARY, CHECKED };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LidexContent = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
