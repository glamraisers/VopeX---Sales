app/components/Calendar.js

import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useTailwind } from 'tailwind-rn';
import { parseISO } from 'date-fns';

const CalendarComponent = ({ 
  events = [], 
  selectedDate, 
  onDayPress,
  theme = {},
  dotColor = '#4CAF50',
  selectedColor = '#2196F3'
}) => {
  const tailwind = useTailwind();

  // Generate marked dates with events and selection
  const markedDates = useMemo(() => {
    const marked = {};
    
    // Mark all dates with events
    events.forEach(event => {
      const date = event.start_time.split('T')[0];
      if (!marked[date]) {
        marked[date] = {
          marked: true,
          dotColor,
          selected: date === selectedDate,
          selectedColor
        };
      }
    });

    // Ensure selected date is marked
    if (!marked[selectedDate]) {
      marked[selectedDate] = {
        selected: true,
        selectedColor
      };
    } else {
      marked[selectedDate] = {
        ...marked[selectedDate],
        selected: true,
        selectedColor
      };
    }

    return marked;
  }, [events, selectedDate, dotColor, selectedColor]);

  // Combine default and custom theme
  const calendarTheme = useMemo(() => ({
    selectedDayBackgroundColor: selectedColor,
    todayTextColor: '#4CAF50',
    arrowColor: selectedColor,
    ...theme
  }), [theme, selectedColor]);

  return (
    <View style={[styles.calendarContainer, tailwind('p-4 bg-white rounded-lg shadow-sm')]}>
      <Calendar
        current={selectedDate}
        onDayPress={onDayPress}
        markedDates={markedDates}
        theme={calendarTheme}
        style={styles.calendar}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  calendarContainer: {
    overflow: 'hidden',
  },
  calendar: {
    borderRadius: 8,
  }
});

export default CalendarComponent;