/**
 * aiWorker.js — Background Job Queue for AI & Heavy Analytics
 * Enterprise Refactor: Offloads AI Insights generation from the main API thread.
 */

const EventEmitter = require('events');
const Event = require('../models/Event');
const Feedback = require('../models/Feedback');
const aiService = require('../services/aiService'); // We will extract logic here

class AIQueue extends EventEmitter {}
const aiQueue = new AIQueue();

// In-memory set to act as a Distributed Lock/Mutex for background jobs
const processingLocks = new Set();

/**
 * Event Listener for triggering AI Background Jobs
 * @param {string} eventId - The event to process
 */
aiQueue.on('process_ai_insights', async (eventId) => {
  // 1. Mutex Lock (Phase 47)
  if (processingLocks.has(eventId)) {
    console.log(`[AI Worker] Job for event ${eventId} is already running. Skipping duplicate.`);
    return;
  }
  
  processingLocks.add(eventId);

  try {
    console.log(`[AI Worker] Starting heavy AI analysis for event ${eventId}...`);
    
    // 2. Fetch the event stats
    const event = await Event.findOne({ _id: eventId, isDeleted: false }).lean();
    if (!event) throw new Error('Event not found');

    const stats = {
      avgRating: event.avgRating || 0,
      avgNPS: event.npsScore || 0,
      totalResponses: event.totalResponses || 0
    };

    // 3. Generate AI payload (expensive text parsing/aggregation)
    const aiPayload = await aiService.generateAIAnalysis([eventId], stats);

    // 4. Save to Event.analyticsSnapshot safely
    await Event.updateOne(
      { _id: eventId },
      { 
        $set: { 
          'analyticsSnapshot.ai': aiPayload,
          'analyticsSnapshot.lastCalculated': new Date()
        } 
      }
    );

    console.log(`[AI Worker] Successfully completed AI analysis for event ${eventId}.`);
  } catch (error) {
    console.error(`[AI Worker] Failed job for event ${eventId}:`, error.message);
    // Phase 48: Failed job recovery could push to a DLQ collection here
  } finally {
    // Release the Mutex Lock
    processingLocks.delete(eventId);
  }
});

module.exports = aiQueue;
