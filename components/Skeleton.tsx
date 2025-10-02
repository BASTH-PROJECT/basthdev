import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Card from './Card'; // Assuming Card is in the same directory

interface SkeletonProps {
  height?: number;
  width?: number | string;
  borderRadius?: number;
  style?: any;
}

const Skeleton: React.FC<SkeletonProps> = ({
  height = 20,
  width = '100%',
  borderRadius = 20,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#E5E7EB', '#F3F4F6'],
  });

  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius,
          backgroundColor,
        },
        style,
      ]}
    />
  );
};

export const SkeletonCard: React.FC = () => (
  <Card>
    <View style={styles.skeletonContent}>
      <Skeleton height={16} width="60%" style={styles.skeletonTitle} />
      <Skeleton height={12} width="40%" style={styles.skeletonSubtitle} />
    </View>
  </Card>
);

export const SkeletonTransactionList: React.FC = () => (
  <View>
    {[1, 2, 3, 4, 5].map((item) => (
      <Card key={item} style={styles.skeletonTransactionCard}>
        <View style={styles.skeletonTransactionContent}>
          <View style={styles.skeletonTransactionInfo}>
            <Skeleton height={16} width="70%" style={styles.skeletonTransactionTitle} />
            <Skeleton height={12} width="50%" style={styles.skeletonTransactionDate} />
          </View>
          <Skeleton height={18} width={80} />
        </View>
      </Card>
    ))}
  </View>
);

const styles = StyleSheet.create({
  skeletonContent: {
    paddingVertical: 8,
  },
  skeletonTitle: {
    marginBottom: 8,
  },
  skeletonSubtitle: {
    marginBottom: 4,
  },
  skeletonTransactionCard: {
    marginVertical: 4,
  },
  skeletonTransactionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  skeletonTransactionInfo: {
    flex: 1,
    marginRight: 16,
  },
  skeletonTransactionTitle: {
    marginBottom: 8,
  },
  skeletonTransactionDate: {
    marginBottom: 4,
  },
});

export default Skeleton;
