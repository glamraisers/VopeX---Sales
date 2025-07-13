app/components/Card.js

import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { Card as PaperCard, Title, Paragraph, useTheme } from 'react-native-paper';
import { useTailwind } from 'tailwind-rn';

const Card = ({
  title,
  subtitle,
  content,
  image,
  actions,
  onPress,
  style,
  contentStyle,
  titleStyle,
  subtitleStyle,
  children,
  elevation = 2,
  rounded = true,
  bordered = true,
}) => {
  const tailwind = useTailwind();
  const theme = useTheme();
  
  // Determine border and background colors based on theme
  const borderColor = theme.dark ? theme.colors.surface : theme.colors.backdrop;
  const backgroundColor = theme.dark ? theme.colors.surface : theme.colors.background;
  
  // Build dynamic styles
  const containerStyles = [
    tailwind('bg-white dark:bg-surface'),
    rounded && tailwind('rounded-lg'),
    bordered && { borderWidth: StyleSheet.hairlineWidth, borderColor },
    style,
  ];

  // Render card content
  const renderContent = () => (
    <>
      {image && (
        <PaperCard.Cover 
          source={typeof image === 'string' ? { uri: image } : image} 
          style={tailwind('rounded-t-lg')} 
        />
      )}
      
      <PaperCard.Content style={[tailwind('py-3 px-4'), contentStyle]}>
        {title && (
          <Title 
            style={[
              tailwind('text-lg font-bold text-gray-900 dark:text-white mb-1'), 
              titleStyle
            ]}
          >
            {title}
          </Title>
        )}
        
        {subtitle && (
          <Paragraph 
            style={[
              tailwind('text-sm text-gray-500 dark:text-gray-400 mb-2'), 
              subtitleStyle
            ]}
          >
            {subtitle}
          </Paragraph>
        )}
        
        {content && (
          <Paragraph 
            style={tailwind('text-base text-gray-700 dark:text-gray-300')}
          >
            {content}
          </Paragraph>
        )}
        
        {children}
      </PaperCard.Content>
      
      {actions && (
        <PaperCard.Actions style={tailwind('px-4 py-2 justify-end')}>
          {actions}
        </PaperCard.Actions>
      )}
    </>
  );

  return (
    <View style={tailwind('mb-4')}>
      {onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
          <PaperCard style={containerStyles} elevation={elevation}>
            {renderContent()}
          </PaperCard>
        </TouchableOpacity>
      ) : (
        <PaperCard style={containerStyles} elevation={elevation}>
          {renderContent()}
        </PaperCard>
      )}
    </View>
  );
};

export default Card;