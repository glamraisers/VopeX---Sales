app/hooks/useScraper.js

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const useScraper = () => {
  const { session } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extractedData, setExtractedData] = useState(null);

  const scrapeAndExtract = useCallback(async (input, context = '') => {
    setIsLoading(true);
    setError(null);
    setExtractedData(null);

    try {
      if (!input) {
        throw new Error('Input text is required for scraping');
      }

      if (!session?.access_token) {
        throw new Error('User not authenticated');
      }

      // Call edge function for scraping and AI extraction
      const { data, error: supabaseError } = await supabase.functions.invoke(
        'scrape-and-extract',
        {
          body: JSON.stringify({
            text: input,
            context,
            user_id: session.user.id,
          }),
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (supabaseError) {
        throw new Error(supabaseError.message || 'Edge function invocation failed');
      }

      if (!data || data.error) {
        throw new Error(data?.error || 'No data returned from extraction service');
      }

      // Validate and normalize response
      const normalizedData = normalizeExtractedData(data);
      setExtractedData(normalizedData);
      return normalizedData;
    } catch (err) {
      console.error('Scraping error:', err);
      setError(err.message || 'Failed to extract data');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [session]);

  // Reset hook state
  const reset = useCallback(() => {
    setIsLoading(false);
    setError(null);
    setExtractedData(null);
  }, []);

  return {
    scrapeAndExtract,
    extractedData,
    isLoading,
    error,
    reset,
  };
};

// Helper function to validate and normalize extracted data
const normalizeExtractedData = (data) => {
  // Basic validation
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid data format from extraction service');
  }

  // Normalize contact info structure
  if (data.contact_info) {
    return {
      ...data,
      contact_info: {
        name: data.contact_info.name || '',
        email: data.contact_info.email || '',
        phone: data.contact_info.phone || '',
        company: data.contact_info.company || '',
      },
    };
  }

  // Normalize key entities
  const entities = data.entities || {};
  return {
    ...data,
    entities: {
      products: Array.isArray(entities.products) ? entities.products : [],
      dates: Array.isArray(entities.dates) ? entities.dates : [],
      prices: Array.isArray(entities.prices) ? entities.prices : [],
      urls: Array.isArray(entities.urls) ? entities.urls : [],
    },
  };
};

export default useScraper;