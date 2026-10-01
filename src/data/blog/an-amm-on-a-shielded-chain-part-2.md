---
title: "Progress building an AMM on Rand Protocol, Part 2"
description: "From a branch and a one-validator devnet to the live testnet: RPL-2 on chain 20, the first swap from a browser wallet, and the five things that broke on the way — a proof window too short for a CPU, a transaction too big for a web server, a wallet that scans with a method nobody allowed, a faucet that is not public, and a number JavaScript cannot hold."
pubDatetime: 2026-10-01T10:30:00Z
author: "Dendi Suhubdy"
tags:
  - engineering
  - rpl-2
  - zkvm
  - amm
featured: true
draft: false
---

[Part 1](/blog/posts/an-amm-on-a-shielded-chain/) ended with RPL-2 — program state, program
vaults and the `Invoke` action — on a branch, durian.market running against a single-validator
devnet, and trades from the browser waiting on the wallet extension learning to submit an
`Invoke`. This morning, all three changed. RPL-2 is in fullnode v0.6.8, v0.6.8 is chain 20, the
public testnet, and a swap was made on chain 20 from durian.market's own page through the
released Rand Wallet extension.

This post is about the distance between those two states, which was mostly not cryptography.

## Table of contents

## What the first browser swap looked like

From a clean Chrome profile with Rand Wallet 0.6.8 installed:

1. **Connect.** The extension asks "durian.market wants to connect to Rand Wallet".
2. **Sell 1 RAND for DUR.** The page quotes 99.20546 DUR and hands the wallet a request: the
   program, the cells it read, the cells it will write, what the bundle pays in, what the vault
   pays out. The wallet window shows exactly that: *Swap 1 RAND for 99.20546 DUR · You pay 1
   RAND · Network fee 0.0044816 RAND · You receive 99.20546 DUR · Program db2148e6b8…2bda*.
3. **Approve.** The page shows "Waiting for Rand Wallet" for about 3.8 minutes while the proofs
   are made, then "Swap confirmed. Included in block 5,787."

The pool went from 200 RAND / 20,000 DUR to 201 RAND / 19,900.79 DUR, and the 99.2 DUR arrived
in the trader's wallet as an ordinary shielded note. Nothing on the chain says which notes paid
for the RAND.

Under the page are three proofs. The **call proof** shows the AMM program accepts the declared
transition; the device makes it, because it runs over the private method inputs. The **auth
proof** shows the spend key authorised the bundle; the device makes it too, so the key never
leaves. The **bundle proof** — the large one, over the notes being spent — goes to a prover,
which receives only a viewing key's worth of information. With the v0.6.8 prover, on an M4
laptop, the call proof takes about 6 seconds and the bundle about 20.

## From a branch to `main`

RPL-2 was written against a full node that did not stand still. While it was being built, `main`
took 45 commits, most of them fixes from an external security audit, and one of them changed
something every proof commits to.

**BIND-1** binds the genesis hash into every transaction binding. Before it, a proof or a
signature made for one chain verified on any other chain that shared its chain id; after it, a
chain cut with `binding_domain: 1` accepts only proofs bound to its own genesis. An `Invoke`'s
call proof commits to the transaction's call binding, so `Invoke` had to join BIND-1 — on the
ledger's side, which computes the binding it verifies against, and on the wallet's side, which
computes the one it proves over. A wallet that did one and not the other would produce proofs no
chain-20 node accepts.

The rebase also renumbered the action: `Invoke` is action 33 on `main` (it was 28 on the branch,
where five newer actions did not yet exist). Encodings change with that, which is why
a wallet built on the branch cannot transact on chain 20 and a wallet built on `main` cannot
transact on the devnet.

The gate for the release was the same end-to-end test as before, with real proofs, on a chain
with `binding_domain: 1`: deploy a counter program, register a token and the program's own
token, then one invoke that reads a cell, writes it, deposits RAND and a token into the vault,
pays RAND out and mints the program's token — and a replay of it refused. Seven proofs, 764
seconds, passed.

## Five things that broke on the way

None of these were in the design. All of them were found by running it.

### 1. A proof window built for a laptop at 1-second blocks

A Rand bundle carries a `time`: the height of the anchor it was built on. A node refuses a bundle
whose `time` is too far behind the tip — 256 blocks, a constant. On the devnet, at one block a
second, that was about four minutes. The first pool-creation invoke, proved on a cloud machine with
the pre-rebase build — 54 seconds for the call proof, 13 for the auth and 207 for the bundle, one
after another — arrived too late, and the node answered:

```
Error: time 789 is outside [816, 1072] (rpc -32000)
```

Four and a half minutes of proving, refused for arriving 27 blocks late. The devnet moved to
three-second blocks the same hour, which stretched the window to 12.8 minutes. The real fix was
already on `main`: a genesis field, `proof_window_blocks`, replaces the constant. Chain 20 sets
it to 1,024 blocks.

### 2. A transaction too big for a web server

An `Invoke` carries three proofs. At production parameters they were 1,434,355, 1,366,507 and
1,501,478 bytes: 4.30 MB before encoding, about 8.7 MB as the hex string a JSON-RPC
`rand_sendTransaction` carries. Two limits stood in front of the node. The site's RPC proxy
capped a send at 9 MiB, an 8% margin that would not have survived a heavier call. And nginx, in
front of the proxy, had a server-wide request cap of 64 KiB — which would have refused every
transaction anyone sent through the site, of any kind, before the application saw it. No transaction
had gone through the site yet, so nothing had failed. The proxy now allows 16 MiB and nginx 17,
and the proxy meters a send separately from a read.

### 3. A wallet that scans with a method nobody allowed

The site exposes two RPC endpoints: a narrow one for its own reads, and one for wallets, with
the methods a wallet needs to sync, prove and submit and open CORS for the extension. The list
was written from the wallet's documentation. It was missing `rand_getRawTransaction`, which the
`rand` command line's scan calls after `rand_getBlocks` — so `rand balance` failed through the
public endpoint, and every command that scans before it acts (a deploy, a call, an invoke) failed
with it. It worked on the server, which reached the node directly. It was found by
running the published example programs from outside, with a logging proxy in the middle.

The same class of bug sat in front of the public testnet endpoint: its proxy predated RPL-2 and
refused the program-state reads, so no RPL-2 program could be driven through
`rpc.randprotocol.org`. That one was fixed by the time we looked again. The lesson for an
allowlist in front of a node is to test it with the real client, from outside, not to derive it
from a list.

### 4. A faucet that is not public

Chain 20's genesis has `faucet: true` and `rand_status` says so, but the faucet only mints to the
sixteen wallets its genesis lists, and the public endpoint does not serve `rand_mint` at all.
"The faucet exists" and "you can use the faucet" are different statements; the status field
said the first and was read as the second. durian.market's treasury on chain 20 was funded by
an operator transfer instead, and the docs now say which is which.

### 5. A number JavaScript cannot hold

The wallet's core is Rust compiled to WebAssembly, and its results cross into the extension as
JSON. An invoke's payout notes do not have a position in the commitment tree until the chain
appends them, and the core marked that with `u64::MAX`. In JavaScript every number is a double;
`18446744073709551615` comes back as `18446744073709552000`, and the next call to the core —
which reads the value back as a `u64` — refused it. The marker is now `2^53 − 1`, the largest
integer a double holds exactly.

## The same program id on two chains

The AMM was deployed on chain 20 from the same image as on the devnet, and got the same program
id: `db2148e6…2bda`. A Rand program id is a hash of the code (and of its deploy-time public
input, which this program does not have), not of who deployed it or when. The site's
configuration did not change between chains; only the node behind it did. Its tokens are 2 (DUR)
and 3 (RDLP, the pool's share token, which only the program can mint), after the genesis zUSD at 1.

## What the wallet says when it cannot know

Most wallet errors are about the request: locked, not connected, insufficient funds, the
program refused the amounts, the pool moved (`STALE_READ`, which the page answers by re-quoting).
One is about the user's money. If the wallet window is closed while it is sending, the wallet
cannot know whether the transaction left. It reports `UNKNOWN_OUTCOME`, and the page says *"this
may or may not have gone through. Check your balance in Rand Wallet before trying again."* A page
that said "try again" there would, some of the time, make the trade twice.

## Examples for anyone writing RPL programs

The programs written along the way are in
[randprotocol/example-programs](https://github.com/randprotocol/example-programs), each with the
scripts that build it, run it on the emulator, deploy it and use it, and the transaction hashes
of a run. On the RPL-1 side: a program that proves a private amount clears a public threshold, the
Solana SPL Token program translated to RISC-V, and the token scripts. On the RPL-2 side: a counter
— one cell, plus one per invoke, the smallest stateful program — and a vault anyone pays into and
only the holder of a secret pays out of, where the lock is the program's deploy-time public input
and the withdrawal proves knowledge of the secret without revealing it. Thirteen more, written
alongside, cover order books, lending, perpetuals, sealed-bid auctions and private ballots.

Each one keeps the two rules from Part 1: a refusal leaves no proof, and an RPL-2 program checks
every word of the context it is shown.

## Where things stand

- RPL-2 is live on chain 20, the Rand testnet, in fullnode v0.6.8.
- durian.market runs on chain 20 at [durian.market](https://durian.market), behind its own
  chain-20 node. The RAND/DUR pool is seeded; trades work from the browser with Rand Wallet
  0.6.8 and from the `durian` command line.
- Next is the design Part 1 ended on: take deposits into per-user cells, which never conflict,
  and settle them against the pool cell in batches, so a busy pool stops being a race between
  provers. After that, token-for-token pools, and a smaller footprint for the bundle proof, which
  is still the one most of a trade's waiting is spent on.
