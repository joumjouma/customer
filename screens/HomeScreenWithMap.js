import React, { useState, useEffect, useRef } from "react";
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  Image,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  Alert,
  Linking,
} from "react-native";
import * as Location from "expo-location";
import { GooglePlacesAutocomplete } from "react-native-google-places-autocomplete";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { GOOGLE_MAPS_APIKEY } from "@env";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { doc, getDoc, collection, addDoc } from "firebase/firestore";
import { auth, firestore } from "../firebase.config";
import CavalLogo from "../assets/Caval_Logo-removebg-preview.png";
import CustomPin from "../assets/CustomPin.png";
import { useNavigation, useRoute } from "@react-navigation/native";

const RECENT_SEARCHES_KEY = "recentSearches";
const THEME_STORAGE_KEY = "appTheme";
const { width, height } = Dimensions.get("window");

const HomeScreenWithMap = ({ userName = "User" }) => {
  const navigation = useNavigation();
  const route = useRoute();
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [listViewDisplayed, setListViewDisplayed] = useState(false);

  // Theme state – retained for other UI elements, but the map will use dark theme always.
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0); // New state for keyboard height
  const [keyboardVisible, setKeyboardVisible] = useState(false); // Track keyboard visibility

  // Set up keyboard listeners to update keyboardHeight
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener("keyboardDidShow", (e) => {
      setKeyboardHeight(e.endCoordinates.height);
      setKeyboardVisible(true);
    });
    const keyboardDidHideListener = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardHeight(0);
      setKeyboardVisible(false);
    });
    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

  const defaultZoomDelta = {
    latitudeDelta: 0.0322,
    longitudeDelta: 0.0321,
  };

  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    ...defaultZoomDelta,
  });

  const [fromLocation, setFromLocation] = useState(null);
  const [pickupText, setPickupText] = useState("");
  const [showPickupInput, setShowPickupInput] = useState(false);
  const [pickupInputVisible, setPickupInputVisible] = useState(false);

  // Customer info
  const [customerFirstName, setCustomerFirstName] = useState(userName);
  const [customerPhoto, setCustomerPhoto] = useState(null);
  const [customerPhone, setCustomerPhone] = useState(null);
  const [customerTariff, setCustomerTariff] = useState(null);

  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [searchText, setSearchText] = useState("");

  const googlePlacesRef = useRef(null);
  const googlePickupRef = useRef(null);
  const mapRef = useRef(null);

  const zoomedInDelta = {
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  };

  // Map Styles – use dark style always for the map.
  const darkMapStyle = [
    { elementType: "geometry", stylers: [{ color: "#212121" }] },
    { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#2c2c2c" }] },
    { featureType: "road.arterial", elementType: "labels.text.fill", stylers: [{ color: "#aaaaaa" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#1a1a1a" }] },
    { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#6e6e6e" }] },
  ];

  // Load & save theme preferences.
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedTheme !== null) {
          setIsDarkMode(savedTheme === "dark");
        }
      } catch (error) {
        console.error("Error loading theme preference:", error);
      }
    };
    loadThemePreference();
  }, []);

  useEffect(() => {
    const saveThemePreference = async () => {
      try {
        await AsyncStorage.setItem(THEME_STORAGE_KEY, isDarkMode ? "dark" : "light");
      } catch (error) {
        console.error("Error saving theme preference:", error);
      }
    };
    saveThemePreference();
  }, [isDarkMode]);

  useEffect(() => {
    const loadRecentSearches = async () => {
      try {
        const storedSearches = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
        if (storedSearches !== null) {
          setRecentSearches(JSON.parse(storedSearches));
        }
      } catch (error) {
        console.error("Erreur lors du chargement des recherches récentes :", error);
      }
    };
    loadRecentSearches();
  }, []);

  useEffect(() => {
    const saveRecentSearches = async () => {
      try {
        await AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recentSearches));
      } catch (error) {
        console.error("Erreur lors de l'enregistrement des recherches récentes :", error);
      }
    };
    saveRecentSearches();
  }, [recentSearches]);

  useEffect(() => {
    (async () => {
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          const docRef = doc(firestore, "Customers", currentUser.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const userData = docSnap.data();
            setCustomerFirstName(userData.firstName || userName);
            setCustomerPhoto(userData.photo || null);
            setCustomerPhone(userData.number || null);
            setCustomerTariff(userData.tariff || 9.99);
          } else {
            console.log("No document found in Firestore!");
            setCustomerFirstName(userName);
          }
        } catch (error) {
          console.error("Error fetching customer data:", error);
          setCustomerFirstName(userName);
        }
      } else {
        console.log("User not logged in");
        setCustomerFirstName(userName);
      }
    })();
  }, [userName]);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Localisation désactivée",
            "Veuillez activer les services de localisation pour utiliser l'application.",
            [
              {
                text: "Annuler",
                style: "cancel"
              },
              {
                text: "Paramètres",
                onPress: () => Linking.openSettings()
              }
            ]
          );
          return;
        }

        // Check if location services are enabled
        const locationEnabled = await Location.hasServicesEnabledAsync();
        if (!locationEnabled) {
          Alert.alert(
            "Services de localisation désactivés",
            "Veuillez activer les services de localisation dans les paramètres de votre appareil.",
            [
              {
                text: "Annuler",
                style: "cancel"
              },
              {
                text: "Paramètres",
                onPress: () => Linking.openSettings()
              }
            ]
          );
          return;
        }

        setLoading(true);
        const currentPosition = await Location.getCurrentPositionAsync({});
        setLoading(false);
        if (currentPosition && currentPosition.coords) {
          const { latitude, longitude } = currentPosition.coords;
          if (!pickupText) {
            setFromLocation({ latitude, longitude });
            setPickupText("Position actuelle");
          }
          setRegion({ latitude, longitude, ...defaultZoomDelta });
          mapRef.current?.animateToRegion({ latitude, longitude, ...defaultZoomDelta }, 1000);
        }
      } catch (err) {
        setLoading(false);
        Alert.alert(
          "Erreur de localisation",
          "Impossible d'obtenir votre position actuelle. Veuillez vérifier que les services de localisation sont activés.",
          [
            {
              text: "Annuler",
              style: "cancel"
            },
            {
              text: "Paramètres",
              onPress: () => Linking.openSettings()
            }
          ]
        );
        console.error("Erreur lors de l'obtention de la localisation :", err);
      }
    })();
  }, []);

  const handlePickupSelect = async (data, details = null) => {
    try {
      if (!details) {
        console.error("Détails non trouvés pour le lieu de départ sélectionné");
        return;
      }
      const location = details.geometry.location;
      setFromLocation({ latitude: location.lat, longitude: location.lng });
      setPickupText(data.description);
      setPickupInputVisible(true);
      mapRef.current?.animateToRegion({ latitude: location.lat, longitude: location.lng, ...zoomedInDelta }, 500);
      setTimeout(() => setShowPickupInput(false), 500);
    } catch (error) {
      console.error("Erreur lors de la sélection du lieu de départ :", error);
    }
  };

  const requestRide = async (origin, destination) => {
    try {
      const rideRequestData = {
        customerName: customerFirstName,
        customerPhone: customerPhone,
        customerPhoto: customerPhoto,
        origin,
        destination,
        createdAt: new Date(),
        activity: "active",
        userId: auth.currentUser?.uid || null,
      };
      await addDoc(collection(firestore, "rideRequests"), rideRequestData);
      console.log("Ride request successfully sent.");
    } catch (error) {
      console.error("Error sending ride request:", error);
    }
  };

  const handleDestinationSelect = async (data, details = null) => {
    try {
      if (!details) {
        console.error("Détails non trouvés pour la destination sélectionnée");
        return;
      }
      if (!fromLocation) {
        console.error("La position de départ n'est pas définie");
        return;
      }
      setLoading(true);
      const location = details.geometry.location;
      const destinationCoords = { latitude: location.lat, longitude: location.lng };
      
      // Safely update recentSearches
      setRecentSearches((prev) => {
        const prevSearches = Array.isArray(prev) ? prev : [];
        const newList = [data.description, ...prevSearches.filter((s) => s !== data.description)];
        return newList.slice(0, 3);
      });

      const originData = { latitude: fromLocation.latitude, longitude: fromLocation.longitude, address: pickupText };
      const destinationData = { latitude: destinationCoords.latitude, longitude: destinationCoords.longitude, address: data.description };
      await requestRide(originData, destinationData);
      setLoading(false);
      navigation.navigate("RideOptionsScreen", {
        origin: originData,
        destination: destinationData,
        customerFirstName,
        customerPhoto,
        customerPhone,
      });
    } catch (error) {
      setLoading(false);
      console.error("Erreur lors de la sélection de la destination :", error);
    }
  };

  const handleGoPress = async () => {
    if (!searchText.trim()) return;
    try {
      setLoading(true);
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
          searchText
        )}&key=${GOOGLE_MAPS_APIKEY}`
      );
      const data = await response.json();
      if (data.status === "OK" && data.results && data.results.length > 0) {
        const location = data.results[0].geometry.location;
        const destinationCoords = { latitude: location.lat, longitude: location.lng };
        
        // Safely update recentSearches
        setRecentSearches((prev) => {
          const prevSearches = Array.isArray(prev) ? prev : [];
          const newList = [searchText, ...prevSearches.filter((s) => s !== searchText)];
          return newList.slice(0, 3);
        });

        const originData = { latitude: fromLocation.latitude, longitude: fromLocation.longitude, address: pickupText };
        const destinationData = { latitude: destinationCoords.latitude, longitude: destinationCoords.longitude, address: searchText };
        await requestRide(originData, destinationData);
        setLoading(false);
        navigation.navigate("RideOptionsScreen", { origin: originData, destination: destinationData });
      } else {
        setLoading(false);
        alert("Impossible de trouver la localisation. Veuillez essayer une autre destination.");
      }
    } catch (error) {
      setLoading(false);
      console.error("Erreur lors de la récupération de la géolocalisation :", error);
      alert("Erreur lors de la récupération de la localisation. Veuillez réessayer.");
    }
  };

  const handleRecentSearchPress = (searchString) => {
    if (googlePlacesRef.current) {
      googlePlacesRef.current.setAddressText(searchString);
      setSearchText(searchString);
    }
  };

  const centerOnCurrentLocation = () => {
    if (fromLocation) {
      mapRef.current?.animateToRegion(
        { latitude: fromLocation.latitude, longitude: fromLocation.longitude, ...defaultZoomDelta },
        500
      );
    }
  };

  // Theme toggle function
  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  // Add new state for map selection mode
  const [selectionMode, setSelectionMode] = useState(null); // 'pickup' or 'dropoff' or null
  const [selectedLocation, setSelectedLocation] = useState(null);

  // Add new function to handle map taps
  const handleMapPress = async (event) => {
    if (!selectionMode) return;

    const { coordinate } = event.nativeEvent;
    setSelectedLocation(coordinate);

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${coordinate.latitude},${coordinate.longitude}&key=${GOOGLE_MAPS_APIKEY}`
      );
      const data = await response.json();
      
      if (data.status === "OK" && data.results && data.results.length > 0) {
        const address = data.results[0].formatted_address;
        
        if (selectionMode === 'pickup') {
          setFromLocation(coordinate);
          setPickupText(address);
          setPickupInputVisible(true);
          setShowPickupInput(false);
        } else if (selectionMode === 'dropoff') {
          setSearchText(address);
          const destinationCoords = {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
            address: address
          };
          const originData = {
            latitude: fromLocation.latitude,
            longitude: fromLocation.longitude,
            address: pickupText
          };
          
          // Create the ride request data
          const rideRequestData = {
            customerName: customerFirstName,
            customerPhone: customerPhone,
            customerPhoto: customerPhoto,
            origin: originData,
            destination: destinationCoords,
            createdAt: new Date(),
            activity: "active",
            userId: auth.currentUser?.uid || null,
          };
          
          // Save to Firestore
          await addDoc(collection(firestore, "rideRequests"), rideRequestData);
          
          // Navigate to RideOptionsScreen
          navigation.navigate("RideOptionsScreen", {
            origin: originData,
            destination: destinationCoords,
            customerFirstName,
            customerPhoto,
            customerPhone,
          });
        }
        
        setSelectionMode(null);
        mapRef.current?.animateToRegion({ ...coordinate, ...zoomedInDelta }, 500);
      }
    } catch (error) {
      console.error("Error reverse geocoding:", error);
    }
  };

  // Add new function to start location selection
  const startLocationSelection = (mode) => {
    setSelectionMode(mode);
    setSelectedLocation(null);
  };

  // Generate styles (keyboardHeight is used to compute autocomplete list maxHeight)
  const getThemedStyles = () => {
    return StyleSheet.create({
      container: { flex: 1, backgroundColor: isDarkMode ? "#121212" : "#fff" },
      mapContainer: { ...StyleSheet.absoluteFillObject },
      map: { ...StyleSheet.absoluteFillObject },
      topBar: {
        position: "absolute",
        top: Platform.OS === "ios" ? 50 : 40,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        paddingHorizontal: 16,
        zIndex: 10,
      },
      logo: { width: 100, height: 40, resizeMode: "contain" },
      currentLocationButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: isDarkMode ? "#2D2D2D" : "#fff",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
      },
      themeToggleButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: isDarkMode ? "#2D2D2D" : "#fff",
        justifyContent: "center",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 3,
        marginRight: 10,
      },
      activeRideBanner: {
        position: "absolute",
        top: Platform.OS === "ios" ? 100 : 90,
        left: 16,
        right: 16,
        borderRadius: 12,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 5,
        zIndex: 5,
      },
      activeRideBannerGradient: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16 },
      activeRideBannerText: { flex: 1, color: "#fff", fontSize: 16, fontWeight: "600", textAlign: "center" },
      bottomContainer: {
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        padding: Platform.OS === "ios" ? 20 : 16,
        paddingTop: 10,
        paddingBottom: Platform.OS === "ios" ? 100 : 16,
        backgroundColor: isDarkMode ? "#1E1E1E" : "#fff",
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        shadowColor: "#000",
        shadowOpacity: 0.15,
        shadowOffset: { width: 0, height: -4 },
        shadowRadius: 12,
        elevation: 8,
        maxHeight: "50%",
        zIndex: 5,
        marginBottom: Platform.OS === 'android' ? 0 : 0,
        top: Platform.OS === 'android' ? height * 0.58 : undefined,
      },
      bottomContainerHeader: { alignItems: "center", marginBottom: 12 },
      dragHandle: {
        width: 40,
        height: 4,
        backgroundColor: isDarkMode ? "#3D3D3D" : "#D1D5DB",
        borderRadius: 2,
        marginVertical: 8,
      },
      rowContainer: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
      greetingText: {
        fontSize: 22,
        fontWeight: "600",
        color: isDarkMode ? "#E0E0E0" : "#1F2937",
        flex: 1,
      },
      searchContainer: { backgroundColor: "transparent" },
      searchInput: {
        height: 50,
        borderRadius: 10,
        backgroundColor: isDarkMode ? "#2D2D2D" : "#F3F4F6",
        paddingHorizontal: 16,
        fontSize: 16,
        color: isDarkMode ? "#fff" : "#333",
        borderWidth: 1,
        borderColor: isDarkMode ? "#444" : "#ddd",
      },
      // Autocomplete list view with fixed positioning to ensure it's always visible
      autocompleteListView: {
        backgroundColor: "#fff",
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#FF6F00",
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        marginHorizontal: 16,
        marginTop: 4,
        position: 'absolute',
        top: 52,
        left: 0,
        right: 0,
        maxHeight: Math.min(300, height - 200 - (keyboardVisible ? keyboardHeight : 80)), 
        zIndex: 9999,
      },
      // Custom row rendering: two lines with black font.
      customAutocompleteRow: {
        paddingVertical: 20,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#e0e0e0",
      },
      customAutocompleteMainText: {
        fontSize: 20,
        color: "#000", // force black font
        fontWeight: "600",
      },
      customAutocompleteSecondaryText: {
        fontSize: 16,
        color: "#000", // force black font
        marginTop: 6,
      },
      smallButton: {
        backgroundColor: "#FF6F00",
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        shadowColor: "#FF6F00",
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 2,
      },
      smallButtonText: { color: "#fff", fontSize: 14, fontWeight: "600" },
      cancelButton: {
        marginLeft: 12,
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 10,
        backgroundColor: isDarkMode ? "#2D2D2D" : "#F3F4F6",
        borderWidth: 1,
        borderColor: isDarkMode ? "#3D3D3D" : "#E5E7EB",
      },
      cancelButtonText: { color: isDarkMode ? "#B0B0B0" : "#4B5563", fontSize: 14, fontWeight: "600" },
      selectedAddressContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isDarkMode ? "#2D2D2D" : "#F3F4F6",
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 16,
      },
      selectedAddressText: { marginLeft: 8, fontSize: 14, color: isDarkMode ? "#B0B0B0" : "#4B5563" },
      destinationRowContainer: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
        position: "relative",
        zIndex: 999,
      },
      destinationIconContainer: { position: "absolute", left: 14, top: 14, zIndex: 1001 },
      destinationSearchContainer: { flex: 1, backgroundColor: "transparent", zIndex: 1000 },
      destinationSearchInput: {
        height: 50,
        borderRadius: 10,
        backgroundColor: isDarkMode ? "#2D2D2D" : "#F3F4F6",
        paddingLeft: 42,
        paddingRight: 16,
        fontSize: 16,
        color: isDarkMode ? "#fff" : "#333",
        borderWidth: 1,
        borderColor: isDarkMode ? "#444" : "#ddd",
      },
      goButton: {
        marginLeft: 12,
        borderRadius: 10,
        overflow: "hidden",
        shadowColor: "#FF6F00",
        shadowOpacity: 0.3,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
        elevation: 3,
        zIndex: 1001,
      },
      goButtonGradient: { paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
      goButtonText: { color: "#fff", fontSize: 15, fontWeight: "700" },
      recentSearchesContainer: {
        backgroundColor: isDarkMode ? "#2D2D2D" : "#F9FAFB",
        padding: Platform.OS === "ios" ? 16 : 16,
        borderRadius: 16,
        marginBottom: Platform.OS === "ios" ? 16 : 16,
        marginTop: Platform.OS === "ios" ? 20 : 12,
      },
      recentSearchesTitle: { 
        fontSize: 16, 
        fontWeight: "600", 
        marginBottom: Platform.OS === "ios" ? 8 : 12, 
        color: isDarkMode ? "#E0E0E0" : "#1F2937" 
      },
      recentSearchItem: { 
        flexDirection: "row", 
        alignItems: "center", 
        marginBottom: Platform.OS === "ios" ? 12 : 16 
      },
      recentSearchText: { fontSize: 14, color: isDarkMode ? "#B0B0B0" : "#4B5563", flex: 1 },
      loadingContainer: { flexDirection: "row", alignItems: "center", marginTop: 20 },
      loadingText: { marginLeft: 12, fontSize: 16, color: isDarkMode ? "#E0E0E0" : "#374151" },
      placeItem: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
      placeName: { marginLeft: 8, fontSize: 16, color: isDarkMode ? "#E0E0E0" : "#1F2937" },
      mapSelectionOverlay: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 100 : 80,
        left: 16,
        right: 16,
        backgroundColor: isDarkMode ? 'rgba(30, 30, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)',
        borderRadius: 12,
        padding: 12,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 5,
        zIndex: 10,
      },
      mapSelectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
      },
      mapSelectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: isDarkMode ? '#fff' : '#1F2937',
        marginLeft: 8,
      },
      mapSelectionText: {
        fontSize: 13,
        color: isDarkMode ? '#B0B0B0' : '#4B5563',
        lineHeight: 18,
      },
      mapSelectionButton: {
        backgroundColor: '#FF6F00',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 8,
        marginTop: 8,
        alignItems: 'center',
      },
      mapSelectionButtonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
      },
    });
  };

  const styles = getThemedStyles();

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} backgroundColor="transparent" translucent />
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.container}>
            {/* MAP */}
            <View style={styles.mapContainer}>
              <MapView
                ref={mapRef}
                provider={PROVIDER_DEFAULT}
                style={styles.map}
                region={region}
                customMapStyle={darkMapStyle}
                showsUserLocation
                showsMyLocationButton={false}
                showsCompass={false}
                rotateEnabled={false}
                mapPadding={{ top: 5, right: 0, bottom: Platform.OS === 'ios' ? 350 : 100, left: 0 }}
                onPress={handleMapPress}
              >
                {fromLocation && (
                  <Marker coordinate={fromLocation} title="Votre position" anchor={{ x: 0.5, y: 1 }}>
                    <Image source={CustomPin} style={{ width: 40, height: 40 }} resizeMode="contain" />
                  </Marker>
                )}
                {selectedLocation && (
                  <Marker coordinate={selectedLocation} title={selectionMode === 'pickup' ? "Point de départ" : "Destination"}>
                    <View style={{ 
                      backgroundColor: selectionMode === 'pickup' ? '#FF6F00' : '#4CAF50',
                      padding: 8,
                      borderRadius: 20,
                      borderWidth: 2,
                      borderColor: '#fff'
                    }}>
                      <Ionicons 
                        name={selectionMode === 'pickup' ? "location" : "flag"} 
                        size={20} 
                        color="#fff" 
                      />
                    </View>
                  </Marker>
                )}
              </MapView>

              {/* Add map selection overlay */}
              {!selectionMode && (
                <View style={styles.mapSelectionOverlay}>
                  <View style={styles.mapSelectionHeader}>
                    <Ionicons name="map-outline" size={20} color="#FF6F00" />
                    <Text style={styles.mapSelectionTitle}>Sélection sur la carte</Text>
                  </View>
                  <Text style={styles.mapSelectionText}>
                    Appuyez sur les boutons ci-dessous pour sélectionner votre trajet sur la carte.
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
                    <TouchableOpacity 
                      style={[styles.mapSelectionButton, { flex: 1, marginRight: 8 }]} 
                      onPress={() => startLocationSelection('pickup')}
                    >
                      <Text style={styles.mapSelectionButtonText}>Départ</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.mapSelectionButton, { flex: 1, marginLeft: 8 }]} 
                      onPress={() => startLocationSelection('dropoff')}
                    >
                      <Text style={styles.mapSelectionButtonText}>Arrivée</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Selection mode indicator */}
              {selectionMode && (
                <View style={[styles.mapSelectionOverlay, { backgroundColor: isDarkMode ? 'rgba(255, 111, 0, 0.2)' : 'rgba(255, 111, 0, 0.1)' }]}>
                  <View style={styles.mapSelectionHeader}>
                    <Ionicons 
                      name={selectionMode === 'pickup' ? "location" : "flag"} 
                      size={20} 
                      color="#FF6F00" 
                    />
                    <Text style={styles.mapSelectionTitle}>
                      {selectionMode === 'pickup' ? 'Sélectionnez le point de départ' : 'Sélectionnez la destination'}
                    </Text>
                  </View>
                  <Text style={styles.mapSelectionText}>
                    Appuyez sur la carte pour placer le marqueur.
                  </Text>
                  <TouchableOpacity 
                    style={[styles.mapSelectionButton, { backgroundColor: isDarkMode ? '#2D2D2D' : '#F3F4F6' }]} 
                    onPress={() => setSelectionMode(null)}
                  >
                    <Text style={[styles.mapSelectionButtonText, { color: isDarkMode ? '#B0B0B0' : '#4B5563' }]}>Annuler</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* TOP BAR WITH THEME TOGGLE */}
            <View style={styles.topBar}>
              <Image source={CavalLogo} style={styles.logo} />
              <View style={{ flexDirection: "row" }}>
                <TouchableOpacity style={styles.themeToggleButton} onPress={toggleTheme}>
                  <Ionicons name={isDarkMode ? "sunny" : "moon"} size={22} color={isDarkMode ? "#FFD700" : "#6B7280"} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.currentLocationButton} onPress={centerOnCurrentLocation}>
                  <Ionicons name="locate" size={24} color="#FF6F00" />
                </TouchableOpacity>
              </View>
            </View>

            {/* ACTIVE RIDE BANNER */}
            {route.params?.activeRide && (
              <TouchableOpacity style={styles.activeRideBanner} onPress={() => navigation.navigate("DriverFoundScreen", route.params.activeRide)}>
                <LinearGradient colors={["#FF9500", "#FF6F00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.activeRideBannerGradient}>
                  <Ionicons name="car-sport" size={20} color="#fff" style={{ marginRight: 8 }} />
                  <Text style={styles.activeRideBannerText}>Vous avez une course en cours</Text>
                  <Ionicons name="chevron-forward" size={20} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* BOTTOM CONTAINER */}
            <View style={[
              styles.bottomContainer,
              isSearchFocused && { 
                maxHeight: '80%',
                paddingBottom: Platform.OS === 'ios' ? 20 : 0
              }
            ]}>
              <View style={styles.bottomContainerHeader}>
                <View style={styles.dragHandle} />
              </View>
              
              {!showPickupInput ? (
                <View style={styles.rowContainer}>
                  <Text style={styles.greetingText}>
                    Bonjour, <Text style={{ fontWeight: "700" }}>{customerFirstName}</Text> !
                  </Text>
                  <TouchableOpacity 
                    style={styles.smallButton} 
                    onPress={() => { setShowPickupInput(true); setPickupInputVisible(true); }}
                  >
                    <Text style={styles.smallButtonText}>Modifier lieu de départ</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={styles.greetingText}>
                    Bonjour, <Text style={{ fontWeight: "700" }}>{customerFirstName}</Text> !
                  </Text>
                  <View style={styles.rowContainer}>
                    <GooglePlacesAutocomplete
                      ref={googlePickupRef}
                      placeholder="Lieu de départ"
                      fetchDetails
                      onPress={handlePickupSelect}
                      query={{
                        key: GOOGLE_MAPS_APIKEY,
                        language: "fr",
                        components: "country:DJ", // Restrict results to Djibouti
                      }}
                      debounce={400}
                      listViewDisplayed="auto"
                      keyboardShouldPersistTaps="always"
                      textInputProps={{
                        value: pickupText,
                        onChangeText: (text) => setPickupText(text),
                        placeholderTextColor: isDarkMode ? "#6B7280" : "#9CA3AF",
                      }}
                      renderRow={(data) => (
                        <View style={styles.customAutocompleteRow}>
                          <Text style={styles.customAutocompleteMainText}>
                            {data.structured_formatting?.main_text || data.description}
                          </Text>
                          {data.structured_formatting?.secondary_text && (
                            <Text style={styles.customAutocompleteSecondaryText}>
                              {data.structured_formatting.secondary_text}
                            </Text>
                          )}
                        </View>
                      )}
                      predefinedPlaces={[]}
                      ListViewProps={{ showsVerticalScrollIndicator: true }}
                      styles={{
                        container: { ...styles.searchContainer, flex: 1 },
                        textInput: styles.searchInput,
                        listView: { ...styles.autocompleteListView, position: "absolute", top: 52, left: 0, right: 0 },
                      }}
                      enablePoweredByContainer={false}
                      minLength={2}
                    />
                    <TouchableOpacity style={styles.cancelButton} onPress={() => { setShowPickupInput(false); setPickupInputVisible(false); }}>
                      <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}

              {pickupInputVisible && !showPickupInput && (
                <TouchableOpacity style={styles.selectedAddressContainer} onPress={() => setShowPickupInput(true)}>
                  <Ionicons name="location-sharp" size={18} color="#FF6F00" />
                  <Text style={styles.selectedAddressText}>{pickupText}</Text>
                </TouchableOpacity>
              )}

              <View style={styles.destinationRowContainer}>
                <View style={styles.destinationIconContainer}>
                  <Ionicons name="navigate-outline" size={20} color="#FF6F00" />
                </View>
                <View style={{ flex: 1 }}>
                  <GooglePlacesAutocomplete
                    ref={googlePlacesRef}
                    placeholder="Où souhaitez-vous aller ?"
                    fetchDetails={true}
                    onPress={handleDestinationSelect}
                    query={{
                      key: GOOGLE_MAPS_APIKEY,
                      language: "fr",
                      components: "country:DJ"
                    }}
                    debounce={400}
                    listViewDisplayed={false}
                    keyboardShouldPersistTaps="always"
                    textInputProps={{
                      value: searchText,
                      onChangeText: setSearchText,
                      placeholderTextColor: isDarkMode ? "#6B7280" : "#9CA3AF",
                      onFocus: () => setIsSearchFocused(true),
                      onBlur: () => setIsSearchFocused(false),
                    }}
                    predefinedPlaces={[]}
                    ListViewProps={{ 
                      showsVerticalScrollIndicator: true,
                      keyboardShouldPersistTaps: "always"
                    }}
                    styles={{
                      container: styles.destinationSearchContainer,
                      textInput: styles.destinationSearchInput,
                      listView: { ...styles.autocompleteListView, position: "absolute", top: 52, left: 0, right: 0 },
                    }}
                    enablePoweredByContainer={false}
                    minLength={2}
                    onFail={(error) => {
                      console.log('GooglePlacesAutocomplete Error:', error);
                      setSearchText('');
                    }}
                    onNotFound={() => {
                      console.log('No results found');
                      setSearchText('');
                    }}
                    enableHighAccuracyLocation={true}
                    returnKeyType={'search'}
                    textInputHide={false}
                    nearbyPlacesAPI="GooglePlacesSearch"
                    GooglePlacesDetailsQuery={{
                      fields: "geometry,formatted_address"
                    }}
                    filterReverseGeocodingByTypes={['locality', 'administrative_area_level_3']}
                  />
                </View>
                <View style={{ flexDirection: 'row' }}>
                  <TouchableOpacity style={styles.goButton} onPress={handleGoPress} disabled={loading || !searchText.trim()}>
                    <LinearGradient colors={["#FF9500", "#FF6F00"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.goButtonGradient}>
                      <Text style={styles.goButtonText}>Go</Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Add selection mode indicator */}
              {selectionMode && (
                <View style={[styles.selectedAddressContainer, { backgroundColor: '#FF6F00' }]}>
                  <Text style={[styles.selectedAddressText, { color: '#fff' }]}>
                    {selectionMode === 'pickup' ? 'Sélectionnez le point de départ sur la carte' : 'Sélectionnez la destination sur la carte'}
                  </Text>
                  <TouchableOpacity 
                    style={{ marginLeft: 8 }} 
                    onPress={() => setSelectionMode(null)}
                  >
                    <Ionicons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}

              {recentSearches.length > 0 && (
                <View style={styles.recentSearchesContainer}>
                  <Text style={styles.recentSearchesTitle}>Recherches récentes</Text>
                  {recentSearches.map((search, index) => (
                    <TouchableOpacity key={index} style={styles.recentSearchItem} onPress={() => handleRecentSearchPress(search)}>
                      <Ionicons name="time-outline" size={18} color={isDarkMode ? "#6B7280" : "#9CA3AF"} style={{ marginRight: 8 }} />
                      <Text style={styles.recentSearchText}>{search}</Text>
                      <Ionicons name="arrow-forward" size={16} color={isDarkMode ? "#6B7280" : "#9CA3AF"} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {loading && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FF6F00" />
                  <Text style={styles.loadingText}>Chargement...</Text>
                </View>
              )}

              {nearbyPlaces.length > 0 && (
                <FlatList
                  data={nearbyPlaces}
                  keyExtractor={(item, index) => `nearby-${index}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.placeItem}
                      onPress={() => {
                        if (googlePlacesRef.current) {
                          googlePlacesRef.current.setAddressText(item.name);
                          setSearchText(item.name);
                        }
                      }}
                    >
                      <Ionicons name="location-outline" size={20} color={isDarkMode ? "#6B7280" : "#9CA3AF"} />
                      <Text style={styles.placeName}>{item.name}</Text>
                    </TouchableOpacity>
                  )}
                  style={{ marginTop: 10 }}
                  scrollEnabled={true}
                  maxHeight={150}
                />
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
};

export default HomeScreenWithMap;