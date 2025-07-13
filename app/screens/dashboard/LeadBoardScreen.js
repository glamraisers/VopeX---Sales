app/screens/dashboard/LeadBoardScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import { SafeAreaView, FlatList, RefreshControl, ActivityIndicator, Text, View } from 'react-native';
import { Appbar, List, FAB } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import { tw } from 'lib/tailwind';
import supabase from 'lib/supabase';

const LeadBoardScreen = ({ navigation }) => {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchLeads = async () => {
    try {
      const { data, error: fetchError } = await supabase
        .from('leads')
        .select('id, name, company, score, status, created_at')
        .order('score', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;
      setLeads(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching leads:', err);
      setError('Failed to load leads. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchLeads();
      return () => {};
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchLeads();
  };

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'new': return '#10B981';
      case 'contacted': return '#3B82F6';
      case 'converted': return '#8B5CF6';
      default: return '#6B7280';
    }
  };

  const renderLeadItem = ({ item }) => (
    <List.Item
      title={item.name}
      description={`${item.company} • Score: ${item.score}`}
      left={props => (
        <View style={tw`items-center justify-center`}>
          <View 
            style={[
              tw`w-12 h-12 rounded-full items-center justify-center bg-blue-100`, 
              { backgroundColor: getStatusColor(item.status) + '20' }
            ]}
          >
            <Text style={[tw`font-bold text-lg`, { color: getStatusColor(item.status) }]}>
              {item.name.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>
      )}
      right={props => (
        <View style={tw`items-end justify-center pr-2`}>
          <Text style={tw`text-xs text-gray-500`}>
            {new Date(item.created_at).toLocaleDateString()}
          </Text>
          <View 
            style={[
              tw`mt-1 px-2 py-1 rounded-full`, 
              { backgroundColor: getStatusColor(item.status) + '20' }
            ]}
          >
            <Text style={[tw`text-xs font-medium`, { color: getStatusColor(item.status) }]}>
              {item.status}
            </Text>
          </View>
        </View>
      )}
      style={tw`py-4 border-b border-gray-100`}
      titleStyle={tw`font-bold text-gray-800`}
      descriptionStyle={tw`text-gray-500`}
      onPress={() => navigation.navigate('LeadDetail', { leadId: item.id })}
    />
  );

  const renderEmptyState = () => (
    <View style={tw`flex-1 items-center justify-center p-8`}>
      <List.Icon icon="clipboard-alert" color="#9CA3AF" size={48} />
      <Text style={tw`text-lg font-medium text-gray-500 mt-4`}>
        No leads found
      </Text>
      <Text style={tw`text-center text-gray-400 mt-2`}>
        Start by adding new leads or check your connection
      </Text>
    </View>
  );

  const renderErrorState = () => (
    <View style={tw`flex-1 items-center justify-center p-8`}>
      <List.Icon icon="alert-circle" color="#EF4444" size={48} />
      <Text style={tw`text-lg font-medium text-gray-700 mt-4`}>
        Couldn't load leads
      </Text>
      <Text style={tw`text-center text-gray-500 mt-2 mb-6`}>
        {error}
      </Text>
      <FAB
        icon="reload"
        label="Retry"
        onPress={fetchLeads}
        style={tw`bg-blue-600`}
        color="white"
      />
    </View>
  );

  return (
    <SafeAreaView style={tw`flex-1 bg-gray-50`}>
      <Appbar.Header style={tw`bg-white shadow`}>
        <Appbar.Content title="Lead Board" titleStyle={tw`font-bold`} />
        <Appbar.Action 
          icon="magnify" 
          onPress={() => navigation.navigate('LeadSearch')} 
        />
      </Appbar.Header>

      {loading && !refreshing ? (
        <View style={tw`flex-1 items-center justify-center`}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : error ? (
        renderErrorState()
      ) : (
        <FlatList
          data={leads}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderLeadItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#3B82F6']}
              tintColor="#3B82F6"
            />
          }
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={leads.length === 0 ? tw`flex-1` : tw`pb-20`}
        />
      )}

      <FAB
        icon="plus"
        style={tw`absolute right-4 bottom-4 bg-blue-600`}
        color="white"
        onPress={() => navigation.navigate('AddLead')}
      />
    </SafeAreaView>
  );
};

export default LeadBoardScreen;