app/services/huggingFaceClient.js


import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const HUGGING_FACE_API_URL = 'https://api-inference.huggingface.co/models';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

class HuggingFaceClient {
  constructor() {
    this.apiKey = null;
    this.requestQueue = [];
    this.isProcessingQueue = false;
    this.rateLimitReset = null;
    this.requestCount = 0;
    this.maxRequestsPerHour = 1000;
  }

  async initialize() {
    try {
      this.apiKey = await AsyncStorage.getItem('huggingface_api_key');
      if (!this.apiKey) {
        throw new Error('Hugging Face API key not found');
      }
    } catch (error) {
      console.warn('HuggingFace API key not configured:', error.message);
    }
  }

  async setApiKey(key) {
    this.apiKey = key;
    await AsyncStorage.setItem('huggingface_api_key', key);
  }

  async checkNetworkConnectivity() {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected && netInfo.isInternetReachable;
  }

  async getCachedResult(cacheKey) {
    try {
      const cached = await AsyncStorage.getItem(`hf_cache_${cacheKey}`);
      if (cached) {
        const { data, timestamp } = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return data;
        }
        await AsyncStorage.removeItem(`hf_cache_${cacheKey}`);
      }
    } catch (error) {
      console.warn('Cache retrieval error:', error);
    }
    return null;
  }

  async setCachedResult(cacheKey, data) {
    try {
      const cacheData = {
        data,
        timestamp: Date.now()
      };
      await AsyncStorage.setItem(`hf_cache_${cacheKey}`, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('Cache storage error:', error);
    }
  }

  generateCacheKey(model, input, parameters = {}) {
    const hashInput = JSON.stringify({ model, input, parameters });
    return btoa(hashInput).replace(/[/+=]/g, '').substring(0, 32);
  }

  async checkRateLimit() {
    if (this.rateLimitReset && Date.now() < this.rateLimitReset) {
      const waitTime = this.rateLimitReset - Date.now();
      throw new Error(`Rate limit exceeded. Reset in ${Math.ceil(waitTime / 1000)}s`);
    }
    
    if (this.requestCount >= this.maxRequestsPerHour) {
      const resetTime = Date.now() + (60 * 60 * 1000);
      this.rateLimitReset = resetTime;
      this.requestCount = 0;
      throw new Error('Hourly rate limit exceeded');
    }
  }

  async makeRequest(url, options, retryCount = 0) {
    try {
      await this.checkRateLimit();
      
      const response = await fetch(url, {
        ...options,
        timeout: 30000,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'User-Agent': `VopeX-Sales/${Platform.OS}`,
          ...options.headers
        }
      });

      this.requestCount++;

      if (response.status === 429) {
        const resetTime = response.headers.get('X-RateLimit-Reset');
        if (resetTime) {
          this.rateLimitReset = parseInt(resetTime) * 1000;
        }
        throw new Error('Rate limit exceeded');
      }

      if (response.status === 503) {
        throw new Error('Model is loading');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      return data;

    } catch (error) {
      if (retryCount < MAX_RETRIES && this.shouldRetry(error)) {
        await this.delay(RETRY_DELAY * Math.pow(2, retryCount));
        return this.makeRequest(url, options, retryCount + 1);
      }
      throw error;
    }
  }

  shouldRetry(error) {
    return error.message.includes('Model is loading') ||
           error.message.includes('network') ||
           error.message.includes('timeout') ||
           error.message.includes('503');
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async textGeneration(input, options = {}) {
    const {
      model = 'microsoft/DialoGPT-medium',
      maxLength = 100,
      temperature = 0.7,
      topK = 50,
      topP = 0.95,
      doSample = true,
      useCache = true
    } = options;

    const cacheKey = this.generateCacheKey(model, input, { maxLength, temperature, topK, topP });
    
    if (useCache) {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) return cached;
    }

    if (!await this.checkNetworkConnectivity()) {
      throw new Error('No internet connection');
    }

    const url = `${HUGGING_FACE_API_URL}/${model}`;
    const payload = {
      inputs: input,
      parameters: {
        max_length: maxLength,
        temperature,
        top_k: topK,
        top_p: topP,
        do_sample: doSample,
        return_full_text: false
      }
    };

    const result = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const processedResult = this.processTextGenerationResult(result);
    
    if (useCache) {
      await this.setCachedResult(cacheKey, processedResult);
    }

    return processedResult;
  }

  processTextGenerationResult(result) {
    if (!result || !Array.isArray(result) || result.length === 0) {
      return { text: '', confidence: 0 };
    }

    const response = result[0];
    return {
      text: response.generated_text?.trim() || '',
      confidence: response.score || 0
    };
  }

  async textClassification(input, options = {}) {
    const {
      model = 'cardiffnlp/twitter-roberta-base-sentiment-latest',
      useCache = true
    } = options;

    const cacheKey = this.generateCacheKey(model, input);
    
    if (useCache) {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) return cached;
    }

    if (!await this.checkNetworkConnectivity()) {
      throw new Error('No internet connection');
    }

    const url = `${HUGGING_FACE_API_URL}/${model}`;
    const payload = { inputs: input };

    const result = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const processedResult = this.processClassificationResult(result);
    
    if (useCache) {
      await this.setCachedResult(cacheKey, processedResult);
    }

    return processedResult;
  }

  processClassificationResult(result) {
    if (!result || !Array.isArray(result) || result.length === 0) {
      return { labels: [], scores: [] };
    }

    const classifications = Array.isArray(result[0]) ? result[0] : result;
    return {
      labels: classifications.map(item => item.label),
      scores: classifications.map(item => item.score),
      topResult: classifications[0] || { label: 'unknown', score: 0 }
    };
  }

  async summarization(input, options = {}) {
    const {
      model = 'facebook/bart-large-cnn',
      maxLength = 150,
      minLength = 30,
      useCache = true
    } = options;

    const cacheKey = this.generateCacheKey(model, input, { maxLength, minLength });
    
    if (useCache) {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) return cached;
    }

    if (!await this.checkNetworkConnectivity()) {
      throw new Error('No internet connection');
    }

    const url = `${HUGGING_FACE_API_URL}/${model}`;
    const payload = {
      inputs: input,
      parameters: {
        max_length: maxLength,
        min_length: minLength,
        do_sample: false
      }
    };

    const result = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const processedResult = this.processSummarizationResult(result);
    
    if (useCache) {
      await this.setCachedResult(cacheKey, processedResult);
    }

    return processedResult;
  }

  processSummarizationResult(result) {
    if (!result || !Array.isArray(result) || result.length === 0) {
      return { summary: '', confidence: 0 };
    }

    const response = result[0];
    return {
      summary: response.summary_text?.trim() || '',
      confidence: response.score || 0
    };
  }

  async questionAnswering(question, context, options = {}) {
    const {
      model = 'deepset/roberta-base-squad2',
      useCache = true
    } = options;

    const input = { question, context };
    const cacheKey = this.generateCacheKey(model, input);
    
    if (useCache) {
      const cached = await this.getCachedResult(cacheKey);
      if (cached) return cached;
    }

    if (!await this.checkNetworkConnectivity()) {
      throw new Error('No internet connection');
    }

    const url = `${HUGGING_FACE_API_URL}/${model}`;
    const payload = {
      inputs: {
        question,
        context
      }
    };

    const result = await this.makeRequest(url, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const processedResult = this.processQuestionAnsweringResult(result);
    
    if (useCache) {
      await this.setCachedResult(cacheKey, processedResult);
    }

    return processedResult;
  }

  processQuestionAnsweringResult(result) {
    if (!result || typeof result !== 'object') {
      return { answer: '', confidence: 0, start: 0, end: 0 };
    }

    return {
      answer: result.answer?.trim() || '',
      confidence: result.score || 0,
      start: result.start || 0,
      end: result.end || 0
    };
  }

  async getModelInfo(modelName) {
    const cacheKey = `model_info_${modelName}`;
    const cached = await this.getCachedResult(cacheKey);
    if (cached) return cached;

    if (!await this.checkNetworkConnectivity()) {
      throw new Error('No internet connection');
    }

    const url = `https://huggingface.co/api/models/${modelName}`;
    
    const result = await this.makeRequest(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`
      }
    });

    await this.setCachedResult(cacheKey, result);
    return result;
  }

  async batchProcess(requests, options = {}) {
    const {
      concurrency = 3,
      delayBetweenRequests = 100
    } = options;

    const results = [];
    const chunks = [];
    
    for (let i = 0; i < requests.length; i += concurrency) {
      chunks.push(requests.slice(i, i + concurrency));
    }

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (request, index) => {
        if (index > 0) {
          await this.delay(delayBetweenRequests * index);
        }
        
        try {
          const { method, ...params } = request;
          return await this[method](...Object.values(params));
        } catch (error) {
          console.error(`Batch request failed:`, error);
          return { error: error.message };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      results.push(...chunkResults);
    }

    return results;
  }

  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('hf_cache_'));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  async getCacheSize() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('hf_cache_'));
      return cacheKeys.length;
    } catch (error) {
      console.error('Cache size check error:', error);
      return 0;
    }
  }

  getRequestStats() {
    return {
      requestCount: this.requestCount,
      rateLimitReset: this.rateLimitReset,
      maxRequestsPerHour: this.maxRequestsPerHour
    };
  }

  resetRequestStats() {
    this.requestCount = 0;
    this.rateLimitReset = null;
  }
}

export default new HuggingFaceClient();
```