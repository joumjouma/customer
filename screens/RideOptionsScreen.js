import React, { useRef, useState, useLayoutEffect, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Modal,
  Alert,
} from "react-native";
import MapView, { Marker } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { useRoute, useNavigation } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { GOOGLE_MAPS_APIKEY } from "@env";
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit, getDoc, doc } from "firebase/firestore";
import { firestore } from "../firebase.config";
import { getAuth } from "firebase/auth";

// Your custom pin and Caval Moto icon
import CustomPin from "../assets/CustomPin.png";
import CavalMotoIcon from "../assets/clipart1667936.png";

const RideOptionsScreen = () => {
  const route = useRoute();
  const navigation = useNavigation();

  // Hide default navigation header
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Retrieve origin and destination (including addresses) from HomeScreenWithMap
  const { origin, destination, customerFirstName, customerPhoto, customerPhone } = route.params || {};

  // Reference for MapView
  const mapRef = useRef(null);

  // State to store route coordinates (for recentering)
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  // Fallback initial region
  const initialRegion = {
    latitude: origin && destination 
      ? (origin.latitude + destination.latitude) / 2 
      : (origin?.latitude || 37.7749),
    longitude: origin && destination 
      ? (origin.longitude + destination.longitude) / 2 
      : (origin?.longitude || -122.4194),
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // States for distance, duration, and fares
  const [distance, setDistance] = useState(0); // km
  const [duration, setDuration] = useState(0); // minutes
  const [cavalPriveFare, setCavalPriveFare] = useState(0);
  const [cavalMotoFare, setCavalMotoFare] = useState(0);
  
  // Payment method states
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedRideType, setSelectedRideType] = useState(null);

  // Load payment methods on screen load
  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  // Format arrival time (e.g., "3:15 PM")
  const getFormattedArrivalTime = (extraMinutes) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + extraMinutes);
    let hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const paddedMinutes = minutes < 10 ? "0" + minutes : minutes;
    return `${hours}:${paddedMinutes} ${ampm}`;
  };

  // When directions are ready, update metrics and fares
  const handleDirectionsReady = (result) => {
    // Remove the fitToCoordinates call to prevent automatic zooming
    setRouteCoordinates(result.coordinates);
    setDistance(result.distance);
    setDuration(result.duration);
    
    // Calculate fares using the pricing structure
    const cavalPriveFare = calculateFare(result.distance, 'Caval Privé');
    const cavalMotoFare = calculateFare(result.distance, 'Caval moto');
    
    setCavalPriveFare(cavalPriveFare);
    setCavalMotoFare(cavalMotoFare);
    
    // Center the map on the route when directions are ready
    if (origin && destination) {
      const centerLat = (origin.latitude + destination.latitude) / 2;
      const centerLng = (origin.longitude + destination.longitude) / 2;
      
      mapRef.current?.animateToRegion({
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  };

  // Function to recenter the map on the route
  const recenterMap = () => {
    // Instead of using fitToCoordinates, just set the region directly
    if (origin && destination) {
      const centerLat = (origin.latitude + destination.latitude) / 2;
      const centerLng = (origin.longitude + destination.longitude) / 2;
      
      mapRef.current?.animateToRegion({
        latitude: centerLat,
        longitude: centerLng,
        latitudeDelta: 0.05, // Reduced from 0.1 to 0.05 for a more zoomed in view
        longitudeDelta: 0.05, // Reduced from 0.1 to 0.05 for a more zoomed in view
      }, 1000);
    }
  };

  // Create ride request in Firestore
  const createRideRequest = async (selectedRideType, selectedFare) => {
    const auth = getAuth();
    const currentUser = auth.currentUser;
    
    if (!currentUser) {
      Alert.alert("Erreur", "Vous devez être connecté pour créer une demande de course.");
      navigation.navigate("LoginScreen");
      return null;
    }
    
    const userId = currentUser.uid;
    try {
      // Get customer data from Firestore
      const customerDoc = await getDoc(doc(firestore, "Customers", userId));
      const customerData = customerDoc.exists() ? customerDoc.data() : null;

      // Create the main ride request document
      const rideRequestDoc = await addDoc(collection(firestore, "rideRequests"), {
        userId,
        pickupLat: origin.latitude,
        pickupLng: origin.longitude,
        destinationLat: destination.latitude,
        destinationLng: destination.longitude,
        rideType: selectedRideType,
        fare: selectedFare,
        distance,
        duration,
        status: "waiting",
        paymentMethod: selectedPaymentMethod ? selectedPaymentMethod.id : "",
        createdAt: serverTimestamp(),
        // Add driver fields with initial null values
        driverId: null,
        driverName: null,
        driverPhoto: null,
        driverPhone: null,
        assignedAt: null
      });

      // Create a document in rideRequestsDriver collection with customer information
      await addDoc(collection(firestore, "rideRequestsDriver"), {
        rideRequestId: rideRequestDoc.id,
        number: customerData?.number || null,
        photo: customerData?.photo || null,
        firstName: customerData?.firstName || "Client",
        createdAt: serverTimestamp()
      });

      return rideRequestDoc.id;
    } catch (error) {
      console.error("Erreur lors de la création de la demande de course :", error);
      return null;
    }
  };

  // Fetch payment methods from Firestore
  const fetchPaymentMethods = async () => {
    try {
      const auth = getAuth();
      const currentUser = auth.currentUser;
      
      if (currentUser) {
        const userId = currentUser.uid;
        const paymentMethodsQuery = query(
          collection(firestore, "paymentMethods"),
          where("userId", "==", userId),
          limit(10)
        );
        
        const querySnapshot = await getDocs(paymentMethodsQuery);
        const methods = [];
        
        querySnapshot.forEach((doc) => {
          methods.push({
            id: doc.id,
            ...doc.data(),
          });
        });
        
        setPaymentMethods(methods);
        
        // Set the default payment method if available
        if (methods.length > 0) {
          const defaultMethod = methods.find(method => method.isDefault) || methods[0];
          setSelectedPaymentMethod(defaultMethod);
        }
      }
    } catch (error) {
      console.error("Error fetching payment methods:", error);
    }
  };

  // Handle initial ride selection before confirming payment
  const handleRideSelection = (rideType) => {
    setSelectedRideType(rideType);
    setPaymentModalVisible(true);
  };

  // Complete the ride request after payment method selection
  const completeRideRequest = async () => {
    let selectedFare = 0;
    if (selectedRideType === "Caval Privé") {
      selectedFare = cavalPriveFare;
    } else if (selectedRideType === "Caval moto") {
      selectedFare = cavalMotoFare;
    }

    const rideRequestId = await createRideRequest(selectedRideType, selectedFare);
    if (rideRequestId) {
      setPaymentModalVisible(false);
      navigation.navigate("FindingDriverScreen", {
        rideType: selectedRideType,
        distance,
        duration,
        rideRequestId,
        origin: route.params.origin,
        destination: route.params.destination,
        paymentMethod: selectedPaymentMethod ? selectedPaymentMethod.type : "cash",
      });
    } else {
      alert("Erreur lors de la création de la demande. Veuillez réessayer.");
    }
  };

  // Render payment method item
  const renderPaymentMethod = (method, index) => {
    const isSelected = selectedPaymentMethod && selectedPaymentMethod.id === method.id;
    
    let icon = "cash";
    if (method.type === "card") {
      icon = "credit-card";
    } else if (method.type === "mobile") {
      icon = "phone";
    }
    
    return (
      <TouchableOpacity
        key={method.id || index}
        style={[
          styles.paymentMethodItem,
          isSelected && styles.selectedPaymentMethod
        ]}
        onPress={() => setSelectedPaymentMethod(method)}
      >
        <MaterialCommunityIcons name={icon} size={24} color="#FF6F00" />
        <Text style={styles.paymentMethodTitle}>
          {method.title || method.type}
        </Text>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={24} color="#FF6F00" />
        )}
      </TouchableOpacity>
    );
  };

  // Updated fare calculation function with the new pricing structure
  const calculateFare = (distance, rideType) => {
    const distanceInKm = distance; // Distance is already in kilometers
    let baseFare = 0;
    let additionalFare = 0;

    if (rideType === 'Caval Privé') {
      baseFare = 400; // Initial price for 3km or less
      if (distanceInKm > 3) {
        additionalFare = (distanceInKm - 3) * 75;
      }
    } else if (rideType === 'Caval moto') {
      baseFare = 150; // Initial price for 3km or less
      if (distanceInKm > 3) {
        additionalFare = (distanceInKm - 3) * 75;
      }
    }

    const totalFare = baseFare + additionalFare;
    // Round to the nearest 50
    return Math.round(totalFare / 50) * 50;
  };

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <View style={styles.backButtonContainer}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={28} color="#FF6F00" />
        </TouchableOpacity>
      </View>

      {/* Recenter Button */}
      <View style={styles.recenterButtonContainer}>
        <TouchableOpacity onPress={recenterMap}>
          <Ionicons name="locate" size={28} color="#FF6F00" />
        </TouchableOpacity>
      </View>

      {/* Map Section */}
      <MapView 
        ref={mapRef} 
        style={styles.map} 
        initialRegion={initialRegion}
        region={initialRegion} // Force the region to stay zoomed out
        mapPadding={{ top: 0, right: 0, bottom: 450, left: 0 }} // Increased from 350 to 450 to move the map up more
      >
        {origin && (
          <Marker coordinate={origin} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.markerContainer}>
              <Image source={CustomPin} style={styles.pin} resizeMode="contain" />
              <Text style={styles.markerLabel} numberOfLines={1} ellipsizeMode="tail">
                {origin.address ? origin.address : "Origine"}
              </Text>
            </View>
          </Marker>
        )}
        {destination && (
          <Marker coordinate={destination} anchor={{ x: 0.5, y: 1 }}>
            <View style={styles.markerContainer}>
              <Image source={CustomPin} style={styles.pin} resizeMode="contain" />
              <Text style={styles.markerLabel} numberOfLines={1} ellipsizeMode="tail">
                {destination.address ? destination.address : "Destination"}
              </Text>
            </View>
          </Marker>
        )}
        {origin && destination && (
          <MapViewDirections
            origin={origin}
            destination={destination}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={4}
            strokeColor="#FF6F00"
            onReady={handleDirectionsReady}
          />
        )}
      </MapView>

      {/* Ride Options Panel */}
      <View style={styles.bottomSheet}>
        <Text style={styles.headerText}>Choisissez votre trajet</Text>

        {/* Route Summary */}
        <View style={styles.routeSummaryContainer}>
          <View style={styles.routePoint}>
            <View style={styles.routeDot} />
            <Text style={styles.routeText} numberOfLines={1}>
              {origin?.address || "Point de départ"}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.routeDot, styles.routeDotDestination]} />
            <Text style={styles.routeText} numberOfLines={1}>
              {destination?.address || "Destination"}
            </Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Ride Option Components */}
        <RideOption
          rideType="Caval Privé"
          iconName="car"
          arrivalTime={getFormattedArrivalTime(duration)}
          distance={distance.toFixed(1)}
          fare={cavalPriveFare}
          onSelect={() => handleRideSelection("Caval Privé")}
        />

        <RideOption
          rideType="Caval moto"
          iconName="motorbike"
          arrivalTime={getFormattedArrivalTime(duration)}
          distance={distance.toFixed(1)}
          fare={cavalMotoFare}
          onSelect={() => handleRideSelection("Caval moto")}
          useMotoImage
          maxPeople={1}
        />

        {/* New Button to navigate to PaymentMethodsScreen */}
        <TouchableOpacity
          style={styles.paymentMethodsButton}
          onPress={() => navigation.navigate("PaymentMethodsScreen")}
        >
          <Ionicons name="card" size={24} color="#FF6F00" />
          <Text style={styles.paymentMethodsButtonText}>Gérer les moyens de paiement</Text>
        </TouchableOpacity>
      </View>

      {/* Payment Method Modal */}
      <Modal
        visible={paymentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisissez votre méthode de paiement</Text>
              <TouchableOpacity
                onPress={() => setPaymentModalVisible(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#FF6F00" />
              </TouchableOpacity>
            </View>

            <View style={styles.paymentMethodsList}>
              {/* Cash option is always available */}
              {renderPaymentMethod(
                { id: "cash", type: "cash", title: "Cash" },
                "cash"
              )}
              
              {/* User's saved payment methods (excluding any duplicate "cash" method) */}
              {paymentMethods
                .filter(method => method.type !== "cash")
                .map((method, index) => renderPaymentMethod(method, index))}
              
              {/* Add payment method button */}
              <TouchableOpacity
                style={styles.addPaymentButton}
                onPress={() => {
                  setPaymentModalVisible(false);
                  navigation.navigate("PaymentMethodsScreen");
                }}
              >
                <Ionicons name="add-circle-outline" size={24} color="#FF6F00" />
                <Text style={styles.addPaymentText}>Ajouter un moyen de paiement</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.confirmButton}
              onPress={completeRideRequest}
            >
              <Text style={styles.confirmButtonText}>Confirmer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

/** 
 * RideOption Component with Hold-to-Confirm and Charging Animation 
 */
const RideOption = ({
  rideType,
  iconName,
  arrivalTime,
  distance,
  fare,
  onSelect,
  useMotoImage,
  maxPeople,
}) => {
  const [pressing, setPressing] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const startPress = () => {
    setPressing(true);
    // Animate progress from 0 to 1 over 1 second
    Animated.timing(progress, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: false,
    }).start();
    timerRef.current = setTimeout(() => {
      onSelect();
      resetPress();
    }, 1000);
  };

  const resetPress = () => {
    clearTimeout(timerRef.current);
    Animated.timing(progress, {
      toValue: 0,
      duration: 100,
      useNativeDriver: false,
    }).start();
    setPressing(false);
  };

  const onPressOut = () => {
    if (pressing) {
      resetPress();
    }
  };

  return (
    <TouchableOpacity
      style={styles.rideOption}
      onPressIn={startPress}
      onPressOut={onPressOut}
    >
      {useMotoImage ? (
        <Image source={CavalMotoIcon} style={styles.motoIcon} resizeMode="contain" />
      ) : (
        <Ionicons name={iconName} size={32} color="#FF6F00" style={styles.icon} />
      )}
      <View style={styles.infoContainer}>
        <Text style={styles.rideTitle}>{rideType}</Text>
        <Text style={styles.rideSubtitle}>
          Arrivée vers {arrivalTime} • {distance} km
        </Text>
        {maxPeople && (
          <View style={styles.maxPeopleContainer}>
            <Ionicons name="people-outline" size={14} color="#FF6F00" />
            <Text style={styles.maxPeopleText}>Maximum {maxPeople} passagers</Text>
          </View>
        )}
        <View style={styles.longPressHint}>
          <Ionicons name="finger-print" size={14} color="#FF6F00" />
          <Text style={styles.longPressText}>Appuyez longuement pour sélectionner</Text>
        </View>
      </View>
      <Text style={styles.price}>{Math.round(fare)} Fdj</Text>
      {pressing && (
        <View style={styles.progressContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"],
                }),
              },
            ]}
          />
        </View>
      )}
    </TouchableOpacity>
  );
};

export default RideOptionsScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212",
  },
  backButtonContainer: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 100,
    backgroundColor: "#1E1E1E",
    borderRadius: 25,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  recenterButtonContainer: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 100,
    backgroundColor: "#1E1E1E",
    borderRadius: 25,
    padding: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  map: {
    flex: 1,
  },
  markerContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30,30,30,0.8)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  pin: {
    width: 25,
    height: 25,
    marginRight: 6,
  },
  markerLabel: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    maxWidth: 100,
  },
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingVertical: 25,
    paddingHorizontal: 20,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  headerText: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 15,
    textAlign: "center",
  },
  rideOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 15,
    paddingVertical: 18,
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  icon: {
    marginRight: 16,
  },
  motoIcon: {
    width: 36,
    height: 36,
    marginRight: 16,
    tintColor: "#FF6F00",
  },
  infoContainer: {
    flex: 1,
  },
  rideTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
    marginBottom: 3,
  },
  rideSubtitle: {
    fontSize: 14,
    color: "#b3b3b3",
  },
  price: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FF6F00",
    marginLeft: 10,
  },
  progressContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: "#333",
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#FF6F00",
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalContent: {
    backgroundColor: "#1E1E1E",
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    paddingVertical: 30,
    paddingHorizontal: 20,
    maxHeight: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  closeButton: {
    padding: 5,
  },
  paymentMethodsList: {
    marginBottom: 20,
  },
  paymentMethodItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginBottom: 10,
  },
  selectedPaymentMethod: {
    borderColor: "#FF6F00",
    borderWidth: 2,
  },
  paymentMethodInfo: {
    flex: 1,
    marginLeft: 15,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
    marginLeft: 15,
  },
  paymentMethodSubtitle: {
    fontSize: 13,
    color: "#b3b3b3",
    marginTop: 2,
  },
  addPaymentButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2C2C2C",
    borderRadius: 15,
    borderStyle: "dashed",
    borderWidth: 1,
    borderColor: "#FF6F00",
    paddingVertical: 15,
    paddingHorizontal: 15,
    marginTop: 5,
  },
  addPaymentText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FF6F00",
    marginLeft: 10,
  },
  confirmButton: {
    backgroundColor: "#FF6F00",
    borderRadius: 15,
    paddingVertical: 15,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  // New Payment Methods Button Styles
  paymentMethodsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderColor: "#FF6F00",
    borderWidth: 1,
    borderRadius: 15,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginTop: 10,
  },
  paymentMethodsButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FF6F00",
    marginLeft: 8,
  },
  maxPeopleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    backgroundColor: 'rgba(255, 111, 0, 0.1)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  maxPeopleText: {
    fontSize: 12,
    color: '#FF6F00',
    marginLeft: 4,
    fontWeight: '500',
  },
  routeSummaryContainer: {
    backgroundColor: 'rgba(255, 111, 0, 0.05)',
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FF6F00',
    marginRight: 12,
  },
  routeDotDestination: {
    backgroundColor: '#FF6F00',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#FF6F00',
    marginLeft: 4,
    marginVertical: 4,
  },
  routeText: {
    fontSize: 14,
    color: '#FF6F00',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 111, 0, 0.1)',
    marginVertical: 15,
  },
  longPressHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: 'rgba(255, 111, 0, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  longPressText: {
    fontSize: 12,
    color: '#FF6F00',
    marginLeft: 4,
    fontWeight: '500',
  },
});