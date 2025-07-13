app/components/CampaignCard.js

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, Text, Button, ProgressBar, Chip, useTheme } from 'react-native-paper';
import { format, parseISO } from 'date-fns';
import { tw } from '../lib/tailwind';

const CampaignCard = ({ 
  campaign, 
  onEdit, 
  onDelete, 
  onViewAnalytics,
  onToggleStatus 
}) => {
  const theme = useTheme();
  const { 
    id, 
    name, 
    status, 
    target_audience, 
    start_date, 
    end_date, 
    progress = 0,
    analytics_available = false,
    budget = 0,
    impressions = 0,
    clicks = 0
  } = campaign;

  // Format dates
  const formattedStartDate = format(parseISO(start_date), 'MMM d, yyyy');
  const formattedEndDate = format(parseISO(end_date), 'MMM d, yyyy');

  // Status configuration
  const statusConfig = {
    draft: { label: 'Draft', color: '#9E9E9E', icon: 'pencil' },
    active: { label: 'Active', color: '#4CAF50', icon: 'play' },
    paused: { label: 'Paused', color: '#FF9800', icon: 'pause' },
    completed: { label: 'Completed', color: '#2196F3', icon: 'check' },
    archived: { label: 'Archived', color: '#757575', icon: 'archive' },
  };
  
  const currentStatus = statusConfig[status] || statusConfig.draft;
  
  // Calculate engagement rate if possible
  const engagementRate = impressions > 0 
    ? `${((clicks / impressions) * 100).toFixed(1)}%` 
    : 'N/A';

  return (
    <Card style={tw('mb-4')} mode="elevated">
      <Card.Content style={tw('pb-2')}>
        <View style={tw('flex-row justify-between items-start mb-2')}>
          <Text variant="titleMedium" style={tw('flex-1 pr-2')}>{name}</Text>
          <Chip 
            icon={currentStatus.icon}
            textStyle={tw('text-white')}
            style={{ 
              backgroundColor: currentStatus.color,
              ...styles.statusChip 
            }}
          >
            {currentStatus.label}
          </Chip>
        </View>
        
        <View style={tw('flex-row justify-between mb-1')}>
          <Text variant="bodyMedium" style={tw('text-gray-600')}>
            {formattedStartDate} - {formattedEndDate}
          </Text>
          <Text variant="bodyMedium" style={tw('text-gray-600')}>
            ${budget.toLocaleString()}
          </Text>
        </View>
        
        {target_audience && (
          <Text variant="bodySmall" style={tw('text-gray-500 mb-2')}>
            Target: {target_audience}
          </Text>
        )}
        
        {status === 'active' && (
          <View style={tw('mb-2')}>
            <View style={tw('flex-row justify-between mb-1')}>
              <Text variant="bodySmall" style={tw('text-gray-500')}>
                Progress
              </Text>
              <Text variant="bodySmall" style={tw('text-gray-500')}>
                {Math.round(progress)}%
              </Text>
            </View>
            <ProgressBar 
              progress={progress / 100} 
              color={theme.colors.primary} 
              style={tw('h-2 rounded-full')}
            />
          </View>
        )}
        
        <View style={tw('flex-row justify-between mt-1')}>
          <Text variant="bodySmall" style={tw('text-gray-500')}>
            Impressions: {impressions.toLocaleString()}
          </Text>
          <Text variant="bodySmall" style={tw('text-gray-500')}>
            CTR: {engagementRate}
          </Text>
        </View>
      </Card.Content>
      
      <Card.Actions style={tw('justify-between px-3 py-2')}>
        <View style={tw('flex-row')}>
          <Button 
            mode="outlined" 
            compact
            onPress={() => onToggleStatus(id)}
            style={tw('mr-2')}
            icon={status === 'active' ? 'pause' : 'play'}
          >
            {status === 'active' ? 'Pause' : 'Activate'}
          </Button>
          
          {status === 'draft' && (
            <Button 
              mode="outlined" 
              compact
              onPress={() => onEdit(id)}
              style={tw('mr-2')}
              icon="pencil"
            >
              Edit
            </Button>
          )}
        </View>
        
        <View style={tw('flex-row')}>
          <Button 
            mode="contained-tonal" 
            compact
            onPress={() => onViewAnalytics(id)}
            disabled={!analytics_available}
            icon="chart-bar"
          >
            Analytics
          </Button>
          
          {(status === 'draft' || status === 'paused') && (
            <Button 
              mode="text" 
              compact
              onPress={() => onDelete(id)}
              textColor={theme.colors.error}
              style={tw('ml-2')}
              icon="delete"
            >
              Delete
            </Button>
          )}
        </View>
      </Card.Actions>
    </Card>
  );
};

const styles = StyleSheet.create({
  statusChip: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CampaignCard;