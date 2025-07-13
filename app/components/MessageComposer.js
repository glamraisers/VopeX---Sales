app/components/MessageComposer.js

import React, { useState, useRef, useEffect } from 'react';
import { View, TextInput, StyleSheet, Keyboard } from 'react-native';
import { Button, IconButton, Menu, ActivityIndicator } from 'react-native-paper';
import { tw } from '../lib/tailwind';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

const MessageComposer = ({ conversationId, onMessageSent, onAIGenerate }) => {
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const inputRef = useRef(null);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;

    setIsSending(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .insert([
          {
            content: message.trim(),
            conversation_id: conversationId,
            sender_id: user.id,
            is_ai_generated: false,
          }
        ])
        .select()
        .single();

      if (error) throw error;

      onMessageSent(data);
      setMessage('');
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!message.trim() || aiLoading) return;

    setAiLoading(true);
    setMenuVisible(false);
    
    try {
      await onAIGenerate(message.trim());
      setMessage('');
      Keyboard.dismiss();
    } catch (error) {
      console.error('Error generating AI response:', error);
    } finally {
      setAiLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    const actions = {
      greeting: "Hello! How can I assist you today?",
      followup: "Could you provide more details about this?",
      closing: "Thank you for your time. Let me know if you need anything else!"
    };

    if (actions[action]) {
      setMessage(actions[action]);
      inputRef.current.focus();
    }
    setMenuVisible(false);
  };

  const handleSubmit = () => {
    if (message.trim()) {
      handleSend();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="lightning-bolt"
              size={24}
              onPress={() => setMenuVisible(true)}
              disabled={isSending || aiLoading}
              style={styles.actionButton}
            />
          }
        >
          <Menu.Item
            onPress={() => handleAIGenerate()}
            title="Generate AI Response"
            leadingIcon="robot"
            disabled={aiLoading}
          />
          <Menu.Item
            onPress={() => handleQuickAction('greeting')}
            title="Insert Greeting"
            leadingIcon="hand-wave"
          />
          <Menu.Item
            onPress={() => handleQuickAction('followup')}
            title="Insert Follow-up"
            leadingIcon="comment-question"
          />
          <Menu.Item
            onPress={() => handleQuickAction('closing')}
            title="Insert Closing"
            leadingIcon="handshake"
          />
        </Menu>

        <TextInput
          ref={inputRef}
          style={styles.input}
          value={message}
          onChangeText={setMessage}
          placeholder="Type a message..."
          placeholderTextColor="#9ca3af"
          multiline
          maxLength={500}
          editable={!isSending && !aiLoading}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
          blurOnSubmit={false}
        />

        <View style={styles.buttonContainer}>
          {isSending || aiLoading ? (
            <ActivityIndicator size={24} style={styles.loadingIndicator} />
          ) : (
            <IconButton
              icon="send"
              size={24}
              onPress={handleSend}
              disabled={!message.trim()}
              style={styles.sendButton}
              accessibilityLabel="Send message"
            />
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e5e7eb',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#f3f4f6',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  actionButton: {
    marginRight: 4,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 16,
    lineHeight: 20,
  },
  buttonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 48,
    width: 48,
  },
  sendButton: {
    margin: 0,
  },
  loadingIndicator: {
    margin: 12,
  },
});

export default MessageComposer;