/**
 * transaction.js — Safe MongoDB transaction wrapper with standalone fallback.
 *
 * MongoDB transactions require a Replica Set. On standalone instances (local dev, 
 * free Atlas tiers, etc.) they throw:
 *   "Transaction numbers are only allowed on a replica set member or mongos"
 *
 * This utility detects the topology at runtime and either uses a real session/
 * transaction (Replica Set) or executes the work directly without one (standalone).
 *
 * Usage:
 *   const result = await withTransaction(async (session) => {
 *     await Model.create([doc], { session });
 *     await OtherModel.updateOne({...}, {...}, { session });
 *     return result;
 *   });
 */

const mongoose = require('mongoose');

/**
 * Detect whether the current MongoDB connection supports multi-document transactions.
 * Returns true for ReplicaSetWithPrimary and Sharded (mongos) topologies.
 */
function isTransactionSupported() {
  try {
    const topology = mongoose.connection?.client?.topology;
    if (!topology) return false;
    const type = topology.description?.type;
    // Supported: ReplicaSetWithPrimary, Sharded
    return type === 'ReplicaSetWithPrimary' || type === 'Sharded';
  } catch {
    return false;
  }
}

/**
 * Execute `fn` inside a MongoDB transaction when supported, or without one on
 * standalone instances. Always passes a (possibly null) session to fn.
 *
 * @param {Function} fn  - Async function receiving (session|null) as its argument.
 *                         Must use session in Mongoose calls if it is non-null.
 * @returns {Promise<*>} - Result of fn.
 */
async function withTransaction(fn) {
  if (!isTransactionSupported()) {
    // Standalone / single node — run without transaction, pass null as session
    return fn(null);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { withTransaction, isTransactionSupported };
