app/screens/dashboard/CalendarScreen.js

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  Alert,
  Platform,
  Dimensions,
  StyleSheet,
} from 'react-native';
import {
  Surface,
  Card,
  Title,
  Paragraph,
  Button,
  FAB,
  Chip,
  Avatar,
  ActivityIndicator,
  Snackbar,
  Menu,
  IconButton,
  Divider,
  Badge,
  Portal,
  Modal,
  TextInput,
  HelperText,
} from 'react-native-paper';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { format, parseISO, isToday, isTomorrow, isYesterday, addDays, startOfDay, endOfDay } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { tw } from '../../lib/tailwind';

// Configure calendar locale
LocaleConfig.locales['en'] = {
  monthNames: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],
  monthNamesShort: [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ],
  dayNames: [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
  ],
  dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  today: 'Today'
};
LocaleConfig.defaultLocale = 'en';

const { width } = Dimensions.get('window');

const CalendarScreen = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  
  // State management
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // 'month', 'week', 'day'
  const [menuVisible, setMenuVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all', 'meetings', 'calls', 'tasks'
  const [createEventModalVisible, setCreateEventModalVisible] = useState(false);
  const [newEventData, setNewEventData] = useState({
    title: '',
    description: '',
    date: selectedDate,
    time: '',
    type: 'meeting',
    priority: 'medium',
    clientId: null,
    duration: 60,
  });
  const [validationErrors, setValidationErrors] = useState({});

  // Fetch events from Supabase
  const fetchEvents = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('calendar_events')
        .select(`
          *,
          client:clients(id, name, company),
          lead:leads(id, name, company)
        `)
        .eq('user_id', user.id)
        .gte('date', format(addDays(new Date(), -30), 'yyyy-MM-dd'))
        .lte('date', format(addDays(new Date(), 90), 'yyyy-MM-dd'))
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (fetchError) throw fetchError;

      setEvents(data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
      setError('Failed to load calendar events. Please try again.');
      showSnackbar('Failed to load calendar events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user.id]);

  // Refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEvents(false);
  }, [fetchEvents]);

  // Focus effect to refresh data when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchEvents();
    }, [fetchEvents])
  );

  // Memoized filtered events
  const filteredEvents = useMemo(() => {
    let filtered = events;

    if (filterType !== 'all') {
      filtered = filtered.filter(event => event.type === filterType);
    }

    return filtered;
  }, [events, filterType]);

  // Memoized events for selected date
  const selectedDateEvents = useMemo(() => {
    return filteredEvents.filter(event => event.date === selectedDate);
  }, [filteredEvents, selectedDate]);

  // Memoized marked dates for calendar
  const markedDates = useMemo(() => {
    const marked = {};
    
    filteredEvents.forEach(event => {
      if (!marked[event.date]) {
        marked[event.date] = {
          marked: true,
          dots: [],
        };
      }
      
      const color = getEventTypeColor(event.type);
      marked[event.date].dots.push({ color });
    });

    // Mark selected date
    if (marked[selectedDate]) {
      marked[selectedDate].selected = true;
      marked[selectedDate].selectedColor = '#6200EE';
    } else {
      marked[selectedDate] = {
        selected: true,
        selectedColor: '#6200EE',
      };
    }

    return marked;
  }, [filteredEvents, selectedDate]);

  // Get event type color
  const getEventTypeColor = (type) => {
    switch (type) {
      case 'meeting': return '#4CAF50';
      case 'call': return '#2196F3';
      case 'task': return '#FF9800';
      case 'follow-up': return '#9C27B0';
      default: return '#757575';
    }
  };

  // Get priority color
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#4CAF50';
      default: return '#757575';
    }
  };

  // Format event time display
  const formatEventTime = (time) => {
    if (!time) return '';
    return format(parseISO(`2000-01-01T${time}`), 'h:mm a');
  };

  // Format date display
  const formatDateDisplay = (date) => {
    const eventDate = parseISO(date);
    
    if (isToday(eventDate)) return 'Today';
    if (isTomorrow(eventDate)) return 'Tomorrow';
    if (isYesterday(eventDate)) return 'Yesterday';
    
    return format(eventDate, 'MMM d, yyyy');
  };

  // Show snackbar
  const showSnackbar = (message) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Validate new event data
  const validateEventData = () => {
    const errors = {};

    if (!newEventData.title.trim()) {
      errors.title = 'Title is required';
    }

    if (!newEventData.time) {
      errors.time = 'Time is required';
    }

    if (!newEventData.date) {
      errors.date = 'Date is required';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Create new event
  const createEvent = async () => {
    if (!validateEventData()) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('calendar_events')
        .insert([{
          ...newEventData,
          user_id: user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) throw error;

      setEvents(prev => [...prev, data]);
      setCreateEventModalVisible(false);
      setNewEventData({
        title: '',
        description: '',
        date: selectedDate,
        time: '',
        type: 'meeting',
        priority: 'medium',
        clientId: null,
        duration: 60,
      });
      setValidationErrors({});
      showSnackbar('Event created successfully');
    } catch (err) {
      console.error('Error creating event:', err);
      showSnackbar('Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  // Delete event
  const deleteEvent = async (eventId) => {
    Alert.alert(
      'Delete Event',
      'Are you sure you want to delete this event?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('calendar_events')
                .delete()
                .eq('id', eventId);

              if (error) throw error;

              setEvents(prev => prev.filter(event => event.id !== eventId));
              showSnackbar('Event deleted successfully');
            } catch (err) {
              console.error('Error deleting event:', err);
              showSnackbar('Failed to delete event');
            }
          }
        }
      ]
    );
  };

  // Navigate to event details
  const navigateToEventDetails = (event) => {
    navigation.navigate('EventDetails', { eventId: event.id });
  };

  // Event card component
  const EventCard = ({ event }) => (
    <Card style={styles.eventCard} onPress={() => navigateToEventDetails(event)}>
      <Card.Content>
        <View style={styles.eventHeader}>
          <View style={styles.eventInfo}>
            <Title style={styles.eventTitle}>{event.title}</Title>
            <Paragraph style={styles.eventTime}>
              {formatEventTime(event.time)}
              {event.duration && ` • ${event.duration} min`}
            </Paragraph>
          </View>
          <View style={styles.eventActions}>
            <Badge
              style={[
                styles.priorityBadge,
                { backgroundColor: getPriorityColor(event.priority) }
              ]}
            >
              {event.priority}
            </Badge>
            <IconButton
              icon="delete"
              size={20}
              onPress={() => deleteEvent(event.id)}
            />
          </View>
        </View>
        
        {event.description && (
          <Paragraph style={styles.eventDescription}>{event.description}</Paragraph>
        )}
        
        <View style={styles.eventFooter}>
          <Chip
            icon="calendar"
            style={[
              styles.typeChip,
              { backgroundColor: getEventTypeColor(event.type) }
            ]}
            textStyle={styles.typeChipText}
          >
            {event.type}
          </Chip>
          
          {(event.client || event.lead) && (
            <Chip
              icon="account"
              style={styles.clientChip}
            >
              {event.client?.name || event.lead?.name}
            </Chip>
          )}
        </View>
      </Card.Content>
    </Card>
  );

  // Filter chips
  const FilterChips = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.filterContainer}
    >
      {['all', 'meeting', 'call', 'task', 'follow-up'].map((type) => (
        <Chip
          key={type}
          selected={filterType === type}
          onPress={() => setFilterType(type)}
          style={[
            styles.filterChip,
            filterType === type && styles.selectedFilterChip
          ]}
          textStyle={[
            styles.filterChipText,
            filterType === type && styles.selectedFilterChipText
          ]}
        >
          {type === 'all' ? 'All' : type.charAt(0).toUpperCase() + type.slice(1)}
        </Chip>
      ))}
    </ScrollView>
  );

  // Create event modal
  const CreateEventModal = () => (
    <Portal>
      <Modal
        visible={createEventModalVisible}
        onDismiss={() => setCreateEventModalVisible(false)}
        contentContainerStyle={styles.modalContainer}
      >
        <Title style={styles.modalTitle}>Create New Event</Title>
        
        <TextInput
          label="Event Title"
          value={newEventData.title}
          onChangeText={(text) => setNewEventData(prev => ({ ...prev, title: text }))}
          style={styles.input}
          error={!!validationErrors.title}
        />
        <HelperText type="error" visible={!!validationErrors.title}>
          {validationErrors.title}
        </HelperText>
        
        <TextInput
          label="Description"
          value={newEventData.description}
          onChangeText={(text) => setNewEventData(prev => ({ ...prev, description: text }))}
          multiline
          numberOfLines={3}
          style={styles.input}
        />
        
        <TextInput
          label="Time (24-hour format)"
          value={newEventData.time}
          onChangeText={(text) => setNewEventData(prev => ({ ...prev, time: text }))}
          placeholder="14:30"
          style={styles.input}
          error={!!validationErrors.time}
        />
        <HelperText type="error" visible={!!validationErrors.time}>
          {validationErrors.time}
        </HelperText>
        
        <View style={styles.modalActions}>
          <Button
            mode="outlined"
            onPress={() => setCreateEventModalVisible(false)}
            style={styles.modalButton}
          >
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={createEvent}
            style={styles.modalButton}
            loading={loading}
          >
            Create
          </Button>
        </View>
      </Modal>
    </Portal>
  );

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" />
          <Paragraph style={styles.loadingText}>Loading calendar...</Paragraph>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <Surface style={styles.header}>
        <View style={styles.headerContent}>
          <Title style={styles.headerTitle}>Calendar</Title>
          <View style={styles.headerActions}>
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  onPress={() => setMenuVisible(true)}
                />
              }
            >
              <Menu.Item
                onPress={() => {
                  setViewMode('month');
                  setMenuVisible(false);
                }}
                title="Month View"
                leadingIcon="calendar"
              />
              <Menu.Item
                onPress={() => {
                  setViewMode('week');
                  setMenuVisible(false);
                }}
                title="Week View"
                leadingIcon="calendar-week"
              />
              <Menu.Item
                onPress={() => {
                  setViewMode('day');
                  setMenuVisible(false);
                }}
                title="Day View"
                leadingIcon="calendar-today"
              />
            </Menu>
          </View>
        </View>
      </Surface>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Calendar Component */}
        <Calendar
          current={selectedDate}
          onDayPress={(day) => setSelectedDate(day.dateString)}
          markedDates={markedDates}
          markingType="multi-dot"
          theme={{
            backgroundColor: '#ffffff',
            calendarBackground: '#ffffff',
            textSectionTitleColor: '#b6c1cd',
            selectedDayBackgroundColor: '#6200EE',
            selectedDayTextColor: '#ffffff',
            todayTextColor: '#6200EE',
            dayTextColor: '#2d4150',
            textDisabledColor: '#d9e1e8',
            dotColor: '#6200EE',
            selectedDotColor: '#ffffff',
            arrowColor: '#6200EE',
            disabledArrowColor: '#d9e1e8',
            monthTextColor: '#2d4150',
            indicatorColor: '#6200EE',
            textDayFontWeight: '300',
            textMonthFontWeight: 'bold',
            textDayHeaderFontWeight: '300',
            textDayFontSize: 16,
            textMonthFontSize: 16,
            textDayHeaderFontSize: 13,
          }}
          style={styles.calendar}
        />

        {/* Filter Chips */}
        <FilterChips />

        {/* Selected Date Events */}
        <Surface style={styles.eventsSection}>
          <Title style={styles.sectionTitle}>
            {formatDateDisplay(selectedDate)}
            <Badge style={styles.eventCount}>{selectedDateEvents.length}</Badge>
          </Title>
          
          {selectedDateEvents.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Card.Content style={styles.emptyContent}>
                <Ionicons name="calendar-outline" size={48} color="#ccc" />
                <Paragraph style={styles.emptyText}>
                  No events scheduled for this date
                </Paragraph>
                <Button
                  mode="outlined"
                  onPress={() => setCreateEventModalVisible(true)}
                  style={styles.createButton}
                >
                  Create Event
                </Button>
              </Card.Content>
            </Card>
          ) : (
            selectedDateEvents.map((event) => (
              <EventCard key={event.id} event={event} />
            ))
          )}
        </Surface>

        {/* Upcoming Events */}
        <Surface style={styles.eventsSection}>
          <Title style={styles.sectionTitle}>Upcoming Events</Title>
          {filteredEvents
            .filter(event => event.date > selectedDate)
            .slice(0, 5)
            .map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
        </Surface>
      </ScrollView>

      {/* Floating Action Button */}
      <FAB
        style={styles.fab}
        icon="plus"
        onPress={() => setCreateEventModalVisible(true)}
      />

      {/* Create Event Modal */}
      <CreateEventModal />

      {/* Snackbar */}
      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
        action={{
          label: 'OK',
          onPress: () => setSnackbarVisible(false),
        }}
      >
        {snackbarMessage}
      </Snackbar>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },
  header: {
    elevation: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  calendar: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  filterChip: {
    marginRight: 8,
    backgroundColor: '#e0e0e0',
  },
  selectedFilterChip: {
    backgroundColor: '#6200EE',
  },
  filterChipText: {
    color: '#333',
  },
  selectedFilterChipText: {
    color: '#fff',
  },
  eventsSection: {
    margin: 16,
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  eventCount: {
    marginLeft: 8,
    backgroundColor: '#6200EE',
    color: '#fff',
  },
  eventCard: {
    marginBottom: 12,
    borderRadius: 8,
    elevation: 2,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  eventInfo: {
    flex: 1,
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  eventTime: {
    fontSize: 14,
    color: '#666',
  },
  eventActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  priorityBadge: {
    marginRight: 8,
    color: '#fff',
  },
  eventDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  typeChip: {
    marginRight: 8,
    marginBottom: 4,
  },
  typeChipText: {
    color: '#fff',
    fontSize: 12,
  },
  clientChip: {
    marginRight: 8,
    marginBottom: 4,
    backgroundColor: '#e3f2fd',
  },
  emptyCard: {
    borderRadius: 8,
    elevation: 1,
  },
  emptyContent: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  createButton: {
    marginTop: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#6200EE',
  },
  modalContainer: {
    backgroundColor: '#fff',
    margin: 20,
    padding: 20,
    borderRadius: 8,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    marginHorizontal: 8,
  },
});

export default CalendarScreen;