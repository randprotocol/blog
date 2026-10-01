---
title: "An AMM on a shielded chain"
description: "How durian.market puts a constant-product market maker on Rand Protocol, where programs had no state and no way to hold a token: what RPL-2 adds to the ledger, how a swap becomes one proof over one declared transition, what is public and what is not, and what the design costs."
pubDatetime: 2026-10-01T03:00:00Z
author: "Dendi Suhubdy"
tags:
  - engineering
  - rpl-2
  - zkvm
  - amm
featured: true
draft: false
---

Rand Protocol is a fully shielded chain: there are no accounts and no balances, only note
commitments and nullifiers, and a transaction is a proof that some notes were spent and some
were created without saying which ones or by whom. Its programs run in a zkVM and are proved by
the caller; validators verify STARKs and never execute anything.

That is a good place to put money and a bad place to put a market. A market maker is a shared
public state that everyone reads and writes, and until this week a Rand program could not keep
state, could not hold a token and could not move one. A `Call` produced a receipt of eight
words, and nothing followed from them.

durian.market is a Uniswap-v2-style automated market maker that runs on Rand anyway. This post
is about the ledger change that made it possible, and about what an AMM looks like when the
trader, not the chain, is the one doing the computing.

## Table of contents

## Why a program could not be a market

Three things were missing, and they are worth stating precisely because the fix is exactly
three things.

| gap | what the chain had |
|---|---|
| a program has nowhere to keep state | the state root commits program ids, never storage |
| a program cannot hold value | every note is owned by a spend key; `MintAuthority::Program` was reserved and refused |
| a program's outputs cannot move value | "effect kind 1", the program-driven transfer, was deleted with the accounts |

The token standard's own spec listed the answer as future work: *"RPL-2, program-owned notes —
a note spendable only with a `Call` proof of a named program — what lets a DEX or an escrow hold
tokens. Needs a program-state design."*

## RPL-2: state, vaults and `Invoke`

RPL-2 is a new ledger feature behind a genesis section, `program_state`. A chain without the
section is byte for byte what it was; the release that carries the code runs the live testnet
unchanged.

**State is public cells.** A program owns a map from an 8-word key to an 8-word value, committed
in the state root. An exchange's reserves are public by nature — every trade moves the price —
so hiding them buys nothing and would have cost a program-state circuit. We did not build one.

**Value a program holds is a public vault balance**, one `u64` per `(program, asset)`. It is
not a note. Value enters the vault through the bundle's existing public burn fields (`burn_r` for
RAND, `burn_a` of `burn_asset` for a token) and leaves as a chain-computed note, exactly as a
token mint's note is computed today. This is what let the change ship with **no circuit
changes**: the bundle guest, the auth guest and every verifier-key shape are untouched.

**The caller proves; validators verify.** A new action, `Invoke`, is a `Call` that also carries a
declared transition:

```rust
Action::Invoke {
    program: ProgramId,
    proof: Vec<u8>,                 // an ordinary call proof
    input_envelope: Option<CallEnvelope>,
    transition: Transition,
}

pub struct Transition {
    pub reads:  Vec<Cell>,   // cells read, with the values read; keys ascending
    pub writes: Vec<Cell>,   // cells written
    pub inflow: Inflow,      // what the bundle's burn_a is: None | Deposit | Burn
    pub pays:   Vec<Payout>, // notes paid out of the vault
    pub mints:  Vec<Payout>, // new units of a token the program is the authority of
}
```

The proof says the program *accepts* this transition. The ledger then applies it — provided
every cell in `reads` still holds the value the transition says it read. That last clause is the
whole concurrency model, and we will come back to it.

### One trick makes the proof state-independent

The obvious design has the program read the chain's state. We did the opposite: **the ledger
builds the proof's public segment from the transaction itself**,

$$
\text{segment} \;=\; \text{public} \,\|\, \text{call\_binding} \,\|\, \text{context}(\text{transition}, \text{burns}),
$$

where the context words are a fixed serialisation of the declared reads, writes, inflow and
payouts. The program reads them with `read_public`, so the guest sees the transition, and the
proof's public-input digest $H_{\text{PUB}}$ binds it. Whether a proof verifies is therefore a
function of the transaction's bytes alone. The verified-proofs cache the node already keeps stays
sound, and the one thing that depends on ledger state — do the cells still hold what was read —
is a comparison that always runs.

The `call_binding` was already there: it hashes the whole action with only the call proof
blanked. So it covers the transition, the recipients and the fee bundle, and a copy of the proof
under another transaction is refused as it always was.

A segment rule keeps this cheap for validators: the context must fit in the same public table a
hardened call to the program is proved over (127 words for a program without a public input).
**An `Invoke` needs no verifier key that a `Call` to the same program does not already need.**

### The rule a program must keep

Because the caller declares the transition, a context word the program does not constrain is a
word any caller may set. The rule for an RPL-2 program is simple and unforgiving: *check
everything you are shown* — the version, all four counts, the inflow kind, every key, every value
word. durian's test suite has a test that flips every single word of every accepted context and
demands a refusal each time.

There is a second, sharper rule that came from reading the guest SDK: its panic handler
**halts**, and a halted run is a provable run whatever its outputs say. A panic on a bad
transition would be an accepted transition. So the program contains no panicking path at all
(the build refuses an image that links one), and a refused transition ends in a read no caller
could have committed, which leaves the run without a trace and the transition without a proof.

## The market itself

durian is one deployed program. Every pool pairs RAND with one RPL token and lives in one cell:

```
key   = [1, 0, token, 0, 0, 0, 0, 0]
value = [rr_lo, rr_hi, rt_lo, rt_hi, s_lo, s_hi, lp_asset, 1]
```

`rr` and `rt` are the reserves, `s` the share supply. Shares are ordinary RPL tokens whose mint
authority is the program — RPL-2 switches `MintAuthority::Program` on — so a liquidity position
is a shielded note like any other. A second cell binds each share token to exactly one pool, and
since a pool's first deposit must mint (which the chain allows only for a token the program
controls), a pool can only be created with a token that is really the program's.

Why RAND pairs only? One bundle burns one token plus RAND. A RAND pair takes liquidity in one
transaction; a token/token pair would need two and a holding cell in between. Token-for-token
trades lose nothing: they run through RAND inside a single transition, reading and writing both
pool cells, with the RAND that leaves one pool exactly the RAND that enters the other.

### The program never divides

Uniswap's swap formula is a division:

$$
\Delta y \;=\; \left\lfloor \frac{997\,\Delta x\, y}{1000\,x + 997\,\Delta x} \right\rfloor .
$$

Inside a zkVM, though, the program does not need to *compute* $\Delta y$. The caller already
declared it. The program only needs to check

$$
\Delta y \,(1000\,x + 997\,\Delta x) \;\le\; 997\,\Delta x\, y ,
$$

which is three multiplications and a comparison — in 192 bits, since every amount is below
$2^{63}$. Adding liquidity checks $L \cdot x \le \Delta x \cdot s$ and $L \cdot y \le \Delta y
\cdot s$; removing it checks the same inequalities the other way; a first deposit checks $s^2 \le
\Delta x\,\Delta y$ and locks 1000 shares for ever, Uniswap v2's defence against share inflation.

The wallet finds the largest amounts that satisfy those inequalities by bisection over the same
inequalities. So a quote cannot disagree with the program about rounding, and nothing on either
side divides.

### What it costs to prove

The compiled program is 1,635 RISC-V words. On the zkVM that is what decides the tier: the
program is hashed into every proof, and 1,635 words are 409 of tier 12's 512 Poseidon2
permutations. Every method — a first deposit, a later one, a withdrawal, a swap, a
token-for-token swap through two pools — proves at tier 12, in 933 to 2,311 of its 4,095 cycles.

A trade is therefore two proofs on the trader's machine: the tier-12 call proof and the
tier-14 bundle proof every Rand transaction carries, plus the small auth proof. The bundle proof
is the expensive one, about a hundred seconds and 5.7 GB today.

## What is public, what is not

Amounts are public at both ends of a trade: the reserves are in a public cell, the deposit is a
public burn, the payout is a public mint-style note with the recipient's public key on the wire.
That is the same information a bridge deposit publishes.

Who paid in is not public. The bundle names nobody: it publishes nullifiers and commitments and
a proof, as every Rand transaction does. So the chain sees that *someone* sold 10 zUSD for RAND
and who received the RAND, but not which notes paid for it, and the trader's liquidity shares are
shielded notes from the moment they are minted.

## The trade-off, stated plainly

A transition is proved against the values it read. If another transaction changes one of those
cells first, the proof is for a state that no longer exists, and the wallet must re-quote and
re-prove. For a pool with occasional trades this is invisible. For a busy pool it is a queue
where the fastest prover wins.

This is the price of keeping validators out of the execution business, and it was a deliberate
choice over the alternative — validators running the program at inclusion, as an EVM does —
which has no write conflicts but puts an interpreter and its semantics into consensus on a chain
whose validators have only ever verified proofs.

The fix does not need another fork. Conflicts are per cell, so a program can take deposits into
per-user cells, which never conflict, and let anyone settle a batch of them against the pool cell
in one proof. That is a program design, not a protocol change, and it is where durian goes next.

## Where things stand

- RPL-2 is implemented on the full node's `feat/rpl2` branch for v0.6.8, behind the
  `program_state` genesis section. No live chain carries it yet.
- durian.market runs against a single-validator devnet with the section on; the interface is at
  [durian.market](https://durian.market). Trades from the browser wait on the wallet extension
  learning to submit an `Invoke`; until then the `durian` command line does it.
- The code is at [github.com/randprotocol/durian.market](https://github.com/randprotocol/durian.market)
  and the design in `fullnode/docs/superpowers/specs/2026-09-30-rpl2-program-state-design.md`.

The larger point is not the exchange. It is that a chain whose validators only verify proofs can
still carry shared public state, as long as the person who wants to change it is the one who
proves the change — and that the ledger can be made to check that proof without ever handing the
prover its own state.
