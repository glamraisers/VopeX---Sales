app/components/Chart.js

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, Dimensions } from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { useTailwind } from 'tailwind-rn';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { format } from 'date-fns';

const Chart = ({ chartType, dateRange = 'month', title, chartConfig }) => {
  const tailwind = useTailwind();
  const { user } = useAuth();
  
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const screenWidth = Dimensions.get('window').width;
  
  // Default chart configuration
  const defaultConfig = {
    backgroundColor: '#ffffff',
    backgroundGradientFrom: '#ffffff',
    backgroundGradientTo: '#ffffff',
    decimalPlaces: 2,
    color: (opacity = 1) => `rgba(98, 0, 238, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '6',
      strokeWidth: '2',
      stroke: '#6200EE',
    },
  };
  
  const finalChartConfig = { ...defaultConfig, ...chartConfig };
  
  // Get date range parameters
  const getDateRange = useCallback(() => {
    const now = new Date();
    let startDate, endDate;
    
    switch (dateRange) {
      case 'week':
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (6 - now.getDay()));
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        startDate = new Date(now.getFullYear(), quarter * 3, 1);
        endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      case 'year':
        startDate = new Date(now.getFullYear(), 0, 1);
        endDate = new Date(now.getFullYear(), 11, 31);
        break;
      default: // month
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }
    
    return {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
    };
  }, [dateRange]);
  
  // Fetch chart data from Supabase
  const fetchChartData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { start, end } = getDateRange();
      
      let data;
      switch (chartType) {
        case 'sales':
          const { data: salesData, error: salesError } = await supabase
            .from('sales')
            .select('created_at, amount')
            .eq('user_id', user.id)
            .gte('created_at', `${start}T00:00:00`)
            .lte('created_at', `${end}T23:59:59`)
            .order('created_at', { ascending: true });
          
          if (salesError) throw salesError;
          
          data = salesData.reduce((acc, sale) => {
            const date = format(new Date(sale.created_at), 'MMM dd');
            if (!acc[date]) {
              acc[date] = 0;
            }
            acc[date] += sale.amount;
            return acc;
          }, {});
          
          setChartData({
            labels: Object.keys(data),
            datasets: [
              { data: Object.values(data) }
            ]
          });
          break;
          
        case 'revenue':
          const { data: revenueData, error: revenueError } = await supabase
            .from('transactions')
            .select('date, amount, type')
            .eq('user_id', user.id)
            .gte('date', `${start}T00:00:00`)
            .lte('date', `${end}T23:59:59`);
          
          if (revenueError) throw revenueError;
          
          data = revenueData.reduce((acc, transaction) => {
            const date = format(new Date(transaction.date), 'MMM dd');
            if (!acc[date]) {
              acc[date] = { income: 0, expense: 0 };
            }
            if (transaction.type === 'income') {
              acc[date].income += transaction.amount;
            } else {
              acc[date].expense += transaction.amount;
            }
            return acc;
          }, {});
          
          setChartData({
            labels: Object.keys(data),
            datasets: [
              { data: Object.values(data).map(d => d.income), color: () => '#4CAF50' },
              { data: Object.values(data).map(d => d.expense), color: () => '#F44336' }
            ]
          });
          break;
          
        case 'categories':
          const { data: categoryData, error: categoryError } = await supabase
            .from('sales')
            .select('category, amount')
            .eq('user_id', user.id)
            .gte('created_at', `${start}T00:00:00`)
            .lte('created_at', `${end}T23:59:59`);
          
          if (categoryError) throw categoryError;
          
          data = categoryData.reduce((acc, sale) => {
            if (!acc[sale.category]) {
              acc[sale.category] = 0;
            }
            acc[sale.category] += sale.amount;
            return acc;
          }, {});
          
          const colors = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#E91E63'];
          const pieData = Object.entries(data).map(([name, value], index) => ({
            name,
            value,
            color: colors[index % colors.length],
            legendFontColor: '#7F7F7F',
            legendFontSize: 12
          }));
          
          setChartData(pieData);
          break;
          
        default:
          throw new Error(`Invalid chart type: ${chartType}`);
      }
    } catch (err) {
      console.error('Error fetching chart data:', err);
      setError('Failed to load chart data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [chartType, dateRange, user.id, getDateRange]);
  
  // Fetch data on mount and when dependencies change
  useEffect(() => {
    fetchChartData();
  }, [fetchChartData]);
  
  // Render appropriate chart based on type
  const renderChart = () => {
    if (loading) {
      return (
        <View style={tailwind('h-64 justify-center items-center')}>
          <ActivityIndicator size="large" color="#6200EE" />
          <Text style={tailwind('mt-4 text-gray-600')}>Loading chart data...</Text>
        </View>
      );
    }
    
    if (error) {
      return (
        <View style={tailwind('h-64 justify-center items-center px-4')}>
          <Text style={tailwind('text-red-500 text-center')}>{error}</Text>
          <Button
            mode="outlined"
            onPress={fetchChartData}
            style={tailwind('mt-4')}
          >
            Retry
          </Button>
        </View>
      );
    }
    
    if (!chartData) return null;
    
    switch (chartType) {
      case 'sales':
      case 'revenue':
        return (
          <LineChart
            data={chartData}
            width={screenWidth - 32}
            height={220}
            chartConfig={finalChartConfig}
            bezier
            style={tailwind('rounded-xl mt-2')}
            withVerticalLines={false}
          />
        );
        
      case 'categories':
        return (
          <PieChart
            data={chartData}
            width={screenWidth - 32}
            height={220}
            chartConfig={finalChartConfig}
            accessor="value"
            backgroundColor="transparent"
            paddingLeft="15"
            style={tailwind('rounded-xl mt-2')}
            absolute
          />
        );
        
      default:
        return null;
    }
  };
  
  return (
    <View style={tailwind('bg-white rounded-xl p-4 mb-4 shadow-sm')}>
      <View style={tailwind('flex-row justify-between items-center mb-4')}>
        <Text style={tailwind('text-lg font-bold')}>{title || 'Sales Performance'}</Text>
        <Text style={tailwind('text-gray-500')}>
          {dateRange.charAt(0).toUpperCase() + dateRange.slice(1)}
        </Text>
      </View>
      
      {renderChart()}
    </View>
  );
};

export default Chart;