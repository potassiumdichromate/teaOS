// Real bug, found by actually running the pipeline to completion (not by
// typechecking): `JSON.stringify` has no native support for `BigInt`, and
// several Prisma fields are BigInt (Question.chainBlockNumber,
// ChainAnchor.blockNumber, MidenNote timelock/reclaim heights) — Express's
// res.json() only threw once a question actually reached ACCEPTED with a
// real on-chain block number populated, which is why this surfaced only
// now. Global shim, imported once for its side effect before any request
// handling starts, rather than converting BigInt -> string at every call site.
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

BigInt.prototype.toJSON = function () {
  return this.toString();
};

export {};
