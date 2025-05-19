import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  TextInput,
  Alert,
  ActivityIndicator,
  Modal
} from 'react-native';
import { Card } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { auth, db } from '../firebaseConfig';
import { 
  collection, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';

const COLORS = {
  primary: "#006400", // Dark green
  secondary: "#FFD700", // Gold/Yellow
  background: "#F5F5F5",
  cardBackground: "#FFFFFF",
  text: "#333333",
  textLight: "#666666",
  accent: "#008000", // Medium green
  border: "#E0E0E0",
  success: "#4CAF50",
  warning: "#FFC107",
  error: "#F44336",
  info: "#2196F3",
}

const RoomsScreen = () => {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [roomName, setRoomName] = useState('');
  const [roomCapacity, setRoomCapacity] = useState('');
  const [roomType, setRoomType] = useState('Lecture');
  
  useEffect(() => {
    fetchRooms();
  }, []);
  
  const fetchRooms = async () => {
    try {
      setLoading(true);
      
      const roomsRef = collection(db, "rooms");
      const roomsSnapshot = await getDocs(roomsRef);
      
      const roomsData = [];
      roomsSnapshot.forEach(doc => {
        roomsData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setRooms(roomsData);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      Alert.alert("Error", "Failed to load rooms. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const openAddModal = () => {
    setEditingRoom(null);
    setRoomName('');
    setRoomCapacity('');
    setRoomType('Lecture');
    setModalVisible(true);
  };
  
  const openEditModal = (room) => {
    setEditingRoom(room);
    setRoomName(room.name);
    setRoomCapacity(room.capacity.toString());
    setRoomType(room.type || 'Lecture');
    setModalVisible(true);
  };
  
  const handleSaveRoom = async () => {
    try {
      if (!roomName || !roomCapacity) {
        Alert.alert("Error", "Please fill in all fields.");
        return;
      }
      
      const capacity = parseInt(roomCapacity);
      if (isNaN(capacity) || capacity <= 0) {
        Alert.alert("Error", "Capacity must be a positive number.");
        return;
      }
      
      if (editingRoom) {
        // Update existing room
        await updateDoc(doc(db, "rooms", editingRoom.id), {
          name: roomName,
          capacity,
          type: roomType,
          updated_at: serverTimestamp()
        });
        
        Alert.alert("Success", "Room updated successfully.");
      } else {
        // Add new room
        await addDoc(collection(db, "rooms"), {
          name: roomName,
          capacity,
          type: roomType,
          created_at: serverTimestamp()
        });
        
        Alert.alert("Success", "Room added successfully.");
      }
      
      setModalVisible(false);
      fetchRooms();
    } catch (error) {
      console.error("Error saving room:", error);
      Alert.alert("Error", "Failed to save room. Please try again.");
    }
  };
  
  const handleDeleteRoom = async (roomId) => {
    try {
      Alert.alert(
        "Confirm Delete",
        "Are you sure you want to delete this room? This action cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Delete", 
            style: "destructive",
            onPress: async () => {
              await deleteDoc(doc(db, "rooms", roomId));
              Alert.alert("Success", "Room deleted successfully.");
              fetchRooms();
            }
          }
        ]
      );
    } catch (error) {
      console.error("Error deleting room:", error);
      Alert.alert("Error", "Failed to delete room. Please try again.");
    }
  };
  
  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Rooms Management</Text>
        <Text style={styles.headerSubtitle}>Manage classrooms and lecture halls</Text>
      </View>
      
      <ScrollView style={styles.content}>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{rooms.length}</Text>
            <Text style={styles.statLabel}>Total Rooms</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {rooms.reduce((sum, room) => sum + room.capacity, 0)}
            </Text>
            <Text style={styles.statLabel}>Total Capacity</Text>
          </View>
          
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {Math.round(rooms.reduce((sum, room) => sum + room.capacity, 0) / (rooms.length || 1))}
            </Text>
            <Text style={styles.statLabel}>Avg. Capacity</Text>
          </View>
        </View>
        
        <View style={styles.roomsHeader}>
          <Text style={styles.sectionTitle}>All Rooms</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={openAddModal}
          >
            <Ionicons name="add" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
        
        {rooms.map(room => (
          <Card key={room.id} style={styles.roomCard}>
            <Card.Content>
              <View style={styles.roomRow}>
                <View>
                  <Text style={styles.roomName}>{room.name}</Text>
                  <Text style={styles.roomType}>{room.type || 'Lecture'}</Text>
                  <View style={styles.capacityBadge}>
                    <Text style={styles.capacityText}>Capacity: {room.capacity}</Text>
                  </View>
                </View>
                
                <View style={styles.roomActions}>
                  <TouchableOpacity 
                    style={styles.roomAction}
                    onPress={() => openEditModal(room)}
                  >
                    <Ionicons name="create-outline" size={20} color="#0066cc" />
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.roomAction}
                    onPress={() => handleDeleteRoom(room.id)}
                  >
                    <Ionicons name="trash-outline" size={20} color="#ff3b30" />
                  </TouchableOpacity>
                </View>
              </View>
            </Card.Content>
          </Card>
        ))}
        
        {rooms.length === 0 && (
          <Text style={styles.emptyText}>No rooms found. Add a room to get started.</Text>
        )}
      </ScrollView>
      
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingRoom ? 'Edit Room' : 'Add New Room'}
            </Text>
            
            <Text style={styles.inputLabel}>Room Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter room name"
              value={roomName}
              onChangeText={setRoomName}
            />
            
            <Text style={styles.inputLabel}>Capacity</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter room capacity"
              value={roomCapacity}
              onChangeText={setRoomCapacity}
              keyboardType="number-pad"
            />
            
            <Text style={styles.inputLabel}>Room Type</Text>
            <View style={styles.roomTypeButtons}>
              {['Lecture', 'Lab', 'Tutorial'].map(type => (
                <TouchableOpacity 
                  key={type}
                  style={[
                    styles.roomTypeButton,
                    roomType === type && styles.roomTypeButtonActive
                  ]}
                  onPress={() => setRoomType(type)}
                >
                  <Text 
                    style={[
                      styles.roomTypeButtonText,
                      roomType === type && styles.roomTypeButtonTextActive
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSaveRoom}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.background,
  },
  header: {
    padding: 16,
    backgroundColor: COLORS.primary,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.secondary,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#FFFFFF",
    marginTop: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 8,
    padding: 16,
    flex: 1,
    marginHorizontal: 4,
    alignItems: "center",
    elevation: 2,
    borderTopWidth: 3,
    borderTopColor: COLORS.primary,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  roomsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  addButton: {
    backgroundColor: COLORS.primary,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.secondary,
  },
  roomCard: {
    marginBottom: 12,
    elevation: 2,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  roomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roomName: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
  },
  roomType: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 2,
  },
  capacityBadge: {
    backgroundColor: "#e6ffe6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  capacityText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "500",
  },
  roomActions: {
    flexDirection: "row",
  },
  roomAction: {
    padding: 8,
    marginLeft: 8,
  },
  emptyText: {
    textAlign: "center",
    color: COLORS.textLight,
    marginVertical: 24,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 8,
    padding: 24,
    width: "80%",
    maxWidth: 400,
    borderTopWidth: 4,
    borderTopColor: COLORS.primary,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 16,
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  roomTypeButtons: {
    flexDirection: "row",
    marginBottom: 24,
  },
  roomTypeButton: {
    flex: 1,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    marginHorizontal: 4,
  },
  roomTypeButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roomTypeButtonText: {
    color: COLORS.text,
  },
  roomTypeButtonTextActive: {
    color: COLORS.secondary,
    fontWeight: "bold",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
    marginTop: 8,
  },
  modalButton: {
    padding: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
    marginLeft: 8,
  },
  cancelButton: {
    backgroundColor: "#f5f5f5",
  },
  cancelButtonText: {
    color: COLORS.text,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    color: COLORS.secondary,
    fontWeight: "bold",
  },
})

export default RoomsScreen;
