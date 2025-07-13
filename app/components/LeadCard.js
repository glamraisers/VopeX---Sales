app/components/LeadCard.js

import React, { useState, useCallback } from 'react';
import { View, Text, Alert, Linking, StyleSheet } from 'react-native';
import { Card, IconButton, Menu, Chip, useTheme } from 'react-native-paper';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useTailwind } from 'tailwind-rn';
import { supabase } from '../lib/supabase';

const LeadCard = ({ 
  lead, 
  onEdit, 
  onDelete, 
  onStatusChange,
  onDetailsPress 
}) => {
  const tw = useTailwind();
  const theme = useTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  
  const openMenu = () => setMenuVisible(true);
  const closeMenu = () => setMenuVisible(false);

  const handleCall = useCallback(() => {
    if (!lead.phone) {
      Alert.alert('No Phone', 'This lead does not have a phone number');
      return;
    }
    Linking.openURL(`tel:${lead.phone}`);
  }, [lead.phone]);

  const handleEmail = useCallback(() => {
    if (!lead.email) {
      Alert.alert('No Email', 'This lead does not have an email address');
      return;
    }
    Linking.openURL(`mailto:${lead.email}`);
  }, [lead.email]);

  const handleDelete = useCallback(() => {
    closeMenu();
    Alert.alert(
      'Delete Lead',
      `Are you sure you want to delete ${lead.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDelete(lead.id) }
      ]
    );
  }, [lead.id, lead.name, onDelete]);

  const handleEdit = useCallback(() => {
    closeMenu();
    onEdit(lead);
  }, [lead, onEdit]);

  const handleStatusChange = useCallback((newStatus) => {
    if (onStatusChange) {
      onStatusChange(lead.id, newStatus);
    }
  }, [lead.id, onStatusChange]);

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'new': return theme.colors.primary;
      case 'contacted': return theme.colors.info;
      case 'qualified': return theme.colors.success;
      case 'lost': return theme.colors.error;
      default: return theme.colors.backdrop;
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority.toLowerCase()) {
      case 'high': return theme.colors.error;
      case 'medium': return theme.colors.warning;
      case 'low': return theme.colors.success;
      default: return theme.colors.backdrop;
    }
  };

  const lastContactedText = lead.last_contacted 
    ? formatDistanceToNow(parseISO(lead.last_contacted), { addSuffix: true })
    : 'Never contacted';

  return (
    <Card style={tw('mb-3')} onPress={onDetailsPress}>
      <Card.Content>
        <View style={tw('flex-row justify-between items-start')}>
          <View style={tw('flex-1')}>
            <Text 
              style={tw('text-lg font-bold')} 
              numberOfLines={1} 
              ellipsizeMode="tail"
            >
              {lead.name}
            </Text>
            {lead.company && (
              <Text 
                style={tw('text-base text-gray-600')} 
                numberOfLines={1} 
                ellipsizeMode="tail"
              >
                {lead.company}
              </Text>
            )}
          </View>
          
          <Menu
            visible={menuVisible}
            onDismiss={closeMenu}
            anchor={
              <IconButton 
                icon="dots-vertical" 
                onPress={openMenu} 
                size={20}
              />
            }
          >
            <Menu.Item onPress={handleEdit} title="Edit" leadingIcon="pencil" />
            <Menu.Item 
              onPress={handleDelete} 
              title="Delete" 
              leadingIcon="delete" 
              titleStyle={{ color: theme.colors.error }}
            />
          </Menu>
        </View>

        <View style={tw('mt-2')}>
          {lead.email && (
            <View style={tw('flex-row items-center mt-1')}>
              <IconButton 
                icon="email" 
                size={16} 
                style={tw('m-0 p-0')} 
                onPress={handleEmail}
              />
              <Text 
                style={tw('text-base text-gray-700 ml-1')} 
                numberOfLines={1} 
                ellipsizeMode="tail"
              >
                {lead.email}
              </Text>
            </View>
          )}

          {lead.phone && (
            <View style={tw('flex-row items-center mt-1')}>
              <IconButton 
                icon="phone" 
                size={16} 
                style={tw('m-0 p-0')} 
                onPress={handleCall}
              />
              <Text style={tw('text-base text-gray-700 ml-1')}>
                {lead.phone}
              </Text>
            </View>
          )}
        </View>

        <View style={tw('flex-row flex-wrap mt-3')}>
          <Chip 
            mode="outlined"
            style={[tw('mr-2 mb-2'), { 
              backgroundColor: getStatusColor(lead.status),
              borderColor: getStatusColor(lead.status)
            }]}
            textStyle={tw('text-white')}
          >
            {lead.status}
          </Chip>
          
          {lead.priority && (
            <Chip 
              mode="outlined"
              style={[tw('mr-2 mb-2'), { 
                backgroundColor: getPriorityColor(lead.priority),
                borderColor: getPriorityColor(lead.priority)
              }]}
              textStyle={tw('text-white')}
            >
              {lead.priority} Priority
            </Chip>
          )}
          
          {lead.score && (
            <Chip 
              mode="outlined"
              style={tw('mr-2 mb-2')}
              textStyle={tw('text-gray-700')}
            >
              Score: {lead.score}
            </Chip>
          )}
        </View>

        <View style={tw('mt-2 flex-row justify-between items-center')}>
          <Text style={tw('text-sm text-gray-500')}>
            {lastContactedText}
          </Text>
          
          <Text style={tw('text-sm text-gray-500')}>
            Created: {formatDistanceToNow(parseISO(lead.created_at), { addSuffix: true })}
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
};

export default React.memo(LeadCard);