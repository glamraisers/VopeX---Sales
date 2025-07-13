app/screens/dashboard/CampaignScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { useTailwind } from 'tailwind-rn';
import { Card, Button, IconButton } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';

const CampaignScreen = () => {
  const tailwind = useTailwind();
  const navigation = useNavigation();
  const [campaigns, setCampaigns] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: supabaseError } = await supabase
        .from('campaigns')
        .select('id, name, status, target_audience, start_date, end_date, budget')
        .order('created_at', { ascending: false });

      if (supabaseError) {
        throw new Error(`Failed to fetch campaigns: ${supabaseError.message}`);
      }

      setCampaigns(data || []);
    } catch (err) {
      console.error('Campaign fetch error:', err);
      setError(err.message || 'Failed to load campaigns');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchCampaigns();
  }, [fetchCampaigns]);

  const navigateToCampaignDetail = (campaignId) => {
    navigation.navigate('CampaignDetail', { campaignId });
  };

  const navigateToCreateCampaign = () => {
    navigation.navigate('CreateCampaign');
  };

  const renderCampaignItem = ({ item }) => (
    <Card 
      style={tailwind('mb-4 mx-4')}
      onPress={() => navigateToCampaignDetail(item.id)}
    >
      <Card.Content>
        <View style={tailwind('flex-row justify-between items-center')}>
          <Text style={tailwind('text-lg font-bold')}>{item.name}</Text>
          <Text 
            style={[
              tailwind('text-xs px-2 py-1 rounded-full'),
              item.status === 'active' ? tailwind('bg-green-100 text-green-800') : 
              item.status === 'paused' ? tailwind('bg-yellow-100 text-yellow-800') : 
              tailwind('bg-gray-100 text-gray-800')
            ]}
          >
            {item.status.toUpperCase()}
          </Text>
        </View>
        
        <Text style={tailwind('mt-2 text-gray-600')}>
          Audience: {item.target_audience || 'N/A'}
        </Text>
        
        <View style={tailwind('flex-row justify-between mt-3')}>
          <Text style={tailwind('text-sm text-gray-500')}>
            {new Date(item.start_date).toLocaleDateString()} - {item.end_date ? new Date(item.end_date).toLocaleDateString() : 'Ongoing'}
          </Text>
          <Text style={tailwind('text-sm font-semibold')}>${item.budget}</Text>
        </View>
      </Card.Content>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={tailwind('flex-1 justify-center items-center px-8')}>
      <Text style={tailwind('text-xl text-center text-gray-500 mb-4')}>
        No campaigns found
      </Text>
      <Button 
        mode="contained" 
        onPress={navigateToCreateCampaign}
        style={tailwind('rounded-full')}
      >
        Create Your First Campaign
      </Button>
    </View>
  );

  const renderErrorState = () => (
    <View style={tailwind('flex-1 justify-center items-center px-8')}>
      <Text style={tailwind('text-lg text-center text-red-500 mb-4')}>
        {error}
      </Text>
      <Button 
        mode="outlined" 
        onPress={fetchCampaigns}
        style={tailwind('rounded-full')}
      >
        Retry
      </Button>
    </View>
  );

  const renderContent = () => {
    if (isLoading && !isRefreshing) {
      return (
        <View style={tailwind('flex-1 justify-center items-center')}>
          <ActivityIndicator size="large" />
        </View>
      );
    }

    if (error) {
      return renderErrorState();
    }

    if (campaigns.length === 0) {
      return renderEmptyState();
    }

    return (
      <FlatList
        data={campaigns}
        renderItem={renderCampaignItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={tailwind('py-4')}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
          />
        }
      />
    );
  };

  return (
    <View style={tailwind('flex-1 bg-gray-50')}>
      <View style={tailwind('flex-row justify-between items-center px-4 py-3 bg-white border-b border-gray-200')}>
        <Text style={tailwind('text-2xl font-bold')}>Campaigns</Text>
        <IconButton
          icon="plus"
          size={24}
          onPress={navigateToCreateCampaign}
          style={tailwind('bg-blue-500 rounded-full')}
          iconColor="white"
        />
      </View>

      {renderContent()}
    </View>
  );
};

export default CampaignScreen;