import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Purchases from 'react-native-purchases';

// ============================================================================
// BACKEND URL (Only this - no API keys in app!)
// ============================================================================

const BACKEND_URL = 'https://sauc-e-backend-production.up.railway.app';
const REVENUECAT_PUBLIC_KEY = 'appl_gNFmOHvscXhhhoQWpgDvVPQeLZm'; // Public key, safe

const FREE_WISDOM_LIMIT = 10;

const RELISH = () => {
  // ============================================================================
  // STATE
  // ============================================================================
  
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [wisdomCount, setWisdomCount] = useState(0);
  const [situation, setSituation] = useState('');
  const [context, setContext] = useState('Life');
  const [wisdom, setWisdom] = useState('');
  const [loading, setLoading] = useState(false);
  const [customerId, setCustomerId] = useState(null);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  useEffect(() => {
    const initTimer = setTimeout(() => {
      initializePurchases();
    }, 500);
    
    return () => clearTimeout(initTimer);
  }, []);
  
  async function initializePurchases() {
    try {
      await Purchases.configure({ 
        apiKey: REVENUECAT_PUBLIC_KEY
      });
      
      const cid = await checkSubscriptionStatus();
      await syncUsageCount(cid);
      console.log('RevenueCat initialized');
    } catch (error) {
      console.error('RevenueCat init error:', error);
    }
  }

  async function syncUsageCount(cid) {
    try {
      const response = await fetch(`${BACKEND_URL}/api/relish/usage-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId: cid || 'anonymous' })
      });
      if (response.ok) {
        const data = await response.json();
        setWisdomCount(data.usageCount || 0);
      }
    } catch (error) {
      console.log('Usage sync skipped:', error.message);
    }
  }
  
  async function checkSubscriptionStatus() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const cid = customerInfo.originalAppUserId;
      
      setCustomerId(cid);
      
      if (customerInfo.entitlements.active['premium']) {
        setIsSubscribed(true);
      } else {
        setIsSubscribed(false);
      }
      return cid;
    } catch (error) {
      console.error('Subscription check error:', error);
      return null;
    }
  }

  // ============================================================================
  // GET WISDOM (Calls backend, NOT Claude directly)
  // ============================================================================
  
  async function handleGetWisdom() {
    if (!situation.trim()) {
      Alert.alert('Error', 'Please describe your situation');
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/relish/get-wisdom`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customerId: customerId || 'anonymous',
          situation: situation,
          context: context
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        
        if (response.status === 403) {
          Alert.alert('Limit Reached', 'Upgrade to Premium for unlimited wisdom', [
            { text: 'Upgrade', onPress: handleSubscribe },
            { text: 'Cancel', onPress: () => {} }
          ]);
          return;
        }
        
        throw new Error(errorData.error || 'Failed to get wisdom');
      }

      const data = await response.json();
      setWisdom(data.wisdom);
      setWisdomCount(wisdomCount + 1);
      setSituation('');
      
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to process request');
    } finally {
      setLoading(false);
    }
  }

  // ============================================================================
  // SUBSCRIPTION MANAGEMENT
  // IAP ENTRY POINT — tapping "Upgrade to Premium" triggers handleSubscribe()
  // Offerings: "RELISH PEAK" and "RELISH Premium" configured via RevenueCat
  // ============================================================================

  async function handleSubscribe() {
    try {
      const offerings = await Purchases.getOfferings();

      if (!offerings.current || offerings.current.availablePackages.length === 0) {
        Alert.alert(
          'Subscriptions Unavailable',
          'In-App Purchases are not available in this environment. Please ensure the Paid Apps Agreement is accepted in App Store Connect and that the subscription products are active.'
        );
        return;
      }

      const package_ = offerings.current.availablePackages[0];

      try {
        const { customerInfo } = await Purchases.purchasePackage(package_);

        if (customerInfo.entitlements.active['premium']) {
          setIsSubscribed(true);
          Alert.alert('Success', 'You are now subscribed!');
        }
      } catch (e) {
        if (!e.userCancelled) {
          Alert.alert('Error', 'Failed to complete purchase');
        }
      }
    } catch (error) {
      console.error('Subscription error:', error);
      Alert.alert('Error', 'Unable to load subscription options. Please try again.');
    }
  }

  async function restorePurchases() {
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo.entitlements.active['premium']) {
        setIsSubscribed(true);
        Alert.alert('Restored', 'Your subscription has been restored!');
      } else {
        Alert.alert('No Purchases Found', 'No active subscriptions were found for this account.');
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    }
  }

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>RELISH</Text>
        <Text style={styles.subtitle}>Wisdom & Clarity</Text>
        <Text style={styles.philosophy}>Understanding = Quality / Quantity</Text>
      </View>

      {!isSubscribed && (
        <TouchableOpacity style={styles.upgradeButton} onPress={handleSubscribe}>
          <Text style={styles.upgradeText}>
            Upgrade to Premium · {Math.max(0, FREE_WISDOM_LIMIT - wisdomCount)} free left
          </Text>
        </TouchableOpacity>
      )}

      {!isSubscribed && (
        <TouchableOpacity style={styles.restoreButton} onPress={restorePurchases}>
          <Text style={styles.restoreText}>Restore Purchases</Text>
        </TouchableOpacity>
      )}

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Pick a Context</Text>
        
        {['Life', 'Career', 'Relationships', 'Health', 'Money'].map(c => (
          <TouchableOpacity
            key={c}
            style={[styles.contextButton, context === c && styles.contextButtonActive]}
            onPress={() => setContext(c)}
          >
            <Text style={styles.contextText}>{c}</Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.sectionTitle}>Your Situation</Text>
        <TextInput
          style={styles.input}
          placeholder="Describe what's on your mind..."
          placeholderTextColor="#999"
          value={situation}
          onChangeText={setSituation}
          multiline
        />

        <TouchableOpacity
          style={[styles.wisdomButton, loading && styles.wisdomButtonDisabled]}
          onPress={handleGetWisdom}
          disabled={loading}
        >
          <Text style={styles.wisdomButtonText}>
            {loading ? 'Seeking wisdom...' : 'Get Wisdom'}
          </Text>
        </TouchableOpacity>

        {wisdom && (
          <View style={styles.wisdomBox}>
            <Text style={styles.wisdomTitle}>Wisdom</Text>
            <Text style={styles.wisdomText}>{wisdom}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Runs on RELISH Sauce 🔥 🥗</Text>
          <Text style={styles.footerSmall}>RELISH is for Feelings</Text>
          <Text style={styles.footerSmall}>Sample: CATSUP (Learning) • BBQE (Safety)</Text>
        </View>
      </View>
    </ScrollView>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#ccc',
    marginBottom: 4,
  },
  philosophy: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
  },
  upgradeButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignSelf: 'center',
    marginVertical: 16,
  },
  upgradeText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: 'white',
    marginTop: 24,
    marginBottom: 12,
  },
  contextButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
    marginBottom: 8,
  },
  contextButtonActive: {
    backgroundColor: '#4ECDC4',
    borderLeftColor: '#fff',
  },
  contextText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    backgroundColor: '#333',
    color: 'white',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginVertical: 12,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  wisdomButton: {
    backgroundColor: '#4ECDC4',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 16,
  },
  wisdomButtonDisabled: {
    opacity: 0.6,
  },
  wisdomButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  wisdomBox: {
    backgroundColor: '#333',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#4ECDC4',
  },
  wisdomTitle: {
    color: '#4ECDC4',
    fontWeight: '700',
    marginBottom: 8,
  },
  wisdomText: {
    color: '#ccc',
    lineHeight: 20,
  },
  footer: {
    alignItems: 'center',
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  footerText: {
    color: '#4ECDC4',
    fontWeight: '600',
    marginBottom: 4,
  },
  footerSmall: {
    color: '#999',
    fontSize: 12,
    marginTop: 2,
  },
  restoreButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 24,
    alignSelf: 'center',
    marginBottom: 8,
  },
  restoreText: {
    color: '#4ECDC4',
    fontSize: 13,
    fontWeight: '500',
  },
});

export default RELISH;
