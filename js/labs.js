/* Lidex Academy - Interactive lab simulators.
   Every lab is a pure computation (no mocked outputs). Lessons reference labs by id,
   and lesson exercises are graded by re-running the same lab computation, so a
   learner's answer is checked against real math, not a stored answer key. */
(function (root) {
  "use strict";
  const C = root.LidexCrypto || require("./crypto.js");
  const WEI = 1000000000n; // wei per gwei

  const gweiToWei = (g) => BigInt(Math.round(Number(g) * 1e9));
  // Exact decimal ETH -> wei conversion (avoids float error on values like 0.1).
  function ethToWei(x) {
    const s = String(x).trim();
    need(/^\d+(\.\d{0,18})?$/.test(s), "ETH amount must be a non-negative decimal with up to 18 places");
    const [whole, frac = ""] = s.split(".");
    return BigInt(whole) * 10n ** 18n + BigInt((frac + "0".repeat(18)).slice(0, 18));
  }
  const weiToGweiStr = (w) => (Number(w) / 1e9).toLocaleString("en-US", { maximumFractionDigits: 4 });
  const fmt = (x, d = 4) => Number(x).toLocaleString("en-US", { maximumFractionDigits: d });
  const need = (cond, msg) => { if (!cond) throw new Error(msg); };
  const int = (v, name) => { const n = Number(v); need(Number.isFinite(n) && Number.isInteger(n), name + " must be a whole number"); return BigInt(n); };
  const num = (v, name) => { const n = Number(v); need(Number.isFinite(n), name + " must be a number"); return n; };

  const LABS = {};

  /* 1. Hash explorer + proof-of-work --------------------------------- */
  LABS["hash-pow"] = {
    id: "hash-pow",
    title: "Hash explorer & proof of work",
    summary: "Hash text with SHA-256, double SHA-256 (Bitcoin) or Keccak-256 (Ethereum), then mine a nonce for a leading-zero-bit target.",
    inputs: [
      { id: "text", label: "Input text", type: "text", value: "lidex-block-1" },
      { id: "algo", label: "Algorithm", type: "select", value: "sha256d", options: [["sha256", "SHA-256"], ["sha256d", "Double SHA-256 (Bitcoin)"], ["keccak256", "Keccak-256 (Ethereum)"]] },
      { id: "nonce", label: "Nonce", type: "number", value: 0, step: 1 },
    ],
    async compute(v) {
      const bytes = C.utf8(String(v.text) + ":" + int(v.nonce, "Nonce").toString());
      let digest;
      if (v.algo === "sha256") digest = await C.sha256(bytes);
      else if (v.algo === "sha256d") digest = await C.sha256d(bytes);
      else digest = C.keccak256(bytes);
      return {
        rows: [
          { label: "Preimage (UTF-8)", value: String(v.text) + ":" + v.nonce },
          { label: "Digest (hex)", value: C.toHex(digest), mono: true },
          { label: "Leading zero bits", value: String(C.leadingZeroBits(digest)) },
        ],
        digest,
      };
    },
    // Mine: search nonces until the digest has at least `bits` leading zero bits.
    async mine(v, bits, onProgress) {
      need(bits >= 0 && bits <= 16, "Difficulty must be between 0 and 16 bits in the browser");
      const base = String(v.text);
      for (let nonce = 0, tries = 0; ; nonce++, tries++) {
        const bytes = C.utf8(base + ":" + nonce);
        const d = v.algo === "keccak256" ? C.keccak256(bytes) : v.algo === "sha256" ? await C.sha256(bytes) : await C.sha256d(bytes);
        if (C.leadingZeroBits(d) >= bits) return { nonce, digest: C.toHex(d), tries: tries + 1 };
        if (onProgress && tries % 2000 === 0) { onProgress(tries); await new Promise(r => setTimeout(r, 0)); }
      }
    },
  };

  /* 2. Merkle tree ---------------------------------------------------- */
  LABS["merkle"] = {
    id: "merkle",
    title: "Merkle tree builder",
    summary: "Hash each leaf with Keccak-256, then pair and hash upward until a single root remains. Odd levels duplicate the last node.",
    inputs: [{ id: "leaves", label: "Leaves (comma-separated)", type: "text", value: "alice,bob,carol,dave" }],
    compute(v) {
      const leaves = String(v.leaves).split(",").map(s => s.trim()).filter(Boolean);
      need(leaves.length >= 1, "Enter at least one leaf");
      const { root, levels } = C.merkleRoot(leaves);
      return {
        rows: [
          { label: "Leaves", value: String(leaves.length) },
          { label: "Levels", value: String(levels.length) },
          { label: "Root (Keccak-256)", value: "0x" + C.toHex(root), mono: true },
        ],
        levels: levels.map(l => l.map(b => "0x" + C.toHex(b))),
      };
    },
  };

  /* 3. Bitcoin issuance ---------------------------------------------- */
  const HALVING = 210000;
  const SUBSIDY0 = 5000000000n; // 50 BTC in satoshis
  function subsidyAt(height) {
    const h = int(height, "Block height");
    need(h >= 0n, "Height cannot be negative");
    const halvings = Number(h / BigInt(HALVING));
    return halvings >= 64 ? 0n : SUBSIDY0 >> BigInt(halvings);
  }
  // Sum of subsidies for blocks 0..height inclusive, computed epoch by epoch.
  function issuedThrough(height) {
    const h = int(height, "Block height");
    let total = 0n, start = 0n;
    for (let e = 0; e < 64 && start <= h; e++) {
      const end = start + BigInt(HALVING) - 1n; // last block of this epoch
      const last = h < end ? h : end;
      total += (last - start + 1n) * (SUBSIDY0 >> BigInt(e));
      start = end + 1n;
    }
    return total;
  }
  LABS["btc-issuance"] = {
    id: "btc-issuance",
    title: "Bitcoin issuance & halving",
    summary: "Block subsidy halves every 210,000 blocks. Amounts are exact integers in satoshis (1 BTC = 100,000,000 sat).",
    inputs: [{ id: "height", label: "Block height", type: "number", value: 630000, step: 1 }],
    compute(v) {
      const s = subsidyAt(v.height);
      const issued = issuedThrough(v.height);
      const h = int(v.height, "Block height");
      return {
        rows: [
          { label: "Halvings so far", value: String(h / BigInt(HALVING)) },
          { label: "Block subsidy", value: fmt(Number(s) / 1e8, 8) + " BTC (" + s.toString() + " sat)", mono: true },
          { label: "Total issued through this block", value: fmt(Number(issued) / 1e8, 8) + " BTC", mono: true },
          { label: "Issued supply cap (all halvings)", value: (issuedThrough(HALVING * 64) / 100000000n).toString() + " BTC + " + (issuedThrough(HALVING * 64) % 100000000n) + " sat", mono: true },
        ],
        subsidySat: s, issuedSat: issued,
      };
    },
  };

  /* 4. Ethereum transaction signing hash (EIP-155) ------------------- */
  LABS["eth-tx"] = {
    id: "eth-tx",
    title: "Transaction anatomy & EIP-155 signing hash",
    summary: "RLP-encode the unsigned legacy transaction fields plus chain ID, then Keccak-256 the result. This is the digest a wallet signs. No private key is used here.",
    inputs: [
      { id: "nonce", label: "Nonce", type: "number", value: 9, step: 1 },
      { id: "gasPriceGwei", label: "Gas price (gwei)", type: "number", value: 20, step: 0.001 },
      { id: "gasLimit", label: "Gas limit", type: "number", value: 21000, step: 1 },
      { id: "to", label: "To address (40 hex chars)", type: "text", value: "3535353535353535353535353535353535353535" },
      { id: "valueEth", label: "Value (ETH)", type: "number", value: 1, step: 0.000000001 },
      { id: "data", label: "Data (hex)", type: "text", value: "" },
      { id: "chainId", label: "Chain ID", type: "number", value: 1, step: 1 },
    ],
    compute(v) {
      const to = C.fromHex(String(v.to));
      need(to.length === 20 || to.length === 0, "Address must be 20 bytes (40 hex chars) or empty for contract creation");
      const valueWei = ethToWei(v.valueEth);
      const data = v.data ? C.fromHex(v.data) : new Uint8Array(0);
      const fields = [
        C.bigintToBytes(int(v.nonce, "Nonce")),
        C.bigintToBytes(gweiToWei(v.gasPriceGwei)),
        C.bigintToBytes(int(v.gasLimit, "Gas limit")),
        to,
        C.bigintToBytes(valueWei),
        data,
        C.bigintToBytes(int(v.chainId, "Chain ID")),
        new Uint8Array(0), new Uint8Array(0), // r and s are empty for the signing payload
      ];
      const rlp = C.rlpEncode(fields);
      const hash = C.keccak256(rlp);
      const maxFeeEth = (Number(gweiToWei(v.gasPriceGwei)) * int(v.gasLimit, "Gas limit").toString() ) / 1e18;
      return {
        rows: [
          { label: "RLP payload (bytes)", value: String(rlp.length) },
          { label: "RLP payload (hex)", value: "0x" + C.toHex(rlp), mono: true },
          { label: "Signing hash (keccak256)", value: "0x" + C.toHex(hash), mono: true },
          { label: "Max fee at this gas price", value: fmt(maxFeeEth, 8) + " ETH" },
          { label: "Value transferred", value: fmt(Number(valueWei) / 1e18, 9) + " ETH" },
        ],
        hash, rlp,
      };
    },
  };

  /* 5. EIP-1559 fee market ------------------------------------------- */
  function nextBaseFee(baseFee, gasUsed, gasLimit) {
    const target = gasLimit / 2n;
    need(target > 0n, "Gas limit must be positive");
    if (gasUsed === target) return baseFee;
    if (gasUsed > target) {
      const delta = (baseFee * (gasUsed - target)) / target / 8n;
      return baseFee + (delta > 1n ? delta : 1n);
    }
    const delta = (baseFee * (target - gasUsed)) / target / 8n;
    return baseFee > delta ? baseFee - delta : 0n;
  }
  LABS["gas-1559"] = {
    id: "gas-1559",
    title: "EIP-1559 fee calculator",
    summary: "Computes the next block's base fee (EIP-1559 update rule) and what a transaction actually pays: base fee is burned, the tip goes to the validator.",
    inputs: [
      { id: "baseFeeGwei", label: "Parent base fee (gwei)", type: "number", value: 100, step: 0.001 },
      { id: "gasLimit", label: "Block gas limit", type: "number", value: 30000000, step: 1 },
      { id: "gasUsed", label: "Block gas used", type: "number", value: 30000000, step: 1 },
      { id: "txGasUsed", label: "Transaction gas used", type: "number", value: 21000, step: 1 },
      { id: "maxFeeGwei", label: "Max fee per gas (gwei)", type: "number", value: 120, step: 0.001 },
      { id: "maxPriorityGwei", label: "Max priority fee (gwei)", type: "number", value: 2, step: 0.001 },
    ],
    compute(v) {
      const base = gweiToWei(v.baseFeeGwei);
      const gasLimit = int(v.gasLimit, "Block gas limit");
      const gasUsed = int(v.gasUsed, "Block gas used");
      need(gasUsed <= gasLimit, "Gas used cannot exceed the gas limit");
      const next = nextBaseFee(base, gasUsed, gasLimit);
      const txGas = int(v.txGasUsed, "Transaction gas");
      const maxFee = gweiToWei(v.maxFeeGwei), maxPrio = gweiToWei(v.maxPriorityGwei);
      const headroom = maxFee > next ? maxFee - next : 0n;
      const tipPerGas = maxPrio < headroom ? maxPrio : headroom;
      const effective = maxFee >= base ? (base + tipPerGas < maxFee ? base + tipPerGas : maxFee) : 0n;
      const included = maxFee >= base;
      const totalWei = included ? txGas * effective : 0n;
      const burnedWei = included ? txGas * base : 0n;
      const tipWei = totalWei - burnedWei;
      return {
        rows: [
          { label: "Next block base fee", value: weiToGweiStr(next) + " gwei", mono: true },
          { label: "Effective gas price", value: included ? weiToGweiStr(effective) + " gwei" : "Not includable (max fee below base fee)" },
          { label: "Total fee paid", value: included ? fmt(Number(totalWei) / 1e18, 8) + " ETH" : "0" },
          { label: "Burned (base fee)", value: fmt(Number(burnedWei) / 1e18, 8) + " ETH" },
          { label: "Tip to validator", value: fmt(Number(tipWei) / 1e18, 8) + " ETH" },
        ],
        nextBaseFeeWei: next,
      };
    },
  };

  /* 6. Constant-product AMM ------------------------------------------ */
  function getAmountOut(amountIn, reserveIn, reserveOut, feeBps = 30n) {
    need(amountIn > 0n && reserveIn > 0n && reserveOut > 0n, "Amounts and reserves must be positive");
    const inWithFee = amountIn * (10000n - feeBps);
    return (inWithFee * reserveOut) / (reserveIn * 10000n + inWithFee);
  }
  LABS["amm"] = {
    id: "amm",
    title: "Constant-product AMM swap",
    summary: "x * y = k pool. Output uses the 0.3% fee (997/1000 of the input). Integer math matches Uniswap v2 floor rounding.",
    inputs: [
      { id: "amountIn", label: "Amount in", type: "number", value: 1000, step: 1 },
      { id: "reserveIn", label: "Reserve in", type: "number", value: 10000, step: 1 },
      { id: "reserveOut", label: "Reserve out", type: "number", value: 20000, step: 1 },
      { id: "feeBps", label: "Fee (basis points)", type: "number", value: 30, step: 1 },
    ],
    compute(v) {
      const a = int(v.amountIn, "Amount in"), rI = int(v.reserveIn, "Reserve in"), rO = int(v.reserveOut, "Reserve out");
      const fee = int(v.feeBps, "Fee");
      need(fee >= 0n && fee < 10000n, "Fee must be between 0 and 9999 bps");
      const out = getAmountOut(a, rI, rO, fee);
      need(out < rO, "Output exceeds the reserve");
      const spot = Number(rO) / Number(rI);
      const exec = Number(out) / Number(a);
      const kBefore = rI * rO;
      const kAfter = (rI + a) * (rO - out);
      return {
        rows: [
          { label: "Amount out (floor)", value: out.toString(), mono: true },
          { label: "Spot price before", value: fmt(spot, 6) + " out per in" },
          { label: "Execution price", value: fmt(exec, 6) + " out per in" },
          { label: "Price impact", value: fmt((1 - exec / spot) * 100, 4) + " %" },
          { label: "Fee paid (input units)", value: fmt(Number(a) * Number(fee) / 10000, 4) },
          { label: "k before → after", value: kBefore + " → " + kAfter, mono: true },
        ],
        out, kBefore, kAfter,
      };
    },
    getAmountOut,
  };

  /* 7. LP shares & impermanent loss ---------------------------------- */
  const MIN_LIQUIDITY = 1000n;
  LABS["amm-lp"] = {
    id: "amm-lp",
    title: "Liquidity provision & impermanent loss",
    summary: "Initial LP shares = sqrt(a*b) - 1000 (locked forever). Later deposits mint shares pro rata. Impermanent loss compares an LP position to simply holding.",
    inputs: [
      { id: "depA", label: "Deposit token A", type: "number", value: 10000, step: 1 },
      { id: "depB", label: "Deposit token B", type: "number", value: 20000, step: 1 },
      { id: "totalSupply", label: "Existing LP supply (0 = new pool)", type: "number", value: 0, step: 1 },
      { id: "reserveA", label: "Existing reserve A", type: "number", value: 0, step: 1 },
      { id: "reserveB", label: "Existing reserve B", type: "number", value: 0, step: 1 },
      { id: "priceChange", label: "Price of A change (x times)", type: "number", value: 2, step: 0.01 },
    ],
    compute(v) {
      const a = int(v.depA, "Deposit A"), b = int(v.depB, "Deposit B");
      const ts = int(v.totalSupply || 0, "LP supply"), ra = int(v.reserveA || 0, "Reserve A"), rb = int(v.reserveB || 0, "Reserve B");
      let minted;
      if (ts === 0n) {
        const root = C.isqrt(a * b);
        need(root > MIN_LIQUIDITY, "Initial deposit too small (sqrt(a*b) must exceed 1000)");
        minted = root - MIN_LIQUIDITY;
      } else {
        need(ra > 0n && rb > 0n, "Existing reserves must be positive");
        const sa = (a * ts) / ra, sb = (b * ts) / rb;
        minted = sa < sb ? sa : sb;
      }
      const r = num(v.priceChange, "Price change");
      need(r > 0, "Price multiplier must be positive");
      const il = 2 * Math.sqrt(r) / (1 + r) - 1;
      return {
        rows: [
          { label: "LP tokens minted to you", value: minted.toString(), mono: true },
          { label: "Impermanent loss vs holding", value: fmt(il * 100, 4) + " %" + " (x" + fmt(r, 4) + " price)" },
        ],
        minted, il,
      };
    },
    ilFactor(r) { return 2 * Math.sqrt(r) / (1 + r) - 1; },
  };

  /* 8. Lending: health factor & APY ---------------------------------- */
  LABS["lending"] = {
    id: "lending",
    title: "Collateral, health factor & APY",
    summary: "Health factor = (collateral value x liquidation threshold) / debt. Below 1.0 the position can be liquidated. APY compounds the APR over the number of periods.",
    inputs: [
      { id: "collAmt", label: "Collateral amount (ETH)", type: "number", value: 10, step: 0.01 },
      { id: "collPrice", label: "Collateral price (USD)", type: "number", value: 2000, step: 1 },
      { id: "lt", label: "Liquidation threshold (%)", type: "number", value: 80, step: 0.1 },
      { id: "debt", label: "Debt (USD)", type: "number", value: 10000, step: 1 },
      { id: "apr", label: "Borrow APR (%)", type: "number", value: 5, step: 0.01 },
      { id: "periods", label: "Compounding periods per year", type: "number", value: 365, step: 1 },
    ],
    compute(v) {
      const amt = num(v.collAmt, "Collateral"), px = num(v.collPrice, "Price"), lt = num(v.lt, "Threshold") / 100;
      const debt = num(v.debt, "Debt"), apr = num(v.apr, "APR") / 100, n = int(v.periods, "Periods");
      need(debt > 0 && amt > 0 && px > 0, "Collateral, price and debt must be positive");
      need(lt > 0 && lt <= 1, "Threshold must be in (0, 100]");
      need(n >= 1n, "Periods must be at least 1");
      const collValue = amt * px;
      const hf = (collValue * lt) / debt;
      const liqPrice = debt / (amt * lt);
      const apy = Math.pow(1 + apr / Number(n), Number(n)) - 1;
      return {
        rows: [
          { label: "Collateral value", value: "$" + fmt(collValue, 2) },
          { label: "Health factor", value: fmt(hf, 4) + (hf < 1 ? "  (LIQUIDATABLE)" : "  (safe)") },
          { label: "Liquidation price of collateral", value: "$" + fmt(liqPrice, 2) },
          { label: "Effective APY", value: fmt(apy * 100, 4) + " %" },
        ],
        healthFactor: hf, liquidationPrice: liqPrice, apy,
      };
    },
  };

  /* 9. Perpetual futures --------------------------------------------- */
  LABS["perps"] = {
    id: "perps",
    title: "Perpetual futures position",
    summary: "Isolated-margin model: notional = margin x leverage. Liquidation price uses maintenance margin rate m: long = entry x (1 - 1/L + m), short = entry x (1 + 1/L - m). Funding: longs pay shorts when the rate is positive.",
    inputs: [
      { id: "side", label: "Side", type: "select", value: "long", options: [["long", "Long"], ["short", "Short"]] },
      { id: "margin", label: "Margin (USD)", type: "number", value: 1000, step: 1 },
      { id: "leverage", label: "Leverage (x)", type: "number", value: 10, step: 0.1 },
      { id: "entry", label: "Entry price (USD)", type: "number", value: 3000, step: 0.01 },
      { id: "mark", label: "Mark price (USD)", type: "number", value: 3100, step: 0.01 },
      { id: "mmr", label: "Maintenance margin rate (%)", type: "number", value: 0.5, step: 0.01 },
      { id: "fundingPct", label: "Funding rate per period (%)", type: "number", value: 0.01, step: 0.0001 },
    ],
    compute(v) {
      const side = v.side === "short" ? -1 : 1;
      const margin = num(v.margin, "Margin"), L = num(v.leverage, "Leverage");
      const entry = num(v.entry, "Entry"), mark = num(v.mark, "Mark"), m = num(v.mmr, "MMR") / 100;
      const f = num(v.fundingPct, "Funding") / 100;
      need(margin > 0 && L > 0 && entry > 0 && mark > 0, "Margin, leverage and prices must be positive");
      need(L * m < 1 && L > 0, "Leverage too high for this maintenance margin");
      const notional = margin * L;
      const qty = notional / entry;
      const pnl = side * qty * (mark - entry);
      const liq = side > 0 ? entry * (1 - 1 / L + m) : entry * (1 + 1 / L - m);
      const funding = notional * f * side * -1; // long pays when f > 0; negative = paid by you
      return {
        rows: [
          { label: "Notional", value: "$" + fmt(notional, 2) },
          { label: "Position size", value: fmt(qty, 6) + " units" },
          { label: "Unrealised PnL at mark", value: (pnl >= 0 ? "+$" : "-$") + fmt(Math.abs(pnl), 2) },
          { label: "Liquidation price (simplified)", value: "$" + fmt(liq, 2), mono: true },
          { label: "Funding payment this period", value: (funding >= 0 ? "receive $" : "pay $") + fmt(Math.abs(funding), 4) },
        ],
        pnl, liq, funding, notional,
      };
    },
  };

  /* 10. Tokenomics: vesting & bonding curve -------------------------- */
  function vestedAt(total, cliff, duration, month) {
    need(duration > 0 && cliff >= 0 && cliff <= duration, "Need 0 <= cliff <= duration and duration > 0");
    if (month < cliff) return 0;
    if (month >= duration) return total;
    return (total * month) / duration;
  }
  // Linear price p(s) = p0 + k*s. Cost to buy from s0 to s1 is the exact integral.
  function curveCost(p0, k, s0, s1) {
    need(s1 >= s0, "End supply must be >= start supply");
    return p0 * (s1 - s0) + k * (s1 * s1 - s0 * s0) / 2;
  }
  LABS["tokenomics"] = {
    id: "tokenomics",
    title: "Vesting schedule & bonding curve",
    summary: "Linear vesting with a cliff: nothing before the cliff, then tokens unlock pro rata up to the full duration. A linear bonding curve prices the next token at p0 + k*supply.",
    inputs: [
      { id: "total", label: "Allocation (tokens)", type: "number", value: 1000000, step: 1 },
      { id: "cliff", label: "Cliff (months)", type: "number", value: 12, step: 1 },
      { id: "duration", label: "Total duration (months)", type: "number", value: 48, step: 1 },
      { id: "month", label: "Month to evaluate", type: "number", value: 30, step: 1 },
      { id: "p0", label: "Curve start price p0", type: "number", value: 0.01, step: 0.0001 },
      { id: "k", label: "Curve slope k", type: "number", value: 0.0001, step: 0.0000001 },
      { id: "s0", label: "Supply now s0", type: "number", value: 0, step: 1 },
      { id: "s1", label: "Supply after purchase s1", type: "number", value: 1000, step: 1 },
    ],
    compute(v) {
      const total = num(v.total, "Allocation"), cliff = num(v.cliff, "Cliff"), dur = num(v.duration, "Duration");
      const month = num(v.month, "Month");
      const vested = vestedAt(total, cliff, dur, month);
      const p0 = num(v.p0, "p0"), k = num(v.k, "k"), s0 = num(v.s0, "s0"), s1 = num(v.s1, "s1");
      const cost = curveCost(p0, k, s0, s1);
      const spotAfter = p0 + k * s1;
      return {
        rows: [
          { label: "Vested at month " + month, value: fmt(vested, 2) + " tokens (" + fmt((vested / total) * 100, 2) + " %)" },
          { label: "Locked at month " + month, value: fmt(total - vested, 2) + " tokens" },
          { label: "Cost to buy s0 → s1", value: "$" + fmt(cost, 4) },
          { label: "Average price paid", value: s1 > s0 ? "$" + fmt(cost / (s1 - s0), 6) : "n/a" },
          { label: "Spot price after purchase", value: "$" + fmt(spotAfter, 6) },
        ],
        vested, cost,
      };
    },
    vestedAt, curveCost,
  };

  const api = { LABS, ethToWei, getAmountOut, nextBaseFee, subsidyAt, issuedThrough, vestedAt, curveCost, gweiToWei };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.LidexLabs = api;
  root.LIDEX_LABS = LABS;
})(typeof globalThis !== "undefined" ? globalThis : this);
