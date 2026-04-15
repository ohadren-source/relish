import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal, ActivityIndicator,
} from 'react-native';
import Purchases from 'react-native-purchases';
import * as Device from 'expo-device';

// ============================================================================
// BACKEND URL (Only this - no API keys in app!)
// ============================================================================

const BACKEND_URL = 'https://sauc-e-backend-production.up.railway.app';
const REVENUECAT_PUBLIC_KEY = 'appl_gNFmOHvscXhhhoQWpgDvVPQeLZm'; // Public key, safe

const FREE_WISDOM_LIMIT = 10;

// True when running inside the iOS Simulator (no real StoreKit hardware)
const IS_SIMULATOR = Platform.OS === 'ios' && !Device.isDevice;

// Fallback product display when RevenueCat/StoreKit cannot return live offerings
const FALLBACK_PRODUCTS = [
  {
    identifier: 'relish_peak',
    title: 'RELISH PEAK',
    priceString: '$9.99/month',
    description: 'Peak performance. Unlimited wisdom.',
  },
];

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

  // Paywall modal state
  const [showPaywall, setShowPaywall] = useState(false);
  const [offerings, setOfferings] = useState(null);
  const [offeringsLoading, setOfferingsLoading] = useState(false);
  const [offeringsError, setOfferingsError] = useState(null);
  const [purchasing, setPurchasing] = useState(false);

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  
  useEffect(() => {
    initializePurchases();
  }, []);
  
  async function initializePurchases() {
    try {
      // configure() is synchronous in react-native-purchases; no await needed
      Purchases.configure({ apiKey: REVENUECAT_PUBLIC_KEY });
      const cid = await checkSubscriptionStatus();
      await syncUsageCount(cid);
      console.log('[Relish] RevenueCat initialized');
    } catch (error) {
      console.error('[Relish] RevenueCat init error:', error);
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
      const cid = customerInfo?.originalAppUserId ?? null;
      
      setCustomerId(cid);
      
      if (customerInfo?.entitlements?.active?.['premium']) {
        setIsSubscribed(true);
      } else {
        setIsSubscribed(false);
      }
      return cid;
    } catch (error) {
      console.error('[Relish] Subscription check error:', error);
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
          Alert.alert('Limit Reached', 'Upgrade to RELISH PEAK for unlimited wisdom', [
            { text: 'Upgrade', onPress: openPaywall },
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
  // IAP ENTRY POINT — opens a paywall modal listing RELISH PEAK & RELISH Premium
  // Products are fetched live from RevenueCat; hardcoded fallback shown on failure.
  // ============================================================================

  // Open the paywall modal and load offerings concurrently
  async function openPaywall() {
    setShowPaywall(true);
    setOfferingsLoading(true);
    setOfferingsError(null);

    try {
      const result = await Purchases.getOfferings();
      console.log('[Relish] Offerings loaded:', result?.current?.availablePackages?.length ?? 0, 'packages');
      setOfferings(result);
    } catch (error) {
      console.error('[Relish] getOfferings error:', error?.code, error?.message);
      setOfferingsError(error?.message || 'Failed to load products from App Store');
    } finally {
      setOfferingsLoading(false);
    }
  }

  // Purchase a specific RevenueCat package
  async function purchasePackage(pkg) {
    if (IS_SIMULATOR) {
      Alert.alert(
        'Simulator Detected',
        'In-App Purchases cannot be completed on the iOS Simulator.\n\nTo test purchases, use a physical iPhone or iPad signed into a Sandbox Apple ID in Settings → App Store.'
      );
      return;
    }

    if (!pkg) {
      Alert.alert('Error', 'Invalid product. Please close and re-open the subscription screen.');
      return;
    }

    setPurchasing(true);
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg);
      if (customerInfo?.entitlements?.active?.['premium']) {
        setIsSubscribed(true);
        setShowPaywall(false);
        Alert.alert('Welcome to RELISH PEAK! 🎉', 'You now have unlimited wisdom.');
      }
    } catch (e) {
      if (!e.userCancelled) {
        console.error('[Relish] purchasePackage error:', e?.code, e?.message);
        Alert.alert(
          'Purchase Failed',
          e?.message || 'Unable to complete purchase. Please try again later.'
        );
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function restorePurchases() {
    try {
      const customerInfo = await Purchases.restorePurchases();
      if (customerInfo?.entitlements?.active?.['premium']) {
        setIsSubscribed(true);
        setShowPaywall(false);
        Alert.alert('Restored', 'Your subscription has been restored!');
      } else {
        Alert.alert('No Purchases Found', 'No active subscriptions were found for this Apple ID.');
      }
    } catch (error) {
      console.error('[Relish] Restore error:', error);
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    }
  }

  // ============================================================================
  // PAYWALL MODAL
  // Always renders both products (live from RevenueCat, or hardcoded fallback).
  // Apple Review can always reach this screen by tapping "Upgrade to Premium".
  // ============================================================================

  const renderPaywall = () => {
    const livePackages = offerings?.current?.availablePackages ?? [];
    const hasLivePackages = livePackages.length > 0;

    return (
      <Modal
        visible={showPaywall}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPaywall(false)}
      >
        <View style={styles.paywallContainer}>
          <TouchableOpacity
            style={styles.paywallCloseButton}
            onPress={() => setShowPaywall(false)}
          >
            <Text style={styles.paywallCloseText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.paywallTitle}>RELISH PEAK</Text>
          <Text style={styles.paywallSubtitle}>Peak Performance · Unlimited Wisdom</Text>

          {IS_SIMULATOR && (
            <View style={styles.simulatorBanner}>
              <Text style={styles.simulatorBannerText}>
                ⚠️ Simulator — purchases cannot be processed here. Use a real device with a Sandbox Apple ID.
              </Text>
            </View>
          )}

          {offeringsLoading ? (
            <View style={styles.paywallLoadingContainer}>
              <ActivityIndicator size="large" color="#4ECDC4" />
              <Text style={styles.paywallLoadingText}>Loading subscription options…</Text>
            </View>
          ) : (
            <>
              {offeringsError ? (
                <View style={styles.paywallErrorBanner}>
                  <Text style={styles.paywallErrorText}>
                    ⚠️ Could not load live pricing — showing standard prices.
                  </Text>
                  <Text style={styles.paywallErrorDetail}>{offeringsError}</Text>
                </View>
              ) : null}

              {(hasLivePackages ? livePackages : FALLBACK_PRODUCTS).map((item, idx) => {
                // When hasLivePackages is true every item is a RevenueCat Package object.
                // When false every item is a plain FALLBACK_PRODUCTS entry.
                const title = hasLivePackages ? (item.product?.title ?? item.identifier) : item.title;
                const price = hasLivePackages ? (item.product?.priceString ?? '—') : item.priceString;
                const desc = hasLivePackages ? (item.product?.description ?? '') : item.description;

                return (
                  <TouchableOpacity
                    key={hasLivePackages ? item.identifier : `fallback-${idx}`}
                    style={[
                      styles.packageButton,
                      purchasing && styles.packageButtonDisabled,
                    ]}
                    disabled={purchasing}
                    onPress={() => {
                      if (hasLivePackages) {
                        purchasePackage(item);
                      } else {
                        // Fallback: re-attempt to load live offerings
                        openPaywall();
                      }
                    }}
                  >
                    <View style={styles.packageInfo}>
                      <Text style={styles.packageTitle}>{title}</Text>
                      {desc ? <Text style={styles.packageDesc}>{desc}</Text> : null}
                      {!hasLivePackages && (
                        <Text style={styles.packageRetry}>Tap to retry loading from App Store</Text>
                      )}
                    </View>
                    <Text style={styles.packagePrice}>{price}</Text>
                  </TouchableOpacity>
                );
              })}

              {purchasing && (
                <View style={styles.purchasingRow}>
                  <ActivityIndicator color="#4ECDC4" />
                  <Text style={styles.purchasingText}> Processing purchase…</Text>
                </View>
              )}
            </>
          )}

          <TouchableOpacity style={styles.restoreButton} onPress={restorePurchases}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          <Text style={styles.paywallLegal}>
            Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Manage or cancel anytime in Settings → Apple ID → Subscriptions.
          </Text>
        </View>
      </Modal>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <ScrollView style={styles.container}>
      {renderPaywall()}

      <View style={styles.header}>
        <Text style={styles.title}>RELISH</Text>
        <Text style={styles.subtitle}>Wisdom & Clarity</Text>
        <Text style={styles.philosophy}>Understanding = Quality / Quantity</Text>
      </View>

      {!isSubscribed && (
        <TouchableOpacity style={styles.upgradeButton} onPress={openPaywall}>
          <Text style={styles.upgradeText}>
            Upgrade to RELISH PEAK · {Math.max(0, FREE_WISDOM_LIMIT - wisdomCount)} free left
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

  // ---- Paywall Modal ----
  paywallContainer: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  paywallCloseButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 8,
    zIndex: 10,
  },
  paywallCloseText: {
    color: '#ccc',
    fontSize: 20,
    fontWeight: '600',
  },
  paywallTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#4ECDC4',
    textAlign: 'center',
    marginBottom: 6,
  },
  paywallSubtitle: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 28,
  },
  simulatorBanner: {
    backgroundColor: '#3a2a00',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#f0a500',
  },
  simulatorBannerText: {
    color: '#f0a500',
    fontSize: 13,
    lineHeight: 18,
  },
  paywallLoadingContainer: {
    alignItems: 'center',
    marginVertical: 40,
  },
  paywallLoadingText: {
    color: '#999',
    marginTop: 12,
    fontSize: 14,
  },
  paywallErrorBanner: {
    backgroundColor: '#2a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#e74c3c',
  },
  paywallErrorText: {
    color: '#e74c3c',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  paywallErrorDetail: {
    color: '#999',
    fontSize: 12,
  },
  packageButton: {
    backgroundColor: '#333',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#4ECDC4',
  },
  packageButtonDisabled: {
    opacity: 0.5,
  },
  packageInfo: {
    flex: 1,
    marginRight: 12,
  },
  packageTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  packageDesc: {
    color: '#999',
    fontSize: 13,
    lineHeight: 18,
  },
  packageRetry: {
    color: '#888',
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: 4,
  },
  packagePrice: {
    color: '#4ECDC4',
    fontSize: 16,
    fontWeight: '700',
  },
  purchasingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  purchasingText: {
    color: '#4ECDC4',
    fontSize: 14,
  },
  paywallLegal: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 16,
  },
});

export default RELISH;
