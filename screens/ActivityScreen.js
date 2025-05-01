import React, { useState, useEffect, useContext } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  useColorScheme as _useColorScheme,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { db } from "./firebase";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { Ionicons } from "@expo/vector-icons";
import { GOOGLE_MAPS_APIKEY } from "@env";
import { StatusBar } from "expo-status-bar";
import ProfilePicture from '../components/ProfilePicture';

// Create Theme Context
const ThemeContext = React.createContext();

export const ThemeProvider = ({ children }) => {
  const deviceTheme = _useColorScheme();
  // Set default theme to dark
  const [theme, setTheme] = useState('dark');

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);

// Geocoding function
async function geocodeLatLng(lat, lng) {
  if (
    lat === undefined ||
    lng === undefined ||
    isNaN(Number(lat)) ||
    isNaN(Number(lng))
  ) {
    console.error("Invalid coordinates passed to geocodeLatLng:", lat, lng);
    return "Invalid coordinates";
  }
  const latitude = Number(lat);
  const longitude = Number(lng);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_APIKEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === "OK" && data.results.length > 0) {
      return data.results[0].formatted_address;
    } else {
      console.error("Geocode API error:", data.status, data.error_message);
      return "Address not found";
    }
  } catch (error) {
    console.error("Error reverse-geocoding:", error);
    return "Error fetching address";
  }
}

function ActivityScreen() {
  const navigation = useNavigation();
  const auth = getAuth();
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addressMap, setAddressMap] = useState({});
  const { theme, toggleTheme } = useTheme();

  // Get theme colors
  const colors = getThemeColors(theme);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setLoading(false);
      return;
    }
    const ridesRef = collection(db, "rideRequests");
    const q = query(
      ridesRef,
      where("userId", "==", currentUser.uid),
      where("status", "==", "active"), // Changed from "assigned" to "active"
      orderBy("createdAt", "desc"),
      limit(10) // Increased limit to show more rides
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ridesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRides(ridesData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [auth]);

  // Fetch and store addresses for each ride
  useEffect(() => {
    (async () => {
      for (const ride of rides) {
        if (!addressMap[ride.id]) {
          let pickupAddress = "Address not found";
          let destinationAddress = "Address not found";
          if (ride.pickupLat && ride.pickupLng) {
            pickupAddress = await geocodeLatLng(ride.pickupLat, ride.pickupLng);
          }
          if (ride.destinationLat && ride.destinationLng) {
            destinationAddress = await geocodeLatLng(
              ride.destinationLat,
              ride.destinationLng
            );
          }
          setAddressMap((prev) => ({
            ...prev,
            [ride.id]: { pickupAddress, destinationAddress },
          }));
        }
      }
    })();
  }, [rides]);

  // Helper to format the ride date/time
  function formatRideDate(rideDate) {
    if (!rideDate) return "Date inconnue";
    const now = new Date();
    const isToday =
      rideDate.getDate() === now.getDate() &&
      rideDate.getMonth() === now.getMonth() &&
      rideDate.getFullYear() === now.getFullYear();
    const timeStr = rideDate.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return isToday
      ? `Aujourd'hui à ${timeStr}`
      : `${rideDate.toLocaleDateString()} à ${timeStr}`;
  }

  const renderRideItem = ({ item }) => {
    // Convert Firestore timestamp to JavaScript Date object
    const formattedDate = item.createdAt && item.createdAt.toDate ? 
      formatRideDate(item.createdAt.toDate()) : 
      "Date inconnue";
      
    const pickupAddr =
      addressMap[item.id]?.pickupAddress ||
      `${item.pickupLat}, ${item.pickupLng}`;
    const destinationAddr =
      addressMap[item.id]?.destinationAddress ||
      `${item.destinationLat}, ${item.destinationLng}`;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: colors.cardBackground }]}
        activeOpacity={0.7}
        onPress={() =>
          navigation.navigate("DriverFoundScreen", {
            rideId: item.id,
            rideType: item.rideType,
            distance: typeof item.distance === "number" ? item.distance : 0,
            duration: typeof item.duration === "number" ? item.duration : 0,
            pickupLat: item.pickupLat,
            pickupLng: item.pickupLng,
            destinationLat: item.destinationLat,
            destinationLng: item.destinationLng,
            driverPhoto: item.driverPhoto,
            driverName: item.driverName,
            driverId: item.driverId,
            driverPhone: item.driverPhone,
            fare: item.fare || 0,
          })
        }
      >
        <View style={[styles.cardHeader, { backgroundColor: colors.accentLight }]}>
          <Text style={[styles.headerLeft, { color: colors.textPrimary }]}>
            {formattedDate}
          </Text>
          <View style={styles.rideTypeContainer}>
            <Text style={[styles.headerRight, { color: colors.accent }]}>
              {item.rideType || "Caval Taxi"}
            </Text>
          </View>
        </View>
        
        <View style={styles.driverInfoPreview}>
          <ProfilePicture 
            photoUrl={item.driverPhoto}
            size={50}
            style={styles.previewDriverPhoto}
          />
          <View style={styles.driverTextInfo}>
            <Text style={[styles.previewDriverName, { color: colors.textPrimary }]}>
              {item.driverName || "Driver Name"}
            </Text>
            <Text style={[styles.previewRideType, { color: colors.accent }]}>
              {item.rideType || "Caval Taxi"}
            </Text>
          </View>
        </View>
        <View style={styles.rideStatus}>
          <View style={[styles.statusIndicator, { backgroundColor: colors.statusActive }]} />
          <Text style={[styles.rideStatusText, { color: colors.textPrimary }]}>
            {item.status === "completed" ? "Course terminée" : "Trajet en cours"}
          </Text>
        </View>
        
        <View style={styles.infoContainer}>
          <View style={styles.addressRow}>
            <View style={[styles.bullet, { backgroundColor: colors.pickupColor }]} />
            <View style={styles.addressContainer}>
              <Text style={[styles.addressLabel, { color: colors.textSecondary }]}>Départ</Text>
              <Text style={[styles.addressText, { color: colors.textPrimary }]} numberOfLines={1}>
                {pickupAddr}
              </Text>
            </View>
          </View>
          
          <View style={[styles.verticalLine, { backgroundColor: colors.divider }]} />
          
          <View style={styles.addressRow}>
            <View style={[styles.bullet, { backgroundColor: colors.destinationColor }]} />
            <View style={styles.addressContainer}>
              <Text style={[styles.addressLabel, { color: colors.textSecondary }]}>Destination</Text>
              <Text style={[styles.addressText, { color: colors.textPrimary }]} numberOfLines={1}>
                {destinationAddr}
              </Text>
            </View>
          </View>
          
          <View style={[styles.divider, { backgroundColor: colors.divider }]} />
          
          <View style={styles.bottomRow}>
            <View style={styles.rideMetrics}>
              <View style={styles.metricItem}>
                <Ionicons name="speedometer-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.metricText, { color: colors.textPrimary }]}>
                  {typeof item.distance === "number"
                    ? `${Number(item.distance).toFixed(1)} km`
                    : "N/A"}
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                <Text style={[styles.metricText, { color: colors.textPrimary }]}>
                  {typeof item.duration === "number"
                    ? `${Number(item.duration).toFixed(0)} min`
                    : "N/A"}
                </Text>
              </View>
            </View>
            <View style={styles.fareContainer}>
              <Text style={[styles.fareLabel, { color: colors.textSecondary }]}>Prix</Text>
              <Text style={[styles.fareText, { color: colors.accent }]}>
                {item.fare ? `${item.fare} Fdj` : "N/A"}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Clean header with just the buttons */}
      <View style={styles.cleanHeader}>
        <TouchableOpacity
          style={[styles.headerButton, { backgroundColor: colors.buttonBackground }]}
          onPress={() => navigation.navigate("HomeScreenWithMap")}
        >
          <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.headerButton, { backgroundColor: colors.buttonBackground }]} 
          onPress={toggleTheme}
        >
          <Ionicons 
            name={theme === 'dark' ? 'sunny-outline' : 'moon-outline'} 
            size={22} 
            color={colors.textPrimary} 
          />
        </TouchableOpacity>
      </View>
      
      {loading ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color={colors.accent} />
        </View>
      ) : rides.length === 0 ? (
        <View style={styles.noRidesContainer}>
          <Ionicons name="car-outline" size={60} color={colors.textSecondary} />
          <Text style={[styles.noRidesText, { color: colors.textSecondary }]}>
            Aucune activité trouvée.
          </Text>
          <TouchableOpacity 
            style={[styles.newRideButton, { backgroundColor: colors.accent }]}
            onPress={() => navigation.navigate("HomeScreenWithMap")}
          >
            <Text style={styles.newRideButtonText}>Demander un taxi</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={rides}
          keyExtractor={(item) => item.id}
          renderItem={renderRideItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// Theme colors function
function getThemeColors(theme) {
  if (theme === 'dark') {
    return {
      background: '#121212',
      cardBackground: '#242424',
      previewBackground: '#2A2A2A',
      textPrimary: '#FFFFFF',
      textSecondary: '#AAAAAA',
      accent: '#FF8F00',
      accentLight: '#3D3426',
      placeholder: '#444444',
      statusActive: '#4CAF50',
      pickupColor: '#FF8F00',
      destinationColor: '#E53935',
      divider: '#333333',
      buttonBackground: '#2A2A2A',
    };
  }
  return {
    background: '#F5F5F5',
    cardBackground: '#FFFFFF',
    previewBackground: '#F9F9F9',
    textPrimary: '#333333',
    textSecondary: '#757575',
    accent: '#FF6F00',
    accentLight: '#FFF3E0',
    placeholder: '#DDDDDD',
    statusActive: '#4CAF50',
    pickupColor: '#FF8F00',
    destinationColor: '#E53935',
    divider: '#EEEEEE',
    buttonBackground: '#FFFFFF',
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  /***** CLEAN HEADER *****/
  cleanHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 16,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  /***** LOADER / NO RIDES *****/
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  noRidesContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  noRidesText: {
    fontSize: 18,
    marginTop: 16,
    marginBottom: 24,
    textAlign: "center",
  },
  newRideButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 2,
  },
  newRideButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  listContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  /***** CARD STYLES *****/
  card: {
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 3,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  headerLeft: {
    fontSize: 15,
    fontWeight: "600",
  },
  rideTypeContainer: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  headerRight: {
    fontSize: 14,
    fontWeight: "700",
  },
  /***** DRIVER FOUND PREVIEW *****/
  previewContainer: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  driverInfoPreview: {
    flexDirection: "row",
    alignItems: "center",
  },
  previewDriverPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 15,
  },
  driverTextInfo: {
    flex: 1,
  },
  previewDriverName: {
    fontSize: 18,
    fontWeight: "700",
  },
  previewRideType: {
    fontSize: 15,
    fontWeight: "500",
    marginTop: 4,
  },
  rideStatus: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  rideStatusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  /***** INFO CONTAINER *****/
  infoContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  bullet: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 12,
    marginTop: 6,
  },
  addressContainer: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  addressText: {
    fontSize: 15,
  },
  verticalLine: {
    width: 1,
    height: 14,
    marginLeft: 4.5,
    marginVertical: 2,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rideMetrics: {
    flexDirection: "row",
  },
  metricItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  metricText: {
    marginLeft: 4,
    fontSize: 14,
  },
  fareContainer: {
    alignItems: "flex-end",
  },
  fareLabel: {
    fontSize: 12,
    marginBottom: 2,
  },
  fareText: {
    fontSize: 18,
    fontWeight: "700",
  },
});

// Make sure to wrap your app with ThemeProvider
export default function ThemedActivityScreen() {
  return (
    <ThemeProvider>
      <ActivityScreen />
    </ThemeProvider>
  );
}