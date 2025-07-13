app/components/PerformanceCard.js

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Card, IconButton } from 'react-native-paper';
import { useTailwind } from 'tailwind-rn';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const PerformanceCard = ({ title, metricKey, icon, color = '#3b82f6' }) => {
  const tailwind = useTailwind();
  const { user } = useAuth();
  const [value, setValue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [trend, setTrend] = useState(0);
  const [comparisonText, setComparisonText] = useState('');

  const fetchPerformanceData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current period data (current month)
      const currentDate = new Date();
      const currentMonth = currentDate.getMonth() + 1;
      const currentYear = currentDate.getFullYear();

      // Get previous period data (previous month)
      const prevDate = new Date(currentDate);
      prevDate.setMonth(prevDate.getMonth() - 1);
      const prevMonth = prevDate.getMonth() + 1;
      const prevYear = prevDate.getFullYear();

      // Query for current period
      const { data: currentData, error: currentError } = await supabase
        .rpc('get_performance_metric', {
          user_id: user.id,
          metric_key: metricKey,
          month_param: currentMonth,
          year_param: currentYear
        });

      if (currentError) throw currentError;

      // Query for previous period
      const { data: prevData, error: prevError } = await supabase
        .rpc('get_performance_metric', {
          user_id: user.id,
          metric_key: metricKey,
          month_param: prevMonth,
          year_param: prevYear
        });

      if (prevError) throw prevError;

      const currentValue = currentData?.[0]?.value || 0;
      const prevValue = prevData?.[0]?.value || 0;

      setValue(currentValue);

      // Calculate trend
      let trendValue = 0;
      if (prevValue > 0) {
        trendValue = ((currentValue - prevValue) / prevValue) * 100;
      } else if (currentValue > 0) {
        trendValue = 100;
      }

      setTrend(trendValue);
      setComparisonText(
        trendValue >= 0 
          ? `+${trendValue.toFixed(1)}% from last month` 
          : `${trendValue.toFixed(1)}% from last month`
      );
    } catch (err) {
      console.error(`Error fetching ${metricKey}:`, err);
      setError('Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceData();
  }, []);

  const formatValue = (val) => {
    if (val === null) return 'N/A';
    
    switch(metricKey) {
      case 'revenue':
        return `$${val.toLocaleString()}`;
      case 'conversion_rate':
        return `${val}%`;
      case 'avg_deal_size':
        return `$${Math.round(val).toLocaleString()}`;
      default:
        return val.toLocaleString();
    }
  };

  return (
    <Card style={tailwind('mb-4')}>
      <Card.Content style={tailwind('pb-3')}>
        <View style={tailwind('flex-row justify-between items-start')}>
          <View style={tailwind('flex-1')}>
            <View style={tailwind('flex-row items-center mb-1')}>
              <View style={[tailwind('p-2 rounded-full mr-2'), { backgroundColor: `${color}20` }]}>
                {icon}
              </View>
              <Text style={tailwind('text-gray-500 font-medium')}>{title}</Text>
            </View>
            
            {loading ? (
              <ActivityIndicator size="small" color={color} style={tailwind('py-2')} />
            ) : error ? (
              <Text style={tailwind('text-red-500 text-sm')}>{error}</Text>
            ) : (
              <>
                <Text style={[tailwind('text-2xl font-bold mt-1 mb-1'), { color }]}>
                  {formatValue(value)}
                </Text>
                <View style={tailwind('flex-row items-center')}>
                  <Text 
                    style={[
                      tailwind('text-sm font-medium'),
                      trend >= 0 ? tailwind('text-green-600') : tailwind('text-red-600')
                    ]}
                  >
                    {comparisonText}
                  </Text>
                </View>
              </>
            )}
          </View>
          
          <IconButton
            icon="refresh"
            size={20}
            color="#9ca3af"
            onPress={fetchPerformanceData}
            style={tailwind('m-0')}
          />
        </View>
      </Card.Content>
    </Card>
  );
};

export default PerformanceCard;