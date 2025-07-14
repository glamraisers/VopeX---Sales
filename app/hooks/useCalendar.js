app/hooks/useCalendar.js


import { useEffect, useState, useCallback } from 'react';
import { useSupabaseClient } from '@supabase/auth-helpers-react';
import { startOfMonth, endOfMonth, format, parseISO } from 'date-fns';
import { Alert } from 'react-native';

const useCalendar = (selectedDate = new Date()) => {
  const supabase = useSupabaseClient();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const start = format(startOfMonth(selectedDate), 'yyyy-MM-dd');
      const end = format(endOfMonth(selectedDate), 'yyyy-MM-dd');

      const { data, error: fetchError } = await supabase
        .from('events')
        .select('*')
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: true });

      if (fetchError) throw fetchError;

      const parsedEvents = data.map(event => ({
        ...event,
        date: parseISO(event.date),
      }));

      setEvents(parsedEvents);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load calendar events.');
      Alert.alert('Error', 'Failed to load calendar events. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedDate]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    events,
    loading,
    error,
    refetch: fetchEvents,
  };
};

export default useCalendar;