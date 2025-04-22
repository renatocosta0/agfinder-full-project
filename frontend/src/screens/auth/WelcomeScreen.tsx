import React, { useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Image, 
  Animated, 
  TouchableOpacity, 
  Dimensions, 
  SafeAreaView 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { LoginScreenNavigationProp } from '../../types/navigation';
import { Colors } from '../../constants/colors';
import { Layout } from '../../constants/layout';
import Button from '../../components/common/Button';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = () => {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleGetStarted = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View 
          style={[
            styles.logoContainer, 
            { 
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }] 
            }
          ]}
        >
          <Image 
            source={require('../../../assets/icon.png')} 
            style={styles.logo} 
            resizeMode="contain"
          />
          <Text style={styles.title}>AGFinder</Text>
        </Animated.View>

        <Animated.View 
          style={[
            styles.infoContainer,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          <Text style={styles.heading}>Encontre ATMs e Postos de Gasolina</Text>
          <Text style={styles.description}>
            Tenha acesso às informações mais atualizadas sobre ATMs e postos de gasolina próximos 
            a você. Contribua com a comunidade atualizando o status e ajudando outros usuários.
          </Text>

          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: Colors.primary }]}>
                <Text style={styles.featureIconText}>📍</Text>
              </View>
              <Text style={styles.featureText}>Localize pontos próximos</Text>
            </View>
            
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: Colors.success }]}>
                <Text style={styles.featureIconText}>💰</Text>
              </View>
              <Text style={styles.featureText}>Status de caixas e combustíveis</Text>
            </View>
            
            <View style={styles.featureItem}>
              <View style={[styles.featureIcon, { backgroundColor: Colors.secondary }]}>
                <Text style={styles.featureIconText}>🔄</Text>
              </View>
              <Text style={styles.featureText}>Contribua com atualizações</Text>
            </View>
          </View>
        </Animated.View>

        <Animated.View 
          style={[
            styles.buttonContainer,
            {
              opacity: fadeAnim
            }
          ]}
        >
          <Button 
            title="Começar Agora" 
            onPress={handleGetStarted} 
            style={styles.button}
          />
          
          <TouchableOpacity
            style={styles.termsContainer}
            onPress={() => {}}
          >
            <Text style={styles.termsText}>
              Ao continuar, você concorda com nossos Termos e Política de Privacidade
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    padding: Layout.padding.large,
    paddingBottom: Layout.padding.xxl,
  },
  logoContainer: {
    alignItems: 'center',
    marginTop: height * 0.05,
  },
  logo: {
    width: 100,
    height: 100,
    marginBottom: Layout.padding.medium,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  infoContainer: {
    marginVertical: Layout.padding.large,
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Layout.padding.medium,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Layout.padding.large,
  },
  featuresContainer: {
    marginTop: Layout.padding.medium,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Layout.padding.medium,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Layout.padding.medium,
  },
  featureIconText: {
    fontSize: 18,
  },
  featureText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  buttonContainer: {
    marginTop: Layout.padding.large,
    alignItems: 'center',
  },
  button: {
    width: '100%',
    paddingVertical: 16,
  },
  termsContainer: {
    marginTop: Layout.padding.medium,
  },
  termsText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});

export default WelcomeScreen; 