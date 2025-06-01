import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth } from '../firebase.config';
import { onAuthStateChanged } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create the context
const AuthContext = createContext({});

// Custom hook to use the auth context
export const useAuth = () => {
  return useContext(AuthContext);
};

// Provider component
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // First try to get stored auth state
    const checkStoredAuth = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error reading stored auth:', error);
      }
    };

    checkStoredAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const userData = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
          };
          await AsyncStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
        } else {
          await AsyncStorage.removeItem('user');
          setUser(null);
        }
      } catch (error) {
        console.error('Auth error:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Context value
  const value = {
    user,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export default AuthContext; 