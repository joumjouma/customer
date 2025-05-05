import React, { useEffect, useState, useRef } from "react";
import {
  Platform,
  StyleSheet,
  View,
  Image,
  Animated,
  Text,
  LogBox,
} from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "react-native-vector-icons/Ionicons";
import { getAuth, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword } from "firebase/auth"; // Firebase Auth
import { auth } from "./screens/firebase";
import { StripeProvider } from '@stripe/stripe-react-native'; // Add this import
import firebase from './firebase.config';

// Import Screens
import LoginScreen from "./screens/LoginScreen";
import RegisterScreen from "./screens/RegisterScreen";
import HomeScreenWithMap from "./screens/HomeScreenWithMap";
import ProfileScreen from "./screens/ProfileScreen";
import ActivityScreen from "./screens/ActivityScreen";
import SettingsScreen from "./screens/SettingsScreen";
import RideOptionsScreen from "./screens/RideOptionsScreen";
import AccountScreen from "./screens/accountScreen";
import WalletScreen from "./screens/WalletScreen";
import ModifyFieldScreen from "./screens/ModifyFieldScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";

// Change this line if PaymentMethodsScreen is exported as a named export:
import { PaymentMethodsScreen } from "./screens/PaymentMethodsScreen";

// -----------------------------------------------------------
// ADD THESE IMPORTS
// -----------------------------------------------------------
import FindingDriverScreen from "./screens/FindingDriverScreen";
import DriverFoundScreen from "./screens/DriverFoundScreen";
import InboxScreen from './screens/InboxScreen';
import CustomerInboxScreen from './screens/CustomerInboxScreen';
// -----------------------------------------------------------

import "react-native-get-random-values";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Add this at the top level, before the App component
LogBox.ignoreLogs(['Warning: ...']); // Ignore non-critical warnings

export default function App() {
  const [authState, setAuthState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Controls whether the splash screen is rendered.
  const [showSplash, setShowSplash] = useState(true);
  // Animated value for fading out the splash screen.
  const splashOpacity = useRef(new Animated.Value(1)).current;
  // Animated value for the breathing (pulsing) effect on the logo.
  const logoScale = useRef(new Animated.Value(1)).current;

  // Add error boundary
  useEffect(() => {
    const errorHandler = (error) => {
      console.error('App Error:', error);
      setError(error.message);
      setLoading(false);
    };

    // Global error handler
    const subscription = ErrorUtils.setGlobalHandler(errorHandler);
    return () => {
      ErrorUtils.setGlobalHandler(subscription);
    };
  }, []);

  // Start the breathing animation on the logo.
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoScale, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, [logoScale]);

  // Modify the auth state change effect
  useEffect(() => {
    console.log('Starting auth state check...');
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        console.log('Auth state changed:', user ? 'User logged in' : 'No user');
        if (user) {
          // User is signed in
          console.log("User is signed in:", user.email);
          setAuthState(user);
        } else {
          // User is signed out
          console.log("User is signed out");
          setAuthState(null);
        }
      } catch (error) {
        console.error('Auth error:', error);
        setError(error.message);
        setAuthState(null);
      } finally {
        console.log('Finishing auth check...');
        setLoading(false);
        // Reduce splash screen time to 1 second
        setTimeout(() => {
          Animated.timing(splashOpacity, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            setShowSplash(false);
          });
        }, 1000);
      }
    });

    return () => {
      console.log('Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  // Bottom Tab Navigator (Home, Activity, Profile)
  function HomeTabs() {
    return (
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color }) => {
            let iconName;
            if (route.name === "Home") {
              iconName = focused ? "home" : "home-outline";
            } else if (route.name === "Activity") {
              iconName = focused ? "time" : "time-outline";
            } else if (route.name === "Profile") {
              iconName = focused ? "person" : "person-outline";
            }
            return (
              <View style={{
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: focused ? 'rgba(255, 159, 67, 0.15)' : 'transparent',
                borderRadius: 12,
                padding: 6,
                width: 40,
                height: 40
              }}>
                <Ionicons name={iconName} size={22} color={color} />
              </View>
            );
          },
          tabBarActiveTintColor: "#ff9f43",
          tabBarInactiveTintColor: "#888888",
          tabBarStyle: {
            backgroundColor: "#1e1e1e",
            borderTopColor: "transparent",
            position: "absolute",
            bottom: 10,
            left: 20,
            right: 20,
            height: 65,
            paddingTop: 5,
            paddingBottom: 8,
            borderRadius: 20,
            shadowColor: "#000",
            shadowOffset: {
              width: 0,
              height: 5,
            },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          },
          tabBarLabel: ({ focused, color }) => (
            <Text style={{
              color: color,
              fontSize: 12,
              fontWeight: focused ? 'bold' : 'normal',
              marginTop: 2,
              marginBottom: 4
            }}>
              {route.name}
            </Text>
          ),
          tabBarItemStyle: {
            paddingTop: 5,
            height: 55,
          }
        })}
      >
        <Tab.Screen name="Home" options={{ headerShown: false }}>
          {() => <HomeScreenWithMap userName={authState?.displayName || "User"} />}
        </Tab.Screen>
        <Tab.Screen
          name="Activity"
          component={ActivityScreen}
          options={{ headerShown: false }}
        />
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ headerShown: false }}
        />
      </Tab.Navigator>
    );
  }

  // If there's an error, show it
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <Text style={styles.errorSubText}>Please restart the app</Text>
      </View>
    );
  }

  // If loading, don't render anything but the splash screen
  if (loading) {
    return (
      <View style={styles.splashContainer}>
        <Animated.Image
          source={require("./assets/Caval_Logo-removebg-preview.png")}
          style={[styles.splashImage, { transform: [{ scale: logoScale }] }]}
        />
      </View>
    );
  }

  return (
    // Wrap everything with StripeProvider
    <StripeProvider
      publishableKey="pk_live_51R9ek8CmEzIPQVTO8V3wcapg87N24eNFOCaJ4dz2krvfKSBaNe5g0vYAW4XBHESTYpQBi6fdz7GA4fPGJh4BlGIW00L1KYPz6m" // Using test key for development
      // Optional: Only if you need Apple Pay
      // merchantIdentifier="merchant.com.yourdomain.yourapp"
    >
      <NavigationContainer>
        <Stack.Navigator initialRouteName={authState ? "HomeScreenWithMap" : "LoginScreen"}>
          {/* Authentication Screens */}
          <Stack.Screen
            name="LoginScreen"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ForgotPasswordScreen"
            component={ForgotPasswordScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="RegisterScreen"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />

          {/* Bottom Tabs (Home, Activity, Profile) */}
          <Stack.Screen
            name="HomeScreenWithMap"
            component={HomeTabs}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="PaymentMethodsScreen"
            component={PaymentMethodsScreen}
            options={{ headerShown: false }}
          />

          {/* Ride Options Screen */}
          <Stack.Screen
            name="RideOptionsScreen"
            component={RideOptionsScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ActivityScreen"
            component={ActivityScreen}
            options={{ headerShown: false }}
          />

          {/* Additional Screens */}
          <Stack.Screen
            name="FindingDriver"
            component={FindingDriverScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="DriverFoundScreen"
            component={DriverFoundScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="SettingsScreen"
            component={SettingsScreen}
            options={{
              headerTitle: "Settings",
              headerStyle: { backgroundColor: "#ff9f43" },
              headerTintColor: "#fff",
              headerTitleAlign: "center",
            }}
          />
          <Stack.Screen
            name="accountScreen"
            component={AccountScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="ModifyFieldScreen"
            component={ModifyFieldScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="WalletScreen"
            component={WalletScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen
            name="InboxScreen"
            component={InboxScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="CustomerInboxScreen"
            component={CustomerInboxScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
        {showSplash && (
          <Animated.View style={[styles.splashContainer, { opacity: splashOpacity }]}>
            <Animated.Image
              source={require("./assets/Caval_Logo-removebg-preview.png")}
              style={[styles.splashImage, { transform: [{ scale: logoScale }] }]}
            />
          </Animated.View>
        )}
      </NavigationContainer>
    </StripeProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1e1e1e", // Changed to dark background (matches tab bar color)
    justifyContent: "center",
    alignItems: "center",
  },
  splashImage: {
    width: 200,
    height: 200,
    resizeMode: "contain",
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    color: 'red',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorSubText: {
    color: 'gray',
    fontSize: 16,
  },
});