import Container from '@/components/Container';
import React from 'react';
import { Text, View } from 'react-native';

export default function Help() {
  return (
    <Container>
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text>Help Screen</Text>
      </View>
    </Container>
  );
}
