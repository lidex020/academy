# Lidex Academy — lab simulators build

Run: serve this folder statically (e.g. `python3 -m http.server 8080`) and open `index.html`.

## What is real
- **Crypto primitives** (`js/crypto.js`): Keccak-256 (checked against known vectors and a Python SHA-3 cross-check for multi-block input), SHA-256 / double SHA-256 via WebCrypto, RLP, Merkle roots.
- **10 lab simulators** (`js/labs.js`): hash explorer and PoW miner, Merkle builder, Bitcoin issuance, EIP-155 signing hash, EIP-1559 fee calculator, constant-product AMM, LP shares and impermanent loss, lending health factor and APY, perpetuals, vesting and bonding curves.
- **13 lessons in 6 courses** (`js/content.js`). Each exercise is graded by re-running the lab's own computation or a real hash/encoding check. Nothing is an answer key.
- **Coding challenge** (AMM lesson): user JS runs in a timed Web Worker against reference cases. Network, DOM and dynamic-code APIs are blocked by a pattern filter.
- **Progress, XP, achievements**: stored in this browser's localStorage. Starts at zero.

## Not built yet
- Quizzes, build projects, final assessments, certificates.
- The automated content engine (source monitoring, AI generation, validation, auto-publish).
- The other 14 of the 20 learning paths.
- Lidex ecosystem integration (Wallet, Swap, App Store).
- Source "last verified" dates reflect HTTP link checks only (2026-10-09). Content review is not automated.

## Modelling notes
- Perpetuals use a simplified isolated-margin model (no fees, no cross-margin). Real venues publish their own formulas.
- Impermanent loss, vesting and bonding-curve formulas are textbook models, not a specific protocol's contracts.
