app/services/calendarService.js


import { supabase } from '../config/supabase';
import { Logger } from '../utils/logger';
import { validateInput } from '../utils/validation';
import { formatDate, parseDate, addDays, isDateInRange } from '../utils/dateHelpers';
import { generateNotificationId } from '../utils/idGenerator';
import { NotificationService } from './notificationService';
import { SyncService } from './syncService';

const CALENDAR_TABLE = 'calendar_events';
const REMINDERS_TABLE = 'event_reminders';
const ATTENDEES_TABLE = 'event_attendees';

export class CalendarService {
  static instance = null;
  
  constructor() {
    if (CalendarService.instance) {
      return CalendarService.instance;
    }
    this.logger = new Logger('CalendarService');
    this.notificationService = new NotificationService();
    this.syncService = new SyncService();
    CalendarService.instance = this;
  }

  static getInstance() {
    if (!CalendarService.instance) {
      CalendarService.instance = new CalendarService();
    }
    return CalendarService.instance;
  }

  async createEvent(eventData) {
    try {
      this.logger.info('Creating calendar event', { eventData });
      
      const validation = validateInput(eventData, {
        title: { required: true, type: 'string', maxLength: 255 },
        description: { required: false, type: 'string', maxLength: 1000 },
        start_time: { required: true, type: 'string' },
        end_time: { required: true, type: 'string' },
        location: { required: false, type: 'string', maxLength: 255 },
        event_type: { required: true, type: 'string', enum: ['meeting', 'call', 'follow_up', 'demo', 'proposal', 'other'] },
        priority: { required: false, type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
        all_day: { required: false, type: 'boolean', default: false },
        recurring: { required: false, type: 'boolean', default: false },
        recurrence_pattern: { required: false, type: 'string' },
        client_id: { required: false, type: 'string' },
        deal_id: { required: false, type: 'string' },
        attendees: { required: false, type: 'array', default: [] },
        reminders: { required: false, type: 'array', default: [] }
      });

      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const { user } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const startTime = parseDate(eventData.start_time);
      const endTime = parseDate(eventData.end_time);

      if (endTime <= startTime) {
        throw new Error('End time must be after start time');
      }

      const eventPayload = {
        ...validation.data,
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'scheduled',
        sync_status: 'pending'
      };

      const { data: event, error } = await supabase
        .from(CALENDAR_TABLE)
        .insert([eventPayload])
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create event: ${error.message}`);
      }

      await this.processEventAttendees(event.id, eventData.attendees || []);
      await this.processEventReminders(event.id, eventData.reminders || []);

      if (eventData.recurring) {
        await this.createRecurringEvents(event);
      }

      await this.syncService.scheduleSync('calendar', event.id);

      this.logger.info('Calendar event created successfully', { eventId: event.id });
      return event;

    } catch (error) {
      this.logger.error('Failed to create calendar event', { error: error.message, eventData });
      throw error;
    }
  }

  async updateEvent(eventId, updateData) {
    try {
      this.logger.info('Updating calendar event', { eventId, updateData });

      const validation = validateInput(updateData, {
        title: { required: false, type: 'string', maxLength: 255 },
        description: { required: false, type: 'string', maxLength: 1000 },
        start_time: { required: false, type: 'string' },
        end_time: { required: false, type: 'string' },
        location: { required: false, type: 'string', maxLength: 255 },
        event_type: { required: false, type: 'string', enum: ['meeting', 'call', 'follow_up', 'demo', 'proposal', 'other'] },
        priority: { required: false, type: 'string', enum: ['low', 'medium', 'high'] },
        all_day: { required: false, type: 'boolean' },
        status: { required: false, type: 'string', enum: ['scheduled', 'completed', 'cancelled', 'postponed'] },
        attendees: { required: false, type: 'array' },
        reminders: { required: false, type: 'array' }
      });

      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      const { user } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: existingEvent, error: fetchError } = await supabase
        .from(CALENDAR_TABLE)
        .select('*')
        .eq('id', eventId)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !existingEvent) {
        throw new Error('Event not found or access denied');
      }

      if (updateData.start_time && updateData.end_time) {
        const startTime = parseDate(updateData.start_time);
        const endTime = parseDate(updateData.end_time);
        
        if (endTime <= startTime) {
          throw new Error('End time must be after start time');
        }
      }

      const updatePayload = {
        ...validation.data,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      };

      const { data: event, error } = await supabase
        .from(CALENDAR_TABLE)
        .update(updatePayload)
        .eq('id', eventId)
        .eq('user_id', user.id)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update event: ${error.message}`);
      }

      if (updateData.attendees) {
        await this.processEventAttendees(eventId, updateData.attendees);
      }

      if (updateData.reminders) {
        await this.processEventReminders(eventId, updateData.reminders);
      }

      await this.syncService.scheduleSync('calendar', eventId);

      this.logger.info('Calendar event updated successfully', { eventId });
      return event;

    } catch (error) {
      this.logger.error('Failed to update calendar event', { error: error.message, eventId, updateData });
      throw error;
    }
  }

  async deleteEvent(eventId, deleteRecurring = false) {
    try {
      this.logger.info('Deleting calendar event', { eventId, deleteRecurring });

      const { user } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: event, error: fetchError } = await supabase
        .from(CALENDAR_TABLE)
        .select('*')
        .eq('id', eventId)
        .eq('user_id', user.id)
        .single();

      if (fetchError || !event) {
        throw new Error('Event not found or access denied');
      }

      await supabase.from(ATTENDEES_TABLE).delete().eq('event_id', eventId);
      await supabase.from(REMINDERS_TABLE).delete().eq('event_id', eventId);

      if (deleteRecurring && event.recurring && event.recurrence_group_id) {
        await supabase
          .from(CALENDAR_TABLE)
          .delete()
          .eq('recurrence_group_id', event.recurrence_group_id)
          .eq('user_id', user.id);
      } else {
        await supabase
          .from(CALENDAR_TABLE)
          .delete()
          .eq('id', eventId)
          .eq('user_id', user.id);
      }

      await this.notificationService.cancelEventNotifications(eventId);

      this.logger.info('Calendar event deleted successfully', { eventId });
      return { success: true };

    } catch (error) {
      this.logger.error('Failed to delete calendar event', { error: error.message, eventId });
      throw error;
    }
  }

  async getEvents(filters = {}) {
    try {
      this.logger.info('Fetching calendar events', { filters });

      const { user } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from(CALENDAR_TABLE)
        .select(`
          *,
          attendees:${ATTENDEES_TABLE}(*),
          reminders:${REMINDERS_TABLE}(*)
        `)
        .eq('user_id', user.id);

      if (filters.start_date && filters.end_date) {
        query = query
          .gte('start_time', filters.start_date)
          .lte('start_time', filters.end_date);
      }

      if (filters.event_type) {
        query = query.eq('event_type', filters.event_type);
      }

      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }

      if (filters.client_id) {
        query = query.eq('client_id', filters.client_id);
      }

      if (filters.deal_id) {
        query = query.eq('deal_id', filters.deal_id);
      }

      query = query.order('start_time', { ascending: true });

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      const { data: events, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch events: ${error.message}`);
      }

      this.logger.info('Calendar events fetched successfully', { count: events?.length || 0 });
      return events || [];

    } catch (error) {
      this.logger.error('Failed to fetch calendar events', { error: error.message, filters });
      throw error;
    }
  }

  async getEvent(eventId) {
    try {
      this.logger.info('Fetching calendar event', { eventId });

      const { user } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data: event, error } = await supabase
        .from(CALENDAR_TABLE)
        .select(`
          *,
          attendees:${ATTENDEES_TABLE}(*),
          reminders:${REMINDERS_TABLE}(*)
        `)
        .eq('id', eventId)
        .eq('user_id', user.id)
        .single();

      if (error) {
        throw new Error(`Failed to fetch event: ${error.message}`);
      }

      this.logger.info('Calendar event fetched successfully', { eventId });
      return event;

    } catch (error) {
      this.logger.error('Failed to fetch calendar event', { error: error.message, eventId });
      throw error;
    }
  }

  async getTodaysEvents() {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

      return await this.getEvents({
        start_date: startOfDay.toISOString(),
        end_date: endOfDay.toISOString()
      });

    } catch (error) {
      this.logger.error('Failed to fetch today\'s events', { error: error.message });
      throw error;
    }
  }

  async getUpcomingEvents(days = 7) {
    try {
      const today = new Date();
      const endDate = addDays(today, days);

      return await this.getEvents({
        start_date: today.toISOString(),
        end_date: endDate.toISOString(),
        status: 'scheduled'
      });

    } catch (error) {
      this.logger.error('Failed to fetch upcoming events', { error: error.message, days });
      throw error;
    }
  }

  async markEventCompleted(eventId, notes = '') {
    try {
      this.logger.info('Marking event as completed', { eventId, notes });

      const updateData = {
        status: 'completed',
        completion_notes: notes,
        completed_at: new Date().toISOString()
      };

      return await this.updateEvent(eventId, updateData);

    } catch (error) {
      this.logger.error('Failed to mark event as completed', { error: error.message, eventId });
      throw error;
    }
  }

  async createQuickEvent(title, dateTime, duration = 60) {
    try {
      const startTime = parseDate(dateTime);
      const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

      const eventData = {
        title,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        event_type: 'other',
        priority: 'medium'
      };

      return await this.createEvent(eventData);

    } catch (error) {
      this.logger.error('Failed to create quick event', { error: error.message, title, dateTime });
      throw error;
    }
  }

  async processEventAttendees(eventId, attendees) {
    try {
      await supabase.from(ATTENDEES_TABLE).delete().eq('event_id', eventId);

      if (attendees && attendees.length > 0) {
        const attendeeData = attendees.map(attendee => ({
          event_id: eventId,
          email: attendee.email,
          name: attendee.name,
          status: attendee.status || 'pending',
          created_at: new Date().toISOString()
        }));

        const { error } = await supabase
          .from(ATTENDEES_TABLE)
          .insert(attendeeData);

        if (error) {
          throw new Error(`Failed to process attendees: ${error.message}`);
        }
      }

    } catch (error) {
      this.logger.error('Failed to process event attendees', { error: error.message, eventId });
      throw error;
    }
  }

  async processEventReminders(eventId, reminders) {
    try {
      await supabase.from(REMINDERS_TABLE).delete().eq('event_id', eventId);

      if (reminders && reminders.length > 0) {
        const reminderData = reminders.map(reminder => ({
          event_id: eventId,
          reminder_time: reminder.time,
          reminder_type: reminder.type || 'notification',
          message: reminder.message,
          is_sent: false,
          created_at: new Date().toISOString()
        }));

        const { error } = await supabase
          .from(REMINDERS_TABLE)
          .insert(reminderData);

        if (error) {
          throw new Error(`Failed to process reminders: ${error.message}`);
        }

        for (const reminder of reminders) {
          await this.scheduleEventReminder(eventId, reminder);
        }
      }

    } catch (error) {
      this.logger.error('Failed to process event reminders', { error: error.message, eventId });
      throw error;
    }
  }

  async scheduleEventReminder(eventId, reminder) {
    try {
      const notificationId = generateNotificationId();
      const reminderTime = parseDate(reminder.time);

      await this.notificationService.scheduleNotification({
        id: notificationId,
        title: 'Event Reminder',
        body: reminder.message || 'You have an upcoming event',
        data: {
          type: 'event_reminder',
          eventId,
          reminderType: reminder.type
        },
        trigger: {
          date: reminderTime
        }
      });

    } catch (error) {
      this.logger.error('Failed to schedule event reminder', { error: error.message, eventId, reminder });
    }
  }

  async createRecurringEvents(baseEvent) {
    try {
      if (!baseEvent.recurrence_pattern) {
        return;
      }

      const pattern = JSON.parse(baseEvent.recurrence_pattern);
      const recurrenceGroupId = generateNotificationId();
      const maxOccurrences = pattern.count || 52;
      const events = [];

      await supabase
        .from(CALENDAR_TABLE)
        .update({ recurrence_group_id: recurrenceGroupId })
        .eq('id', baseEvent.id);

      let currentDate = parseDate(baseEvent.start_time);
      const duration = parseDate(baseEvent.end_time) - parseDate(baseEvent.start_time);

      for (let i = 1; i < maxOccurrences; i++) {
        currentDate = this.calculateNextOccurrence(currentDate, pattern);
        
        if (pattern.until && currentDate > parseDate(pattern.until)) {
          break;
        }

        const nextEvent = {
          ...baseEvent,
          id: undefined,
          start_time: currentDate.toISOString(),
          end_time: new Date(currentDate.getTime() + duration).toISOString(),
          recurrence_group_id: recurrenceGroupId,
          is_recurring_instance: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        events.push(nextEvent);
      }

      if (events.length > 0) {
        const { error } = await supabase
          .from(CALENDAR_TABLE)
          .insert(events);

        if (error) {
          throw new Error(`Failed to create recurring events: ${error.message}`);
        }
      }

    } catch (error) {
      this.logger.error('Failed to create recurring events', { error: error.message, baseEvent });
      throw error;
    }
  }

  calculateNextOccurrence(currentDate, pattern) {
    const nextDate = new Date(currentDate);

    switch (pattern.frequency) {
      case 'daily':
        nextDate.setDate(nextDate.getDate() + (pattern.interval || 1));
        break;
      case 'weekly':
        nextDate.setDate(nextDate.getDate() + (7 * (pattern.interval || 1)));
        break;
      case 'monthly':
        nextDate.setMonth(nextDate.getMonth() + (pattern.interval || 1));
        break;
      case 'yearly':
        nextDate.setFullYear(nextDate.getFullYear() + (pattern.interval || 1));
        break;
      default:
        nextDate.setDate(nextDate.getDate() + 1);
    }

    return nextDate;
  }

  async syncExternalCalendar(provider, credentials) {
    try {
      this.logger.info('Syncing external calendar', { provider });

      const { data, error } = await supabase.functions.invoke('sync-calendar', {
        body: {
          provider,
          credentials,
          action: 'sync'
        }
      });

      if (error) {
        throw new Error(`Failed to sync external calendar: ${error.message}`);
      }

      this.logger.info('External calendar synced successfully', { provider, syncedEvents: data?.count || 0 });
      return data;

    } catch (error) {
      this.logger.error('Failed to sync external calendar', { error: error.message, provider });
      throw error;
    }
  }

  async getCalendarAnalytics(startDate, endDate) {
    try {
      const { user } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const { data, error } = await supabase.functions.invoke('calendar-analytics', {
        body: {
          userId: user.id,
          startDate,
          endDate
        }
      });

      if (error) {
        throw new Error(`Failed to get calendar analytics: ${error.message}`);
      }

      return data;

    } catch (error) {
      this.logger.error('Failed to get calendar analytics', { error: error.message, startDate, endDate });
      throw error;
    }
  }

  async searchEvents(query, filters = {}) {
    try {
      this.logger.info('Searching calendar events', { query, filters });

      const { user } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let dbQuery = supabase
        .from(CALENDAR_TABLE)
        .select(`
          *,
          attendees:${ATTENDEES_TABLE}(*),
          reminders:${REMINDERS_TABLE}(*)
        `)
        .eq('user_id', user.id);

      if (query) {
        dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%,location.ilike.%${query}%`);
      }

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          dbQuery = dbQuery.eq(key, value);
        }
      });

      dbQuery = dbQuery.order('start_time', { ascending: true }).limit(50);

      const { data: events, error } = await dbQuery;

      if (error) {
        throw new Error(`Failed to search events: ${error.message}`);
      }

      this.logger.info('Event search completed', { query, resultsCount: events?.length || 0 });
      return events || [];

    } catch (error) {
      this.logger.error('Failed to search events', { error: error.message, query, filters });
      throw error;
    }
  }

  async getConflictingEvents(startTime, endTime, excludeEventId = null) {
    try {
      const { user } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      let query = supabase
        .from(CALENDAR_TABLE)
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'scheduled')
        .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`);

      if (excludeEventId) {
        query = query.neq('id', excludeEventId);
      }

      const { data: conflicts, error } = await query;

      if (error) {
        throw new Error(`Failed to check for conflicts: ${error.message}`);
      }

      return conflicts || [];

    } catch (error) {
      this.logger.error('Failed to get conflicting events', { error: error.message, startTime, endTime });
      throw error;
    }
  }

  async bulkUpdateEvents(eventIds, updateData) {
    try {
      this.logger.info('Bulk updating calendar events', { eventIds, updateData });

      const { user } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('User not authenticated');
      }

      const updatePayload = {
        ...updateData,
        updated_at: new Date().toISOString(),
        sync_status: 'pending'
      };

      const { data: events, error } = await supabase
        .from(CALENDAR_TABLE)
        .update(updatePayload)
        .in('id', eventIds)
        .eq('user_id', user.id)
        .select('*');

      if (error) {
        throw new Error(`Failed to bulk update events: ${error.message}`);
      }

      for (const eventId of eventIds) {
        await this.syncService.scheduleSync('calendar', eventId);
      }

      this.logger.info('Bulk update completed', { updatedCount: events?.length || 0 });
      return events;

    } catch (error) {
      this.logger.error('Failed to bulk update events', { error: error.message, eventIds, updateData });
      throw error;
    }
  }
}

export default CalendarService.getInstance();
```