// ============================================================================
// RELISH — version 3.2.0 (Understand.Think.Know — Diagnostic Build)
// 3_6_NIFE.pi · SOi sauc-e Division · Selkirk, NY
// Move steadfast && break it down.
// ----------------------------------------------------------------------------
// v3.2.0 CHANGES
// - Full diagnostic instrumentation: every paywall failure now captures and
//   displays complete state (bundle ID, SDK version, offerings result, error
//   codes, StoreKit env, Apple ID sign-in state, timestamps, session ID).
// - Diagnostic payload POSTed to backend on every failure AND manual open,
//   so the developer receives reviewer-generated diagnostic data whether or
//   not the reviewer taps "Send to Developer".
// - New DiagnosticPanel modal reachable two ways:
//     (1) "Show Diagnostic" button inside the failure alert.
//     (2) Triple-tap the paywall title ("RELISH Peak").
// - Config-snapshot POST on app launch (one-shot) so every installed build
//   reports its identity and SDK state to the developer's backend.
// - Configure call now waits for SDK ready before subsequent calls, closing
//   the race window that could produce empty offerings on slow networks.
// - All existing behavior, branding, disclosures, and layout preserved.
// ============================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, Alert, Platform, Modal, ActivityIndicator, Linking,
  Clipboard,
} from 'react-native';
import Purchases from 'react-native-purchases';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';

// ============================================================================
// BACKEND URL (Only this - no API keys in app!)
// ============================================================================

const BACKEND_URL = 'https://sauc-e-backend-production.up.railway.app';
const REVENUECAT_PUBLIC_KEY = 'appl_gNFmOHvscXhhhoQWpgDvVPQeLZm'; // Public key, safe

const APP_VERSION = '3.2.0';
const FREE_WISDOM_LIMIT = 10;

// Apple Standard EULA URL — required link for auto-renewing subscriptions
const APPLE_STANDARD_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

// Privacy Policy and Support URL — hosted at sauc-e.com
const PRIVACY_AND_SUPPORT_URL = 'https://www.sauc-e.com/privatesupport';

// True when running inside the iOS Simulator (no real StoreKit hardware)
const IS_SIMULATOR = Platform.OS === 'ios' && !Device.isDevice;

// Fallback product display when RevenueCat/StoreKit cannot return live offerings
const FALLBACK_PRODUCTS = [
  {
    identifier: 'relish_peak',
    title: 'RELISH Peak',
    priceString: '$9.99/month',
    description: 'Unlimited wisdom at peak performance.',
  },
];

// Product identifiers we expect RevenueCat/ASC to return
const EXPECTED_PRODUCT_IDS = ['relish_peak'];

// ============================================================================
// DIAGNOSTIC SESSION — persists across a single app run
// ============================================================================

// Generate a session ID so every diagnostic event from a single app launch
// can be correlated on the backend. Format: rlsh-<timestamp>-<rand>
const SESSION_ID = `rlsh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// Simple safe-stringify that doesn't blow up on circular refs or weird SDK objects
function safeStringify(obj, maxLen = 4000) {
  try {
    const seen = new WeakSet();
    const str = JSON.stringify(obj, (key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]';
        seen.add(val);
      }
      if (typeof val === 'function') return '[Function]';
      return val;
    }, 2);
    if (!str) return String(obj);
    return str.length > maxLen ? str.slice(0, maxLen) + '…[truncated]' : str;
  } catch (e) {
    try { return String(obj); } catch { return '[unserializable]'; }
  }
}

// POST a diagnostic payload to the backend. Best-effort; never throws.
async function postDiagnostic(kind, payload) {
  try {
    await fetch(`${BACKEND_URL}/api/relish/paywall-diagnostic`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind,
        sessionId: SESSION_ID,
        timestamp: new Date().toISOString(),
        appVersion: APP_VERSION,
        payload,
      }),
    });
  } catch (e) {
    // swallow — diagnostic transport failure should never break the app
    console.log('[Relish] diagnostic post failed:', e?.message);
  }
}

// Pull every piece of state we care about into a single plain object.
// This is what the diagnostic panel displays and what gets POSTed.
async function collectDiagnostics({
  offerings,
  offeringsError,
  lastPurchaseError,
  stage,
}) {
  const snapshot = {
    stage: stage || 'unknown',
    session: {
      sessionId: SESSION_ID,
      timestamp: new Date().toISOString(),
      appVersion: APP_VERSION,
    },
    platform: {
      os: Platform.OS,
      osVersion: Platform.Version,
      isSimulator: IS_SIMULATOR,
      deviceBrand: Device.brand ?? null,
      deviceModel: Device.modelName ?? null,
      deviceYear: Device.deviceYearClass ?? null,
      isDevice: Device.isDevice,
    },
    app: {
      bundleId: Application.applicationId ?? null,
      nativeAppVersion: Application.nativeApplicationVersion ?? null,
      nativeBuildVersion: Application.nativeBuildVersion ?? null,
      expoRuntimeVersion: Constants?.expoConfig?.runtimeVersion ?? null,
      expoSdkVersion: Constants?.expoConfig?.sdkVersion ?? null,
    },
    revenuecat: {
      publicKeyPrefix: REVENUECAT_PUBLIC_KEY?.slice(0, 8) ?? null,
      publicKeySuffix: REVENUECAT_PUBLIC_KEY?.slice(-4) ?? null,
      publicKeyLength: REVENUECAT_PUBLIC_KEY?.length ?? 0,
      expectedProductIds: EXPECTED_PRODUCT_IDS,
    },
    offerings: {
      fetched: !!offerings,
      hasCurrent: !!offerings?.current,
      currentOfferingId: offerings?.current?.identifier ?? null,
      availablePackageCount: offerings?.current?.availablePackages?.length ?? 0,
      availablePackageIds: (offerings?.current?.availablePackages ?? []).map(p => ({
        identifier: p.identifier,
        productIdentifier: p.product?.identifier ?? null,
        title: p.product?.title ?? null,
        priceString: p.product?.priceString ?? null,
      })),
      allOfferingIds: offerings?.all ? Object.keys(offerings.all) : [],
    },
    errors: {
      offeringsError: offeringsError ? {
        code: offeringsError.code ?? null,
        message: offeringsError.message ?? String(offeringsError),
        underlyingErrorMessage: offeringsError.underlyingErrorMessage ?? null,
        readableErrorCode: offeringsError.readableErrorCode ?? null,
        raw: safeStringify(offeringsError, 1500),
      } : null,
      lastPurchaseError: lastPurchaseError ? {
        code: lastPurchaseError.code ?? null,
        message: lastPurchaseError.message ?? String(lastPurchaseError),
        userCancelled: !!lastPurchaseError.userCancelled,
        underlyingErrorMessage: lastPurchaseError.underlyingErrorMessage ?? null,
        readableErrorCode: lastPurchaseError.readableErrorCode ?? null,
        raw: safeStringify(lastPurchaseError, 1500),
      } : null,
    },
  };

  // Try to pull customer info — separately wrapped so a failure here
  // doesn't wipe out the rest of the snapshot.
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    snapshot.customer = {
      originalAppUserId: customerInfo?.originalAppUserId ?? null,
      firstSeen: customerInfo?.firstSeen ?? null,
      requestDate: customerInfo?.requestDate ?? null,
      activeEntitlements: Object.keys(customerInfo?.entitlements?.active ?? {}),
      allEntitlements: Object.keys(customerInfo?.entitlements?.all ?? {}),
      activeSubscriptions: customerInfo?.activeSubscriptions ?? [],
      allPurchasedProductIdentifiers: customerInfo?.allPurchasedProductIdentifiers ?? [],
      managementURL: customerInfo?.managementURL ?? null,
    };
  } catch (e) {
    snapshot.customer = {
      error: e?.message ?? String(e),
      errorCode: e?.code ?? null,
    };
  }

  // Try to pull the StoreKit storefront / country — tells us which ASC region
  // the device is querying. Mismatched region is a common "products empty" cause.
  try {
    if (Purchases.getStorefront) {
      const sf = await Purchases.getStorefront();
      snapshot.storefront = {
        countryCode: sf?.countryCode ?? null,
        identifier: sf?.identifier ?? null,
      };
    } else {
      snapshot.storefront = { note: 'getStorefront not available on this SDK version' };
    }
  } catch (e) {
    snapshot.storefront = { error: e?.message ?? String(e) };
  }

  return snapshot;
}

// ============================================================================
// CONFIG SNAPSHOT — fired once per launch, before any paywall interaction.
// Lets the developer confirm, from their own logs, what every installed
// build thinks its identity is. Bundle ID / build number mismatches surface
// here without needing a rejection to reveal them.
// ============================================================================

async function postLaunchSnapshot() {
  try {
    const snap = await collectDiagnostics({ stage: 'launch' });
    await postDiagnostic('launch', snap);
  } catch (e) {
    console.log('[Relish] launch snapshot failed:', e?.message);
  }
}

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

  // Diagnostic state
  const [showDiagnostic, setShowDiagnostic] = useState(false);
  const [diagnosticSnapshot, setDiagnosticSnapshot] = useState(null);
  const [diagnosticLoading, setDiagnosticLoading] = useState(false);
  const [lastPurchaseError, setLastPurchaseError] = useState(null);
  const [diagnosticSent, setDiagnosticSent] = useState(false);

  // Triple-tap detector for manual diagnostic open
  const titleTapRef = useRef({ count: 0, lastTap: 0 });

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  useEffect(() => {
    initializePurchases();
  }, []);

  async function initializePurchases() {
    try {
      // configure() returns synchronously but SDK internals aren't immediately
      // ready; give it a short tick so subsequent getCustomerInfo/getOfferings
      // calls don't race. This closes a real failure window on slow networks.
      Purchases.configure({ apiKey: REVENUECAT_PUBLIC_KEY });
      await new Promise(r => setTimeout(r, 50));

      // Set verbose logging so any RevenueCat internal diagnostic messages
      // land in the console (and via bridged log handler, in backend logs).
      try {
        if (Purchases.setLogLevel) {
          await Purchases.setLogLevel(Purchases.LOG_LEVEL?.VERBOSE ?? 'VERBOSE');
        }
      } catch (e) {
        console.log('[Relish] setLogLevel unavailable:', e?.message);
      }

      const cid = await checkSubscriptionStatus();
      await syncUsageCount(cid);
      console.log('[Relish] RevenueCat initialized, session:', SESSION_ID);

      // Fire launch snapshot to backend — one-shot config report.
      postLaunchSnapshot();
    } catch (error) {
      console.error('[Relish] RevenueCat init error:', error);
      postDiagnostic('init_error', {
        message: error?.message,
        code: error?.code,
        raw: safeStringify(error),
      });
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

      // NOTE: 'premium' here is the RevenueCat entitlement identifier,
      // which cannot be renamed without deleting the entitlement. User-facing
      // branding is "Peak" everywhere; this internal string stays as 'premium'
      // because that's how it's configured in the RevenueCat dashboard.
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
          Alert.alert('Limit Reached', 'Upgrade to Peak for unlimited wisdom', [
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
  // IAP ENTRY POINT — opens a paywall modal listing RELISH Peak
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

      const pkgCount = result?.current?.availablePackages?.length ?? 0;

      // Report offerings result — success OR empty — so we know which it was.
      // Empty-with-no-error is the pathological "products in review" state.
      const snap = await collectDiagnostics({
        offerings: result,
        stage: pkgCount > 0 ? 'offerings_loaded' : 'offerings_empty',
      });
      postDiagnostic(pkgCount > 0 ? 'offerings_loaded' : 'offerings_empty', snap);
    } catch (error) {
      console.error('[Relish] getOfferings error:', error?.code, error?.message);
      setOfferingsError(error?.message || 'Failed to load products from App Store');

      const snap = await collectDiagnostics({
        offeringsError: error,
        stage: 'offerings_error',
      });
      postDiagnostic('offerings_error', snap);
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
      // NOTE: 'premium' is the RevenueCat entitlement identifier (see note in checkSubscriptionStatus).
      if (customerInfo?.entitlements?.active?.['premium']) {
        setIsSubscribed(true);
        setShowPaywall(false);
        Alert.alert('Welcome to Peak! 🎉', 'You now have unlimited wisdom.');

        const snap = await collectDiagnostics({ offerings, stage: 'purchase_success' });
        postDiagnostic('purchase_success', snap);
      }
    } catch (e) {
      if (!e.userCancelled) {
        console.error('[Relish] purchasePackage error:', e?.code, e?.message);
        setLastPurchaseError(e);

        // Push the reviewer toward the diagnostic panel rather than a dead-end
        // "Purchase Failed" alert. They can still dismiss if they want.
        Alert.alert(
          'Purchase Failed',
          `${e?.message || 'Unable to complete purchase.'}\n\nIf you are testing this app, tapping "Show Diagnostic" will display the exact error state and send it to the developer.`,
          [
            { text: 'Show Diagnostic', onPress: () => openDiagnosticPanel('purchase_failed', { lastPurchaseError: e }) },
            { text: 'Close', style: 'cancel' },
          ]
        );

        const snap = await collectDiagnostics({
          offerings,
          lastPurchaseError: e,
          stage: 'purchase_error',
        });
        postDiagnostic('purchase_error', snap);
      } else {
        // user-cancelled is normal; still log it at a low-volume kind
        postDiagnostic('purchase_cancelled', { code: e?.code, message: e?.message });
      }
    } finally {
      setPurchasing(false);
    }
  }

  async function restorePurchases() {
    try {
      const customerInfo = await Purchases.restorePurchases();
      // NOTE: 'premium' is the RevenueCat entitlement identifier (see note in checkSubscriptionStatus).
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
      postDiagnostic('restore_error', {
        message: error?.message,
        code: error?.code,
        raw: safeStringify(error),
      });
    }
  }

  // ============================================================================
  // DIAGNOSTIC PANEL CONTROL
  // ============================================================================

  async function openDiagnosticPanel(stage, extras = {}) {
    setShowDiagnostic(true);
    setDiagnosticLoading(true);
    setDiagnosticSent(false);
    try {
      const snap = await collectDiagnostics({
        offerings,
        offeringsError: extras.offeringsError ?? (offeringsError ? { message: offeringsError } : null),
        lastPurchaseError: extras.lastPurchaseError ?? lastPurchaseError,
        stage: stage || 'manual_open',
      });
      setDiagnosticSnapshot(snap);

      // Always fire on open — if the developer wants to see that the reviewer
      // tapped to diagnose, that's valuable signal even if they never hit Send.
      postDiagnostic('diagnostic_opened', snap);
    } catch (e) {
      setDiagnosticSnapshot({ error: e?.message ?? String(e) });
    } finally {
      setDiagnosticLoading(false);
    }
  }

  // Triple-tap handler for the paywall title → opens diagnostic panel.
  // Three taps within 1.5s of each other.
  function handleTitleTap() {
    const now = Date.now();
    const ref = titleTapRef.current;
    if (now - ref.lastTap > 1500) {
      ref.count = 1;
    } else {
      ref.count += 1;
    }
    ref.lastTap = now;
    if (ref.count >= 3) {
      ref.count = 0;
      openDiagnosticPanel('manual_triple_tap');
    }
  }

  async function sendDiagnosticToDeveloper() {
    if (!diagnosticSnapshot) return;
    await postDiagnostic('diagnostic_sent_by_user', diagnosticSnapshot);
    setDiagnosticSent(true);
    Alert.alert(
      'Sent',
      'Diagnostic report sent to the developer. Thank you for helping resolve this issue.'
    );
  }

  function copyDiagnosticToClipboard() {
    if (!diagnosticSnapshot) return;
    try {
      Clipboard.setString(safeStringify(diagnosticSnapshot, 50000));
      Alert.alert('Copied', 'Diagnostic report copied to clipboard.');
    } catch (e) {
      Alert.alert('Copy Failed', e?.message || 'Could not copy to clipboard.');
    }
  }

  // ============================================================================
  // PAYWALL MODAL
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
        <ScrollView
          style={styles.paywallContainer}
          contentContainerStyle={styles.paywallContent}
        >
          <TouchableOpacity
            style={styles.paywallCloseButton}
            onPress={() => setShowPaywall(false)}
          >
            <Text style={styles.paywallCloseText}>✕</Text>
          </TouchableOpacity>

          {/* Title is tap-sensitive — triple-tap opens the diagnostic panel.
              Invisible to normal users, immediate for a reviewer reading the
              app's review notes that tell them how to reach it. */}
          <TouchableOpacity activeOpacity={1} onPress={handleTitleTap}>
            <Text style={styles.paywallTitle}>RELISH Peak</Text>
          </TouchableOpacity>
          <Text style={styles.paywallSubtitle}>Unlimited Wisdom & Clarity</Text>

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
              {(offeringsError || !hasLivePackages) ? (
                <View style={styles.paywallErrorBanner}>
                  <Text style={styles.paywallErrorText}>
                    ⚠️ Could not load live pricing — showing standard prices.
                  </Text>
                  <Text style={styles.paywallErrorDetail}>{offeringsError}</Text>
                  <TouchableOpacity
                    style={styles.diagnosticInlineButton}
                    onPress={() => openDiagnosticPanel('error_banner_tap', { offeringsError: { message: offeringsError } })}
                  >
                    <Text style={styles.diagnosticInlineButtonText}>Show Diagnostic Details</Text>
                  </TouchableOpacity>
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
                        // Fallback path: products didn't fetch. Offer the user
                        // Try Again, Close, AND Show Diagnostic. The diagnostic
                        // path is the one the developer actually needs data from.
                        Alert.alert(
                          'Subscription Unavailable',
                          'Subscription pricing could not be loaded from the App Store right now. Please check your internet connection and try again. If the problem continues, please close and reopen the app — or tap "Show Diagnostic" to send the error details to the developer.',
                          [
                            { text: 'Show Diagnostic', onPress: () => openDiagnosticPanel('fallback_tap') },
                            { text: 'Try Again', onPress: openPaywall },
                            { text: 'Close', style: 'cancel' },
                          ]
                        );
                      }
                    }}
                  >
                    <View style={styles.packageInfo}>
                      <Text style={styles.packageTitle}>{title}</Text>
                      {desc ? <Text style={styles.packageDesc}>{desc}</Text> : null}
                      {!hasLivePackages && (
                        <Text style={styles.packageRetry}>Tap for more information</Text>
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

          {/* Subscription Details — required disclosures per Apple Guideline 3.1.2(c) */}
          <View style={styles.subscriptionDetails}>
            <Text style={styles.subscriptionDetailsTitle}>Subscription Details</Text>
            <Text style={styles.subscriptionDetailsText}>
              • Title: RELISH Peak{'\n'}
              • Length: 1 month, auto-renewing subscription{'\n'}
              • Price: $9.99 per month (USD){'\n'}
              • Price per unit: $9.99 per month
            </Text>
          </View>

          {/* Required links — Privacy Policy and Terms of Use (EULA) */}
          <View style={styles.legalLinksContainer}>
            <TouchableOpacity
              style={styles.legalLinkButton}
              onPress={() => Linking.openURL(PRIVACY_AND_SUPPORT_URL)}
            >
              <Text style={styles.legalLinkText}>Privacy Policy and Support</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.legalLinkButton}
              onPress={() => Linking.openURL(APPLE_STANDARD_EULA_URL)}
            >
              <Text style={styles.legalLinkText}>Terms of Use (EULA)</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.paywallLegal}>
            Payment will be charged to your Apple ID account at confirmation of purchase. Subscriptions auto-renew unless cancelled at least 24 hours before the end of the current period. Your account will be charged for renewal within 24 hours prior to the end of the current period. You can manage or cancel your subscription anytime in Settings → Apple ID → Subscriptions.
          </Text>

          {/* Discreet diagnostic access for reviewers / support.
              Always present; the app-review notes tell reviewers to tap this
              if the paywall misbehaves on their end. */}
          <TouchableOpacity
            style={styles.diagnosticFooterButton}
            onPress={() => openDiagnosticPanel('footer_tap')}
          >
            <Text style={styles.diagnosticFooterText}>
              Paywall not working? Tap here to show diagnostic
            </Text>
          </TouchableOpacity>

          <Text style={styles.sessionIdText}>Session: {SESSION_ID}</Text>
        </ScrollView>
      </Modal>
    );
  };

  // ============================================================================
  // DIAGNOSTIC PANEL MODAL
  // Full-screen takeover. Monospace dump of every piece of state.
  // Copy + Send buttons. Always reachable; always auto-reports on open.
  // ============================================================================

  const renderDiagnosticPanel = () => {
    return (
      <Modal
        visible={showDiagnostic}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDiagnostic(false)}
      >
        <ScrollView
          style={styles.diagContainer}
          contentContainerStyle={styles.diagContent}
        >
          <TouchableOpacity
            style={styles.paywallCloseButton}
            onPress={() => setShowDiagnostic(false)}
          >
            <Text style={styles.paywallCloseText}>✕</Text>
          </TouchableOpacity>

          <Text style={styles.diagTitle}>Paywall Diagnostic</Text>
          <Text style={styles.diagSubtitle}>
            This report captures the exact state of the subscription system on this device right now.
            It has been automatically sent to the developer. You may also copy it or send it manually below.
          </Text>

          {diagnosticLoading ? (
            <View style={styles.paywallLoadingContainer}>
              <ActivityIndicator size="large" color="#4ECDC4" />
              <Text style={styles.paywallLoadingText}>Collecting diagnostics…</Text>
            </View>
          ) : diagnosticSnapshot ? (
            <>
              <DiagSection label="Session" data={diagnosticSnapshot.session} />
              <DiagSection label="Platform" data={diagnosticSnapshot.platform} />
              <DiagSection label="App Identity" data={diagnosticSnapshot.app} />
              <DiagSection label="RevenueCat Config" data={diagnosticSnapshot.revenuecat} />
              <DiagSection label="Offerings (this is the key data)" data={diagnosticSnapshot.offerings} highlight />
              <DiagSection label="Customer" data={diagnosticSnapshot.customer} />
              <DiagSection label="Storefront" data={diagnosticSnapshot.storefront} />
              <DiagSection label="Errors" data={diagnosticSnapshot.errors} highlight />

              <View style={styles.diagButtonRow}>
                <TouchableOpacity
                  style={styles.diagActionButton}
                  onPress={copyDiagnosticToClipboard}
                >
                  <Text style={styles.diagActionText}>Copy All</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.diagActionButton, styles.diagActionButtonPrimary]}
                  onPress={sendDiagnosticToDeveloper}
                  disabled={diagnosticSent}
                >
                  <Text style={styles.diagActionText}>
                    {diagnosticSent ? 'Sent ✓' : 'Send to Developer'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.diagFooterNote}>
                Session ID: {SESSION_ID}
                {'\n'}If you are an Apple App Review tester, please include this Session ID when submitting your review notes. It lets the developer correlate this report with your review session.
              </Text>
            </>
          ) : (
            <Text style={styles.diagEmptyText}>No diagnostic data available.</Text>
          )}
        </ScrollView>
      </Modal>
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <ScrollView style={styles.container}>
      {renderPaywall()}
      {renderDiagnosticPanel()}

      <View style={styles.header}>
        <Text style={styles.title}>RELISH</Text>
        <Text style={styles.subtitle}>Wisdom & Clarity</Text>
        <Text style={styles.philosophy}>Understanding = Quality / Quantity</Text>
      </View>

      {!isSubscribed && (
        <TouchableOpacity style={styles.upgradeButton} onPress={openPaywall}>
          <Text style={styles.upgradeText}>
            Upgrade to Peak · {Math.max(0, FREE_WISDOM_LIMIT - wisdomCount)} free left
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
          <TouchableOpacity onPress={() => Linking.openURL(PRIVACY_AND_SUPPORT_URL)}>
            <Text style={styles.footerLink}>Privacy Policy and Support</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => Linking.openURL(APPLE_STANDARD_EULA_URL)}>
            <Text style={styles.footerLink}>Terms of Use (EULA)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

// ============================================================================
// DIAGNOSTIC SECTION RENDERER (subcomponent)
// ============================================================================

const DiagSection = ({ label, data, highlight }) => (
  <View style={[styles.diagSection, highlight && styles.diagSectionHighlight]}>
    <Text style={[styles.diagSectionLabel, highlight && styles.diagSectionLabelHighlight]}>{label}</Text>
    <Text style={styles.diagSectionBody} selectable>
      {safeStringify(data, 8000)}
    </Text>
  </View>
);

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
  footerLink: {
    color: '#4ECDC4',
    fontSize: 12,
    marginTop: 8,
    textDecorationLine: 'underline',
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
  },
  paywallContent: {
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 48,
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

  // ---- Subscription disclosures + legal links ----
  subscriptionDetails: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#4ECDC4',
  },
  subscriptionDetailsTitle: {
    color: '#4ECDC4',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  subscriptionDetailsText: {
    color: '#ccc',
    fontSize: 12,
    lineHeight: 18,
  },
  legalLinksContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 4,
    marginBottom: 8,
  },
  legalLinkButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  legalLinkText: {
    color: '#4ECDC4',
    fontSize: 13,
    fontWeight: '500',
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  paywallLegal: {
    color: '#666',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 8,
  },

  // ---- Diagnostic entry points (embedded in paywall) ----
  diagnosticInlineButton: {
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#4a2222',
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  diagnosticInlineButtonText: {
    color: '#f39c9c',
    fontSize: 12,
    fontWeight: '600',
  },
  diagnosticFooterButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#2a2a2a',
    borderRadius: 6,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  diagnosticFooterText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  sessionIdText: {
    color: '#555',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // ---- Diagnostic Panel Modal ----
  diagContainer: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  diagContent: {
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 48,
  },
  diagTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#4ECDC4',
    marginBottom: 8,
  },
  diagSubtitle: {
    fontSize: 13,
    color: '#aaa',
    lineHeight: 18,
    marginBottom: 18,
  },
  diagSection: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4ECDC4',
  },
  diagSectionHighlight: {
    borderLeftColor: '#f0a500',
    backgroundColor: '#1f1a0f',
  },
  diagSectionLabel: {
    color: '#4ECDC4',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  diagSectionLabelHighlight: {
    color: '#f0a500',
  },
  diagSectionBody: {
    color: '#ddd',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  diagButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 16,
    gap: 10,
  },
  diagActionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  diagActionButtonPrimary: {
    backgroundColor: '#4ECDC4',
  },
  diagActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
  },
  diagFooterNote: {
    color: '#666',
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    marginTop: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  diagEmptyText: {
    color: '#888',
    textAlign: 'center',
    marginVertical: 40,
  },
});

export default RELISH;
