const { z } = require('zod');
const { AppError } = require('./errorHandler');

/**
 * validate.js — Strict Zod Validation Middleware
 * Enterprise Refactor: Enforces robust server-side validation using Zod.
 */

// ---- Generic Zod Runner ----------------------------------------------------
const validate = (schema) => (req, res, next) => {
  try {
    // Parse and strip unknown fields, keeping payloads clean
    req.body = schema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Zod v4 uses error.issues; v3 used error.errors — support both
      const issues = error.issues || error.errors || [];
      const message = issues.map(e => `${(e.path || []).join('.')}: ${e.message}`).join(', ');
      return next(new AppError(message || 'Validation failed', 400));
    }
    next(error);
  }
};

// ---- Zod Schemas -----------------------------------------------------------

const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').trim(),
  email: z.string().email('Invalid email').toLowerCase().trim(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required'),
});

const eventSchema = z.object({
  title: z.string().min(1, 'Event title is required').max(200, 'Title too long').trim(),
  date: z.string().refine(val => !isNaN(Date.parse(val)), 'Invalid date format'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  category: z.enum(['Workshop', 'Seminar', 'Conference', 'Webinar', 'Hackathon', 'Cultural', 'Sports', 'Networking', 'Other']),
  venue: z.string().max(300).trim().optional().default(''),
  description: z.string().max(1000).trim().optional().default(''),
  attendanceEnabled: z.boolean().optional().default(false),
  banner: z.string().optional().default(''),
});

const feedbackSchema = z.object({
  eventId: z.string()
    .length(24, 'eventId must be a 24-character MongoDB ObjectId')
    .regex(/^[a-f0-9]{24}$/i, 'eventId must be a valid hex ObjectId'),
  overallRating: z.number().int().min(1).max(5),
  recommendationScore: z.number().int().min(0).max(10),
  selectedTags: z.array(z.string()).optional().default([]),
  comments: z.string().max(2000).trim().optional().default(''),
  // Public submission fields (optional)
  submitterName: z.string().max(120).trim().optional().default(''),
  attendeeEmail: z.string().email('Invalid email format').toLowerCase().trim().optional().or(z.literal('')).default(''),
});

const attendanceSchema = z.object({
  eventId: z.string().min(24).max(24),
  attendanceToken: z.string().optional(), // Public QR scan requires this, manual doesn't
  attendeeName: z.string().min(1, 'Name is required').trim(),
  attendeeEmail: z.string().email('Valid email is required').toLowerCase().trim().optional().or(z.literal('')).default(''),
  phone: z.string().trim().optional().default(''),
  college: z.string().trim().optional().default(''),
  organization: z.string().trim().optional().default(''),
  batch: z.string().trim().optional().default(''),
  course: z.string().trim().optional().default(''),
  status: z.enum(['present', 'absent', 'pending', 'checked-in']).optional().default('checked-in'),
  attendanceType: z.enum(['qr', 'manual', 'system']).optional().default('qr')
});

// Separate schema for manual attendance — eventId comes from URL param, not body
const manualAttendanceSchema = z.object({
  attendeeName: z.string().min(1, 'Name is required').trim(),
  attendeeEmail: z.string().email('Valid email is required').toLowerCase().trim().optional().or(z.literal('')).default(''),
  phone: z.string().trim().optional().default(''),
  college: z.string().trim().optional().default(''),
  organization: z.string().trim().optional().default(''),
  batch: z.string().trim().optional().default(''),
  course: z.string().trim().optional().default(''),
  status: z.enum(['present', 'absent', 'pending', 'checked-in']).optional().default('present'),
  attendanceType: z.enum(['qr', 'manual', 'system']).optional().default('manual')
});

module.exports = {
  validateRegister: validate(registerSchema),
  validateLogin: validate(loginSchema),
  validateEvent: validate(eventSchema),
  validateFeedback: validate(feedbackSchema),
  validateAttendance: validate(attendanceSchema),
  validateManualAttendance: validate(manualAttendanceSchema),
};
