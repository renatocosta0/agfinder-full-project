import React, { useState, useRef } from 'react';
import { View, Image, StyleSheet, Dimensions, ScrollView, NativeScrollEvent, NativeSyntheticEvent, Text } from 'react-native';

const { width: screenWidth } = Dimensions.get('window');
// Match screen horizontal padding (20 left + 20 right) and cap max width to 350 to mirror design
const H_PADDING = 20;
const SLIDE_WIDTH = Math.min(screenWidth - H_PADDING * 2, 350);

const HERO_IMAGES = [
  { id: 1, source: require('../../assets/images/atmdesign.png'), text: 'Find your local atms' },
  { id: 2, source: require('../../assets/images/gasstationdesign.png'), text: 'Find your local gasstations' },
];

interface HeroCarouselProps {
  style?: any;
}

export default function HeroCarousel({ style }: HeroCarouselProps) {
  const [activeSlide, setActiveSlide] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slideIndex = Math.round(event.nativeEvent.contentOffset.x / SLIDE_WIDTH);
    setActiveSlide(slideIndex);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.carouselWrapper}>
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          decelerationRate="fast"
          snapToInterval={SLIDE_WIDTH}
          snapToAlignment="start"
          contentContainerStyle={styles.scrollContent}
          style={styles.scrollView}
        >
          {HERO_IMAGES.map((item) => (
            <View key={item.id} style={styles.slideContainer}>
              <View style={styles.imageWrapper}>
                <Image source={item.source} style={styles.image} resizeMode="cover" />
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
      
      {/* Dynamic text */}
      <Text style={styles.slideText}>{HERO_IMAGES[activeSlide]?.text}</Text>

      {/* Dot indicators */}
      <View style={styles.pagination}>
        {HERO_IMAGES.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeSlide ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
  },
  carouselWrapper: {
    width: SLIDE_WIDTH,
    overflow: 'hidden',
  },
  scrollView: {
    width: SLIDE_WIDTH,
  },
  scrollContent: {
    alignItems: 'center',
  },
  slideContainer: {
    width: SLIDE_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageWrapper: {
    width: SLIDE_WIDTH,
    height: 280,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  slideText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  dotActive: {
    backgroundColor: '#fff',
  },
  dotInactive: {
    backgroundColor: '#666',
  },
});
